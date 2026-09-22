package com.oldes.rentacar.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.net.http.SslError
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.view.View
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.GeolocationPermissions
import android.webkit.SslErrorHandler
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private lateinit var swipeRefresh: SwipeRefreshLayout

    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var monitorEnabled = false
    private var pendingOpenPath: String? = null

    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (!granted) {
                Toast.makeText(
                    this,
                    getString(R.string.notification_permission_denied),
                    Toast.LENGTH_LONG,
                ).show()
            }
        }

    private val fileChooserLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val callback = filePathCallback ?: return@registerForActivityResult
            filePathCallback = null
            val uris = WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
            callback.onReceiveValue(uris)
        }

    companion object {
        const val EXTRA_OPEN_PATH = "open_path"
        const val EXTRA_ALERT_ID = "alert_id"
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        NotificationHelper.ensureChannels(this)
        requestNotificationPermissionIfNeeded()

        webView = findViewById(R.id.webView)
        progressBar = findViewById(R.id.progressBar)
        swipeRefresh = findViewById(R.id.swipeRefresh)

        pendingOpenPath = intent?.getStringExtra(EXTRA_OPEN_PATH)

        configureWebView()
        configureSwipeRefresh()
        configureBackNavigation()

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            val start = pendingOpenPath?.let { path ->
                OldesConfig.START_URL.replace("/login", "") + path
            } ?: OldesConfig.START_URL
            webView.loadUrl(start)
        }
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        if (ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS,
            ) == PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            loadsImagesAutomatically = true
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            cacheMode = WebSettings.LOAD_DEFAULT
            userAgentString = "${WebSettings.getDefaultUserAgent(this@MainActivity)} OLDES-Android/1.1"
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false
            useWideViewPort = true
            loadWithOverviewMode = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = true
            allowContentAccess = true
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                safeBrowsingEnabled = true
            }
        }

        webView.setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            try {
                val request = DownloadManager.Request(Uri.parse(url)).apply {
                    addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url) ?: "")
                    addRequestHeader("User-Agent", userAgent)
                    setMimeType(mimeType)
                    setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    setTitle(contentDisposition?.substringAfter("filename=")?.trim('"') ?: "OLDES")
                    setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "OLDES_${System.currentTimeMillis()}")
                }
                (getSystemService(DOWNLOAD_SERVICE) as DownloadManager).enqueue(request)
                Toast.makeText(this, getString(R.string.download_started), Toast.LENGTH_SHORT).show()
            } catch (_: Exception) {
                openExternal(Uri.parse(url))
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?,
            ): Boolean {
                val uri = request?.url ?: return false
                return handleNavigation(uri)
            }

            @Deprecated("Deprecated in Java")
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                if (url.isNullOrBlank()) return false
                return handleNavigation(Uri.parse(url))
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                progressBar.visibility = View.VISIBLE
                progressBar.progress = 0
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                progressBar.visibility = View.GONE
                swipeRefresh.isRefreshing = false
                evaluateMonitorState(url)
            }

            override fun onReceivedSslError(
                view: WebView?,
                handler: SslErrorHandler?,
                error: SslError?,
            ) {
                handler?.cancel()
                swipeRefresh.isRefreshing = false
                progressBar.visibility = View.GONE
                AlertDialog.Builder(this@MainActivity)
                    .setTitle(R.string.ssl_error_title)
                    .setMessage(R.string.ssl_error_message)
                    .setPositiveButton(R.string.ssl_error_ok, null)
                    .show()
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progressBar.progress = newProgress
                progressBar.visibility = if (newProgress in 1..99) View.VISIBLE else View.GONE
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?,
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback
                val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"
                }
                return try {
                    fileChooserLauncher.launch(intent)
                    true
                } catch (_: ActivityNotFoundException) {
                    this@MainActivity.filePathCallback = null
                    false
                }
            }

            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: GeolocationPermissions.Callback?,
            ) {
                callback?.invoke(origin, true, false)
            }
        }
    }

    private fun evaluateMonitorState(url: String?) {
        val path = url?.substringAfter("://")?.substringAfter("/") ?: return
        val loggedIn = path.startsWith("dashboard")
        if (loggedIn && !monitorEnabled) {
            monitorEnabled = true
            AlertMonitorService.start(this)
            WorkManager.getInstance(this).enqueue(
                OneTimeWorkRequestBuilder<AlertPollWorker>().build(),
            )
        } else if (!loggedIn && path.contains("login") && monitorEnabled) {
            monitorEnabled = false
            AlertMonitorService.stop(this)
            AlertNotifier.clearKnown(this)
        }
    }

    private fun handleNavigation(uri: Uri): Boolean {
        val scheme = (uri.scheme ?: "").lowercase()
        val host = (uri.host ?: "").lowercase()

        if (scheme == "tel" || scheme == "mailto" || scheme == "sms" ||
            scheme == "whatsapp" || scheme == "intent" ||
            host == "wa.me" || host.endsWith(".whatsapp.com")
        ) {
            openExternal(uri)
            return true
        }

        if (scheme != "http" && scheme != "https") {
            openExternal(uri)
            return true
        }

        if (isAllowedHost(host)) {
            return false
        }

        openExternal(uri)
        return true
    }

    private fun isAllowedHost(host: String): Boolean {
        if (host.isBlank()) return false
        return OldesConfig.ALLOWED_HOSTS.any { allowed ->
            host == allowed || host.endsWith(".$allowed")
        }
    }

    private fun openExternal(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (_: ActivityNotFoundException) {
            // No handler available.
        }
    }

    private fun configureSwipeRefresh() {
        swipeRefresh.setColorSchemeResources(R.color.accent_red, R.color.navy_secondary)
        swipeRefresh.setOnRefreshListener { webView.reload() }
    }

    private fun configureBackNavigation() {
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    if (webView.canGoBack()) {
                        webView.goBack()
                    } else {
                        finish()
                    }
                }
            },
        )
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onPause() {
        webView.onPause()
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        if (monitorEnabled) {
            WorkManager.getInstance(this).enqueue(
                OneTimeWorkRequestBuilder<AlertPollWorker>().build(),
            )
        }
    }

    override fun onStop() {
        super.onStop()
        if (monitorEnabled) {
            AlertMonitorService.start(this)
        }
    }

    override fun onDestroy() {
        if (isFinishing) {
            AlertMonitorService.stop(this)
        }
        webView.destroy()
        super.onDestroy()
    }
}

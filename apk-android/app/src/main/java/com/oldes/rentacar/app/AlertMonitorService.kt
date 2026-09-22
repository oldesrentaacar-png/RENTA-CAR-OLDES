package com.oldes.rentacar.app

import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import java.util.concurrent.Executors

/**
 * Foreground service: polls alerts while the app is in background so notifications
 * arrive even with the screen locked (Android allows foreground services).
 */
class AlertMonitorService : Service() {
    private val executor = Executors.newSingleThreadExecutor()
    private val handler = Handler(Looper.getMainLooper())
    private val pollRunnable = object : Runnable {
        override fun run() {
            executor.execute {
                try {
                    val result = AlertApiClient.pollAlerts(OldesConfig.START_URL)
                    AlertNotifier.processPollResult(this@AlertMonitorService, result)
                } catch (_: Exception) {
                    // Ignore transient network errors; next poll will retry.
                }
            }
            handler.postDelayed(this, OldesConfig.MONITOR_POLL_INTERVAL_MS)
        }
    }

    override fun onCreate() {
        super.onCreate()
        NotificationHelper.ensureChannels(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(
            NOTIFICATION_ID,
            NotificationHelper.buildMonitorNotification(this),
        )
        handler.removeCallbacks(pollRunnable)
        handler.post(pollRunnable)
        return START_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacks(pollRunnable)
        executor.shutdownNow()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        private const val NOTIFICATION_ID = 1001

        fun start(context: Context) {
            val intent = Intent(context, AlertMonitorService::class.java)
            context.startForegroundService(intent)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, AlertMonitorService::class.java))
        }
    }
}

package com.oldes.rentacar.app

import android.webkit.CookieManager
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class AlertSummary(
    val id: String,
    val title: String,
    val message: String,
    val severity: String,
)

data class AlertPollResult(
    val total: Int,
    val alerts: List<AlertSummary>,
    val authenticated: Boolean,
)

object AlertApiClient {
    fun pollAlerts(baseUrl: String): AlertPollResult {
        val apiUrl = baseUrl.trimEnd('/') + "/api/mobile/alerts/summary"
        val cookie = CookieManager.getInstance().getCookie(baseUrl)
            ?: CookieManager.getInstance().getCookie(OldesConfig.START_URL)
            ?: ""

        if (cookie.isBlank()) {
            return AlertPollResult(0, emptyList(), authenticated = false)
        }

        val connection = (URL(apiUrl).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 20_000
            readTimeout = 20_000
            setRequestProperty("Cookie", cookie)
            setRequestProperty("Accept", "application/json")
            setRequestProperty("User-Agent", "OLDES-Android/1.1")
        }

        return try {
            when (connection.responseCode) {
                HttpURLConnection.HTTP_UNAUTHORIZED,
                HttpURLConnection.HTTP_FORBIDDEN,
                -> AlertPollResult(0, emptyList(), authenticated = false)

                !in 200..299 -> AlertPollResult(0, emptyList(), authenticated = true)

                else -> {
                    val body = connection.inputStream.bufferedReader().use { it.readText() }
                    parseResponse(body)
                }
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun parseResponse(body: String): AlertPollResult {
        val json = JSONObject(body)
        val total = json.optInt("total", 0)
        val alertsJson = json.optJSONArray("alerts") ?: JSONArray()
        val alerts = buildList {
            for (i in 0 until alertsJson.length()) {
                val item = alertsJson.getJSONObject(i)
                add(
                    AlertSummary(
                        id = item.optString("id"),
                        title = item.optString("title"),
                        message = item.optString("message"),
                        severity = item.optString("severity", "warning"),
                    ),
                )
            }
        }
        return AlertPollResult(total, alerts, authenticated = true)
    }
}

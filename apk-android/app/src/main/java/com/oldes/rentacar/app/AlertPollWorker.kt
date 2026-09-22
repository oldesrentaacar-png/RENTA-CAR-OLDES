package com.oldes.rentacar.app

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters

class AlertPollWorker(
    appContext: Context,
    params: WorkerParameters,
) : Worker(appContext, params) {

    override fun doWork(): Result {
        return try {
            val result = AlertApiClient.pollAlerts(OldesConfig.START_URL)
            AlertNotifier.processPollResult(applicationContext, result)
            Result.success()
        } catch (_: Exception) {
            Result.retry()
        }
    }

    companion object {
        const val UNIQUE_WORK_NAME = "oldes_alert_poll"
        const val WORK_TAG = "oldes_alert_poll_tag"
    }
}

package com.oldes.rentacar.app

import android.app.Application
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

class OldesApp : Application() {
    override fun onCreate() {
        super.onCreate()
        scheduleBackgroundAlertPolling()
    }

    private fun scheduleBackgroundAlertPolling() {
        val request = PeriodicWorkRequestBuilder<AlertPollWorker>(15, TimeUnit.MINUTES)
            .addTag(AlertPollWorker.WORK_TAG)
            .build()

        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            AlertPollWorker.UNIQUE_WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            request,
        )
    }
}

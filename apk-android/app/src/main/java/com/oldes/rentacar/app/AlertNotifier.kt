package com.oldes.rentacar.app

import android.content.Context

/**
 * Compares polled alerts with the last snapshot and posts native notifications.
 */
object AlertNotifier {
    private const val PREFS = "oldes_alert_notifier"
    private const val KEY_KNOWN_IDS = "known_alert_ids"
    private const val KEY_LAST_TOTAL = "last_total"

    fun processPollResult(context: Context, result: AlertPollResult) {
        if (!result.authenticated || result.alerts.isEmpty()) {
            if (!result.authenticated) {
                clearKnown(context)
            }
            return
        }

        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val known = prefs.getStringSet(KEY_KNOWN_IDS, emptySet())?.toMutableSet()
            ?: mutableSetOf()

        val isFirstSnapshot = known.isEmpty()
        val currentIds = result.alerts.map { it.id }.toSet()

        if (isFirstSnapshot) {
            prefs.edit()
                .putStringSet(KEY_KNOWN_IDS, currentIds)
                .putInt(KEY_LAST_TOTAL, result.total)
                .apply()
            return
        }

        val newAlerts = result.alerts.filter { it.id !in known }
        newAlerts.forEachIndexed { index, alert ->
            val body = alert.message.ifBlank { "Tiene ${result.total} alerta(s) pendiente(s)." }
            NotificationHelper.showAlertNotification(
                context = context,
                notificationId = alert.id.hashCode(),
                title = alert.title.ifBlank { "OLDES — Alerta" },
                body = body,
                alertId = alert.id,
            )
        }

        prefs.edit()
            .putStringSet(KEY_KNOWN_IDS, currentIds)
            .putInt(KEY_LAST_TOTAL, result.total)
            .apply()
    }

    fun clearKnown(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .remove(KEY_KNOWN_IDS)
            .remove(KEY_LAST_TOTAL)
            .apply()
    }
}

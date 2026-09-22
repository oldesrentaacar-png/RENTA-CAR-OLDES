package com.oldes.rentacar.app

object OldesConfig {
    const val START_URL = "https://oldescarrentalelsalvador.com/login"

    val ALLOWED_HOSTS = setOf(
        "oldescarrentalelsalvador.com",
        "oldesrentacar.com",
        "app.oldesrentacar.com",
        "renta-car-oldes.vercel.app",
    )

    /** Poll every 3 minutes while monitor service runs (app in background). */
    const val MONITOR_POLL_INTERVAL_MS = 3 * 60 * 1000L
}

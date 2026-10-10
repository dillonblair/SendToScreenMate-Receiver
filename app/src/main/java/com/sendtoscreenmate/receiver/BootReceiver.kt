package com.sendtoscreenmate.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Restarts the receiver when the screen powers on (full boot, quick boot, or app update). */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (!Settings(context).enabled) return
        // Some vendor "quick boot" broadcasts are not exempt from Android's background-start
        // limits; the overlay permission usually exempts us, and the app can be opened manually.
        runCatching { ReceiverService.start(context, reconnect = true) }
    }
}

package com.sendtoscreenmate.receiver

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.ConnectivityManager
import android.net.Network
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Keeps a long-lived subscription to the paired ntfy topic and opens incoming links.
 *
 * On every (re)connect it first polls for messages that arrived while the screen was
 * off: only the newest one that is younger than the configured max age is opened, the
 * rest are listed as "missed". Then it streams live messages.
 */
class ReceiverService : Service() {
    private lateinit var settings: Settings
    @Volatile private var running = false
    private var worker: Thread? = null
    @Volatile private var activeCall: okhttp3.Call? = null
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(90, TimeUnit.SECONDS) // ntfy sends a keepalive roughly every 45 s
        .build()

    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            // A new network usually means the old socket is dead: reconnect right away.
            activeCall?.cancel()
            worker?.interrupt()
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        settings = Settings(this)
        createChannels(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }
        ServiceCompat.startForeground(
            this, NOTIF_SERVICE, serviceNotification("Starting…"),
            if (Build.VERSION.SDK_INT >= 34) ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0,
        )
        if (intent?.action == ACTION_RECONNECT) {
            activeCall?.cancel()
            worker?.interrupt()
        }
        if (!running) {
            running = true
            getSystemService(ConnectivityManager::class.java).registerDefaultNetworkCallback(networkCallback)
            worker = Thread(::loop, "ntfy-subscriber").also { it.start() }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        running = false
        activeCall?.cancel()
        worker?.interrupt()
        runCatching { getSystemService(ConnectivityManager::class.java).unregisterNetworkCallback(networkCallback) }
        status("Stopped")
        super.onDestroy()
    }

    private fun loop() {
        var backoffMs = 1_000L
        while (running) {
            val pairing = settings.pairing
            try {
                status("Connecting to ${pairing.baseUrl}…")
                catchUp(pairing)
                stream(pairing)
                backoffMs = 1_000L
            } catch (e: Exception) {
                if (!running) break
                Log.w(TAG, "Connection error", e)
                status("Offline • retrying (${e.javaClass.simpleName})")
            }
            try {
                Thread.sleep(backoffMs)
            } catch (_: InterruptedException) {
                backoffMs = 0 // network changed: retry immediately
            }
            backoffMs = (backoffMs * 2).coerceIn(1_000L, 60_000L)
        }
    }

    /** Fetches everything since the last cursor without waiting for live messages. */
    private fun catchUp(pairing: Pairing) {
        val events = mutableListOf<JSONObject>()
        execute(request(pairing, poll = true)).use { response ->
            response.body!!.source().let { source ->
                while (true) {
                    val line = source.readUtf8Line() ?: break
                    parseEvent(line)?.takeIf { it.optString("event") == "message" }?.let(events::add)
                }
            }
        }
        if (events.isEmpty()) return
        val decoded = events.mapNotNull { event -> decode(pairing, event)?.let { event to it } }
        val now = System.currentTimeMillis() / 1000
        val maxAge = settings.maxAgeMinutes * 60L
        val newest = decoded.lastOrNull()
        decoded.forEach { (event, link) ->
            val time = event.optLong("time", now)
            val open = event === newest?.first && maxAge > 0 && now - time <= maxAge
            deliver(pairing, event, link, open)
        }
        settings.lastId = events.last().optString("id")
        val missed = decoded.size - if (newest != null && maxAge > 0 &&
            now - newest.first.optLong("time", now) <= maxAge) 1 else 0
        if (missed > 0) notifyMissed(missed)
    }

    private fun stream(pairing: Pairing) {
        execute(request(pairing, poll = false)).use { response ->
            val source = response.body!!.source()
            while (running) {
                val line = source.readUtf8Line() ?: throw IOException("Stream closed")
                val event = parseEvent(line) ?: continue
                when (event.optString("event")) {
                    "open" -> status("Connected • waiting for links")
                    "message" -> {
                        decode(pairing, event)?.let { deliver(pairing, event, it, open = true) }
                        settings.lastId = event.optString("id")
                    }
                }
            }
        }
    }

    private fun request(pairing: Pairing, poll: Boolean): Request {
        val since = settings.lastId ?: settings.sinceTime.toString()
        val url = "${pairing.baseUrl}/${pairing.topic}/json?since=$since" + if (poll) "&poll=1" else ""
        return Request.Builder().url(url).build()
    }

    private fun execute(request: Request): Response {
        val call = client.newCall(request)
        activeCall = call
        val response = call.execute()
        if (!response.isSuccessful) {
            response.close()
            throw IOException("HTTP ${response.code}")
        }
        return response
    }

    private fun parseEvent(line: String): JSONObject? =
        line.takeIf { it.isNotBlank() }?.let { runCatching { JSONObject(it) }.getOrNull() }

    private fun decode(pairing: Pairing, event: JSONObject): SharedLink? = try {
        MessageCodec.decode(event.optString("message"), pairing.key, settings.requireEncryption)
    } catch (e: Exception) {
        // Wrong key, tampered or unrelated message: ignore it and do not acknowledge.
        Log.w(TAG, "Rejected message ${event.optString("id")}", e)
        null
    }

    private fun deliver(pairing: Pairing, event: JSONObject, link: SharedLink, open: Boolean) {
        val target = LinkRouter.classify(link.url)
        val opened = open && target != null && launch(target, link)
        settings.addHistory(HistoryEntry(event.optLong("time", System.currentTimeMillis() / 1000), link.url, link.title, opened))
        acknowledge(pairing, event.optString("id"))
        if (opened) status("Opened: ${link.title.ifBlank { link.url }}")
    }

    private fun launch(target: LinkRouter.Target, link: SharedLink): Boolean {
        val intent = LinkRouter.intentFor(this, target, settings)
        // Android only lets background apps open screens with "Display over other apps".
        if (android.provider.Settings.canDrawOverlays(this)) {
            return runCatching { startActivity(intent); true }.getOrElse {
                Log.w(TAG, "Could not open link", it); notifyLink(link, intent); false
            }
        }
        notifyLink(link, intent)
        return false
    }

    private fun acknowledge(pairing: Pairing, id: String) {
        if (id.isEmpty()) return
        val request = Request.Builder()
            .url("${pairing.baseUrl}/${pairing.topic}_ack")
            .post(id.toRequestBody("text/plain".toMediaType()))
            .build()
        runCatching { client.newCall(request).execute().close() }
            .onFailure { Log.w(TAG, "Receipt failed", it) }
    }

    private fun status(text: String) {
        settings.lastStatus = text
        if (running) getSystemService(NotificationManager::class.java).notify(NOTIF_SERVICE, serviceNotification(text))
    }

    private fun serviceNotification(text: String): Notification =
        NotificationCompat.Builder(this, CHANNEL_SERVICE)
            .setSmallIcon(R.drawable.ic_stat_receiver)
            .setContentTitle("ScreenMate Receiver")
            .setContentText(text)
            .setOngoing(true)
            .setContentIntent(openAppIntent())
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

    private fun notifyLink(link: SharedLink, intent: Intent) {
        val pending = PendingIntent.getActivity(
            this, link.url.hashCode(), intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val notification = NotificationCompat.Builder(this, CHANNEL_LINKS)
            .setSmallIcon(R.drawable.ic_stat_receiver)
            .setContentTitle(link.title.ifBlank { "Link received" })
            .setContentText("Tap to open • ${link.url}")
            .setContentIntent(pending)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()
        getSystemService(NotificationManager::class.java).notify(link.url.hashCode(), notification)
    }

    private fun notifyMissed(count: Int) {
        val notification = NotificationCompat.Builder(this, CHANNEL_LINKS)
            .setSmallIcon(R.drawable.ic_stat_receiver)
            .setContentTitle("$count missed link${if (count == 1) "" else "s"}")
            .setContentText("Sent while the screen was off. Tap to view.")
            .setContentIntent(openAppIntent())
            .setAutoCancel(true)
            .build()
        getSystemService(NotificationManager::class.java).notify(NOTIF_MISSED, notification)
    }

    private fun openAppIntent() = PendingIntent.getActivity(
        this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE,
    )

    companion object {
        private const val TAG = "ScreenMateReceiver"
        private const val CHANNEL_SERVICE = "service"
        private const val CHANNEL_LINKS = "links"
        private const val NOTIF_SERVICE = 1
        private const val NOTIF_MISSED = 2
        const val ACTION_STOP = "com.sendtoscreenmate.receiver.STOP"
        const val ACTION_RECONNECT = "com.sendtoscreenmate.receiver.RECONNECT"

        fun start(context: Context, reconnect: Boolean = false) {
            val intent = Intent(context, ReceiverService::class.java)
            if (reconnect) intent.action = ACTION_RECONNECT
            ContextCompat.startForegroundService(context, intent)
        }

        fun stop(context: Context) {
            context.startService(Intent(context, ReceiverService::class.java).setAction(ACTION_STOP))
        }

        fun createChannels(context: Context) {
            val manager = context.getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_SERVICE, "Connection status", NotificationManager.IMPORTANCE_LOW),
            )
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_LINKS, "Received links", NotificationManager.IMPORTANCE_HIGH),
            )
        }
    }
}

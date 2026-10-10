package com.sendtoscreenmate.receiver

import android.content.Context
import android.content.SharedPreferences

enum class NavApp(val label: String, val packageName: String?) {
    ASK("Ask each time", null),
    GOOGLE_MAPS("Google Maps", "com.google.android.apps.maps"),
    WAZE("Waze", "com.waze"),
}

/** Small SharedPreferences wrapper. All state lives on this device only. */
class Settings(context: Context) {
    private val prefs: SharedPreferences =
        context.applicationContext.getSharedPreferences("receiver", Context.MODE_PRIVATE)

    var pairing: Pairing
        get() {
            val topic = prefs.getString("topic", null)
            val key = prefs.getString("key", null)
            if (topic == null || key == null) return Pairing.generate().also { pairing = it }
            return Pairing(prefs.getString("server", Pairing.DEFAULT_SERVER)!!, topic, key)
        }
        set(value) {
            prefs.edit()
                .putString("server", value.server)
                .putString("topic", value.topic)
                .putString("key", value.key)
                .remove("lastId")
                .putLong("sinceTime", System.currentTimeMillis() / 1000)
                .apply()
        }

    var enabled: Boolean
        get() = prefs.getBoolean("enabled", false)
        set(value) = prefs.edit().putBoolean("enabled", value).apply()

    /** When true, unencrypted messages are rejected. */
    var requireEncryption: Boolean
        get() = prefs.getBoolean("requireEncryption", true)
        set(value) = prefs.edit().putBoolean("requireEncryption", value).apply()

    var navApp: NavApp
        get() = runCatching { NavApp.valueOf(prefs.getString("navApp", NavApp.GOOGLE_MAPS.name)!!) }
            .getOrDefault(NavApp.GOOGLE_MAPS)
        set(value) = prefs.edit().putString("navApp", value.name).apply()

    /** Open YouTube links in the YouTube app when installed. */
    var youtubeApp: Boolean
        get() = prefs.getBoolean("youtubeApp", true)
        set(value) = prefs.edit().putBoolean("youtubeApp", value).apply()

    /** Last ntfy message id handled; used to resume after reconnects without replays. */
    var lastId: String?
        get() = prefs.getString("lastId", null)
        set(value) = prefs.edit().putString("lastId", value).apply()

    /** Messages older than this (sent while the screen was off) are not auto-opened. 0 = never auto-open backlog. */
    var maxAgeMinutes: Int
        get() = prefs.getInt("maxAgeMinutes", 120)
        set(value) = prefs.edit().putInt("maxAgeMinutes", value).apply()

    /** Recently received links, newest first, as "epochSeconds\turl\ttitle\topened(0/1)" lines. */
    var history: List<HistoryEntry>
        get() = prefs.getString("history", "")!!.lineSequence().mapNotNull(HistoryEntry::parse).toList()
        set(value) = prefs.edit().putString("history", value.take(25).joinToString("\n") { it.serialize() }).apply()

    fun addHistory(entry: HistoryEntry) { history = listOf(entry) + history }

    /** Unix time the current pairing was created; the resume point until the first message arrives. */
    val sinceTime: Long
        get() = prefs.getLong("sinceTime", System.currentTimeMillis() / 1000)

    var lastStatus: String
        get() = prefs.getString("lastStatus", "Not started")!!
        set(value) = prefs.edit().putString("lastStatus", value).apply()

    fun registerListener(listener: SharedPreferences.OnSharedPreferenceChangeListener) =
        prefs.registerOnSharedPreferenceChangeListener(listener)

    fun unregisterListener(listener: SharedPreferences.OnSharedPreferenceChangeListener) =
        prefs.unregisterOnSharedPreferenceChangeListener(listener)
}

data class HistoryEntry(val time: Long, val url: String, val title: String, val opened: Boolean) {
    fun serialize() = listOf(time.toString(), clean(url), clean(title), if (opened) "1" else "0").joinToString("\t")

    companion object {
        private fun clean(s: String) = s.replace('\t', ' ').replace('\n', ' ')
        fun parse(line: String): HistoryEntry? {
            val p = line.split('\t')
            if (p.size != 4) return null
            return HistoryEntry(p[0].toLongOrNull() ?: return null, p[1], p[2], p[3] == "1")
        }
    }
}

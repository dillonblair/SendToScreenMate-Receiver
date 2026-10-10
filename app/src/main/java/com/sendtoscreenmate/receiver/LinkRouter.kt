package com.sendtoscreenmate.receiver

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri

/** Turns a received link into the Intent that should open it on this screen. */
object LinkRouter {
    private const val YOUTUBE = "com.google.android.youtube"

    /** Pure classification, kept separate from Android so it can be unit tested. */
    sealed interface Target {
        data class Navigate(val query: String) : Target
        data class Web(val url: String, val youtube: Boolean) : Target
    }

    fun classify(raw: String): Target? {
        val url = raw.trim()
        val lower = url.lowercase()
        return when {
            lower.startsWith("geo:") -> Target.Navigate(geoQuery(url))
            lower.startsWith("https://") || lower.startsWith("http://") -> {
                val host = runCatching { java.net.URI(url).host?.lowercase() }.getOrNull().orEmpty()
                when {
                    isMapsLink(host, lower) -> Target.Web(url, youtube = false)
                    host == "youtu.be" || host.endsWith("youtube.com") -> Target.Web(url, youtube = true)
                    else -> Target.Web(url, youtube = false)
                }
            }
            // Plain text (an address typed on the phone) becomes a navigation search.
            url.isNotEmpty() && "://" !in url -> Target.Navigate(url)
            else -> null // Unknown schemes are refused.
        }
    }

    private fun isMapsLink(host: String, lower: String) =
        host == "maps.google.com" || host == "maps.app.goo.gl" || host == "goo.gl" && "/maps" in lower ||
            (host.endsWith("google.com") && "/maps" in lower) || host == "waze.com" || host.endsWith(".waze.com")

    /** Extracts the destination from geo:lat,lng?q=… */
    fun geoQuery(geo: String): String {
        val afterScheme = geo.substringAfter(':')
        val q = afterScheme.substringAfter("q=", "").substringBefore('&')
        val decoded = runCatching { java.net.URLDecoder.decode(q, "UTF-8") }.getOrDefault(q)
        if (decoded.isNotBlank()) return decoded
        return afterScheme.substringBefore('?') // bare coordinates
    }

    fun intentFor(context: Context, target: Target, settings: Settings): Intent {
        val intent = when (target) {
            is Target.Navigate -> navigationIntent(context, target.query, settings.navApp)
            is Target.Web -> Intent(Intent.ACTION_VIEW, Uri.parse(target.url)).apply {
                if (target.youtube && settings.youtubeApp && isInstalled(context, YOUTUBE)) setPackage(YOUTUBE)
            }
        }
        return intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }

    private fun navigationIntent(context: Context, query: String, app: NavApp): Intent {
        val encoded = Uri.encode(query)
        return when {
            app == NavApp.WAZE && isInstalled(context, NavApp.WAZE.packageName!!) ->
                Intent(Intent.ACTION_VIEW, Uri.parse("https://waze.com/ul?q=$encoded&navigate=yes"))
                    .setPackage(NavApp.WAZE.packageName)
            app == NavApp.GOOGLE_MAPS && isInstalled(context, NavApp.GOOGLE_MAPS.packageName!!) ->
                Intent(Intent.ACTION_VIEW, Uri.parse("google.navigation:q=$encoded"))
                    .setPackage(NavApp.GOOGLE_MAPS.packageName)
            else -> Intent.createChooser(Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=$encoded")), "Navigate with")
        }
    }

    private fun isInstalled(context: Context, pkg: String): Boolean = try {
        context.packageManager.getPackageInfo(pkg, 0); true
    } catch (_: PackageManager.NameNotFoundException) {
        false
    }
}

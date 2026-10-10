package com.sendtoscreenmate.receiver

import android.Manifest
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.text.DateFormat
import java.util.Date
import android.provider.Settings as AndroidSettings

class MainActivity : ComponentActivity() {
    private lateinit var settings: Settings
    private var refresh by mutableIntStateOf(0)

    private val notificationPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { refresh++ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        settings = Settings(this)
        ReceiverService.createChannels(this)
        if (settings.enabled) ReceiverService.start(this)
        setContent {
            MaterialTheme(colorScheme = darkColorScheme()) {
                Surface(Modifier.fillMaxSize()) { Screen() }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        refresh++ // re-check permissions after returning from system settings
    }

    @Composable
    private fun Screen() {
        // Re-read settings whenever the service writes status/history.
        var tick by remember { mutableIntStateOf(0) }
        DisposableEffect(Unit) {
            val listener = SharedPreferences.OnSharedPreferenceChangeListener { _, _ -> tick++ }
            settings.registerListener(listener)
            onDispose { settings.unregisterListener(listener) }
        }
        @Suppress("UNUSED_EXPRESSION") tick; refresh

        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
            LazyColumn(
                Modifier.widthIn(max = 760.dp).fillMaxWidth().padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                item { Spacer(Modifier.size(8.dp)) }
                item { StatusCard() }
                item { SetupCard() }
                item { PairingCard() }
                item { OptionsCard() }
                item { Text("Recent links", style = MaterialTheme.typography.titleMedium) }
                val history = settings.history
                if (history.isEmpty()) item { Text("Nothing received yet.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
                items(history) { HistoryRow(it) }
                item { Spacer(Modifier.size(24.dp)) }
            }
        }
    }

    @Composable
    private fun StatusCard() = Card(Modifier.fillMaxWidth()) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("ScreenMate Receiver", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                Text(if (settings.enabled) settings.lastStatus else "Receiver is off", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Switch(checked = settings.enabled, onCheckedChange = { on ->
                settings.enabled = on
                if (on) ReceiverService.start(this@MainActivity) else ReceiverService.stop(this@MainActivity)
                refresh++
            })
        }
    }

    @Composable
    private fun SetupCard() {
        val notificationsOk = Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(
            this, Manifest.permission.POST_NOTIFICATIONS,
        ) == PackageManager.PERMISSION_GRANTED
        val overlayOk = AndroidSettings.canDrawOverlays(this)
        val batteryOk = getSystemService(PowerManager::class.java).isIgnoringBatteryOptimizations(packageName)
        if (notificationsOk && overlayOk && batteryOk) return
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Finish setup", style = MaterialTheme.typography.titleMedium)
                if (!overlayOk) SetupStep("Allow opening links automatically", "Display over other apps") {
                    startActivity(Intent(AndroidSettings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")))
                }
                if (!batteryOk) SetupStep("Keep running in the background", "Allow") {
                    @Suppress("BatteryLife")
                    startActivity(Intent(AndroidSettings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName")))
                }
                if (!notificationsOk && Build.VERSION.SDK_INT >= 33) SetupStep("Show status notifications", "Allow") {
                    notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
            }
        }
    }

    @Composable
    private fun SetupStep(text: String, action: String, onClick: () -> Unit) =
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(text, Modifier.weight(1f))
            Button(onClick = onClick) { Text(action) }
        }

    @Composable
    private fun PairingCard() {
        val pairing = settings.pairing
        var server by remember(pairing.server) { mutableStateOf(pairing.server) }
        var confirmNew by remember { mutableStateOf(false) }
        var testStatus by remember { mutableStateOf("") }
        val qr = remember(pairing.qrText) { Qr.bitmap(pairing.qrText).asImageBitmap() }
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Pair your phone", style = MaterialTheme.typography.titleMedium)
                Text("In SendTo ScreenMate on your phone, open Settings and scan this code.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                Image(qr, "Pairing QR code", Modifier.size(260.dp).align(Alignment.CenterHorizontally))
                Text(pairing.qrText, fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.bodySmall)
                OutlinedTextField(
                    value = server, onValueChange = { server = it }, singleLine = true,
                    label = { Text("Server (ntfy)") }, modifier = Modifier.fillMaxWidth(),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (server.trim() != pairing.server) Button(onClick = {
                        settings.pairing = pairing.copy(server = server.trim())
                        restartIfEnabled()
                    }) { Text("Save server") }
                    OutlinedButton(onClick = { confirmNew = true }) { Text("New pairing") }
                    OutlinedButton(onClick = { testStatus = "Sending…"; sendTest(pairing) { testStatus = it } }) { Text("Send test") }
                }
                if (testStatus.isNotEmpty()) Text(testStatus, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        if (confirmNew) AlertDialog(
            onDismissRequest = { confirmNew = false },
            title = { Text("Create a new pairing?") },
            text = { Text("Your phone will stop reaching this screen until you scan the new code.") },
            confirmButton = { TextButton(onClick = {
                settings.pairing = Pairing.generate(pairing.server)
                confirmNew = false
                restartIfEnabled()
            }) { Text("Create") } },
            dismissButton = { TextButton(onClick = { confirmNew = false }) { Text("Cancel") } },
        )
    }

    @Composable
    private fun OptionsCard() = Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Options", style = MaterialTheme.typography.titleMedium)
            Text("Navigate with")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                NavApp.entries.forEach { app ->
                    FilterChip(selected = settings.navApp == app, onClick = { settings.navApp = app }, label = { Text(app.label) })
                }
            }
            Text("Open links sent while off, if newer than")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(0 to "Never", 30 to "30 min", 120 to "2 h", 360 to "6 h", 720 to "12 h").forEach { (minutes, label) ->
                    FilterChip(selected = settings.maxAgeMinutes == minutes, onClick = { settings.maxAgeMinutes = minutes }, label = { Text(label) })
                }
            }
            HorizontalDivider()
            ToggleRow("Open YouTube links in the YouTube app", settings.youtubeApp) { settings.youtubeApp = it }
            ToggleRow("Reject unencrypted messages", settings.requireEncryption) { settings.requireEncryption = it }
        }
    }

    @Composable
    private fun ToggleRow(text: String, checked: Boolean, onChange: (Boolean) -> Unit) =
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(text, Modifier.weight(1f))
            Switch(checked = checked, onCheckedChange = onChange)
        }

    @Composable
    private fun HistoryRow(entry: HistoryEntry) {
        val time = remember(entry.time) { DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(entry.time * 1000)) }
        Card(Modifier.fillMaxWidth().clickable {
            LinkRouter.classify(entry.url)?.let { runCatching { startActivity(LinkRouter.intentFor(this, it, settings)) } }
        }) {
            Column(Modifier.padding(12.dp)) {
                Text(entry.title.ifBlank { entry.url }, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(entry.url, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("$time • ${if (entry.opened) "Opened" else "Missed — tap to open"}", style = MaterialTheme.typography.labelSmall,
                    color = if (entry.opened) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.primary)
            }
        }
    }

    private fun restartIfEnabled() {
        if (settings.enabled) ReceiverService.start(this, reconnect = true)
        refresh++
    }

    /** Publishes an encrypted test link to our own topic to check the whole path end to end. */
    private fun sendTest(pairing: Pairing, done: (String) -> Unit) {
        Thread {
            val result = runCatching {
                val body = WireCrypto.encrypt(
                    MessageCodec.encode(SharedLink("https://ntfy.sh/docs/", "ScreenMate test")).toByteArray(), pairing.key,
                )
                val request = Request.Builder().url("${pairing.baseUrl}/${pairing.topic}")
                    .post(body.toRequestBody("text/plain".toMediaType())).build()
                OkHttpClient().newCall(request).execute().use { if (!it.isSuccessful) error("HTTP ${it.code}") }
            }
            val text = result.fold({ "Test sent. It should open in a moment." }, { "Test failed: ${it.message}" })
            runOnUiThread { done(text) }
        }.start()
    }
}

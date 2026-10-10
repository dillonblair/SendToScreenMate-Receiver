package com.sendtoscreenmate.receiver

import org.json.JSONObject
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * Wire protocol shared with the SendTo ScreenMate senders.
 *
 * - Pairing QR / text:   `server|topic|base64Key`
 * - Message body:        JSON `{"url": "...", "title": "..."}`
 * - Encrypted body:      Base64( 12-byte nonce || AES-256-GCM ciphertext || 16-byte tag )
 * - Transport:           ntfy — publish to `<server>/<topic>`, stream `<server>/<topic>/json`
 * - Delivery receipt:    receiver publishes the received ntfy message id to `<server>/<topic>_ack`
 */
data class SharedLink(val url: String, val title: String)

data class Pairing(val server: String, val topic: String, val key: String) {
    val qrText: String get() = "$server|$topic|$key"
    val baseUrl: String get() = normalizeServer(server)

    companion object {
        const val DEFAULT_SERVER = "https://ntfy.sh"
        private val TOPIC = Regex("^[-_A-Za-z0-9]{1,64}$")
        private const val ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"

        fun generate(server: String = DEFAULT_SERVER, random: SecureRandom = SecureRandom()): Pairing {
            val topic = "sm-" + (1..24).map { ALPHABET[random.nextInt(ALPHABET.length)] }.joinToString("")
            val key = ByteArray(32).also(random::nextBytes)
            return Pairing(server.trim(), topic, Base64.getEncoder().encodeToString(key))
        }

        fun normalizeServer(value: String): String {
            val trimmed = value.trim().trimEnd('/')
            return if ("://" in trimmed) trimmed else "https://$trimmed"
        }

        fun isValidTopic(topic: String) = TOPIC.matches(topic)
    }
}

object WireCrypto {
    private const val NONCE_BYTES = 12
    private const val TAG_BITS = 128

    fun decodeKey(base64Key: String): ByteArray {
        val bytes = Base64.getDecoder().decode(base64Key.trim())
        require(bytes.size == 32) { "Key must be 32 bytes" }
        return bytes
    }

    fun encrypt(plain: ByteArray, base64Key: String, random: SecureRandom = SecureRandom()): String {
        val nonce = ByteArray(NONCE_BYTES).also(random::nextBytes)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(decodeKey(base64Key), "AES"), GCMParameterSpec(TAG_BITS, nonce))
        return Base64.getEncoder().encodeToString(nonce + cipher.doFinal(plain))
    }

    fun decrypt(body: String, base64Key: String): ByteArray {
        val combined = Base64.getDecoder().decode(body.trim())
        require(combined.size > NONCE_BYTES + TAG_BITS / 8) { "Ciphertext too short" }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(
            Cipher.DECRYPT_MODE,
            SecretKeySpec(decodeKey(base64Key), "AES"),
            GCMParameterSpec(TAG_BITS, combined, 0, NONCE_BYTES),
        )
        return cipher.doFinal(combined, NONCE_BYTES, combined.size - NONCE_BYTES)
    }
}

object MessageCodec {
    /** Decodes an ntfy message body. Throws if it cannot be authenticated or parsed. */
    fun decode(body: String, key: String?, requireEncryption: Boolean): SharedLink {
        val json = when {
            key != null && requireEncryption -> String(WireCrypto.decrypt(body, key), Charsets.UTF_8)
            key != null && !body.trimStart().startsWith("{") -> String(WireCrypto.decrypt(body, key), Charsets.UTF_8)
            else -> body
        }
        val obj = JSONObject(json)
        val url = obj.optString("url").trim()
        require(url.isNotEmpty()) { "Message has no url" }
        return SharedLink(url, obj.optString("title").trim())
    }

    fun encode(link: SharedLink): String =
        JSONObject().put("url", link.url).put("title", link.title).toString()
}

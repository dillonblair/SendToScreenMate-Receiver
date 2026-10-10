package com.sendtoscreenmate.receiver

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import javax.crypto.AEADBadTagException

class ProtocolTest {
    // Fixture produced independently with Python `cryptography` (AESGCM), key = bytes 0..31, nonce = bytes 100..111.
    private val key = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8="
    private val fixture = "ZGVmZ2hpamtsbW5vMzmrFBXLbLxWFiuYqV9F0jutc37+QpEXiLX9P8/UnB/zsSORbj65cJSHFFrfeOiMej1bTgCo3bvYjKdtnx+g0SCar97W+ip4YFo="

    @Test fun decryptsIndependentFixture() {
        val link = MessageCodec.decode(fixture, key, requireEncryption = true)
        assertEquals(SharedLink("https://youtu.be/dQw4w9WgXcQ", "Café ✓"), link)
    }

    @Test fun roundTripsWithFreshNonce() {
        val json = MessageCodec.encode(SharedLink("geo:0,0?q=Colosseum", "Colosseum")).toByteArray()
        val a = WireCrypto.encrypt(json, key)
        val b = WireCrypto.encrypt(json, key)
        assertTrue(a != b)
        assertEquals("Colosseum", MessageCodec.decode(a, key, true).title)
    }

    @Test(expected = AEADBadTagException::class) fun rejectsTampering() {
        val bytes = java.util.Base64.getDecoder().decode(fixture)
        bytes[20] = (bytes[20].toInt() xor 1).toByte()
        MessageCodec.decode(java.util.Base64.getEncoder().encodeToString(bytes), key, true)
    }

    @Test(expected = Exception::class) fun rejectsPlaintextWhenEncryptionRequired() {
        MessageCodec.decode("""{"url":"https://example.com","title":"x"}""", key, requireEncryption = true)
    }

    @Test fun acceptsPlaintextWhenAllowed() {
        assertEquals("https://example.com", MessageCodec.decode("""{"url":"https://example.com"}""", key, false).url)
    }

    @Test fun generatesValidPairing() {
        val p = Pairing.generate()
        assertTrue(Pairing.isValidTopic(p.topic))
        assertEquals(32, WireCrypto.decodeKey(p.key).size)
        assertEquals("https://ntfy.sh|${p.topic}|${p.key}", p.qrText)
        assertEquals("https://ntfy.example.com", Pairing.normalizeServer(" ntfy.example.com/ "))
    }

    @Test fun classifiesLinks() {
        assertEquals(LinkRouter.Target.Web("https://youtu.be/abc", youtube = true), LinkRouter.classify("https://youtu.be/abc"))
        assertEquals(LinkRouter.Target.Web("https://m.youtube.com/watch?v=abc", youtube = true), LinkRouter.classify("https://m.youtube.com/watch?v=abc"))
        assertEquals(LinkRouter.Target.Web("https://example.com/a", youtube = false), LinkRouter.classify("https://example.com/a"))
        assertEquals(LinkRouter.Target.Navigate("Piazza del Colosseo, Rome"), LinkRouter.classify("geo:0,0?q=Piazza%20del%20Colosseo%2C%20Rome"))
        assertEquals(LinkRouter.Target.Navigate("41.89,12.49"), LinkRouter.classify("geo:41.89,12.49"))
        assertEquals(LinkRouter.Target.Navigate("1 Infinite Loop, Cupertino"), LinkRouter.classify("1 Infinite Loop, Cupertino"))
        assertNull(LinkRouter.classify("file:///sdcard/secret"))
        assertNull(LinkRouter.classify("intent://evil#Intent;end"))
    }
}

# ScreenMate Receiver

Open-source Android app that receives links sent from your phone and opens them on a car head unit, tablet, or any Android screen: YouTube videos, web pages, and navigation destinations (Google Maps or Waze).

It pairs with the **SendTo ScreenMate** iPhone app (share sheet, Shortcuts, NFC tag, Siri).

## How it works

```
iPhone ──encrypt──▶ ntfy server ──stream──▶ Receiver ──▶ YouTube / Maps / Waze / browser
   ▲                                          │
   └──────────── delivery receipt ◀───────────┘
```

- **Transport:** [ntfy](https://ntfy.sh), an open-source pub/sub server. The default is the public `https://ntfy.sh`; you can run your own and change the server in the app.
- **Privacy:** every message is end-to-end encrypted with AES-256-GCM. The 32-byte key is generated on the Receiver and shared only through the pairing QR code. The ntfy server only sees ciphertext, and unencrypted messages are rejected by default.
- **Screen powered off:** ntfy keeps messages for a while (12 hours on ntfy.sh). When the screen powers on, the Receiver reconnects, opens **only the newest** link (if it is newer than the age you choose, 2 hours by default), and lists the rest under *Recent links* as missed.

## Install

1. Download the latest APK from [Releases](../../releases) (or the *Actions* tab for development builds) and install it on the Android screen. Every APK is built from this source by GitHub Actions; a SHA-256 checksum is published alongside it.
2. Open **ScreenMate Receiver**, turn it on, and finish the setup steps:
   - **Display over other apps:** lets it open links by itself while running in the background.
   - **Battery optimization off:** keeps the connection alive.
   - **Notifications:** status and missed-link notifications.
3. On your iPhone, open SendTo ScreenMate → Settings and scan the Receiver's QR code.
4. Tap **Send test** on the Receiver to check the whole path.

## Wire protocol

| Item | Format |
|---|---|
| Pairing QR | `server|topic|base64Key` |
| Payload | JSON `{"url": "...", "title": "..."}` |
| Encrypted body | Base64(12-byte nonce ‖ AES-256-GCM ciphertext ‖ 16-byte tag) |
| Publish | `POST <server>/<topic>` |
| Subscribe | `GET <server>/<topic>/json?since=<last id>` |
| Receipt | Receiver publishes the ntfy message id to `<server>/<topic>_ack` |

Accepted URLs: `http(s)://`, `geo:` and plain text (treated as a navigation search). Other schemes are refused.

## Build from source

Requires JDK 17 and the Android SDK (Android Studio includes both).

```bash
./gradlew testDebugUnitTest assembleRelease
```

Without signing variables, release builds are signed with the debug key. CI signs with a release key supplied through repository secrets (`RELEASE_KEYSTORE_BASE64`, `RELEASE_KEYSTORE_PASSWORD`, `RELEASE_KEY_ALIAS`) so updates install over earlier versions.

## License

MIT. See [LICENSE](LICENSE). This is an independent implementation written from the wire protocol; it contains no code from other ScreenMate projects.

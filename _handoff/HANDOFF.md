# Halo for Tesla: handoff

Halo is a DashPilot **dash app contest entry** (web category). Contest rules:
<https://github.com/softwiredtech/dashpilot/tree/main/dash-apps/contest>.
**Deadline: October 30, 23:00 GMT.** Prize $250, one entry per person.

## Where everything lives

| What | Where |
|---|---|
| **The entry (source of truth)** | Branch `halo-dashboard` of `dillonblair/SendToScreenMate-Receiver` (repo root, everything except `_handoff/` and `.nojekyll`) |
| Live URL to load in DashPilot (use this one consistently: settings and drives are stored per site, so `rawcdn.githack.com` commit links start empty) | <https://raw.githack.com/dillonblair/sendtoscreenmate-receiver/halo-dashboard/index.html> (updates a few minutes after each push) |
| This handoff, test scripts, PR text, Blender script | `_handoff/` on the same branch. **Not part of the entry.** |
| Showcase page (private to Dillon's Claude account) | <https://claude.ai/artifact/JBykfPgMoY8qSgK7d1cf1p> |

The branch is an orphan branch, so it shares no history with the receiver app's `main`. It's only used for hosting. Deleting the branch removes Halo.

The previous session also had a local clone of `softwiredtech/dashpilot` with branch `dash-contest-halo` (8 commits). **It was never pushed and is gone.** Rebuild it from this branch (next section).

## What's left to enter

1. **Dillon forks** `softwiredtech/dashpilot` on GitHub. Claude can't create the fork or new repos (GitHub returns "403 Resource not accessible by integration").
2. Clone the fork, create branch `dash-contest-halo`, copy the entry files from this branch into `dash-apps/contest/dillonblair-halo/`. Leave out `_handoff/` and `.nojekyll`. Run `node scripts/validate-manifests.js`, commit, push.
3. Open a PR titled **`[dash contest] Halo for Tesla`** that adds only that one folder. Use `_handoff/pr-body.md` as the body. Dillon drags in the 30–60 s screen recording (DashPilot, Demo data source) and posts it with the PR link in **#hmi-challenge** on the DashKit Discord.
4. Can still be done before the deadline: phone testing (does the 3D view run smoothly, does the long-press work in the app?).

## Files in the entry

| File | Role |
|---|---|
| `index.html` | Layout, light ring (canvas), speed, gear, power + kW, turn arrows, top bar (car battery, phone battery, clock), odometer, sign, Autopilot + set speed, 2D lane-view fallback (SVG), settings sheet, speed-warning logic |
| `core.js` | Data plumbing: Android `onCarStateUpdate` + `NativeCarState.getX()`, iOS `receiveMessage(state)`. Demo loop **only outside the app** (never fakes a drive in the car). `#day`, `#metric`, `#juniper`, `#novis` URL flags for the demo |
| `drives.js` | Trip tracking (distance, kWh from pack V×I, regen), trip card on Park, weekly totals and last drive in appData, 0–60 timer (opt-in), parked screensaver with burn-in drift, the Drives tab |
| `lane3d.js` | three.js chase-camera lane view: bending lanes, scrolling dashes, Autopilot path, neighbours in blind spots, stop line + distance label, brake glow. Falls back to the SVG view without WebGL or when `renderQuality === 1` |
| `car3d.js` | The car, built in code: lofted body from Model 3 / Model Y profiles, lamps as strips on the surface (legacy wrap lamps, Highland C lamps, Juniper light bar), wheels, mirrors, paints, `HaloCar.resolve()` (settings + VIN / paint auto-detect) |
| `three.min.js` + `LICENSE-three.txt` | three.js r160 UMD build (MIT), from npm |
| `fonts/montserrat-var.woff2` + `fonts/OFL.txt` | Montserrat (SIL OFL) |
| `manifest.json`, `README.md`, `preview.jpg` | Contest metadata. README has the credits and the data used |

Size: about 0.81 MB without `preview.jpg`. The limit is 5 MB. It makes no network requests (checked: 6 requests at runtime, all local).

## Features (all user-visible)

- **Light ring:** Autopilot blue (steady: no travelling light, Dillon found it distracting); amber turn sweep with a bright tip; red blind-spot edge (pulses when urgent); red light ahead grows along the top (legacy cars only); speed-warning amber / deeper orange on top.
- **Middle:** big speed (Montserrat), P R N D stack, power bar + kW (green regen), green turn arrows either side of the speed, US or EU speed-limit sign by units, Autopilot wheel + set speed.
- **Edges:** car battery (top left), phone battery + clock (top right), odometer (bottom left), seatbelt/door warnings (bottom centre). Each follows the app's Show car battery / Show phone battery / Show odometer settings (default on).
- **Settings (long-press ~0.55 s, any speed; Dillon asked for the speed lock to go):** Lane view on/off · Traffic lights on/off (`settings.stopLine`, hides the ring bar, stop line and distance) · Car (Auto / Model 3 / Model Y) · Version (Auto / Original / Refresh) · Paint (Auto + 12 Tesla paints) · Speed warning (Off / Speed / Both) · Warn above limit by +0/+3/+5/+10 mph (+0/+5/+10/+15 km/h). Saved via `NativeCarState.setAppData` / `webkit.messageHandlers.appData`, with localStorage as the fallback when loaded by URL.
- **Drives (`drives.js`):** trip card on Park, this week's totals, optional 0–60 timer, parked screensaver after 60 s. The Drives tab in settings shows the drive in progress (so it has something to show in DashPilot's Demo, which never parks) or the last drive, plus switches.
- **Brightness tab (index.html, `updateBrightness`):** Auto (night level 80/60/40/25%, night = estimated sunset→sunrise from date + time zone at latitude ±40, or app dark mode) or fixed 100–40%. Sets `--bk` (opacity on text) and `ringDim` (band, Autopilot, drain, screensaver ring). Hazards, turn sweep, speed warning and `.tells` stay full. Dash apps can't set phone brightness or car lights (CarStateBridge.kt / WebDashView.swift only expose getters + appData + editing).
- **iPhone notch:** DashPilot's iOS `DashboardView` uses `.ignoresSafeArea()`, so Halo insets itself by `--sx` = max(safe-area-inset-left, right) on both sides (layout, ring in `build()`, sheet, trip card). If an iOS app on a >2:1 screen reports 0, it assumes 44 px.
- **Layouts (Display tab → Layout, `settings.layout`, URL preview `#lay-a`…`#lay-d`):** Classic (gears left edge, sign + Autopilot right edge) or A Top (small cluster top-centre), B Beside (sign + AP right of the speed, gears row under it), C Below (row under the lane view), D Over (sign + AP over the road, gears row above the speed). A–D use `display: contents` on `.side` and grid areas, and set `--sx: 0` (no notch margin: nothing sits mid-edge; only a 5u side padding on the middle band so the turn arrows clear a notch); each has a lane-view-off variant. The notch covers the middle half of a side edge, which is why A–D exist. Dillon is choosing one.
- **Neon theme (Display tab → Theme, `settings.theme`, URL preview `#neon`):** `:root.neon`. `buildNeon()` makes two arcs (210°, speed left rising clockwise, power right rising anticlockwise, 0 kW at 16% with green regen below) and sets `--gL/--gR/--gy/--gr` so the DOM pieces (`position: fixed`) sit inside them. The signal path `P` runs along the outside of both arcs with `null` gaps at top and bottom centre, so `drawRing()`'s existing signals land on the arcs unchanged. `drawGauges()` draws outline, ticks, labels and a conic-gradient fill each frame the values change. Forces dark (also in `lane3d.js`, which now tests visibility with `getClientRects()` because fixed elements have no `offsetParent`) and ignores Layout. Bokeh background is CSS gradients, no images.
- **Ring cues (index.html):** Autopilot-off drain (assist drops out above 3 mph) and the green-light nudge (stopped on red → green, still stopped 2 s later).
- **Long-press:** judged per frame and on release (not one timer), backed by touch events, survives a native gesture cancelling the pointer. A blue ring fills under the finger.

## Decisions and constraints worth knowing

- **Web, not Rive:** settings storage only exists for web apps.
- **Car model:** don't use DashPilot's `web-vanilla/assets/models/tesla*.glb`. Its node names show it came from Sketchfab, and no license is credited, so using it risks disqualification under the "unlicensed assets" rule. Every asset in Halo is self-made or MIT/OFL.
- **Dillon said stop modelling** and keep the current car. A Blender pipeline was explored (`_handoff/tools/build_car.py`, needs `pip install bpy==5.2.2` on Python 3.13). It was never integrated, so leave it unless asked.
- **The app doesn't send VIN, model or paint to dash apps** (`CarStateBridge.kt` / iOS bridge). Halo reads `vin` / `exteriorColor` if they ever appear, and the settings are the real path today.
- **Car data differences** (`bridge/car/cars/tesla.h`):
  - The Juniper has no traffic-light or stop-line data.
  - The legacy set speed is flagged unreliable, so Halo hides it if it mirrors the speed.
  - `adasOn` means Autosteer on legacy cars and cruise on the Juniper.
- **Red is reserved for hazards** (blind spot, red light). The speed warning uses amber, then deeper orange.
- The lane view was made smaller and moved right at Dillon's request.

## Verifying changes (`_handoff/tools/`)

Node + Playwright scripts. They use `/opt/node-tools/node_modules/playwright` and Chromium flags `--use-angle=swiftshader --enable-unsafe-swiftshader` for WebGL. Pass the absolute path of `index.html`:

- `harness.js file out.png '{state json}' [w h] ['{settings json}']`: feed a fixed state through the iOS path and screenshot.
- `bridge.js`: fake iOS + Android bridges; demo stays off in the app; settings open.
- `touch.js`: real touch events: hold, short tap, overloaded page, cancelled touch, driving notice.
- `lp.js`, `warn.js`, `net.js`: long-press + lane-view persistence, speed-warning thresholds, no network requests.
- `layouts.js`: screenshots every layout at iPhone size with a notch drawn on both sides and a contact sheet. `node layouts.js /abs/index.html outdir ['#novis']`.
- `notch.js`: iPhone landscape with the fallback inset and a reported 59 px inset; element positions, settings open at 72 mph, screenshots.
- `persist.js`: settings + drives survive a reload when loaded by URL (Android's `setAppData` is a no-op and iOS has no `appData` handler for URL apps, so Halo also writes localStorage).
- `brightness.js`: `--bk` and ring brightness for fixed / Auto-by-sun / Auto-by-dark-mode, hazards stay full, tab screenshots. Usage: `node brightness.js /abs/index.html outdir`.
- `drivetest.js`: launch timer, AP-off drain, green-light nudge, trip card, appData save, Drives tab, screensaver + wake (~90 s).
- `shot.js`: demo-time screenshots (set `HASH=#day` etc).

Software WebGL is slow here, so don't trust frame rates measured headlessly, and give long-press tests ≥1.5 s. `touch.js`'s "short tap" case reports open under headless load; a real 400 ms tap stays shut, so it's the harness being slow, not a bug.

DashPilot's own Demo data source is always in Drive with Autopilot on, so the trip card, screensaver and AP-off cue never appear on a recording made with it. The Drives tab shows the live drive instead. The browser demo (66 s loop) does park and drop Autopilot.

## Publishing an update

Commit to `halo-dashboard` (entry files at the root) and push. The raw.githack URL picks it up after a few minutes. Keep the PR folder in sync with the same files.

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
- **Settings (long-press ~0.55 s, any speed; Dillon asked for the speed lock to go):** Lane view Auto / Always / Off (`settings.laneMode`; Auto = shown while `adasOn`, hidden 4 s after; old `laneView: false` reads as Off) · Traffic lights on/off (`settings.stopLine`, hides the ring bar, stop line and distance) · Car (Auto / Model 3 / Model Y) · Version (Auto / Original / Refresh) · Paint (Auto + 12 Tesla paints) · Speed warning (Off / Speed / Both) · Warn above limit by +0/+3/+5/+10 mph (+0/+5/+10/+15 km/h). Saved via `NativeCarState.setAppData` / `webkit.messageHandlers.appData`, with localStorage as the fallback when loaded by URL.
- **Drives (`drives.js`):** trip card on Park, this week's totals, optional 0–60 timer, parked screensaver after 60 s. The Drives tab in settings shows the drive in progress (so it has something to show in DashPilot's Demo, which never parks) or the last drive, plus switches.
- **Brightness tab (index.html, `updateBrightness`):** Auto (night level 80/60/40/25%, night = estimated sunset→sunrise from date + time zone at latitude ±40, or app dark mode) or fixed 100–40%. Sets `--bk` (opacity on text) and `ringDim` (band, Autopilot, drain, screensaver ring). Hazards, turn sweep, speed warning and `.tells` stay full. Dash apps can't set phone brightness or car lights (CarStateBridge.kt / WebDashView.swift only expose getters + appData + editing).
- **iPhone notch:** DashPilot's iOS `DashboardView` uses `.ignoresSafeArea()`, so Halo insets itself by `--sx` = max(safe-area-inset-left, right) on both sides (layout, ring in `build()`, sheet, trip card). If an iOS app on a >2:1 screen reports 0, it assumes 44 px.
- **Layouts (Display tab → Layout, `settings.layout`, URL preview `#lay-a`…`#lay-d`):** Classic (gears left edge, sign + Autopilot right edge) or A Top (small cluster top-centre), B Beside (sign + AP right of the speed, gears row under it), C Below (row under the lane view), D Over (sign + AP over the road, gears row above the speed). A–D use `display: contents` on `.side` and grid areas, and set `--sx: 0` (no notch margin: nothing sits mid-edge; only a 5u side padding on the middle band so the turn arrows clear a notch); each has a lane-view-off variant. The notch covers the middle half of a side edge, which is why A–D exist. Dillon is choosing one.
- **Matrix theme (Display tab → Theme, `settings.theme = "matrix"`, URL preview `#matrix`; was "Neon", and a saved `"neon"` is read as matrix):** `:root.matrix`. Renamed and redesigned on Dillon's word that the earlier Neon look copied someone else's work: Matrix green (#00FF41) instead of magenta, full circles instead of open arcs, digital rain (`#rain`, `rainStep()`, ~12 fps, still under reduced motion) instead of the city-light bokeh. `buildMatrix()` makes two circles and sets `--gL/--gR/--gy/--gr`; the signal path `P` runs along the circles' outer halves with `null` gaps at top and bottom centre, so `drawRing()`'s signals land there. `drawGauges()`: speed fills clockwise from 12 o'clock round the whole ring; power fills clockwise over three quarters, regen anticlockwise over the last quarter (pale). Forces dark, ignores Layout.
- **HUD mode (index.html, `setHud`, `settings.hud` / `settings.hudFlip`):** HUD button → full-screen `#hud` (black; `.flip` = scaleY(-1) for top edge to the glass, `.mirror` = scaleX(-1) for bottom edge to the glass, which is also how a wall mirror reads), `.hudOn` hides the dash (and stops the 3D view). Double-tap (two clicks within 400 ms) or Escape leaves. Remembered across reloads.
- **iPhone Duo (unfolded 1878×2670, about 890×626 CSS landscape, 10:7):** `detectDuo()` sets `:root.duo` when an iOS screen is about 626×890 points (±16/24) or the URL has `#duo` (for testing without one). Only `.duo` gets the larger `--u`, three settings columns, the HUD button and the HUD image setting; folding (smaller cover screen) leaves HUD without forgetting it, unfolding brings it back. The 626×890 figure comes from spec sites, so check `screen.width/height` on a real Duo. Dillon wanted the HUD on the Duo's back (cover) screen while unfolded in a mount: **not possible from a dash app.** A web page only draws in DashPilot's window on the active screen. iOS lets an app draw on the outer display while open only through `CameraCaptureAccessory` (camera use cases; one e-reader keeps a camera session running to do it). It would need DashPilot's native iOS app to add it.
- **Slide to dim (index.html, `slide` in startPress/movePress/endPress, `setBright`):** a vertical drag (> 22 px, |dy| > 1.6 |dx|) sets `settings.bright` to 20–100 in steps of 5, saved on release; `#briPill` shows it. Sideways drags are ignored for DashPilot's dash swipe. Not in HUD, the sheet or the screensaver.
- **S2000 theme (`s2000.js`, `settings.theme = "s2000"`, URL preview `#s2000`):** `:root.s2000` hides the dash, ring and lane view and shows canvas `#s2k`. Laid out in a 2.16:1 box centred on the screen. Bars follow speed (0–140 mph / 0–220 km/h); red from `window.HaloWarn.at` (limit + warning margin, set in `updateWarn`), else the top eighth. Reads `HaloDim()` for brightness, `HaloSx` for the notch inset, `HaloDrives.tripKm` for the trip meter. Seven-segment digits are drawn as polygons (no font). Colour schemes in `SCHEMES` (s2000.js; `settings.s2kColor`, default sport): they tint bars, digits, LCD and dials (`LIT`/`GHOST`); printed scale and labels stay white (`TXT`). A sideways swipe in this theme cycles them (index.html `nextScheme`, swipe > 60 px, |dx| > 1.6 |dy|); other themes leave sideways swipes to DashPilot. Lamps draw only when on. Modern counts 0–9 (×10 mph, ×20 km/h; max 100 / 200). Its numbers use `sqText()`, a hand-built squared numeral set (stroked paths in `SQ`, no font file) after the original screen; captions stay Montserrat. Rows sit on a grid centred on the screen (gx = W/2), power starting right of the arc's 0 (PL), battery ending at BR; the light ahead sits above the speed. Reworked v1.14 after Dillon found v1.13 rough, using the frontend-design skill (critique, then a type and grid plan). Styles (`settings.s2kStyle`: classic | modern | redlcd; `drawModern`, `drawRedLcd` in s2000.js, sharing `blindSpots`, `turnArrow`, `carLamp`, `lightAhead`): each keeps its own colour in `settings.s2kColors[style]` (defaults sport / white / red; Classic falls back to the older `s2kColor`), resolved by `HaloS2kColour()`; the guide previews colours through `window.HaloS2kPreview` without saving. In S2000 the Display tab hides Arrange and puts S2000 style in column 1. Polish (v1.8): `GLOW` (off at renderQuality 1) adds shadowBlur to lit segments, dial bars, ticks, lamps; bar bloom is drawn shadow-only (stroke off-canvas, `shadowOffsetX` back) so it has no hard edge; the leading bar is white-hot; no face shape or outline behind the cluster (Dillon disliked both); LCD windows are recessed with glass. Blind spots: a red car-alongside lamp (`icon("car")`, waves facing outward) in that end of the bottom strip, plus that side's turn arrow tinted red; signalling into it (or `BlindSpot === 2`) pulses both and redraws every frame. (Earlier tries, a screen-edge bar and a glow along the face edge, were dropped: the edge glow overlapped labels.) First-run guide: `#tour`, `TOUR`, `maybeTour()` (on load after the version toast, and when the sheet closes), `settings.tourS2k` once finished or skipped; step 1 cycles `s2kColor` without saving and restores it.
- **Arrange screen (index.html, `MOVABLE`, `arrange()`, `applyMoves()`, `settings.moved[halo|matrix][id] = [dx/innerWidth, dy/innerHeight]`):** each piece keeps its layout slot and is shifted: fixed/absolute pieces by margin, others by `position: relative` + left/top (never `transform`/`translate`, which would become the containing block for the Matrix turn arrows inside `#spd`). Drags clamp to keep a third on screen. `setEditing(true)` while arranging. The bar sits bottom-centre (Halo) or top-left (Matrix) so it never covers a piece.
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

**Build number:** `HALO_VERSION` near the top of the main script in `index.html` (shown for 3.5 s at start and in the settings header). Raise it with every push and tell Dillon the number, so he can confirm the car has the latest build.

Commit to `halo-dashboard` (entry files at the root) and push. The raw.githack URL picks it up after a few minutes. Keep the PR folder in sync with the same files.

# Halo for Tesla

**Category:** web

Halo is the cluster a Model 3 or Model Y never had, for the legacy cars (2019–2024) and the Model 3 Highland / Model Y Juniper. A ring of light around the screen edge carries what you can catch without looking: it turns Autopilot blue when assist is on, an amber sweep runs toward the side you're turning, the edge on that side goes red (pulsing if urgent) when a car is in your blind spot, and on legacy cars a red bar grows along the top as you near a red light's stop line. The middle reads like Tesla's own UI: a large speed figure that turns amber, then deeper orange, once you're over the limit by an amount you choose, the P R N D stack, a thin power meter with green regen, a US or European speed-limit sign to match your units, the Autopilot wheel with the set speed, and a real-time 3D view of your car on the road. The car is your car: Model 3 or Model Y, original or refresh, in your paint, with that generation's tail lights. Its lanes bend with the steering wheel and scroll at your speed, brake lights glow under regen, neighbouring cars slide into the blind-spot lanes, and the stop line glows in the light's colour. Around it sit the quieter details: power in kW under the meter (green when regenerating), green turn arrows either side of the speed, car battery, phone battery and the clock along the top, and the odometer at the bottom, each following the app's Show car battery / Show phone battery / Show odometer settings. Day mode follows the app's dark-mode setting.

## Drives

- **Trip card:** shift into Park after a drive and Halo shows it: distance, time, efficiency in Wh/mi (Wh/km), energy used and energy won back by regen, plus this week's running totals. Energy comes from pack voltage × current (or the power meter when a source doesn't send them). If frames were missed while the screen was off, the odometer and the pack's energy counter fill the gap. Tap to close; it also clears when you shift out of Park.
- **This week:** each drive adds to Monday-to-Sunday totals (distance, average efficiency, number of drives), kept with the settings in the app's dash-app storage. Nothing leaves the phone.
- **0–60 mph (0–100 km/h) timer**, off by default: times launches from a standstill in Drive and shows the result only on the trip card once you've parked, never while driving.
- **Green-light nudge:** stopped at a red light that turns green, and still stopped 2 s later? The top of the ring glows green once. Legacy cars only, since the Juniper sends no traffic-light data.
- **Autopilot-off cue:** when assist drops out while you're moving, the blue ring drains away toward the bottom instead of just fading, so a disengagement is hard to miss.
- **Parked screensaver:** after a quiet minute in Park, Halo fades to a large clock, the date and battery %, with the ring breathing slowly. The clock and ring drift a few pixels each minute so a phone left in its mount doesn't burn in, and the 3D view pauses. A touch, a door, the seatbelt or a gear change wakes it.

## The 3D car

Everything is built in code with three.js, so there are no model files or textures to license. The body is one smooth surface lofted between side, plan and belt-line profiles drawn from published Model 3 / Model Y dimensions: the bullet nose, raked windscreen, glass roof running into the long rear glass, short deck, rounded tail and wide rear hips. Glass and black trim are regions of that surface, and the lamps are laid onto it as smooth strips that follow the bodywork: the original cars' wrap-around tail lamps, the Highland's slim C lamps and the Juniper's full-width light bar, plus swept headlights. Wheels have multi-spoke rims, tyres, discs and calipers, and there are door mirrors, flush handles, a plate and the trunk shut line. Paint and glass are clear-coated materials reflecting a small built-in studio. If WebGL isn't available, or the app's render quality is set to its lowest, Halo shows a flat 2D lane view instead, tinted to your paint.

## Settings

Long-press the dashboard to open Halo's settings, parked or on the move (handy for a passenger). Choices are saved with the app's dash-app storage. The sheet has three tabs: **Settings** (below), **Brightness** (further down) and **Drives**, which shows the drive in progress or the last one, this week's totals, the best 0–60, and switches for the 0–60 timer, green-light nudge and screensaver.

- **Theme (Display tab):** Halo, or Neon: speed and power on two glowing magenta arc gauges with your car between them, over soft out-of-focus city lights. Every ring signal moves onto the arcs: Autopilot turns their outline cyan, turn signals sweep along them, a blind spot lights the middle of that side, and a red light or the speed warning lights their tops. Neon is always dark and has its own layout.
- **Lane view:** turn the car-and-road view off; the speed moves to the centre and the light ahead moves under the sign.
- **Car:** Auto, Model 3 or Model Y.
- **Version:** Auto, Original, or Refresh (2024+ Model 3 Highland, 2025+ Model Y Juniper).
- **Paint:** Auto or one of twelve Tesla paints.
- **Traffic lights:** on by default. Turn it off to hide the light ahead everywhere: the bar along the top of the ring, the stop line and distance in the lane view, and the light readout when the lane view is off.
- **Speed warning:** Off, Speed (the number changes colour) or Both (the top of the ring lights too).
- **Warn above the limit by:** +0, +3, +5 or +10 mph (+0, +5, +10 or +15 km/h). Past that the speed turns amber, and 10 mph / 15 km/h further it turns a deeper orange. A one-unit margin stops it flickering at the threshold. Red is never used for speed, because on Halo red means a car in your blind spot or a red light.

**Brightness tab.** Dash apps can't change the phone's brightness or the car's lights, and no light sensor reaches them, so Halo dims its own light instead: the ring's glow and its text. Black stays black, so on an OLED phone this is real light saved. Red hazards, turn signals and the ring's speed warning stay at full strength.

- **Brightness:** Auto, or a fixed 100 / 80 / 60 / 40%.
- **Auto: at night:** 80, 60, 40 or 25%.
- **Auto: night is:** after sunset (estimated from the date and time zone, since dash apps don't get the phone's location; the tab shows the estimated times) or whenever the app's dark mode is on. It fades over half an hour around sunset and sunrise.

**Auto:** DashPilot doesn't send the VIN or paint to dash apps today, so Auto means Model 3, Original, Pearl White. Halo already reads `vin` and `exteriorColor` if a future version sends them: the VIN gives the model (4th character) and model year (10th), and the legacy `GTW_exteriorColor` code gives the paint. Your own choice always overrides.

## Legacy and Juniper

- The Juniper sends no traffic-light or stop-line data (`DAS_road` is static there), so those never show. On both cars, the top of the ring shows the speed warning when no light is showing.
- The legacy DashKit set speed is marked unreliable in `bridge/car/cars/tesla.h`. If it follows the current speed through a change while assist is on, Halo hides the number and keeps only the blue wheel.
- `adasOn` means Autosteer on the legacy cars and cruise on the Juniper. Halo follows it either way.

## Data used

`egoSpeed`, `gear`, `leftBlinker`, `rightBlinker`, `leftBlindSpot`, `rightBlindSpot`, `alwaysOnBlindSpotMonitor`, `adasOn`, `accSetSpeed`, `fusedSpeedLimit`, `egoSteeringAngle`, `trafficLightColor`, `stopLineDist`, `powerLevel`, `nominalEnergyRemaining`, `fullPackEnergy`, `energyBuffer`, `buckleStatus`, `anyDoorOpen`, `isImperial`, `darkMode`, `renderQuality`, `currentTime`, `dataSourceType`, `maxRegenPower`, `maxDischargePower`, `packVoltage`, `packCurrent`, `odometer`, `phoneBattery`, `showCarBattery`, `showPhoneBattery`, `showOdometer`, and `vin` / `exteriorColor` if ever sent.

Opened in a desktop browser, it plays a built-in 66-second demo drive that ends by parking, so the trip card shows. Add `#day`, `#metric`, `#juniper` or `#novis` to the URL to try the other modes. The demo never runs inside DashPilot, so a dropped connection can't turn into a fake drive.

Size: about 0.81 MB without the preview, most of it three.js.

## Credits

- **three.js** r160 by the three.js authors, MIT License, from [npm](https://www.npmjs.com/package/three) / [github.com/mrdoob/three.js](https://github.com/mrdoob/three.js). License included as `LICENSE-three.txt`.
- **Montserrat** by The Montserrat Project Authors, SIL Open Font License 1.1, from [Google Fonts](https://fonts.google.com/specimen/Montserrat) / [github.com/JulietaUla/Montserrat](https://github.com/JulietaUla/Montserrat). License included as `fonts/OFL.txt`.
- The 3D car, the 2D car drawing, the icons, the paint colour values and all other code are my own work, contributed under this repo's MIT license. Tesla, Model 3 and Model Y are trademarks of Tesla, Inc., used only to name the cars this dashboard is for.

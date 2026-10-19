# Halo for Tesla

**Category:** web

Halo is the cluster a Model 3 or Model Y never had, for the legacy cars (2019–2024) and the Model 3 Highland / Model Y Juniper. A ring of light around the screen edge carries what you can catch without looking: it turns Autopilot blue when assist is on, an amber sweep runs toward the side you're turning, the edge on that side goes red (pulsing if urgent) when a car is in your blind spot, and on legacy cars a red bar grows along the top as you near a red light's stop line. The middle reads like Tesla's own UI: a large speed figure that turns amber, then deeper orange, once you're over the limit by an amount you choose, the P R N D stack, a thin power meter with green regen, a US or European speed-limit sign to match your units, the Autopilot wheel with the set speed, and a real-time 3D view of your car on the road. The car is your car: Model 3 or Model Y, original or refresh, in your paint, with that generation's tail lights. Its lanes bend with the steering wheel and scroll at your speed, brake lights glow under regen, neighbouring cars slide into the blind-spot lanes, and the stop line glows in the light's colour. Day mode follows the app's dark-mode setting.

## The 3D car

Everything is built in code with three.js, so there are no model files or textures to license. The body is one smooth surface lofted between side, plan and belt-line profiles drawn from published Model 3 / Model Y dimensions: the bullet nose, raked windscreen, glass roof running into the long rear glass, short deck, rounded tail and wide rear hips. Glass and black trim are regions of that surface, and the lamps are laid onto it as smooth strips that follow the bodywork: the original cars' wrap-around tail lamps, the Highland's slim C lamps and the Juniper's full-width light bar, plus swept headlights. Wheels have multi-spoke rims, tyres, discs and calipers, and there are door mirrors, flush handles, a plate and the trunk shut line. Paint and glass are clear-coated materials reflecting a small built-in studio. If WebGL isn't available, or the app's render quality is set to its lowest, Halo shows a flat 2D lane view instead, tinted to your paint.

## Settings

Long-press the dashboard while stopped to open Halo's settings. Like the Compose editor, it won't open above 3 and closes itself once you drive off. Choices are saved with the app's dash-app storage.

- **Lane view:** turn the car-and-road view off; the speed moves to the centre and the light ahead moves under the sign.
- **Car:** Auto, Model 3 or Model Y.
- **Version:** Auto, Original, or Refresh (2024+ Model 3 Highland, 2025+ Model Y Juniper).
- **Paint:** Auto or one of twelve Tesla paints.
- **Speed warning:** Off, Speed (the number changes colour) or Both (the top of the ring lights too).
- **Warn above the limit by:** +0, +3, +5 or +10 mph (+0, +5, +10 or +15 km/h). Past that the speed turns amber, and 10 mph / 15 km/h further it turns a deeper orange. A one-unit margin stops it flickering at the threshold. Red is never used for speed, because on Halo red means a car in your blind spot or a red light.

**Auto:** DashPilot doesn't send the VIN or paint to dash apps today, so Auto means Model 3, Original, Pearl White. Halo already reads `vin` and `exteriorColor` if a future version sends them: the VIN gives the model (4th character) and model year (10th), and the legacy `GTW_exteriorColor` code gives the paint. Your own choice always overrides.

## Legacy and Juniper

- The Juniper sends no traffic-light or stop-line data (`DAS_road` is static there), so those never show. On both cars, the top of the ring shows the speed warning when no light is showing.
- The legacy DashKit set speed is marked unreliable in `bridge/car/cars/tesla.h`. If it follows the current speed through a change while assist is on, Halo hides the number and keeps only the blue wheel.
- `adasOn` means Autosteer on the legacy cars and cruise on the Juniper. Halo follows it either way.

## Data used

`egoSpeed`, `gear`, `leftBlinker`, `rightBlinker`, `leftBlindSpot`, `rightBlindSpot`, `alwaysOnBlindSpotMonitor`, `adasOn`, `accSetSpeed`, `fusedSpeedLimit`, `egoSteeringAngle`, `trafficLightColor`, `stopLineDist`, `powerLevel`, `nominalEnergyRemaining`, `fullPackEnergy`, `energyBuffer`, `buckleStatus`, `anyDoorOpen`, `isImperial`, `darkMode`, `renderQuality`, `currentTime`, `dataSourceType`, and `vin` / `exteriorColor` if ever sent.

Opened in a desktop browser, it plays a built-in 48-second demo drive. Add `#day`, `#metric`, `#juniper` or `#novis` to the URL to try the other modes. The demo never runs inside DashPilot, so a dropped connection can't turn into a fake drive.

Size: about 0.75 MB without the preview, most of it three.js.

## Credits

- **three.js** r160 by the three.js authors, MIT License, from [npm](https://www.npmjs.com/package/three) / [github.com/mrdoob/three.js](https://github.com/mrdoob/three.js). License included as `LICENSE-three.txt`.
- **Montserrat** by The Montserrat Project Authors, SIL Open Font License 1.1, from [Google Fonts](https://fonts.google.com/specimen/Montserrat) / [github.com/JulietaUla/Montserrat](https://github.com/JulietaUla/Montserrat). License included as `fonts/OFL.txt`.
- The 3D car, the 2D car drawing, the icons, the paint colour values and all other code are my own work, contributed under this repo's MIT license. Tesla, Model 3 and Model Y are trademarks of Tesla, Inc., used only to name the cars this dashboard is for.

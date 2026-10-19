## Halo for Tesla (web)

<!-- Drag the 30–60 s screen recording of Halo running in DashPilot (Demo data source) here. -->

The cluster a Model 3 / Model Y never had, for the legacy cars (2019–2024) and the Model 3 Highland / Model Y Juniper.

**A ring of light around the screen edge** carries what you can catch without looking:
- **Autopilot:** blue all around while assist is on
- **Turn signals:** an amber sweep toward the side you're turning
- **Blind spots:** a red edge on that side, pulsing when urgent
- **Red light ahead:** grows along the top as you near the stop line (legacy cars)
- **Speed warning:** amber, then deeper orange, when you pass the offset you chose

**The middle reads like Tesla's own UI:**
- a large speed with green turn arrows either side
- the P R N D stack
- a power meter with kW (green regen)
- a US or EU speed-limit sign to match your units
- the Autopilot wheel with the set speed
- a real-time 3D view of your car on the road, built in code: Model 3 or Model Y, original or refresh, in your paint, with that generation's lamps, plus neighbours in the blind spot and the stop line
- car battery, phone battery, clock and odometer, following the app's display settings

**Settings:** long-press while stopped. Lane view, car, version, paint, speed warning and its offset. Saved with `setAppData` / `appData`. It won't open above 3 and closes when you drive off.

**Legacy vs Juniper:** Halo handles the Juniper's missing `DAS_road` data, and hides the legacy set speed if it just mirrors the current speed (see the TODO in `bridge/car/cars/tesla.h`).

- Offline: no network requests. About 0.79 MB without the preview.
- Android (`onCarStateUpdate` / `NativeCarState`) and iOS (`receiveMessage`) are both handled. The browser demo loop never runs inside the app. The 2D lane view replaces the 3D one without WebGL or at the lowest render quality.
- Assets: three.js r160 (MIT) and Montserrat (SIL OFL), with licenses included. The car, icons and code are my own.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

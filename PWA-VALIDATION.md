# Phase 4 PWA validation

## Completed on 5 November 2026

- The production frontend build generated a versioned service worker and passed its JavaScript/CSS budgets.
- All four manifest icons exist at their declared paths and dimensions. The new 192 px and 512 px maskable icons have opaque backgrounds and keep the brigade emblem inside the central safe area.
- Local HTTPS returned the page, manifest, service worker, offline page, and maskable icon with successful responses and appropriate content types.
- In Edge on Windows, the worker installed and controlled the page. Chromium reported no installability errors. Simulated disconnection displayed the in-page offline notice. After stopping a temporary production preview server, navigation displayed the cached offline page. A changed worker displayed “Reload now”; choosing it activated the update and reloaded the page.
- Automated tests confirm that API, authentication, CSRF, and cross-origin requests bypass the service worker. Attendance submissions are **not** queued offline.

## Device checks still needed

The following browsers and devices were unavailable in this Windows workspace. Complete these checks against the deployed staging URL over trusted HTTPS. A local LAN certificate must be trusted by each device for service workers to run.

| Target | Installation and behavior to check |
| --- | --- |
| Android Chrome | Install from browser menu; confirm icon, standalone launch, offline notice and fallback, reconnect, update prompt. |
| iPhone Safari and Home Screen | Add to Home Screen; confirm icon/title, safe areas, standalone launch, offline fallback, reconnect, update prompt. |
| iPad Safari | Add to Home Screen; confirm tablet layout, safe areas, offline fallback, update prompt. |
| Desktop Chrome | Confirm installability, installed launch, offline fallback, update prompt. |
| Desktop Edge | Complete an interactive OS install; automated worker, installability, offline, and update checks passed. |
| Desktop Firefox | Confirm page and offline fallback; installation UI depends on browser support. |
| Desktop Safari | Confirm page, installation or Dock behavior, offline fallback, update prompt. |

For each target, first load the app online and allow the service worker to install. Disconnect the network while the page is open to check the notice. Navigate to a new page while disconnected to check the fallback. Reconnect and retry. Deploy a new frontend build, return to the app, and check that the update prompt waits until the user chooses to reload. Check that attendance submission and admin operations require an online connection and do not replay after reconnecting.

The worker caches only public static assets and the offline page. It does not store authenticated pages or API responses. If rolling back the PWA, unregister `/sw.js` and clear caches named `jrfb-static-*` in browser site data after deploying the previous frontend; installed Home Screen copies may need to be closed and reopened.

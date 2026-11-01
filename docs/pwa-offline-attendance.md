# Installable INCA and offline faculty attendance

INCA remains a browser-based React application on Netlify with its existing Render API. It can also be installed as a Progressive Web App. No app store, APK, dependency upgrade, or database migration is required.

## Using the feature

1. Open the home page or post-login hub and choose **Download / Install app**. Supported browsers offer their installation prompt. Otherwise, the button explains Chrome/Edge installation and Safari's Share → Add to Home Screen flow.
2. Sign in while connected. The hub now immediately loads the approved profile name/photo and provides a profile card. The header and sidebar use the same identity; opening the profile page is no longer required first.
3. Faculty accounts automatically prepare today's classes and authorized student rosters. **Prepare today’s classes** refreshes them manually. Check the prepared-class count and **App files ready for offline use** before leaving connectivity. Dates use Asia/Kolkata.
4. Open **Take attendance**, select a class, and mark students by swipe or list. Each change is committed to device storage. Drafts survive closing/reloading the app. The existing default of marking roster students present is preserved; review before submitting.
5. Submit the class. The UI distinguishes **saved locally / waiting for upload** from **uploaded / locked**. Pending local submissions cannot be edited accidentally.
6. When the app is open and connected, it automatically retries on reconnection, return to the app, and a one-minute interval. **Sync now** also retries immediately. Cloud confirmation is required before the local copy is marked uploaded.

Keep the same device/browser and sign in to the same faculty account for unsynced records. Signing out does not discard pending attendance. Do not clear site data while uploads are pending. A class not prepared while online cannot download its roster without connectivity. Reopening after midnight prepares the new campus day when connected; older unsent classes remain in the queue.

Automatic sync is a foreground/resume workflow. Mobile operating systems may suspend or close an app; this implementation does not promise uploads while the app is closed. Reopen INCA after reconnecting and confirm the waiting count reaches zero. Browser storage eviction, private browsing, a lost device, or clearing site data can remove local data; pending/conflict panels provide **Download local copy** as an additional manual backup.

## Data and safety behavior

- IndexedDB `inca-attendance-v1` stores lecture metadata, authorized roster identifiers/names, draft marks, baseline cloud status, and sync state. Keys include account ID, campus date, and schedule ID. App-level reads are account-scoped. Tokens are not stored in this database or service-worker cache.
- A service worker precaches versioned application assets and the HTML shell. It does not cache authenticated API responses, profile photos, or mutations. All API requests retain normal authentication and authorization.
- A network outage or server failure does not clear an existing local signed-in workspace. Server authentication rejection still ends the session. Reauthentication is required before cloud writes when the session expires.
- Local writes are serialized and use revision comparisons. A stale tab cannot silently overwrite a newer local submission. Preparation/sync operations use Web Locks where supported.
- Today's faculty rosters are prepared at login and refreshed while the app is active. An individual failed preparation does not prevent other classes being prepared. Admin/HOD/coordinator attendance preparation is available manually within existing permissions; their campus/department oversight is unchanged.
- Old prepared/uploaded copies expire after seven days. Draft, pending, and conflicting attendance are retained for reconciliation. Prepared rosters are not silently replaced after marking starts.
- Before upload, the client checks cloud state and current roster. Exact retries of already uploaded attendance are accepted without writing twice. Different cloud marks, changed enrollment, cancelled lectures, or revoked access retain the local copy and display **Needs review**.
- A conflict is not automatically merged. Expand its panel, download the retained copy, and review with the HOD/admin against the live roster or existing audited correction workflow. **Recheck cloud** retries validation; it never forces an overwrite.

## Atomic API

`POST /api/v1/attendance/sessions/:sessionId/sync`

Allowed roles: FACULTY, HOD, COORDINATOR, ADMIN, with the existing write scope applied inside the transaction. SUPER_ADMIN and STUDENT cannot use this write route.

```json
{
  "baseline": "[[\"student-id\",\"PRESENT\"]]",
  "records": [{ "studentId": "student-id", "status": "ABSENT" }]
}
```

`baseline` is the sorted student/status signature from preparation. The server validates a complete current active roster, rejects duplicate IDs and stale cloud baselines, saves marks, and locks the lecture in a serializable Prisma transaction. Exact submitted retries return the existing session. Business conflicts return 409; authorization failures return 403; serialization conflicts return a retryable 503. Existing tables, role policy, and audited correction endpoints are preserved.

The frontend performs a subsequent authenticated read and verifies the submitted status and complete records before displaying upload confirmation. During a rolling deployment, an unavailable new sync route retains the queue for retry.

## Build and deployment

`scripts/pwa-build.mjs` is a Vite build plugin using Node built-ins. It generates `dist/sw.js` from all emitted hashed assets, so attendance and auth routes can load offline even if their lazy chunks were not previously visited. Cache names change with each build. Service-worker updates wait for existing app tabs to close, avoiding a forced reload during attendance taking. `/sw.js` and the manifest revalidate; hashed assets remain immutable.

The web manifest, 192px/512px icons, Apple touch icon, installation instructions, and theme color are included. Netlify's existing SPA rewrites and authentication proxy remain in place. Deploy the backend commit to Render as well as the frontend to Netlify for the atomic sync endpoint.

Installation behavior follows the browser's support and eligibility rules: [MDN installability guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable). Foreground/offline expectations follow [MDN's offline operation guidance](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation).

## Verification

- Backend attendance regression suite: **103 tests passed**, including 8 new offline-service checks for authorization scope, serializable transaction configuration, exact retries, locked differences, changed/duplicate roster, baseline changes, cancellation, and retryable serialization errors. Tests use mocks/HTTP test apps, not the configured database.
- Frontend sync protocol: **11 tests passed**, including campus-date boundaries, normal sync, interrupted retries, atomic operation selection, roster/cloud conflicts, network failure, missing marks, and absent cloud confirmation.
- Real browser IndexedDB checks: committed marks read back; another account's reads return no roster; stale revision and duplicate preparation writes are rejected; pending attendance survives rejected writes.
- Browser production-build exercise: faculty hub shows approved photo/name without visiting profile; today's roster prepares automatically; service-worker files become ready; local server is stopped completely; attendance page reloads from cache; a mark is changed offline; draft survives reload; submit remains queued through another reload; after reconnecting, sync confirms the correct absent mark and submitted state.
- UI checks include profile dropdown, installation fallback instructions, phone-width hub and attendance views. Synthetic data and local loopback services were used. No live attendance or profile records were changed.
- Frontend TypeScript/Vite/Netlify build, backend build, and frontend lint pass (lint has existing and advisory warnings).

Physical iOS/Android installation and real-device radio transitions remain device acceptance checks; the in-app test browser cannot complete native OS installation.

Reproduce: `node --test scripts/offline-attendance.test.mjs` from `frontend`; `npm test -- --runInBand attendance` from `backend`. Build frontend with local `/api/v1` environment values and run `node scripts/pwa-preview-server.mjs` for the loopback-only production preview. `/__fixture` signs in a synthetic faculty account; `/__controls` disconnects/reconnects its synthetic API. Stop the preview server entirely to test service-worker navigation fallback. The development preview also serves `scripts/offline-storage-check.html` for real IndexedDB checks. These helpers are excluded from the production app bundle.

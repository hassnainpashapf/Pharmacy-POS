# System Optix Inventory on phones

`/mobile` is the shared inventory module, with its own server-backed accounts and permissions. It opens directly without the desktop POS login or sidebar. The desktop **Mobile Inventory** link is a convenience; it does not grant shared permissions. Administrators and explicitly granted staff can add medicines and stock; other signed-in staff can view inventory.

**This is separate from the legacy POS.** Existing browser/localStorage products, staff, sales, stock, purchasing and reports are not imported or synchronized. Both phones must use the same running backend/database. There is no external medicine lookup: a known barcode selects saved metadata; a new barcode requires real medicine details.

## Local setup on the computer

Requirements: Node.js/npm and Python 3.10+. From this repository, install frontend dependencies with `npm install` (or `npm ci` with the committed lockfile). One command starts both frontend and inventory API:

```sh
npm run dev
```

The launcher starts the API on loopback port 8787 before Vite. If a healthy inventory API is already running, it reuses it. Ctrl+C stops only child processes it started; it does not stop a reused backend. For production, run the backend and HTTPS reverse proxy as described below. No default administrator is created by the launcher.

Open **http://127.0.0.1:5173/mobile** on this computer. Create the first administrator locally before allowing remote access. There are no default credentials or seeded medicines. Keep using the same hostname: localhost and 127.0.0.1 have separate cookies. Create staff accounts in the module and explicitly grant inventory management when needed.

Vite listens only on `127.0.0.1:5173` by default and refuses to silently switch ports. `/api/mobile` is proxied to `http://127.0.0.1:8787` with the browser's exact `Origin` and `Host` preserved. The proxy forwards the client address; remote requests cannot qualify as local first-admin setup. Backend origin configuration and account/security details are in [server/README.md](server/README.md).

For an intentional LAN-only development preview, `npm run dev -- --host 0.0.0.0` exposes the frontend on local interfaces. Configure the backend's `MOBILE_ORIGINS` for each exact preview origin, including its port; restart the backend. Complete setup on loopback first. Do not forward these development ports to the public internet. Plain LAN HTTP can preview the UI but does **not** provide phone camera/PWA readiness.

## HTTPS deployment and installation

1. Complete local administrator setup and retain the private SQLite database.
2. Run `npm run build` to create `dist/`.
3. Serve `dist/` through a TLS reverse proxy on a hostname reachable by both phones. The certificate must be trusted by both devices. Use the same origin for frontend and `/api/mobile`; route API requests to the private backend **before** the SPA fallback to `index.html`. The Caddy example in [server/README.md](server/README.md#https-for-android-and-iphone) includes local-only setup blocking and the SPA fallback. `vite preview` alone does not provide the backend proxy or HTTPS deployment.
4. Start the backend with `MOBILE_ORIGINS=https://your-actual-hostname` and `MOBILE_SECURE_COOKIES=1`. Preserve browser `Origin` and external `Host`; overwrite untrusted forwarding headers at the edge. Keep port 8787 private. Do not place the database in `dist/` or any served directory.
5. Serve `/sw.js` with `Cache-Control: no-cache` (or equivalent revalidation), and revalidate `index.html`. Deploy the complete build atomically; keep prior hashed assets temporarily available for already-open tabs. The worker itself stores no HTML app bundles or API responses.
6. On **Android Chrome**, visit `https://your-actual-hostname/mobile`, sign in, then use **Install app** or **Add to Home screen** from the browser menu. On **iPhone Safari**, visit that same URL, use **Share → Add to Home Screen**, then sign in in the installed app if requested. Browser wording/install prompts vary. Grant camera permission when scanning; manual barcode entry remains available.

The installed app opens `/mobile` as **System Optix Inventory**. The supplied manifest has 192px/512px PNG maskable-safe icons and a 180px Apple touch icon. A phone's `localhost` points to the phone, not this computer. Merely running the local commands does not provision DNS, trusted certificates or a reachable phone deployment. The server and reverse proxy must remain running.

## Connectivity, updates and cache boundaries

- All shared reads and writes need the server. Refresh inventory to see changes made on another phone. No offline write queue, background sync, or automatic legacy POS synchronization is implemented.
- Production registers `/sw.js`; only explicit public icons, the manifest and an explanatory offline page are cached using credential-free requests. `/api`, authorization-bearing requests, non-GET requests, third-party requests, source modules and built bundles are not cached. Navigations use the network and fall back to the static offline explanation on a network failure, never a cached signed-in screen.
- Existing open mobile screens may retain in-memory data, but it is not a fresh server confirmation. Check the UI's connection/save result. If a save result is uncertain, resolve it before creating another stock addition.
- An initial successful production visit/worker install is necessary for the offline explanation. It does not make inventory usable offline. Reopening a built app while offline shows the explanation rather than an old application build.
- Activation removes only this app's old cache names, including the unsafe legacy `pharmacy-pos-v1` cache. Other applications' caches are untouched.
- Development registers no worker. If this origin has this app's root `/sw.js` registration, startup unregisters it, deletes only its cache namespaces, and reloads once when needed to release the old controller. Other scripts/scopes are not unregistered. After deploying the replacement over a legacy worker, one online refresh may be needed to obtain the new worker and remove old caches.

## Checks

```sh
node --test tests/pwa.test.mjs
npm run build
```

The PWA checks exercise service-worker pass-through, credential-free static caching, sensitive-response rejection, offline fallback, namespace-limited cleanup, development registration cleanup, manifest/icon dimensions, and Vite proxy configuration. Actual camera permission, barcode detection and installation require testing the trusted HTTPS deployment on the target Android/iPhone devices.
# Medicine label photo scanning

The primary mobile scan action now reads **printed medicine text**, not a barcode. Take or choose a clear image of the box/strip. The local Tesseract engine suggests English/Latin name, strength, form and explicitly labelled Rs/PKR/MRP values. These are unverified OCR drafts, not clinical identification. Photos remain in browser memory and are not uploaded or saved.

Review/edit the name and printed price, explicitly choose per-unit or per-pack price basis, then use an existing verified medicine match or review a new medicine form. Actual pharmacy buying price is a separate required input: it is never inferred from MRP. Batch, expiry, quantity and prices must be confirmed before the server commits stock. Barcode lookup remains an optional secondary tool.

`npm run dev` and `npm run build` copy versioned OCR worker/model dependencies to generated `public/ocr/`; no CDN is required. OCR can fail on blurry images, Urdu-only text and unsupported formats. Take another photo or enter details manually. First load downloads the engine/model from this installation. Real iPhone/Android camera and install testing remains necessary on trusted HTTPS.

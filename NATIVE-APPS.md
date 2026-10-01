# Native app readiness

The repository contains Capacitor projects in `android/` and `ios/`, plus Electron packaging for Windows/macOS. The mobile client can use a cloud API URL in native mode: set `pharmacy_cloud_api_url` in the app's local storage/configuration to the HTTPS origin (for example `https://inventory.example.com`) before sign-in. Browser development continues to use the Vite `/api/mobile` proxy.

## Build requirements

Use Node.js **22+**. Capacitor 8 and Electron 44 do not support the current Node 21 runtime.

```sh
npm ci
npm run build
npm run mobile:sync
npm run android:open   # Android Studio/SDK
npm run ios:open       # macOS + Xcode + signing
```

Windows/macOS packaging:

```sh
npm run electron:build:win
npm run electron:build:mac
```

A Windows installer cannot be produced/tested on macOS without a Windows runner. Android/iPhone camera permissions are declared, but physical camera/OCR testing and Play Store/App Store signing remain deployment steps.

## Important current limit

Native mobile builds are cloud-first and require HTTPS for login, inventory and OCR stock commits. The local Python SQLite API is not bundled into the Electron installer yet. Offline reads/writes, encrypted local storage, conflict resolution and scheduled 10-minute sync are **not** silently simulated; they require a tested local outbox and server sync endpoint before production enablement.

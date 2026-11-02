# Android setup

PlateUp keeps its React frontend and wraps it as an Android app with Capacitor. The FastAPI backend remains a separate service.

## Requirements

- Node.js 22 or newer and npm.
- Android Studio with the Android SDK and an emulator or USB-debugging-enabled device.
- JDK 21 (Android Studio's bundled JBR is recommended).

## Configure the API

The Android WebView cannot use `localhost` to reach a backend running on the development computer. Configure a reachable HTTPS API URL before building:

1. Copy `frontend/.env.android.example` to `frontend/.env.android`.
2. Set `VITE_API_BASE_URL` to the backend URL ending in `/api`. For local development, expose the backend through an HTTPS development tunnel; for regular use, deploy the API with HTTPS.
3. The backend CORS allow-list already includes `https://localhost`, the Capacitor Android web origin.

Android builds intentionally stop if this URL is missing or is not HTTPS. Regular web development still uses `http://localhost:8000/api` by default.

Do not put API keys, passwords, or other secrets in `VITE_*` variables: Vite embeds them in the app bundle.

## Generate, sync, and run

From `frontend`, install dependencies and generate the Android native project once:

```powershell
npm ci
npx cap add android
```

Then build the web assets, copy them into Android, and open the native project:

```powershell
npm run android:sync
npm run android:open
```

In Android Studio, wait for Gradle sync, select an emulator or connected device, and press **Run**. Alternatively, with Android Studio, the SDK, and Java configured on `PATH`, run `npm run android:run`.

After changing frontend code, run `npm run android:sync` again before launching the Android app so the native project receives the latest web build.

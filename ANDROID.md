# Android setup

PlateUp keeps its React frontend and wraps it as an Android app with Capacitor. The FastAPI backend remains a separate service.
The result is an installable Android package; its interface runs in the app's embedded WebView rather than the phone's browser.

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

## Build an APK on GitHub (no local Android Studio)

The repository includes a manual GitHub Actions workflow that builds a debug APK and publishes it as a downloadable artifact:

1. In the GitHub repository, open **Settings → Secrets and variables → Actions → Variables** and add a repository variable named `VITE_API_BASE_URL` with the deployed HTTPS API URL ending in `/api`. This URL is public app configuration, not a secret; do not put credentials in it.
2. Commit and push the Android project and workflow to GitHub.
3. Open **Actions → Build Android APK → Run workflow** and start the workflow on `main`.
4. When it finishes, open the run summary and download the `plateup-debug-apk` artifact.
5. Extract `app-debug.apk`, transfer it to the Android phone, and install it. Android may ask permission to install apps from that source.

The APK is a debug build intended for testing, not Play Store release. Play Store publishing requires a separately signed release build and signing-key management.

## Deploy the backend with a persistent free database

The repository includes a Render Blueprint in `render.yaml` for the FastAPI service. It uses Render's free web-service plan and connects to Neon Postgres, whose free plan does not automatically delete the project or data. No cloud resources are created until you import the Blueprint from your own Render account.

A newly created Neon database starts empty; it will not contain users or planner data from your local PostgreSQL database. Export/import existing data separately if you need to preserve it.

Free plans have limits: Render may spin down the API after inactivity, so the first request can take about a minute. Neon scales database compute to zero after five idle minutes and resumes it on a query. Neon Free currently includes 1 GB of database storage and 100 compute-hours per month; reaching its quotas can suspend compute or block writes until the quota resets or the plan changes. Check each provider's current pricing and limits before relying on the service.

### Create the Neon database

1. Create a Free project at Neon and create/select its default database branch.
2. In the Neon console, select **Connect** and copy the connection string for the database. Keep it private; it contains the database password.

### Deploy the Render Blueprint

1. Push `render.yaml` to the GitHub repository.
2. In Render, choose **New → Blueprint**, connect the PlateUp repository, and review the resources and plans before applying them. The Blueprint requests a Free web service; Neon remains a separate provider.
3. When prompted for `DATABASE_URL`, paste the Neon connection string. Never commit it or share it in chat.
4. If recipe generation through Gemini is needed, add `GEMINI_API_KEY` later in the Render service's Environment settings. It is optional for the rest of the app.
5. Apply the Blueprint and wait for the service deployment. The start command applies Alembic migrations before starting FastAPI.
6. Test `https://<your-render-service>.onrender.com/health`; it should return `{"status":"ok"}`.
7. Set the GitHub Actions repository variable `VITE_API_BASE_URL` to `https://<your-render-service>.onrender.com/api`, then run **Actions → Build Android APK → Run workflow** and install the new APK.

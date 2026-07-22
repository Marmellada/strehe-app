# Inspection Lab Mobile

A mobile inspection companion app for the Inspection Lab engine. Field workers use this to capture baseline (check-in) and inspection photos, then export them to the laptop engine for processing.

## What this app does

1. **Onboarding** — one-tap account setup (no server needed)
2. **Apartment registration** — name, address, auto-generated property ID like `PROP-0001`
3. **Room setup** — add Living Room, Master Bedroom, Bathroom with predefined zones from the v1.5 architecture
4. **Check-in / Baseline capture** — guided photo steps for each room (wide + zone close-ups) stored as baseline
5. **Inspection capture** — same guided steps for current-condition photos, using the real camera with on-screen guidance
6. **Export** — packages baseline + inspection photos + `room_setup.json` + `run_manifest.json` into a shareable folder
7. **Report import** — paste the `review_result.json` from the laptop engine to view findings on the phone

## Tech stack

- Expo SDK 52
- React Native
- expo-camera (real camera with guided overlays)
- expo-sqlite (offline local database)
- expo-file-system (local photo storage)
- expo-sharing (export to Google Drive, WhatsApp, USB, etc.)

## Folder structure

```
mobile-app/
├── App.js                        # Entry point
├── src/
│   ├── constants/zones.js        # Room types, zones, capture templates from v1.5 architecture
│   ├── storage/database.js       # SQLite schema + CRUD
│   ├── navigation/AppNavigator.js # Stack navigator
│   ├── screens/
│   │   ├── OnboardingScreen.js
│   │   ├── DashboardScreen.js
│   │   ├── ApartmentSetupScreen.js
│   │   ├── RoomSetupScreen.js
│   │   ├── CheckinScreen.js
│   │   ├── InspectionStartScreen.js
│   │   ├── InspectionCaptureScreen.js   # real camera + guided overlay
│   │   ├── InspectionDetailScreen.js    # export button
│   │   ├── ReportScreen.js
│   │   └── SettingsScreen.js          # import review_result.json
│   └── utils/exportEngine.js    # Export to engine-compatible format
├── assets/
│   ├── icon.png
│   ├── splash.png
│   └── adaptive-icon.png
└── package.json
```

## Quick start (test on your phone without building APK yet)

### 1. Install dependencies

```bash
cd D:\Personal\Projects\Strehe-Prona\strehe-app\inspection-lab\mobile-app
npm install
```

### 2. Start Expo

Copy `.env.example` to `.env.local` and set only the public mobile values:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_publishable_key
```

The mobile app accepts only a Supabase publishable key. Never place `SUPABASE_SERVICE_ROLE_KEY` or another server secret in an `EXPO_PUBLIC_` variable. Real mobile `.env` files are ignored by Git.

Then start Expo:

```bash
npx expo start
```

### 3. Run on your phone

- Install **Expo Go** from Google Play Store
- Scan the QR code in the terminal
- The app opens on your phone

## Build APK (Android)

### Option A: EAS Build (recommended, no Android Studio needed)

1. Install EAS CLI:
```bash
npm install -g eas-cli
```

2. Log in (free Expo account):
```bash
eas login
```

3. Configure build:
```bash
eas build:configure
```

4. Build APK:
```bash
eas build -p android --profile preview
```

This builds in the cloud and gives you a downloadable APK.

### Option B: Local build (requires Android Studio)

```bash
npx expo run:android
```

This requires Android Studio and a lot of disk space. EAS Build is easier.

## Workflow: Phone → Laptop Engine → Phone Report

```
Phone app
  ├─ Capture baseline photos (check-in)
  └─ Capture inspection photos
        ↓
  Export folder via Share (WhatsApp, Drive, USB, etc.)
        ↓
Laptop (RTX 1650)
  ├─ Place photos into inspection-lab/test-data/
  ├─ Run: node inspection-lab/scripts/run-local-e2e-inspection.mjs ...
  └─ Get review_result.json
        ↓
Phone app
  └─ Settings → Paste review_result JSON → View Report
```

## Integration with STREHË later

When the production integration is ready (PRODUCTION_INTEGRATION_PLAN.md), this app can:
- Sync apartments/rooms to Supabase
- Upload photos to Supabase Storage
- Poll for inspection jobs
- Display the review queue

For now, it stays offline-first so you can test in the field without internet.

## Known limitations for v1

- Camera capture is real, but the preview area in CheckinScreen is a placeholder (InspectionCaptureScreen uses the real camera)
- Zone crop rectangles are simplified (full-image placeholders) because the engine generates real crops on the laptop
- No direct WiFi sync to laptop yet — use Share/export
- No Supabase integration yet (local-only per AGENTS.md)

## Next steps to improve

1. Add real camera preview to CheckinScreen (currently uses a placeholder for baseline capture)
2. Add WiFi direct-sync mode so the laptop engine can pull jobs automatically (Phase 3 of PRODUCTION_INTEGRATION_PLAN.md)
3. Add PDF report generation on the phone
4. Add photo quality checks (blur, darkness detection) before allowing confirm
5. Connect to STREHË auth and properties when production integration is approved

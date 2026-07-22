# Supabase + Engine Integration Setup Guide

This connects the **Inspection Lab Mobile** app to your **Supabase** backend and your **laptop engine** so the full workflow runs automatically.

---

## Step 1: Get your Supabase credentials

Go to your Supabase Dashboard → Project Settings → API.

You need **3 values**:

| Value | Where to find | What it's for |
|---|---|---|
| **Project URL** | `https://xxxx.supabase.co` | The connection URL |
| **Publishable Key** | `sb_publishable_...` public API key | The mobile app (phone) uses this |
| **Service Role Key** | server-side secret API key | The laptop worker uses this (can bypass RLS) |

⚠️ **Never share the Service Role Key.** It has full database access.

---

## Step 2: Configure local environment files

### 2A — Mobile app (phone)

Copy `inspection-lab/mobile-app/.env.example` to `inspection-lab/mobile-app/.env.local`, then set:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_publishable_key
```

The Expo app reads these variables in:
```
inspection-lab/mobile-app/src/storage/supabase.js
```

Only the publishable key is accepted. Never place the service-role key or any other server secret in an `EXPO_PUBLIC_` variable. Real mobile `.env` files remain ignored by Git.

### 2B — Laptop worker

Set the worker's server-side credential in the repository-root `.env.local`:

```dotenv
SUPABASE_SERVICE_ROLE_KEY=replace_with_rotated_server_secret
```

The worker reads it from the environment in:
```
inspection-lab/scripts/worker-poll.mjs
```

---

## Step 3: Create the database tables

Open your Supabase Dashboard → SQL Editor → New Query.

Paste the entire contents of:
```
inspection-lab/supabase-schema-additions.sql
```

Click **Run**.

This creates 5 tables:
- `inspection_cases` — each inspection run
- `inspection_case_photos` — photos uploaded from the phone
- `inspection_jobs` — what the laptop worker polls for
- `inspection_job_artifacts` — engine outputs (review_result.json, etc.)
- `inspection_reviews` — human review actions (future)

---

## Step 4: Create the Storage bucket

Go to Supabase Dashboard → Storage → New Bucket.

- Name: `inspection-lab`
- Public: **NO** (keep it private)
- Click **Create**

Then go to the bucket's **Policies** and add:
- **Authenticated users** can `SELECT` (read their own)
- **Service role** can `ALL` (the laptop worker)
- **Authenticated users** can `INSERT` (upload from phone)

---

## Step 5: Install the mobile app dependencies

```bash
cd "D:\Personal\Projects\Strehe-Prona\strehe-app\inspection-lab\mobile-app"
npm install
```

This installs `@supabase/supabase-js` and all other dependencies.

---

## Step 6: Start the laptop worker

Open a terminal on your laptop (RTX 1650 machine). Make sure you are in the `strehe-app` root.

```bash
cd "D:\Personal\Projects\Strehe-Prona\strehe-app"
node inspection-lab/scripts/worker-poll.mjs
```

The worker will:
- Print: `Worker local-laptop-001 started`
- Poll Supabase every 10 seconds for new jobs
- If it finds a job, it downloads photos, runs the engine, and uploads results
- Keep it running in the background while you test

**Important:** Make sure your LM Studio / local model is running if you want real AI processing. The worker sets `INSPECTION_LAB_MODEL_ENABLED=true` automatically.

---

## Step 7: Test the full workflow

### On your phone:

1. Open the app (via Expo Go or APK)
2. Create an apartment
3. Add rooms
4. Take baseline photos (check-in)
5. Start a new inspection
6. Take inspection photos (current condition)
7. Go to the inspection detail screen
8. Tap **"Upload to Supabase"**

### On the laptop:

9. The worker should detect the job within 10 seconds
10. It downloads photos and runs the engine
11. After a few minutes (depends on model speed), it uploads the result

### Back on your phone:

12. Tap **"Wait for result"** — the app polls for 5 minutes
13. When the result arrives, the report is saved locally
14. Tap **"View Report"** to see the findings

---

## If something goes wrong

### Worker can't find jobs
- Check that the tables were created (SQL Editor → Tables)
- Check the worker logs: `inspection-lab/worker.log`
- Verify the Service Role Key is correct

### Photos don't upload
- Check the `inspection-lab` storage bucket exists
- Check the bucket has INSERT permissions for authenticated users
- Check that the mobile app has internet permission (Android)

### Engine fails to run
- The worker assumes `run-local-e2e-inspection.mjs` is in `inspection-lab/scripts/`
- Make sure LM Studio is running with an OpenAI-compatible API (or the model is available)
- Check `worker.log` for the exact error

### Report never comes back
- Check the `inspection_jobs` table in Supabase for status changes
- If status is `failed`, read the `failure_reason` column
- If status is `claimed` for too long, the worker may have crashed

---

## Architecture reminder

```
Phone (Expo app)
  ├── SQLite (offline cache)
  └── Supabase (upload photos + jobs)
         ↓
Supabase Cloud
  ├── PostgreSQL (inspection_cases, jobs, photos)
  └── Storage (inspection-lab bucket)
         ↓
Laptop (Node.js worker)
  ├── Polls Supabase for jobs
  ├── Downloads photos
  ├── Runs: run-local-e2e-inspection.mjs
  ├── Reads review_result.json
  └── Uploads result back to Supabase
         ↓
Phone (Expo app)
  └── Polls for result → displays report
```

---

## Next improvements

- Add a Supabase Realtime subscription so the phone gets notified instantly when the result is ready (instead of polling)
- Add a push notification when the report is ready
- Add offline queueing so the phone can upload when WiFi returns
- Connect the `property_id` to your existing STREHË `properties` table

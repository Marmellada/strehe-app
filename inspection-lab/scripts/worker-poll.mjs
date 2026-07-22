import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadEnvFile } from 'node:process';

const SUPABASE_URL = 'https://evrravcuhrryiyywofwe.supabase.co'; // REPLACE THIS
const ENV_FILE = path.join(process.cwd(), '.env.local');
if (fs.existsSync(ENV_FILE)) {
  loadEnvFile(ENV_FILE);
}

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Configuration error: SUPABASE_SERVICE_ROLE_KEY is required in the environment or .env.local.');
}

const POLL_INTERVAL_MS = 10000;
const WORKER_ID = 'inspection-lab-worker-001';
const ROOT = process.cwd();
const E2E_RUNS_DIR = path.join(ROOT, 'inspection-lab', 'e2e-runs');
const SCRIPTS_DIR = path.join(ROOT, 'inspection-lab', 'scripts');
const STORAGE_BUCKET = 'task-attachments';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function log(msg, level = 'info') {
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}`;
  console.log(line);
  const logPath = path.join(ROOT, 'inspection-lab', 'worker.log');
  fs.appendFileSync(logPath, line + '\n');
}

async function pollAndWork() {
  await log(`Worker ${WORKER_ID} polling for inspection jobs...`);

  // 1. Find eligible inspection jobs
  const { data: eligibleJobs, error: findError } = await supabase
    .from('agent_jobs')
    .select('id, payload, required_capability, workspace_type, status')
    .eq('workspace_type', 'inspection')
    .eq('required_capability', 'inspection_lab_v1')
    .eq('status', 'queued')
    .lte('available_at', new Date().toISOString())
    .gt('expires_at', new Date().toISOString())
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1);

  if (findError) {
    await log(`Query error: ${findError.message}`, 'error');
    return;
  }

  if (!eligibleJobs || eligibleJobs.length === 0) {
    await log('No eligible inspection jobs found.');
    return;
  }

  const job = eligibleJobs[0];
  await log(`Found job ${job.id} — attempting to claim...`);

  // 2. Claim the job
  const { data: claimedJob, error: claimError } = await supabase.rpc('claim_agent_job', {
    target_job_id: job.id,
    lease_seconds: 600,
  });

  if (claimError) {
    await log(`Claim failed: ${claimError.message}`, 'error');
    return;
  }

  await log(`Job ${job.id} claimed. Lease expires in 10 minutes.`);

  // 3. Parse payload
  const payload = job.payload || {};
  const caseId = payload.case_id;
  const propertyId = payload.property_id;

  if (!caseId) {
    await log('Job payload missing case_id', 'error');
    await failJob(job.id, 'Payload missing case_id');
    return;
  }

  // 4. Get the inspection case + photos
  const { data: caseRow, error: caseError } = await supabase
    .from('inspection_lab_cases')
    .select('id, case_key, room_type')
    .eq('id', caseId)
    .single();

  if (caseError || !caseRow) {
    await log(`Case fetch failed: ${caseError?.message}`, 'error');
    await failJob(job.id, 'Case not found');
    return;
  }

  const { data: photos, error: photosError } = await supabase
    .from('inspection_lab_case_photos')
    .select('id, capture_slot, storage_path, photo_type, order_index')
    .eq('case_id', caseId)
    .order('order_index', { ascending: true });

  if (photosError) {
    await log(`Photo fetch failed: ${photosError.message}`, 'error');
    await failJob(job.id, 'Photo fetch failed');
    return;
  }

  // 5. Download photos
  const runTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(E2E_RUNS_DIR, caseRow.case_key, runTimestamp);
  fs.mkdirSync(runDir, { recursive: true });

  const photosDir = path.join(runDir, 'photos');
  fs.mkdirSync(photosDir, { recursive: true });

  const localPhotos = [];
  for (const photo of photos) {
    const { data: blob, error: dlError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(photo.storage_path);

    if (dlError) {
      await log(`Download failed: ${photo.storage_path} — ${dlError.message}`, 'error');
      continue;
    }

    const localName = path.basename(photo.storage_path);
    const localPath = path.join(photosDir, localName);
    const buffer = Buffer.from(await blob.arrayBuffer());
    fs.writeFileSync(localPath, buffer);
    localPhotos.push({ ...photo, local_path: localPath });
    await log(`Downloaded: ${photo.storage_path} -> ${localPath}`);
  }

  // 6. Build room_setup.json in the NEW zone-based format
  // Each zone becomes its own "room" in the engine JSON
  const baselinePhotos = localPhotos.filter((p) => p.capture_slot === 'baseline');
  const currentPhotos = localPhotos.filter((p) => p.capture_slot === 'current');

  // Group by photo_type (which represents the zone name in our mobile app)
  const zoneGroups = new Map();
  for (const bp of baselinePhotos) {
    const zoneName = bp.photo_type || 'zone';
    if (!zoneGroups.has(zoneName)) zoneGroups.set(zoneName, {});
    zoneGroups.get(zoneName).baseline = bp.local_path;
  }
  for (const cp of currentPhotos) {
    const zoneName = cp.photo_type || 'zone';
    if (!zoneGroups.has(zoneName)) zoneGroups.set(zoneName, {});
    zoneGroups.get(zoneName).current = cp.local_path;
  }

  const rooms = [];
  for (const [zoneName, paths] of zoneGroups) {
    if (!paths.baseline || !paths.current) continue;
    rooms.push({
      room_id: `zone_${caseRow.case_key}_${zoneName}`,
      room_label: zoneName,
      baseline_photo: paths.baseline,
      current_photo: paths.current,
      zones: [
        {
          zone_key: 'main',
          label: zoneName,
          rect: { x: 0, y: 0, w: 1, h: 1 },
        }
      ],
      tracked_objects: [],
    });
  }

  const roomSetup = {
    property_id: propertyId || caseRow.case_key,
    setup_version: 'mobile-zone-v1',
    rooms,
    object_search_rules: {
      if_not_visible_in_expected_zone: 'search_same_room_zones_first',
      if_not_found_in_same_room: 'search_other_rooms',
      if_not_found_anywhere: 'NOT_VISIBLE_IN_ANY_CURRENT_PHOTO',
      always_require_human_review: true,
    },
  };

  const setupPath = path.join(runDir, 'room_setup.json');
  fs.writeFileSync(setupPath, JSON.stringify(roomSetup, null, 2));
  await log(`Wrote room_setup.json: ${setupPath} (${rooms.length} zones)`);

  // 7. Run the engine
  await log(`Running engine for job ${job.id}...`);
  try {
    const engineOutput = execFileSync(
      'node',
      [
        path.join(SCRIPTS_DIR, 'run-local-e2e-inspection.mjs'),
        '--setup',
        setupPath,
      ],
      {
        encoding: 'utf-8',
        cwd: ROOT,
        env: { ...process.env, INSPECTION_LAB_MODEL_ENABLED: 'true' },
        timeout: 600000,
      }
    );
    await log(`Engine output: ${engineOutput.slice(0, 500)}...`);
  } catch (e) {
    await log(`Engine run failed: ${e.message}`, 'error');
    await failJob(job.id, `Engine run failed: ${e.message}`);
    return;
  }

  // 8. Find the review_result.json
  const resultPath = findReviewResult(runDir);
  if (!resultPath) {
    await log('review_result.json not found after engine run', 'error');
    await failJob(job.id, 'review_result.json not found');
    return;
  }

  const reviewResult = fs.readFileSync(resultPath, 'utf-8');
  const reviewResultJson = JSON.parse(reviewResult);
  await log(`Found review_result: ${resultPath}`);

  // 9. Upload result as agent artifact
  const artifactPath = `${WORKER_ID}/${caseRow.case_key}/review_result.json`;
  const { error: uploadError } = await supabase.storage
    .from('agent-artifacts')
    .upload(artifactPath, reviewResult, {
      contentType: 'application/json',
      upsert: true,
    });

  if (uploadError) {
    await log(`Artifact upload failed: ${uploadError.message}`, 'error');
  }

  // 10. Complete the job
  const resultPayload = {
    case_id: caseId,
    case_key: caseRow.case_key,
    review_result: reviewResultJson,
    artifact_storage_path: artifactPath,
    run_directory: runDir,
  };

  const { data: completedJob, error: completeError } = await supabase.rpc('complete_agent_job', {
    target_job_id: job.id,
    job_result: resultPayload,
  });

  if (completeError) {
    await log(`Complete failed: ${completeError.message}`, 'error');
    await failJob(job.id, `Complete failed: ${completeError.message}`);
    return;
  }

  await log(`Job ${job.id} COMPLETED. Case: ${caseRow.case_key}`);
}

async function failJob(jobId, reason) {
  const { error } = await supabase.rpc('fail_agent_job', {
    target_job_id: jobId,
    failure_code: 'worker_error',
    failure_message: reason,
  });
  if (error) {
    await log(`Failed to mark job ${jobId} as failed: ${error.message}`, 'error');
  } else {
    await log(`Job ${jobId} marked FAILED: ${reason}`, 'error');
  }
}

function findReviewResult(startDir) {
  const entries = fs.readdirSync(startDir, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => path.join(startDir, e.name));
  for (const d of dirs) {
    const candidates = [
      path.join(d, 'review_result.json'),
      path.join(d, 'results', 'review_result.json'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    const deep = findReviewResult(d);
    if (deep) return deep;
  }
  return null;
}

// Main loop
async function main() {
  await log(`Worker ${WORKER_ID} started`);
  await log(`Supabase: ${SUPABASE_URL}`);
  await log(`E2E runs dir: ${E2E_RUNS_DIR}`);

  while (true) {
    try {
      await pollAndWork();
    } catch (e) {
      await log(`Unhandled error in pollAndWork: ${e.message}`, 'error');
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

main();

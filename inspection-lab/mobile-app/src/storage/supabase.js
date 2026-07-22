import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

if (!SUPABASE_URL) {
  throw new Error(
    'Configuration error: EXPO_PUBLIC_SUPABASE_URL is required for the Inspection Lab mobile app.'
  );
}

if (!SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    'Configuration error: EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required for the Inspection Lab mobile app.'
  );
}

if (!SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_')) {
  throw new Error(
    'Configuration error: EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be a Supabase publishable key; server secrets and legacy JWT keys are not accepted.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// The existing STREHË app uses 'task-attachments' for inspection photos
export const STORAGE_BUCKET = 'task-attachments';

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function ensureBucket() {
  const { data } = await supabase.storage.getBucket(STORAGE_BUCKET);
  if (!data) {
    console.warn('Storage bucket not found. Create it in Supabase dashboard: task-attachments');
  }
}

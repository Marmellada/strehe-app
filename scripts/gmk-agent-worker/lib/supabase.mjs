import { createClient } from "@supabase/supabase-js";

// User-scoped Supabase client + sign-in. The worker holds only the anon key and
// the agent's own credentials; never the service_role key.
export function createAgentClient(supabaseUrl, anonKey) {
  return createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: true, persistSession: false },
  });
}

export async function signInAgent(supabase, email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`agent sign-in failed: ${error.message}`);
  return data;
}

export async function heartbeat(supabase) {
  const { error } = await supabase.rpc("heartbeat_agent");
  if (error) throw new Error(`heartbeat failed: ${error.message}`);
}

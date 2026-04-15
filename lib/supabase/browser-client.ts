import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function getBrowserSupabaseClient() {
  if (browserClient) {
    return browserClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase browser environment variables are missing.");
  }

  browserClient = createBrowserClient<Database>(url, anonKey);
  return browserClient;
}
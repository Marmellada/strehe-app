export async function selectCoordinatorJob(supabase, capability, targetJobId = null, now = new Date()) {
  let query = supabase
    .from("agent_jobs")
    .select("id, payload, job_type, priority, created_at, attempt_count, max_attempts, requires_review, workspace_type")
    .eq("required_capability", capability)
    .eq("status", "queued")
    .lte("available_at", now.toISOString())
    .gt("expires_at", now.toISOString());
  if (targetJobId) query = query.eq("id", targetJobId);
  const { data, error } = await query
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

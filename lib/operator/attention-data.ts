import type { createClient } from "@/lib/supabase/server";
import {
  parseEngineeringReviewQueue,
  type EngineeringReviewQueue,
} from "@/lib/agents/review-queue";
import {
  buildOperatorAttentionCounts,
  type OperatorAttentionCounts,
} from "@/lib/operator/workflows";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function loadEngineeringReviewQueue(
  supabase: SupabaseServerClient,
  limit = 25,
  offset = 0
): Promise<EngineeringReviewQueue> {
  const { data, error } = await supabase.rpc("get_engineering_review_queue", {
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    throw new Error(`Unable to load Engineering review queue: ${error.message}`);
  }

  return parseEngineeringReviewQueue(data);
}

export async function loadOperatorAttention(
  supabase: SupabaseServerClient,
  todayIso: string,
  reviewLimit = 5,
  reviewOffset = 0
): Promise<{
  counts: OperatorAttentionCounts;
  reviewQueue: EngineeringReviewQueue;
}> {
  const [
    inboxResult,
    reviewQueue,
    escalatedResult,
    overdueResult,
    identitiesResult,
    offersResult,
    followUpsResult,
  ] = await Promise.all([
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("attention_state", "needs_reply")
      .neq("status", "archived"),
    loadEngineeringReviewQueue(supabase, reviewLimit, reviewOffset),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .in("status", ["escalated", "blocked"]),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .lt("due_date", todayIso)
      .in("status", ["open", "in_progress", "escalated", "blocked"]),
    supabase
      .from("contact_channel_identities")
      .select("id", { count: "exact", head: true })
      .eq("resolution_status", "needs_review"),
    supabase
      .from("lead_offers")
      .select("id", { count: "exact", head: true })
      .in("status", ["draft", "sent"])
      .or(
        `status.eq.draft,follow_up_date.lte.${todayIso},valid_until.lt.${todayIso}`
      ),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .lte("next_follow_up_date", todayIso)
      .not("status", "in", "(won,lost)"),
  ]);

  const failed = [
    ["inbox", inboxResult.error],
    ["escalated tasks", escalatedResult.error],
    ["overdue tasks", overdueResult.error],
    ["identity review", identitiesResult.error],
    ["offers", offersResult.error],
    ["follow-ups", followUpsResult.error],
  ].find(([, error]) => Boolean(error));

  if (failed) {
    const error = failed[1] as { message?: string };
    throw new Error(`Unable to load ${failed[0]} attention count: ${error.message || "unknown error"}`);
  }

  return {
    counts: buildOperatorAttentionCounts({
      inboxNeedsReply: inboxResult.count,
      agentAwaitingReview: reviewQueue.pending_count,
      escalatedTasks: escalatedResult.count,
      overdueTasks: overdueResult.count,
      identitiesNeedingReview: identitiesResult.count,
      offersNeedingAttention: offersResult.count,
      followUpsDue: followUpsResult.count,
    }),
    reviewQueue,
  };
}

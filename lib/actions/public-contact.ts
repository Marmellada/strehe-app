"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  createPublicContactLeadHandler,
  type PublicContactAdminClient,
  type PublicContactLeadState,
} from "@/lib/security/public-contact";

const handlePublicContactLead = createPublicContactLeadHandler({
  getAdminClient: () =>
    getAdminClient() as unknown as PublicContactAdminClient,
  now: () => new Date(),
  revalidateLeads: () => revalidatePath("/leads"),
});

export async function createPublicContactLeadAction(
  state: PublicContactLeadState,
  formData: FormData
): Promise<PublicContactLeadState> {
  return handlePublicContactLead(state, formData);
}

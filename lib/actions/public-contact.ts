"use server";

import { revalidatePath } from "next/cache";
import { sendInquiryNotificationEmail } from "@/lib/email/inquiry-notification-email";
import { getCompanyProfile } from "@/lib/marketing/company-profile";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  createPublicContactLeadHandler,
  type PublicContactAdminClient,
  type PublicContactLeadState,
} from "@/lib/security/public-contact";

const handlePublicContactLead = createPublicContactLeadHandler({
  getAdminClient: () =>
    getAdminClient() as unknown as PublicContactAdminClient,
  createInquiryId: () => crypto.randomUUID(),
  now: () => new Date(),
  revalidateLeads: () => revalidatePath("/leads"),
  sendInquiryNotification: async (inquiry) => {
    const companyProfile = await getCompanyProfile();
    const result = await sendInquiryNotificationEmail({
      ...inquiry,
      to: companyProfile.email,
    });
    return result.ok
      ? { ok: true }
      : { ok: false, reason: result.reason };
  },
  logNotificationFailure: (failure) => {
    console.error("[PUBLIC_CONTACT_NOTIFICATION_FAILURE]", failure);
  },
});

export async function createPublicContactLeadAction(
  state: PublicContactLeadState,
  formData: FormData
): Promise<PublicContactLeadState> {
  return handlePublicContactLead(state, formData);
}

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { generateOfferPdf, type OfferPdfData } from "@/lib/funnel/offer-pdf";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireRole(["admin", "office"]);
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_offers")
    .select("*,lead:leads!lead_offers_lead_id_fkey(full_name,email,phone)")
    .eq("id", id)
    .single();
  if (error || !data) return new NextResponse("Offer not found", { status: 404 });
  const result = await generateOfferPdf(data as unknown as OfferPdfData);
  return new NextResponse(Buffer.from(result.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${result.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

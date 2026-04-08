import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";

export default async function LeasesPage() {
  await requireRole(["admin", "office"]);
  redirect("/subscriptions");
}

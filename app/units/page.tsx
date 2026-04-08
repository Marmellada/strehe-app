import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";

export default async function UnitsPage() {
  await requireRole(["admin", "office"]);
  redirect("/properties");
}

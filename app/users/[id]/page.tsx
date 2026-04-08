import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";

export default async function UserDetailPage() {
  await requireRole(["admin"]);
  redirect("/settings/users");
}

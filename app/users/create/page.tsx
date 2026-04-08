import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";

export default async function CreateUserPage() {
  await requireRole(["admin"]);
  redirect("/settings/users");
}

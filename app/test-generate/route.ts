import { generateTasks } from "@/lib/actions/task-generator";
import { requireRole } from "@/lib/auth/require-role";

export async function GET() {
  await requireRole(["admin"]);

  const result = await generateTasks();

  return Response.json({
    ok: true,
    mode: "manual-test",
    result,
  });
}
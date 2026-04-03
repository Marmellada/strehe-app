import { generateTasks } from "@/lib/actions/task-generator";

export async function GET() {
  await generateTasks();
  return Response.json({ ok: true });
}
import type { NextRequest } from "next/server";
import { generateTasks } from "@/lib/actions/task-generator";

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    throw new Error("Missing CRON_SECRET environment variable.");
  }

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return Response.json(
      {
        ok: false,
        error: "Unauthorized",
      },
      { status: 401 }
    );
  }

  const result = await generateTasks();

  return Response.json({
    ok: true,
    mode: "cron",
    result,
  });
}
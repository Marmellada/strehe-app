import type { NextRequest } from "next/server";

type GenerateTasksFn = () => Promise<unknown>;

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

export function createGenerateTasksHandler(generateTasksFn: GenerateTasksFn) {
  return async function handleGenerateTasks(request: NextRequest) {
    if (!isAuthorized(request)) {
      return Response.json(
        {
          ok: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const result = await generateTasksFn();

    return Response.json({
      ok: true,
      mode: "cron",
      result,
    });
  };
}

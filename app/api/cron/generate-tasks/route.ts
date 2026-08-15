import { generateTasks } from "@/lib/actions/task-generator";
import { createGenerateTasksHandler } from "@/lib/server/generate-tasks-handler";

const handleGenerateTasks = createGenerateTasksHandler(generateTasks);

export const GET = handleGenerateTasks;
export const POST = handleGenerateTasks;

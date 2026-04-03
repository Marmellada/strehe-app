import { cache } from "react";
import { getCurrentUserWithRole } from "@/lib/auth/get-current-user-with-role";

export const getCurrentUser = cache(async () => {
  return await getCurrentUserWithRole();
});
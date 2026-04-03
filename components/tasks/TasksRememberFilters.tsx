"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const STORAGE_KEY = "tasks_filters";

export default function TasksRememberFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Save filters on change
  useEffect(() => {
    const params = searchParams.toString();
    if (params) {
      localStorage.setItem(STORAGE_KEY, params);
    }
  }, [searchParams]);

  // Restore filters if none exist
  useEffect(() => {
    const hasParams = searchParams.toString().length > 0;

    if (!hasParams) {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        router.replace(`/tasks?${saved}`);
      }
    }
  }, []);

  return null;
}
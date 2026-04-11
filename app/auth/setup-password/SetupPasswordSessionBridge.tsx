"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SetupPasswordSessionBridge() {
  const router = useRouter();
  const didRunRef = useRef(false);

  useEffect(() => {
    if (didRunRef.current) {
      return;
    }

    didRunRef.current = true;

    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : "";

    if (!hash) {
      return;
    }

    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const errorDescription = params.get("error_description");

    if (errorDescription) {
      router.replace(
        `/auth/login?error=${encodeURIComponent(errorDescription)}`
      );
      return;
    }

    if (!accessToken || !refreshToken) {
      return;
    }

    const supabase = createClient();

    void supabase.auth
      .setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      .then(({ error }) => {
        if (error) {
          router.replace(
            `/auth/login?error=${encodeURIComponent(error.message)}`
          );
          return;
        }

        router.replace("/auth/setup-password");
        router.refresh();
      });
  }, [router]);

  return null;
}

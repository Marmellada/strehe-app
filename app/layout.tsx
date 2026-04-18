import "../assets/css/tokens.css";
import "../assets/css/components.css";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Figtree } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";
import { ToastProvider } from "@/components/ui/toast";
import { AppearanceThemeClient } from "@/components/ui/AppearanceThemeClient";
import { AppShell } from "@/components/layout/AppShell";
import {
  normalizePreviewTheme,
  type PreviewTheme,
} from "@/components/ui/appearance-preview-theme";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "STREHË",
  description:
    "Trusted local care for your apartment in Prishtina or Fushë Kosovë while you live abroad.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerStore = await headers();
  const surface = headerStore.get("x-strehe-surface") ?? "app";
  const supabase = await createClient();
  const { data: companySettings } = await supabase
    .from("company_settings")
    .select("appearance_theme")
    .limit(1)
    .maybeSingle();
  const initialTheme = normalizePreviewTheme(
    (companySettings?.appearance_theme as Partial<PreviewTheme> | null | undefined) ??
      null
  );
  const current = surface === "app" ? await getCurrentUser() : null;
  const role = current?.appUser.role ?? null;

  return (
    <html
      lang="en"
      className={cn(
        "theme-dark",
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        "font-sans",
        figtree.variable
      )}
    >
      <body className="min-h-full bg-background text-foreground">
        <ToastProvider>
          <AppearanceThemeClient initialTheme={initialTheme} />
          {surface === "app" ? (
            <AppShell role={role} current={current}>
              {children}
            </AppShell>
          ) : (
            children
          )}
        </ToastProvider>
      </body>
    </html>
  );
}

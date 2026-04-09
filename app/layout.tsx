import "../assets/css/tokens.css";
import "../assets/css/components.css";
import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Figtree } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import SidebarAuthBox from "@/components/auth/SidebarAuthBox";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { ToastProvider } from "@/components/ui/toast";
import { AppearanceThemeClient } from "@/components/ui/AppearanceThemeClient";

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
  title: "STREHË Admin",
  description: "STREHË Prona management app",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const current = await getCurrentUser();
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
      <body className="min-h-full">
        <ToastProvider>
          <AppearanceThemeClient />
          <div className="layout">
            <aside className="sidebar flex min-h-screen flex-col">
              <div className="brand">
                <div className="brand-mark" />
                <strong>STREHË Admin</strong>
              </div>

              <nav className="shell-nav">
                <div className="shell-nav-group">
                  <Link href="/">Dashboard</Link>
                </div>

                <div className="shell-nav-group">
                  <p className="shell-nav-label">Operations</p>

                  <Link href="/clients">Clients</Link>
                  <Link href="/properties">Properties</Link>

                  {(role === "admin" || role === "office" || role === "field") ? (
                    <Link href="/keys">Keys</Link>
                  ) : null}

                  <Link href="/tasks">Tasks</Link>
                  <Link href="/subscriptions">Contracts</Link>
                  <Link href="/billing">Billing</Link>
                  <Link href="/expenses">Expenses</Link>
                  {(role === "admin" || role === "office") ? (
                    <Link href="/workers">Staff</Link>
                  ) : null}
                </div>

                <div className="shell-nav-group">
                  <p className="shell-nav-label">Configuration</p>

                  <Link href="/services">Services</Link>
                  <Link href="/packages">Packages</Link>
                </div>

                {role === "admin" ? (
                  <div className="shell-nav-group">
                    <p className="shell-nav-label">System</p>

                    <Link href="/settings">Settings</Link>
                  </div>
                ) : null}
              </nav>

              <SidebarAuthBox />
            </aside>

            <div className="main">
              <div className="topbar">
                <div className="row">
                  <h1 className="topbar-title">STREHË Admin</h1>
                </div>
              </div>

              <div className="content">{children}</div>
            </div>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SidebarAuthBox from "@/components/auth/SidebarAuthBox";

type AppShellProps = {
  children: React.ReactNode;
  role: string | null;
  current:
    | {
        authUser: {
          email: string | undefined;
        };
        appUser: {
          full_name: string | null;
        };
      }
    | null;
};

export function AppShell({ children, role, current }: AppShellProps) {
  const pathname = usePathname();
  const isAuthRoute = pathname?.startsWith("/auth");

  if (isAuthRoute) {
    return (
      <div className="min-h-screen bg-[var(--app-bg)]">
        <main>{children}</main>
      </div>
    );
  }

  return (
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

            {role === "admin" || role === "office" || role === "field" ? (
              <Link href="/keys">Keys</Link>
            ) : null}

            <Link href="/tasks">Tasks</Link>
            <Link href="/subscriptions">Contracts</Link>
            <Link href="/billing">Billing</Link>
            <Link href="/expenses">Expenses</Link>
            {role === "admin" || role === "office" ? (
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

        <SidebarAuthBox current={current} />
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
  );
}

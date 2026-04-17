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
  const isAdmin = role === "admin";
  const isOffice = role === "office";
  const isField = role === "field";
  const isContractor = role === "contractor";
  const canUseOfficeSurface = isAdmin || isOffice;

  const workLinks = canUseOfficeSurface
    ? [
        { href: "/tasks", label: "Tasks" },
        { href: "/properties", label: "Properties" },
        { href: "/clients", label: "Clients" },
        { href: "/keys", label: "Keys" },
      ]
    : isField
      ? [
          { href: "/tasks", label: "Tasks" },
          { href: "/keys", label: "Keys" },
        ]
      : isContractor
        ? [{ href: "/tasks", label: "Tasks" }]
        : [];

  const businessLinks = canUseOfficeSurface
    ? [
        { href: "/subscriptions", label: "Contracts" },
        { href: "/billing", label: "Billing" },
        { href: "/expenses", label: "Expenses" },
        { href: "/finance", label: "Finance" },
      ]
    : [];

  const setupLinks = canUseOfficeSurface
    ? [
        { href: "/workers", label: "Staff" },
        { href: "/services", label: "Services" },
        { href: "/packages", label: "Packages" },
      ]
    : [];

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

          {workLinks.length > 0 ? (
            <div className="shell-nav-group">
              <p className="shell-nav-label">Work</p>

              {workLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          ) : null}

          {businessLinks.length > 0 ? (
            <div className="shell-nav-group">
              <p className="shell-nav-label">Business</p>

              {businessLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          ) : null}

          {setupLinks.length > 0 ? (
            <div className="shell-nav-group">
              <p className="shell-nav-label">Setup</p>

              {setupLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          ) : null}

          {isAdmin ? (
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

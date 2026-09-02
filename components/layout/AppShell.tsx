"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SidebarAuthBox from "@/components/auth/SidebarAuthBox";
import type { AppRole } from "@/lib/auth/roles";

type AppShellProps = {
  children: React.ReactNode;
  role: AppRole | null;
  inboxNeedsReplyCount?: number | null;
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

export function AppShell({
  children,
  role,
  current,
  inboxNeedsReplyCount = 0,
}: AppShellProps) {
  const pathname = usePathname();
  const isAuthRoute = pathname?.startsWith("/auth");
  const isAdmin = role === "admin";
  const isOffice = role === "office";
  const isField = role === "field";
  const isContractor = role === "contractor";
  const canUseOfficeSurface = isAdmin || isOffice;
  const isCurrent = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname?.startsWith(`${href}/`));

  const workLinks = canUseOfficeSurface
    ? [
        { href: "/tasks", label: "Tasks" },
        { href: "/operator/inbox", label: "Inbox" },
        { href: "/properties", label: "Properties" },
        { href: "/clients", label: "Clients" },
        { href: "/leads", label: "Leads" },
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
            <Link href="/dashboard" aria-current={isCurrent("/dashboard") ? "page" : undefined}>
              Dashboard
            </Link>
          </div>

          {workLinks.length > 0 ? (
            <div className="shell-nav-group">
              <p className="shell-nav-label">Work</p>

              {workLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isCurrent(link.href) ? "page" : undefined}
                  style={{ display: "flex", alignItems: "center" }}
                >
                  <span>{link.label}</span>
                  {link.href === "/operator/inbox" &&
                  (inboxNeedsReplyCount === null || inboxNeedsReplyCount > 0) ? (
                    <span
                      style={{
                        marginLeft: "auto",
                        backgroundColor: "#dc2626",
                        color: "#ffffff",
                        borderRadius: "9999px",
                        padding: "1px 7px",
                        fontSize: "11px",
                        fontWeight: 600,
                        lineHeight: 1.4,
                      }}
                      role="status"
                      aria-live="polite"
                      aria-label={
                        inboxNeedsReplyCount === null
                          ? "Inbox attention count unavailable"
                          : `${inboxNeedsReplyCount} conversations need a reply`
                      }
                    >
                      {inboxNeedsReplyCount === null ? "!" : inboxNeedsReplyCount}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          ) : null}

          {businessLinks.length > 0 ? (
            <div className="shell-nav-group">
              <p className="shell-nav-label">Business</p>

              {businessLinks.map((link) => (
                <Link key={link.href} href={link.href} aria-current={isCurrent(link.href) ? "page" : undefined}>
                  {link.label}
                </Link>
              ))}
            </div>
          ) : null}

          {setupLinks.length > 0 ? (
            <div className="shell-nav-group">
              <p className="shell-nav-label">Setup</p>

              {setupLinks.map((link) => (
                <Link key={link.href} href={link.href} aria-current={isCurrent(link.href) ? "page" : undefined}>
                  {link.label}
                </Link>
              ))}
            </div>
          ) : null}

          {canUseOfficeSurface ? (
            <div className="shell-nav-group">
              <p className="shell-nav-label">System</p>

              <Link href="/operator/review" aria-current={isCurrent("/operator/review") ? "page" : undefined}>
                Review queue
              </Link>
              <Link href="/operator/agents" aria-current={isCurrent("/operator/agents") ? "page" : undefined}>
                Agents
              </Link>
              {isAdmin ? <Link href="/settings">Settings</Link> : null}
            </div>
          ) : null}
        </nav>

        <SidebarAuthBox current={current} />
      </aside>

      <div className="main min-w-0 grid-cols-[minmax(0,1fr)]">
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

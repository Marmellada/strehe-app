import "../assets/css/tokens.css";
import "../assets/css/components.css";
import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`theme-dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <div className="layout">
          <aside className="sidebar">
            <div className="brand">
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: "#fff",
                  border: "1px solid var(--border)",
                }}
              />
              <strong>STREHË Admin</strong>
            </div>

            <nav
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "20px",
                marginTop: "24px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <Link href="/">Dashboard</Link>
                <Link href="/clients">Clients</Link>
                <Link href="/properties">Properties</Link>
                <Link href="/tasks">Tasks</Link>
                <Link href="/subscriptions">Subscriptions</Link>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <p
                  style={{
                    margin: "8px 0 2px",
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--muted-foreground, #94a3b8)",
                  }}
                >
                  Settings
                </p>

                <Link href="/services">Services</Link>
                <Link href="/packages">Packages</Link>
              </div>
            </nav>
          </aside>

          <div className="main">
            <div className="topbar">
              <div className="row">
                <h1 style={{ margin: 0 }}>STREHË Admin</h1>
              </div>
            </div>

            <div className="content">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
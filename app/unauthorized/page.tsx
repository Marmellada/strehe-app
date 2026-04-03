import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="container" style={{ padding: "32px" }}>
      <div className="card" style={{ maxWidth: 640, margin: "0 auto" }}>
        <h1 style={{ marginBottom: 12 }}>Access denied</h1>
        <p style={{ marginBottom: 16 }}>
          You do not have permission to access this page.
        </p>

        <div style={{ display: "flex", gap: 12 }}>
          <Link href="/dashboard" className="btn btn-primary">
            Go to dashboard
          </Link>
          <Link href="/auth/logout" className="btn btn-secondary">
            Logout
          </Link>
        </div>
      </div>
    </main>
  );
}
import { createClient } from "@/lib/supabase/server";

export default async function SidebarAuthBox() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const email = user.email || "Logged in user";
  const fullName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.user_metadata?.display_name ||
    null;

  return (
    <div
      style={{
        marginTop: "auto",
        paddingTop: "16px",
        borderTop: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <div
        style={{
          padding: "12px",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "12px",
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "8px",
            fontSize: "12px",
            color: "rgba(255,255,255,0.7)",
          }}
        >
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "999px",
              background: "#22c55e",
              display: "inline-block",
            }}
          />
          Logged in
        </div>

        <div
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "#fff",
            marginBottom: "4px",
            wordBreak: "break-word",
          }}
        >
          {fullName || email}
        </div>

        {fullName ? (
          <div
            style={{
              fontSize: "12px",
              color: "rgba(255,255,255,0.7)",
              marginBottom: "12px",
              wordBreak: "break-word",
            }}
          >
            {email}
          </div>
        ) : (
          <div style={{ marginBottom: "12px" }} />
        )}

        <form action="/auth/logout" method="post">
          <button
            type="submit"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              minHeight: "40px",
              padding: "10px 12px",
              borderRadius: "10px",
              border: "1px solid rgba(255,255,255,0.16)",
              color: "#fff",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: 600,
              background: "transparent",
              cursor: "pointer",
            }}
          >
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}
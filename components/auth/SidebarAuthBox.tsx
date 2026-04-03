import { getCurrentUser } from "@/lib/auth/get-current-user";

export default async function SidebarAuthBox() {
  const current = await getCurrentUser();

  if (!current) return null;

  const { authUser, appUser } = current;

  const email = authUser.email || "Logged in user";
  const fullName = appUser.full_name;

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
              width: "100%",
              minHeight: "40px",
              borderRadius: "10px",
              border: "1px solid rgba(255,255,255,0.16)",
              color: "#fff",
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
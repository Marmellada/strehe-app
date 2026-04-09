import { getCurrentUser } from "@/lib/auth/get-current-user";

export default async function SidebarAuthBox() {
  const current = await getCurrentUser();

  if (!current) return null;

  const { authUser, appUser } = current;

  const email = authUser.email || "Logged in user";
  const fullName = appUser.full_name;

  return (
    <div className="sidebar-auth">
      <div className="sidebar-auth-card">
        <div className="sidebar-auth-status">
          <span className="sidebar-auth-dot" />
          Logged in
        </div>

        <div className="sidebar-auth-name">{fullName || email}</div>

        {fullName ? (
          <div className="sidebar-auth-email">{email}</div>
        ) : (
          <div className="mb-3" />
        )}

        <form action="/auth/logout" method="post">
          <button type="submit" className="btn btn-ghost w-full">
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}

import { Button } from "@/components/ui";

type SidebarAuthBoxProps = {
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

export default function SidebarAuthBox({ current }: SidebarAuthBoxProps) {
  if (!current) return null;

  const email = current.authUser.email || "Logged in user";
  const fullName = current.appUser.full_name;

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
          <Button type="submit" variant="ghost" className="w-full">
            Log out
          </Button>
        </form>
      </div>
    </div>
  );
}

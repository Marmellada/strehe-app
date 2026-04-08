import { revalidatePath } from "next/cache";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { APP_ROLES, type AppRole } from "@/lib/auth/roles";
import { createClient as createAdminClient } from "@supabase/supabase-js";

type AppUserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: AppRole;
  is_active: boolean;
  created_at: string;
};

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase admin credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createAdminClient(supabaseUrl, serviceRoleKey);
}

async function createTestUser(formData: FormData) {
  "use server";

  await requireRole(["admin"]);

  const supabase = await createClient();
  const admin = getAdminClient();

  const fullName = String(formData.get("full_name") || "").trim();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "").trim() as AppRole;

  if (!fullName) {
    throw new Error("Full name is required.");
  }

  if (!email) {
    throw new Error("Email is required.");
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  if (!APP_ROLES.includes(role)) {
    throw new Error("Invalid role.");
  }

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
    },
  });

  if (authError || !authData.user) {
    throw new Error(authError?.message || "Failed to create auth user.");
  }

  const now = new Date().toISOString();

  const { error: appUserError } = await supabase.from("app_users").upsert(
    {
      id: authData.user.id,
      email,
      full_name: fullName,
      role,
      is_active: true,
      updated_at: now,
    },
    {
      onConflict: "id",
    }
  );

  if (appUserError) {
    await admin.auth.admin.deleteUser(authData.user.id);
    throw new Error(appUserError.message);
  }

  revalidatePath("/settings/users");
}

async function updateUserRole(formData: FormData) {
  "use server";

  const { authUser } = await requireRole(["admin"]);

  const supabase = await createClient();

  const userId = String(formData.get("user_id") || "").trim();
  const role = String(formData.get("role") || "").trim() as AppRole;

  if (!userId) {
    throw new Error("User id is required.");
  }

  if (!APP_ROLES.includes(role)) {
    throw new Error("Invalid role.");
  }

  const { error } = await supabase
    .from("app_users")
    .update({
      role,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    throw new Error(error.message);
  }

  // Make sure the currently logged-in admin does not accidentally demote self
  // without noticing. This does not block it, just refreshes everything.
  revalidatePath("/settings");
  revalidatePath("/settings/users");

  if (authUser.id === userId) {
    revalidatePath("/");
  }
}

async function toggleUserActive(formData: FormData) {
  "use server";

  const { authUser } = await requireRole(["admin"]);

  const supabase = await createClient();

  const userId = String(formData.get("user_id") || "").trim();
  const current = String(formData.get("current") || "").trim() === "true";

  if (!userId) {
    throw new Error("User id is required.");
  }

  // Prevent admin from deactivating own account accidentally
  if (authUser.id === userId && current === true) {
    throw new Error("You cannot deactivate your own account.");
  }

  const { error } = await supabase
    .from("app_users")
    .update({
      is_active: !current,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings/users");
}

function formatDate(value: string | null) {
  if (!value) return "-";

  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default async function SettingsUsersPage() {
  await requireRole(["admin"]);

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("app_users")
    .select("id, email, full_name, role, is_active, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Users load error: ${error.message}`);
  }

  const users = (data || []) as AppUserRow[];

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">User Access Management</h1>
          <p className="page-subtitle mt-2">
            Manage internal user roles and account access.
          </p>
        </div>

        <Link href="/settings" className="btn btn-ghost">
          Back to Settings
        </Link>
      </div>

      <section className="card">
        <div className="mb-6 border-b border-border pb-6">
          <h2 className="section-title !mb-0">Create Test User</h2>
          <p className="page-subtitle mt-1">
            Temporary admin-only user creation for testing. This creates both the
            auth account and the matching app user record.
          </p>

          <form
            action={createTestUser}
            className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
          >
            <label className="field">
              Full Name
              <input
                name="full_name"
                type="text"
                required
                className="input"
                placeholder="Test User"
              />
            </label>

            <label className="field">
              Email
              <input
                name="email"
                type="email"
                required
                className="input"
                placeholder="test.user@example.com"
              />
            </label>

            <label className="field">
              Password
              <input
                name="password"
                type="password"
                required
                minLength={8}
                className="input"
                placeholder="Minimum 8 characters"
              />
            </label>

            <label className="field">
              Role
              <select name="role" required defaultValue="office" className="input">
                {APP_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>

            <div className="md:col-span-2 xl:col-span-4 flex justify-end">
              <button type="submit" className="btn btn-primary">
                Create Test User
              </button>
            </div>
          </form>
        </div>

        <div className="mb-4">
          <h2 className="section-title !mb-0">Users</h2>
          <p className="page-subtitle mt-1">
            Assign roles and control who can access the system.
          </p>
        </div>

        {users.length === 0 ? (
          <p className="field-value-muted">No users found.</p>
        ) : (
          <div className="related-list">
            {users.map((user) => (
              <div
                key={user.id}
                className="related-item"
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: 20,
                  alignItems: "start",
                }}
              >
                <div>
                  <div className="related-item-title">
                    {user.full_name || "Unnamed User"}
                  </div>

                  <div className="related-item-subtitle">
                    {user.email || "No email"}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: 8,
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(180px, 1fr))",
                      marginTop: 12,
                    }}
                  >
                    <div>
                      <div className="field-label">Role</div>
                      <div className="field-value">{user.role}</div>
                    </div>

                    <div>
                      <div className="field-label">Status</div>
                      <div className="field-value">
                        {user.is_active ? "Active" : "Inactive"}
                      </div>
                    </div>

                    <div>
                      <div className="field-label">Created</div>
                      <div className="field-value">
                        {formatDate(user.created_at)}
                      </div>
                    </div>

                    <div>
                      <div className="field-label">User ID</div>
                      <div className="field-value" style={{ wordBreak: "break-all" }}>
                        {user.id}
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    minWidth: 240,
                  }}
                >
                  <form action={updateUserRole} className="space-y-2">
                    <input type="hidden" name="user_id" value={user.id} />

                    <label className="field">
                      Role
                      <select
                        name="role"
                        defaultValue={user.role}
                        className="input"
                      >
                        {APP_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button type="submit" className="btn btn-primary w-full">
                      Save Role
                    </button>
                  </form>

                  <form action={toggleUserActive}>
                    <input type="hidden" name="user_id" value={user.id} />
                    <input
                      type="hidden"
                      name="current"
                      value={String(!!user.is_active)}
                    />

                    <button type="submit" className="btn btn-ghost w-full">
                      {user.is_active ? "Deactivate User" : "Activate User"}
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

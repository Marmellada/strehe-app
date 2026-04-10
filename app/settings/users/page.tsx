import { revalidatePath } from "next/cache";
import Link from "next/link";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DetailField,
  EmptyState,
  FormField,
  Input,
  PageHeader,
  StatusBadge,
} from "@/components/ui";
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

const nativeSelectClassName =
  "flex h-10 w-full items-center justify-between rounded-md border border-[var(--select-border)] bg-[var(--select-bg)] px-3 py-2 text-sm text-[var(--select-text)] ring-offset-background focus:outline-none focus:ring-2 focus:ring-[var(--select-ring-color)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

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
      <PageHeader
        title="User Access Management"
        description="Manage internal user roles and account access."
        actions={
          <Button asChild variant="ghost">
            <Link href="/settings">Back to Settings</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Create Test User</CardTitle>
          <CardDescription>
            Temporary admin-only user creation for testing. This creates both the
            auth account and the matching app user record.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createTestUser} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FormField label="Full Name" required>
              <Input name="full_name" type="text" required placeholder="Test User" />
            </FormField>

            <FormField label="Email" required>
              <Input
                name="email"
                type="email"
                required
                placeholder="test.user@example.com"
              />
            </FormField>

            <FormField label="Password" required hint="Minimum 8 characters.">
              <Input
                name="password"
                type="password"
                required
                minLength={8}
                placeholder="Minimum 8 characters"
              />
            </FormField>

            <FormField label="Role" required>
              <select name="role" defaultValue="office" className={nativeSelectClassName}>
                {APP_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </FormField>

            <div className="flex justify-end md:col-span-2 xl:col-span-4">
              <Button type="submit">Create Test User</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div>
          <h2 className="text-base font-medium text-foreground">Users</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Assign roles and control who can access the system.
          </p>
        </div>

        {users.length === 0 ? (
          <EmptyState
            title="No users found"
            description="Once users exist, you will be able to review their role, status, and account details here."
          />
        ) : (
          <div className="grid gap-4">
            {users.map((user) => (
              <Card key={user.id}>
                <CardHeader className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
                  <div className="space-y-1">
                    <CardTitle>{user.full_name || "Unnamed User"}</CardTitle>
                    <CardDescription>{user.email || "No email"}</CardDescription>
                  </div>
                  <div className="flex items-center justify-start sm:justify-end">
                    <StatusBadge status={user.is_active ? "active" : "inactive"} />
                  </div>
                </CardHeader>

                <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <DetailField label="Role" value={user.role} />
                    <DetailField
                      label="Status"
                      value={user.is_active ? "Active" : "Inactive"}
                    />
                    <DetailField label="Created" value={formatDate(user.created_at)} />
                    <DetailField
                      label="User ID"
                      value={<span className="break-all">{user.id}</span>}
                    />
                  </div>

                  <div className="space-y-3">
                    <form action={updateUserRole} className="space-y-3">
                      <input type="hidden" name="user_id" value={user.id} />

                      <FormField label="Role">
                        <select
                          name="role"
                          defaultValue={user.role}
                          className={nativeSelectClassName}
                        >
                          {APP_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </FormField>

                      <Button type="submit" className="w-full">
                        Save Role
                      </Button>
                    </form>

                    <form action={toggleUserActive}>
                      <input type="hidden" name="user_id" value={user.id} />
                      <input type="hidden" name="current" value={String(!!user.is_active)} />

                      <Button type="submit" variant="ghost" className="w-full">
                        {user.is_active ? "Deactivate User" : "Activate User"}
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

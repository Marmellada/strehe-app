import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import Link from "next/link";
import {
  Alert,
  AlertDescription,
  AlertTitle,
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
import { getAdminClient } from "@/lib/supabase/admin";

type AppUserRow = {
  id: string;
  email: string | null;
  username: string | null;
  full_name: string | null;
  role: AppRole;
  is_active: boolean;
  created_at: string;
};

type AuthAdminUser = {
  id: string;
  email?: string;
  last_sign_in_at?: string | null;
  created_at?: string;
  identities?: Array<{
    identity_data?: {
      email_verified?: boolean;
    } | null;
  }> | null;
  user_metadata?: {
    full_name?: string;
  } | null;
  email_confirmed_at?: string | null;
};

const nativeSelectClassName =
  "flex h-10 w-full items-center justify-between rounded-md border border-[var(--select-border)] bg-[var(--select-bg)] px-3 py-2 text-sm text-[var(--select-text)] ring-offset-background focus:outline-none focus:ring-2 focus:ring-[var(--select-ring-color)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

async function getAppBaseUrl() {
  const explicit =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL;

  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") || "http";

  if (host) {
    return `${protocol}://${host}`;
  }

  return "http://localhost:3000";
}

function getPasswordSetupRedirect(baseUrl: string) {
  return `${baseUrl}/auth/setup-password`;
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function assertValidUsername(value: string) {
  const username = normalizeUsername(value);

  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    throw new Error(
      "Username must be 3-32 characters and use only lowercase letters, numbers, dots, underscores, or hyphens."
    );
  }

  return username;
}

function getAuthSetupSummary(authUser: AuthAdminUser | null) {
  if (!authUser) {
    return {
      badgeStatus: "inactive",
      label: "Missing Auth Record",
      detail: "This app user does not have a matching auth account yet.",
    } as const;
  }

  if (authUser.last_sign_in_at) {
    return {
      badgeStatus: "active",
      label: "Signed In",
      detail: `Last sign-in: ${formatDate(authUser.last_sign_in_at)}`,
    } as const;
  }

  if (authUser.email_confirmed_at) {
    return {
      badgeStatus: "info",
      label: "Password Set",
      detail: "The account is confirmed and ready to sign in.",
    } as const;
  }

  return {
    badgeStatus: "pending",
    label: "Invited",
    detail: "The user still needs to open the email and finish setup.",
  } as const;
}

async function rollbackAuthUser(userId: string) {
  const admin = getAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);

  if (error) {
    console.error("Auth rollback failed:", error.message);
  }
}

async function inviteUser(formData: FormData) {
  "use server";

  await requireRole(["admin"]);

  const supabase = await createClient();
  const admin = getAdminClient();
  const baseUrl = await getAppBaseUrl();

  const fullName = String(formData.get("full_name") || "").trim();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const username = assertValidUsername(String(formData.get("username") || ""));
  const role = String(formData.get("role") || "").trim() as AppRole;

  if (!fullName) {
    throw new Error("Full name is required.");
  }

  if (!email) {
    throw new Error("Email is required.");
  }

  if (!APP_ROLES.includes(role)) {
    throw new Error("Invalid role.");
  }

  const { data: authData, error: authError } =
    await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: fullName,
      },
      redirectTo: getPasswordSetupRedirect(baseUrl),
    });

  if (authError || !authData.user) {
    throw new Error(authError?.message || "Failed to create auth invite.");
  }

  const now = new Date().toISOString();

  const { error: appUserError } = await supabase.from("app_users").upsert(
    {
      id: authData.user.id,
      email,
      username,
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
    await rollbackAuthUser(authData.user.id);
    throw new Error(appUserError.message);
  }

  revalidatePath("/settings/users");
}

async function sendPasswordSetupEmail(formData: FormData) {
  "use server";

  await requireRole(["admin"]);

  const supabase = await createClient();
  const baseUrl = await getAppBaseUrl();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();

  if (!email) {
    throw new Error("Email is required.");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getPasswordSetupRedirect(baseUrl),
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings/users");
}

async function resendInviteEmail(formData: FormData) {
  "use server";

  await requireRole(["admin"]);

  const admin = getAdminClient();
  const baseUrl = await getAppBaseUrl();

  const fullName = String(formData.get("full_name") || "").trim();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();

  if (!email) {
    throw new Error("Email is required.");
  }

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: {
      full_name: fullName,
    },
    redirectTo: getPasswordSetupRedirect(baseUrl),
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings/users");
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
  const username = assertValidUsername(String(formData.get("username") || ""));
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
      username,
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
  const rawUsername = String(formData.get("username") || "").trim();
  const username = rawUsername ? assertValidUsername(rawUsername) : null;

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
      username,
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
  const admin = getAdminClient();

  const [{ data, error }, { data: authUsersData, error: authUsersError }] =
    await Promise.all([
      supabase
        .from("app_users")
        .select("id, email, username, full_name, role, is_active, created_at")
        .order("created_at", { ascending: false }),
      admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      }),
    ]);

  if (error) {
    throw new Error(`Users load error: ${error.message}`);
  }

  if (authUsersError) {
    throw new Error(`Auth users load error: ${authUsersError.message}`);
  }

  const users = (data || []) as AppUserRow[];
  const authUsers = ((authUsersData?.users || []) as AuthAdminUser[]).reduce(
    (map, user) => map.set(user.id, user),
    new Map<string, AuthAdminUser>()
  );

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
          <CardTitle>Invite User</CardTitle>
          <CardDescription>
            Create the auth account, assign the app role, and send a setup email.
            Your temporary personal mailbox can be used as the sender until the official company sender is ready in Supabase Auth.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={inviteUser} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FormField label="Full Name" required>
              <Input name="full_name" type="text" required placeholder="Jane Admin" />
            </FormField>

            <FormField label="Email" required>
              <Input
                name="email"
                type="email"
                required
                placeholder="jane@example.com"
              />
            </FormField>

            <FormField label="Username" required hint="Used for sign-in.">
              <Input
                name="username"
                type="text"
                required
                minLength={3}
                placeholder="jane.admin"
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
              <Button type="submit">Send Invite</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manual Fallback</CardTitle>
          <CardDescription>
            Use this only if the email sender is not configured yet and you need to unblock someone immediately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createTestUser} className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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

            <FormField label="Username" required hint="Used for sign-in.">
              <Input
                name="username"
                type="text"
                required
                minLength={3}
                placeholder="test.user"
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

            <div className="flex justify-end md:col-span-2 xl:col-span-5">
              <Button type="submit" variant="outline">Create Direct User</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Alert>
        <AlertTitle>Current rollout shape</AlertTitle>
        <AlertDescription>
          We can onboard people properly now with invites and setup emails. The final login polish can come later without changing the underlying user model.
        </AlertDescription>
      </Alert>

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
                  {(() => {
                    const authUser = authUsers.get(user.id) || null;
                    const setup = getAuthSetupSummary(authUser);

                    return (
                      <>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <DetailField label="Role" value={user.role} />
                    <DetailField
                      label="Username"
                      value={user.username || "No username set"}
                    />
                    <DetailField
                      label="Status"
                      value={user.is_active ? "Active" : "Inactive"}
                    />
                    <DetailField label="Setup State" value={setup.label} />
                    <DetailField label="Created" value={formatDate(user.created_at)} />
                    <DetailField label="Auth Detail" value={setup.detail} />
                    <DetailField
                      label="User ID"
                      value={<span className="break-all">{user.id}</span>}
                      className="xl:col-span-2"
                    />
                  </div>

                  <div className="space-y-3">
                    <form action={updateUserRole} className="space-y-3">
                      <input type="hidden" name="user_id" value={user.id} />

                      <FormField label="Username" hint="Users can sign in with username or email.">
                        <Input
                          name="username"
                          type="text"
                          defaultValue={user.username || ""}
                          minLength={3}
                          placeholder="username"
                        />
                      </FormField>

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
                        Save Access
                      </Button>
                    </form>

                    {authUser ? (
                      authUser.last_sign_in_at || authUser.email_confirmed_at ? (
                        <form action={sendPasswordSetupEmail}>
                          <input type="hidden" name="email" value={user.email || ""} />

                          <Button type="submit" variant="outline" className="w-full">
                            Send Password Reset
                          </Button>
                        </form>
                      ) : (
                        <form action={resendInviteEmail}>
                          <input type="hidden" name="email" value={user.email || ""} />
                          <input type="hidden" name="full_name" value={user.full_name || ""} />

                          <Button type="submit" variant="outline" className="w-full">
                            Resend Invite
                          </Button>
                        </form>
                      )
                    ) : null}

                    <form action={toggleUserActive}>
                      <input type="hidden" name="user_id" value={user.id} />
                      <input type="hidden" name="current" value={String(!!user.is_active)} />

                      <Button type="submit" variant="ghost" className="w-full">
                        {user.is_active ? "Deactivate User" : "Activate User"}
                      </Button>
                    </form>
                  </div>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

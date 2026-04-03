import Image from "next/image";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import BankAccountForm from "./BankAccountForm";

async function saveCompanySettings(formData: FormData) {
  "use server";

  await requireRole(["admin"]);

  const supabase = await createClient();

  const id = String(formData.get("id") || "").trim();
  const company_name = String(formData.get("company_name") || "").trim();
  const legal_name = String(formData.get("legal_name") || "").trim();
  const business_number = String(formData.get("business_number") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const address = String(formData.get("address") || "").trim();
  const city = String(formData.get("city") || "").trim();
  const country = String(formData.get("country") || "").trim();
  const vat_enabled = formData.get("vat_enabled") === "on";
  const vat_number = String(formData.get("vat_number") || "").trim();
  const vat_rate_raw = String(formData.get("vat_rate") || "").trim();
  const currency = "EUR";

  const logoFile = formData.get("logo") as File | null;

  if (!company_name) {
    throw new Error("Company name is required.");
  }

  const vat_rate = vat_rate_raw === "" ? null : Number(vat_rate_raw);

  if (vat_rate_raw !== "" && Number.isNaN(vat_rate)) {
    throw new Error("VAT rate must be a valid number.");
  }

  let logo_url: string | null = null;

  if (logoFile && logoFile.size > 0) {
    const fileExt = logoFile.name.split(".").pop()?.toLowerCase() || "png";
    const fileName = `company-logo-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("branding")
      .upload(fileName, logoFile, {
        upsert: true,
        contentType: logoFile.type || "image/png",
      });

    if (uploadError) {
      throw new Error(`Logo upload failed: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from("branding")
      .getPublicUrl(fileName);

    logo_url = publicUrlData.publicUrl;
  }

  if (id) {
    const updatePayload: Record<string, unknown> = {
      company_name,
      legal_name: legal_name || null,
      business_number: business_number || null,
      email: email || null,
      phone: phone || null,
      address: address || null,
      city: city || null,
      country: country || null,
      vat_enabled,
      vat_number: vat_enabled ? vat_number || null : null,
      vat_rate: vat_enabled ? vat_rate : null,
      currency,
      updated_at: new Date().toISOString(),
    };

    if (logo_url) {
      updatePayload.logo_url = logo_url;
    }

    const { error } = await supabase
      .from("company_settings")
      .update(updatePayload)
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }
  } else {
    const { error } = await supabase.from("company_settings").insert({
      company_name,
      legal_name: legal_name || null,
      business_number: business_number || null,
      email: email || null,
      phone: phone || null,
      address: address || null,
      city: city || null,
      country: country || null,
      vat_enabled,
      vat_number: vat_enabled ? vat_number || null : null,
      vat_rate: vat_enabled ? vat_rate : null,
      currency,
      logo_url,
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  revalidatePath("/settings");
}

async function addBankAccount(formData: FormData) {
  "use server";

  await requireRole(["admin"]);

  const supabase = await createClient();

  const bank_id = String(formData.get("bank_id") || "").trim();
  const account_name = String(formData.get("account_name") || "")
    .trim()
    .toUpperCase();
  const iban = String(formData.get("iban") || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  const is_primary = formData.get("is_primary") === "on";

  if (!bank_id) {
    throw new Error("Bank is required.");
  }

  if (!account_name) {
    throw new Error("Account name is required.");
  }

  if (!iban) {
    throw new Error("IBAN is required.");
  }

  if (!iban.match(/^[A-Z0-9]+$/)) {
    throw new Error("IBAN must contain only letters and numbers.");
  }

  if (iban.length < 15 || iban.length > 34) {
    throw new Error("Invalid IBAN length.");
  }

  if (is_primary) {
    const { error: resetError } = await supabase
      .from("company_bank_accounts")
      .update({ is_primary: false })
      .eq("is_primary", true);

    if (resetError) {
      throw new Error(resetError.message);
    }
  }

  const { error } = await supabase.from("company_bank_accounts").insert({
    bank_id,
    account_name,
    iban,
    is_primary,
    is_active: true,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings");
}

async function setPrimaryBankAccount(formData: FormData) {
  "use server";

  await requireRole(["admin"]);

  const supabase = await createClient();
  const id = String(formData.get("id") || "").trim();

  if (!id) {
    throw new Error("Bank account id is required.");
  }

  const { error: resetError } = await supabase
    .from("company_bank_accounts")
    .update({ is_primary: false })
    .eq("is_primary", true);

  if (resetError) {
    throw new Error(resetError.message);
  }

  const { error } = await supabase
    .from("company_bank_accounts")
    .update({ is_primary: true })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings");
}

async function toggleBankAccountActive(formData: FormData) {
  "use server";

  await requireRole(["admin"]);

  const supabase = await createClient();
  const id = String(formData.get("id") || "").trim();
  const current = String(formData.get("current") || "").trim() === "true";

  if (!id) {
    throw new Error("Bank account id is required.");
  }

  const { error } = await supabase
    .from("company_bank_accounts")
    .update({ is_active: !current })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings");
}

export default async function SettingsPage() {
  const { appUser } = await requireRole(["admin"]);

  const supabase = await createClient();

  const [settingsResult, banksResult, accountsResult] = await Promise.all([
    supabase
      .from("company_settings")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("banks")
      .select("id, name, swift_code, country, is_active")
      .eq("is_active", true)
      .order("name", { ascending: true }),

    supabase
      .from("company_bank_accounts")
      .select(
        `
        id,
        account_name,
        iban,
        is_primary,
        is_active,
        banks (
          id,
          name,
          swift_code,
          country
        )
      `
      )
      .order("created_at", { ascending: false }),
  ]);

  if (settingsResult.error) {
    throw new Error(`Company settings load error: ${settingsResult.error.message}`);
  }

  if (banksResult.error) {
    throw new Error(`Banks load error: ${banksResult.error.message}`);
  }

  if (accountsResult.error) {
    throw new Error(`Company bank accounts load error: ${accountsResult.error.message}`);
  }

  const settings = settingsResult.data;
  const banks = banksResult.data || [];
  const accounts = accountsResult.data || [];

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">System Settings</h1>
          <p className="page-subtitle mt-2">
            Configure company profile, branding, tax defaults, and bank accounts
          </p>
          <p className="page-subtitle mt-1">
            Signed in as: <strong>{appUser.role}</strong>
          </p>
        </div>

        <Link href="/settings/users" className="btn btn-primary">
          Manage Users
        </Link>
      </div>

      <section className="card">
        <div className="mb-4">
          <h2 className="section-title !mb-0">Company Profile</h2>
          <p className="page-subtitle mt-1">
            This information will be used later in contracts, invoices, and company branding.
          </p>
        </div>

        <form action={saveCompanySettings} className="space-y-6">
          <input type="hidden" name="id" value={settings?.id || ""} />

          <div className="grid grid-2 gap-4">
            <div>
              <label htmlFor="company_name" className="field-label">
                Company Name *
              </label>
              <input
                id="company_name"
                name="company_name"
                className="input"
                defaultValue={settings?.company_name || ""}
                required
              />
            </div>

            <div>
              <label htmlFor="legal_name" className="field-label">
                Legal Name
              </label>
              <input
                id="legal_name"
                name="legal_name"
                className="input"
                defaultValue={settings?.legal_name || ""}
              />
            </div>

            <div>
              <label htmlFor="business_number" className="field-label">
                Business Number / UID
              </label>
              <input
                id="business_number"
                name="business_number"
                className="input"
                defaultValue={settings?.business_number || ""}
              />
            </div>

            <div>
              <label htmlFor="currency" className="field-label">
                Currency
              </label>
              <input
                id="currency"
                className="input"
                value="EUR"
                disabled
                readOnly
              />
            </div>

            <div>
              <label htmlFor="email" className="field-label">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="input"
                defaultValue={settings?.email || ""}
              />
            </div>

            <div>
              <label htmlFor="phone" className="field-label">
                Phone
              </label>
              <input
                id="phone"
                name="phone"
                className="input"
                defaultValue={settings?.phone || ""}
              />
            </div>

            <div>
              <label htmlFor="address" className="field-label">
                Address
              </label>
              <input
                id="address"
                name="address"
                className="input"
                defaultValue={settings?.address || ""}
              />
            </div>

            <div>
              <label htmlFor="city" className="field-label">
                City
              </label>
              <input
                id="city"
                name="city"
                className="input"
                defaultValue={settings?.city || ""}
              />
            </div>

            <div>
              <label htmlFor="country" className="field-label">
                Country
              </label>
              <input
                id="country"
                name="country"
                className="input"
                defaultValue={settings?.country || ""}
              />
            </div>

            <div>
              <label htmlFor="logo" className="field-label">
                Company Logo
              </label>
              <input
                id="logo"
                name="logo"
                type="file"
                accept="image/*"
                className="input"
              />
            </div>
          </div>

          {settings?.logo_url ? (
            <div className="space-y-2">
              <div className="field-label">Current Logo</div>
              <div
                style={{
                  position: "relative",
                  width: 140,
                  height: 140,
                  borderRadius: 12,
                  overflow: "hidden",
                  border: "1px solid var(--border)",
                  background: "white",
                }}
              >
                <Image
                  src={settings.logo_url}
                  alt="Company logo"
                  fill
                  style={{ objectFit: "contain" }}
                />
              </div>
            </div>
          ) : null}

          <div className="space-y-4">
            <label
              className="flex items-center gap-3"
              style={{ cursor: "pointer" }}
            >
              <input
                type="checkbox"
                name="vat_enabled"
                defaultChecked={!!settings?.vat_enabled}
              />
              <span className="field-label" style={{ margin: 0 }}>
                VAT enabled
              </span>
            </label>

            <div className="grid grid-2 gap-4">
              <div>
                <label htmlFor="vat_number" className="field-label">
                  VAT Number
                </label>
                <input
                  id="vat_number"
                  name="vat_number"
                  className="input"
                  defaultValue={settings?.vat_number || ""}
                />
              </div>

              <div>
                <label htmlFor="vat_rate" className="field-label">
                  VAT Rate (%)
                </label>
                <input
                  id="vat_rate"
                  name="vat_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  className="input"
                  defaultValue={settings?.vat_rate ?? ""}
                />
              </div>
            </div>
          </div>

          <div>
            <button type="submit" className="btn btn-primary">
              Save Company Settings
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="mb-4">
          <h2 className="section-title !mb-0">Company Bank Accounts</h2>
          <p className="page-subtitle mt-1">
            Add and manage the bank accounts used for invoices and payments.
          </p>
        </div>

        <BankAccountForm banks={banks} action={addBankAccount} />

        <div className="mt-6">
          {accounts.length === 0 ? (
            <p className="field-value-muted">No bank accounts added yet.</p>
          ) : (
            <div className="related-list">
              {accounts.map((account: any) => {
                const bank = Array.isArray(account.banks)
                  ? account.banks[0]
                  : account.banks;

                return (
                  <div key={account.id} className="related-item">
                    <div>
                      <div className="related-item-title">
                        {account.account_name}
                      </div>
                      <div className="related-item-subtitle">
                        {bank?.name || "Unknown bank"}
                        {bank?.swift_code ? ` • ${bank.swift_code}` : ""}
                        {bank?.country ? ` • ${bank.country}` : ""}
                      </div>
                      <div className="related-item-subtitle">
                        IBAN: {account.iban}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`badge ${
                          account.is_primary ? "badge-success" : "badge-outline"
                        }`}
                      >
                        {account.is_primary ? "Primary" : "Secondary"}
                      </span>

                      <span
                        className={`badge ${
                          account.is_active ? "badge-success" : "badge-warning"
                        }`}
                      >
                        {account.is_active ? "Active" : "Inactive"}
                      </span>

                      {!account.is_primary ? (
                        <form action={setPrimaryBankAccount}>
                          <input type="hidden" name="id" value={account.id} />
                          <button type="submit" className="btn btn-ghost">
                            Set Primary
                          </button>
                        </form>
                      ) : null}

                      <form action={toggleBankAccountActive}>
                        <input type="hidden" name="id" value={account.id} />
                        <input
                          type="hidden"
                          name="current"
                          value={String(!!account.is_active)}
                        />
                        <button type="submit" className="btn btn-ghost">
                          {account.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
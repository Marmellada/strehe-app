import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { PageHeader } from "@/components/ui/PageHeader";
import { BankAccountForm } from "@/components/banking/BankAccountForm";

type ActionResult = {
  success: boolean;
  error?: string;
};

function normalizeIban(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function normalizeSwift(value: string) {
  return value.trim().toUpperCase();
}

function isValidBasicIban(value: string) {
  return /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(value);
}

function isValidSwift(value: string) {
  return value === "" || /^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(value);
}

async function createBankAccount(formData: FormData): Promise<ActionResult> {
  "use server";

  try {
    await requireRole(["admin"]);
    const supabase = await createClient();

    const bank_id = String(formData.get("bank_id") || "").trim();
    const account_name = String(formData.get("account_name") || "").trim();
    const bank_name_snapshot = String(formData.get("bank_name_snapshot") || "").trim();
    const iban = normalizeIban(String(formData.get("iban") || ""));
    const swift = normalizeSwift(String(formData.get("swift") || ""));
    const is_primary = formData.get("is_primary") === "on";
    const show_on_invoice = formData.get("show_on_invoice") === "on";

    if (!bank_id) return { success: false, error: "Bank is required." };
    if (!account_name) return { success: false, error: "Account name is required." };
    if (!bank_name_snapshot) return { success: false, error: "Display bank name is required." };
    if (!iban) return { success: false, error: "IBAN is required." };

    if (!isValidBasicIban(iban)) {
      return { success: false, error: "IBAN format is invalid." };
    }

    if (!isValidSwift(swift)) {
      return { success: false, error: "SWIFT format is invalid." };
    }

    if (is_primary) {
      await supabase
        .from("company_bank_accounts")
        .update({ is_primary: false })
        .eq("is_primary", true);
    }

    const { error } = await supabase.from("company_bank_accounts").insert({
      bank_id,
      account_name,
      bank_name_snapshot,
      iban,
      swift: swift || null,
      is_primary,
      is_active: true,
      show_on_invoice,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unexpected error",
    };
  }
}

export default async function NewBankAccountPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const { data: banks, error } = await supabase
    .from("banks")
    .select("id, name, swift_code, country")
    .eq("is_active", true)
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Bank Account"
        description="Add a new company bank account"
      />

      <div className="card p-6">
        <BankAccountForm action={createBankAccount} banks={banks || []} />
      </div>

      <div>
        <Link href="/settings/banking" className="btn btn-outline">
          Back to Banking
        </Link>
      </div>
    </div>
  );
}
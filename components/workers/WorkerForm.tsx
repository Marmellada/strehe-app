import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  FormField,
  Input,
  Label,
  Textarea,
} from "@/components/ui";
import { detectBankFromInput } from "@/lib/banking/detection";
import type { BankIdentifierRule, BankRegistryBank } from "@/types/banking";

type WorkerFormAction = (formData: FormData) => void | Promise<void>;

export type WorkerFormValues = {
  id?: string;
  full_name?: string | null;
  personal_id?: string | null;
  email?: string | null;
  phone?: string | null;
  role_title?: string | null;
  worker_type?: string | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  base_salary?: number | string | null;
  payment_frequency?: string | null;
  payment_method?: string | null;
  bank_account?: string | null;
  subject_to_tax?: boolean | null;
  subject_to_pension?: boolean | null;
  notes?: string | null;
};

type Props = {
  action: WorkerFormAction;
  submitLabel: string;
  worker?: WorkerFormValues;
  cancelHref?: string;
  banks?: BankRegistryBank[];
  identifiers?: BankIdentifierRule[];
};

function normalizeBankAccountInput(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export default function WorkerForm({
  action,
  submitLabel,
  worker,
  cancelHref = "/workers",
  banks,
  identifiers,
}: Props) {
  const nativeSelectClassName =
    "flex h-10 w-full items-center justify-between rounded-md border border-[var(--select-border)] bg-[var(--select-bg)] px-3 py-2 text-sm text-[var(--select-text)] ring-offset-background focus:outline-none focus:ring-2 focus:ring-[var(--select-ring-color)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
  const [paymentMethod, setPaymentMethod] = useState<string>(
    worker?.payment_method ?? ""
  );
  const [bankAccountValue, setBankAccountValue] = useState<string>(
    worker?.bank_account ?? ""
  );

  const bankDetectionResult = useMemo(() => {
    if (!bankAccountValue.trim()) return null;

    return detectBankFromInput({
      input: bankAccountValue,
      identifiers: identifiers || [],
      banks: banks || [],
    });
  }, [bankAccountValue, identifiers, banks]);

  return (
    <form action={action} className="space-y-8">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Core</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField id="full_name" label="Full name" required>
              <Input
                id="full_name"
                name="full_name"
                defaultValue={worker?.full_name ?? ""}
                required
              />
            </FormField>

            <FormField id="personal_id" label="Personal ID">
              <Input
                id="personal_id"
                name="personal_id"
                defaultValue={worker?.personal_id ?? ""}
              />
            </FormField>

            <FormField id="email" label="Email">
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={worker?.email ?? ""}
              />
            </FormField>

            <FormField id="phone" label="Phone">
              <Input
                id="phone"
                name="phone"
                defaultValue={worker?.phone ?? ""}
              />
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Employment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField id="role_title" label="Role title" required>
              <Input
                id="role_title"
                name="role_title"
                defaultValue={worker?.role_title ?? ""}
                required
              />
            </FormField>

            <FormField id="worker_type" label="Worker type" required>
              <select
                id="worker_type"
                name="worker_type"
                defaultValue={worker?.worker_type ?? "employee"}
                required
                className={nativeSelectClassName}
              >
                <option value="employee">Employee</option>
                <option value="contractor">Contractor</option>
                <option value="temporary">Temporary</option>
              </select>
            </FormField>

            <FormField id="status" label="Status" required>
              <select
                id="status"
                name="status"
                defaultValue={worker?.status ?? "active"}
                required
                className={nativeSelectClassName}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </FormField>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField id="start_date" label="Start date" required>
                <Input
                  id="start_date"
                  name="start_date"
                  type="date"
                  defaultValue={worker?.start_date ?? ""}
                  required
                />
              </FormField>

              <FormField id="end_date" label="End date">
                <Input
                  id="end_date"
                  name="end_date"
                  type="date"
                  defaultValue={worker?.end_date ?? ""}
                />
              </FormField>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Compensation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField id="base_salary" label="Base salary">
              <Input
                id="base_salary"
                name="base_salary"
                type="number"
                step="0.01"
                min="0"
                defaultValue={
                  worker?.base_salary === null || worker?.base_salary === undefined
                    ? ""
                    : String(worker.base_salary)
                }
              />
            </FormField>

            <FormField id="payment_frequency" label="Payment frequency">
              <select
                id="payment_frequency"
                name="payment_frequency"
                defaultValue={worker?.payment_frequency ?? ""}
                className={nativeSelectClassName}
              >
                <option value="">Not set</option>
                <option value="monthly">Monthly</option>
                <option value="hourly">Hourly</option>
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
                <option value="per_task">Per task</option>
                <option value="one_time">One time</option>
                <option value="other">Other</option>
              </select>
            </FormField>

            <FormField id="payment_method" label="Payment method">
              <select
                id="payment_method"
                name="payment_method"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
                className={nativeSelectClassName}
              >
                <option value="">Not set</option>
                <option value="bank">Bank</option>
                <option value="cash">Cash</option>
              </select>
            </FormField>

            <FormField
              id="bank_account"
              label="Bank account"
              hint="Use IBAN or account number. Letters and numbers only."
            >
              <Input
                id="bank_account"
                name="bank_account"
                value={bankAccountValue}
                onChange={(event) =>
                  setBankAccountValue(normalizeBankAccountInput(event.target.value))
                }
                className="uppercase"
              />
            </FormField>

            {bankDetectionResult && bankAccountValue.trim() ? (
              <Alert
                variant={
                  !bankDetectionResult.isValid
                    ? "destructive"
                    : bankDetectionResult.kind === "card_number"
                    ? "destructive"
                    : bankDetectionResult.matchedBank
                    ? "success"
                    : "warning"
                }
              >
                <AlertTitle>Bank account validation</AlertTitle>
                <AlertDescription>
                  {!bankDetectionResult.isValid
                    ? bankDetectionResult.validationMessage
                    : bankDetectionResult.kind === "card_number"
                    ? "This looks like a card number. For staff payment details, enter an IBAN or bank account number instead."
                    : bankDetectionResult.matchedBank
                    ? `Detected ${bankDetectionResult.matchedBank.bankName}${
                        bankDetectionResult.matchedBank.swiftCode
                          ? ` (${bankDetectionResult.matchedBank.swiftCode})`
                          : ""
                      }.`
                    : bankDetectionResult.availableRuleCount > 0
                    ? "The bank account format looks valid, but no active bank rule matched it yet."
                    : "The bank account format looks valid, but there are no active detection rules for this type yet."}
                </AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Flags and notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Checkbox
                id="subject_to_tax"
                name="subject_to_tax"
                defaultChecked={worker?.subject_to_tax ?? true}
              />
              <Label htmlFor="subject_to_tax">Subject to tax</Label>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id="subject_to_pension"
                name="subject_to_pension"
                defaultChecked={worker?.subject_to_pension ?? true}
              />
              <Label htmlFor="subject_to_pension">Subject to pension</Label>
            </div>

            <FormField id="notes" label="Notes">
              <Textarea
                id="notes"
                name="notes"
                defaultValue={worker?.notes ?? ""}
                rows={6}
              />
            </FormField>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit">{submitLabel}</Button>

        <Button asChild variant="outline" type="button">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}

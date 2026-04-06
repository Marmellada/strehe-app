import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

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
};

export default function WorkerForm({
  action,
  submitLabel,
  worker,
  cancelHref = "/workers",
}: Props) {
  return (
    <form action={action} className="space-y-8">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Core */}
        <div className="space-y-4 rounded-2xl border bg-card p-5">
          <h2 className="text-lg font-semibold text-foreground">Core</h2>

          <div className="space-y-2">
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" name="full_name" defaultValue={worker?.full_name ?? ""} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="personal_id">Personal ID</Label>
            <Input id="personal_id" name="personal_id" defaultValue={worker?.personal_id ?? ""} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={worker?.email ?? ""} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" defaultValue={worker?.phone ?? ""} />
          </div>
        </div>

        {/* Employment */}
        <div className="space-y-4 rounded-2xl border bg-card p-5">
          <h2 className="text-lg font-semibold text-foreground">Employment</h2>

          <div className="space-y-2">
            <Label htmlFor="role_title">Role title</Label>
            <Input id="role_title" name="role_title" defaultValue={worker?.role_title ?? ""} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="worker_type">Worker type</Label>
            <select
              id="worker_type"
              name="worker_type"
              defaultValue={worker?.worker_type ?? "employee"}
              required
              className="input"
            >
              <option value="employee">Employee</option>
              <option value="contractor">Contractor</option>
              <option value="temporary">Temporary</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              name="status"
              defaultValue={worker?.status ?? "active"}
              required
              className="input"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start date</Label>
              <Input id="start_date" name="start_date" type="date" defaultValue={worker?.start_date ?? ""} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">End date</Label>
              <Input id="end_date" name="end_date" type="date" defaultValue={worker?.end_date ?? ""} />
            </div>
          </div>
        </div>

        {/* Compensation */}
        <div className="space-y-4 rounded-2xl border bg-card p-5">
          <h2 className="text-lg font-semibold text-foreground">Compensation</h2>

          <div className="space-y-2">
            <Label htmlFor="base_salary">Base salary</Label>
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_frequency">Payment frequency</Label>
            <select id="payment_frequency" name="payment_frequency" defaultValue={worker?.payment_frequency ?? ""} className="input">
              <option value="">Not set</option>
              <option value="monthly">Monthly</option>
              <option value="hourly">Hourly</option>
              <option value="weekly">Weekly</option>
              <option value="daily">Daily</option>
              <option value="per_task">Per task</option>
              <option value="one_time">One time</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_method">Payment method</Label>
            <select id="payment_method" name="payment_method" defaultValue={worker?.payment_method ?? ""} className="input">
              <option value="">Not set</option>
              <option value="bank">Bank</option>
              <option value="cash">Cash</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bank_account">Bank account</Label>
            <Input id="bank_account" name="bank_account" defaultValue={worker?.bank_account ?? ""} />
          </div>
        </div>

        {/* Flags */}
        <div className="space-y-4 rounded-2xl border bg-card p-5">
          <h2 className="text-lg font-semibold text-foreground">Flags and notes</h2>

          <div className="flex items-center gap-3">
            <input type="checkbox" id="subject_to_tax" name="subject_to_tax" defaultChecked={worker?.subject_to_tax ?? true} />
            <Label htmlFor="subject_to_tax">Subject to tax</Label>
          </div>

          <div className="flex items-center gap-3">
            <input type="checkbox" id="subject_to_pension" name="subject_to_pension" defaultChecked={worker?.subject_to_pension ?? true} />
            <Label htmlFor="subject_to_pension">Subject to pension</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea id="notes" name="notes" defaultValue={worker?.notes ?? ""} className="input min-h-[140px]" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn">
          {submitLabel}
        </button>

        <Link href={cancelHref} className="btn btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}
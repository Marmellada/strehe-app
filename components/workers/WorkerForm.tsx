import Link from "next/link";
import {
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
                className="input"
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
                className="input"
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
                className="input"
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
                defaultValue={worker?.payment_method ?? ""}
                className="input"
              >
                <option value="">Not set</option>
                <option value="bank">Bank</option>
                <option value="cash">Cash</option>
              </select>
            </FormField>

            <FormField id="bank_account" label="Bank account">
              <Input
                id="bank_account"
                name="bank_account"
                defaultValue={worker?.bank_account ?? ""}
              />
            </FormField>
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

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ClientLocationFields from "../ClientLocationFields";

import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { SectionCard } from "@/components/ui/SectionCard";
import { Input } from "@/components/ui/Input";

type Municipality = {
  id: string;
  name: string;
};

type Location = {
  id: string;
  name: string;
  type: string | null;
  municipality_id: string | null;
};

type Client = {
  client_type?: string | null;
  full_name?: string | null;
  company_name?: string | null;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  country?: string | null;
  municipality_id?: string | null;
  location_id?: string | null;
  notes?: string | null;
  status?: string | null;
};

type Props = {
  municipalities: Municipality[];
  locations: Location[];
  action: (formData: FormData) => void | Promise<void>;
  initialData?: Client;
  isEdit?: boolean;
  clientId?: string;
};

export default function NewClientForm({
  municipalities,
  locations,
  action,
  initialData,
  isEdit = false,
  clientId,
}: Props) {
  const [clientType, setClientType] = useState(
    initialData?.client_type || "individual"
  );

  const title = isEdit
    ? "Edit Client"
    : clientType === "business"
    ? "New Business Client"
    : "New Individual Client";

  const subtitle = isEdit
    ? "Update client details"
    : "Create a new client";

  const showIndividual = clientType === "individual";
  const showBusiness = clientType === "business";

  const helperText = useMemo(() => {
    return clientType === "business"
      ? "Business details are required."
      : "Use full name for individuals.";
  }, [clientType]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={subtitle}
        backHref={isEdit ? `/clients/${clientId}` : "/clients"}
      />

      <form action={action} className="space-y-6 max-w-3xl">
        <SectionCard title="General">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="client_type" className="text-sm font-medium">
                Client Type
              </label>
              <select
                id="client_type"
                name="client_type"
                value={clientType}
                onChange={(e) => setClientType(e.target.value)}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="individual">Individual</option>
                <option value="business">Business</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="status" className="text-sm font-medium">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={initialData?.status || "active"}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <Card size="sm">
            <CardContent>
              <p className="text-sm text-muted-foreground">{helperText}</p>
            </CardContent>
          </Card>
        </SectionCard>

        <SectionCard title="Client Details">
          {showIndividual && (
            <div className="space-y-2">
              <label htmlFor="full_name" className="text-sm font-medium">
                Full Name
              </label>
              <Input
                id="full_name"
                name="full_name"
                defaultValue={initialData?.full_name || ""}
                required={showIndividual}
              />
            </div>
          )}

          {showBusiness && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="company_name" className="text-sm font-medium">
                  Company Name
                </label>
                <Input
                  id="company_name"
                  name="company_name"
                  defaultValue={initialData?.company_name || ""}
                  required={showBusiness}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="contact_person" className="text-sm font-medium">
                  Contact Person
                </label>
                <Input
                  id="contact_person"
                  name="contact_person"
                  defaultValue={initialData?.contact_person || ""}
                />
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Contact">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-medium">
                Phone
              </label>
              <Input
                id="phone"
                name="phone"
                defaultValue={initialData?.phone || ""}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={initialData?.email || ""}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Address">
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="address_line_1" className="text-sm font-medium">
                Address Line 1
              </label>
              <Input
                id="address_line_1"
                name="address_line_1"
                defaultValue={initialData?.address_line_1 || ""}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="address_line_2" className="text-sm font-medium">
                Address Line 2
              </label>
              <Input
                id="address_line_2"
                name="address_line_2"
                defaultValue={initialData?.address_line_2 || ""}
              />
            </div>

            <ClientLocationFields
              municipalities={municipalities}
              locations={locations}
              defaultMunicipalityId={initialData?.municipality_id || ""}
              defaultLocationId={initialData?.location_id || ""}
            />

            <div className="space-y-2">
              <label htmlFor="country" className="text-sm font-medium">
                Country
              </label>
              <Input
                id="country"
                name="country"
                defaultValue={initialData?.country || "Kosovo"}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Notes">
          <div className="space-y-2">
            <label htmlFor="notes" className="text-sm font-medium">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={4}
              defaultValue={initialData?.notes || ""}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </SectionCard>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" asChild>
            <Link href={isEdit ? `/clients/${clientId}` : "/clients"}>
              Cancel
            </Link>
          </Button>

          <Button type="submit">
            {isEdit ? "Update Client" : "Create Client"}
          </Button>
        </div>
      </form>
    </div>
  );
}
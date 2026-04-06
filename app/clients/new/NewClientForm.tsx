"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ClientLocationFields from "../ClientLocationFields";

import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { SectionCard } from "@/components/ui/SectionCard";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";

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
      />

      <form action={action} className="max-w-3xl space-y-6">
        <SectionCard title="General">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="client_type">Client Type</Label>
              <select
                id="client_type"
                name="client_type"
                value={clientType}
                onChange={(e) => setClientType(e.target.value)}
                required
                className="input"
              >
                <option value="individual">Individual</option>
                <option value="business">Business</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue={initialData?.status || "active"}
                className="input"
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
              <Label htmlFor="full_name">Full Name</Label>
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
                <Label htmlFor="company_name">Company Name</Label>
                <Input
                  id="company_name"
                  name="company_name"
                  defaultValue={initialData?.company_name || ""}
                  required={showBusiness}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_person">Contact Person</Label>
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
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={initialData?.phone || ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
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
              <Label htmlFor="address_line_1">Address Line 1</Label>
              <Input
                id="address_line_1"
                name="address_line_1"
                defaultValue={initialData?.address_line_1 || ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_line_2">Address Line 2</Label>
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
              <Label htmlFor="country">Country</Label>
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
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={4}
              defaultValue={initialData?.notes || ""}
            />
          </div>
        </SectionCard>

        <div className="flex justify-end gap-2">
          <Button variant="outline" asChild>
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
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ClientLocationFields from "../ClientLocationFields";

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
    ? "Add Business Client"
    : "Add Individual Client";

  const subtitle = isEdit
    ? "Update client details"
    : clientType === "business"
    ? "Create a company profile"
    : "Create a personal client profile";

  const showIndividualFields = clientType === "individual";
  const showBusinessFields = clientType === "business";

  const helperText = useMemo(() => {
    return clientType === "business"
      ? "Business details are required."
      : "Use full name for individuals.";
  }, [clientType]);

  return (
    <main className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle mt-2">{subtitle}</p>
        </div>

        <Link
          href={isEdit ? `/clients/${clientId}` : "/clients"}
          className="btn btn-ghost"
        >
          Cancel
        </Link>
      </div>

      <form
        action={action}
        className="card"
        style={{ display: "grid", gap: 16, maxWidth: 860 }}
      >
        <div className="grid-2">
          <label className="field">
            Client Type
            <select
              name="client_type"
              className="input"
              value={clientType}
              onChange={(e) => setClientType(e.target.value)}
              required
            >
              <option value="individual">Individual</option>
              <option value="business">Business</option>
            </select>
          </label>

          <label className="field">
            Status
            <select
              name="status"
              className="input"
              defaultValue={initialData?.status || "active"}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>

        <div className="card" style={{ padding: 12 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>
            {helperText}
          </div>
        </div>

        {showIndividualFields && (
          <label className="field">
            Full Name
            <input
              name="full_name"
              className="input"
              defaultValue={initialData?.full_name || ""}
              required={showIndividualFields}
            />
          </label>
        )}

        {showBusinessFields && (
          <>
            <label className="field">
              Company Name
              <input
                name="company_name"
                className="input"
                defaultValue={initialData?.company_name || ""}
                required={showBusinessFields}
              />
            </label>

            <label className="field">
              Contact Person
              <input
                name="contact_person"
                className="input"
                defaultValue={initialData?.contact_person || ""}
              />
            </label>
          </>
        )}

        <div className="grid-2">
          <label className="field">
            Phone
            <input
              name="phone"
              className="input"
              defaultValue={initialData?.phone || ""}
            />
          </label>

          <label className="field">
            Email
            <input
              name="email"
              type="email"
              className="input"
              defaultValue={initialData?.email || ""}
            />
          </label>
        </div>

        <label className="field">
          Address Line 1
          <input
            name="address_line_1"
            className="input"
            defaultValue={initialData?.address_line_1 || ""}
          />
        </label>

        <label className="field">
          Address Line 2
          <input
            name="address_line_2"
            className="input"
            defaultValue={initialData?.address_line_2 || ""}
          />
        </label>

        <ClientLocationFields
          municipalities={municipalities}
          locations={locations}
          defaultMunicipalityId={initialData?.municipality_id || ""}
          defaultLocationId={initialData?.location_id || ""}
        />

        <label className="field">
          Country
          <input
            name="country"
            className="input"
            defaultValue={initialData?.country || "Kosovo"}
          />
        </label>

        <label className="field">
          Notes
          <textarea
            name="notes"
            className="input"
            rows={4}
            defaultValue={initialData?.notes || ""}
          />
        </label>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Link
            href={isEdit ? `/clients/${clientId}` : "/clients"}
            className="btn btn-ghost"
          >
            Cancel
          </Link>

          <button type="submit" className="btn btn-primary">
            {isEdit ? "Update Client" : "Save Client"}
          </button>
        </div>
      </form>
    </main>
  );
}
"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, FormField, Input } from "@/components/ui";
import AddressFields from "../../components/AddressFields";

type Municipality = {
  id: string;
  name: string;
};

type Location = {
  id: string;
  name: string;
  type: "neighborhood" | "village" | "other";
  municipality_id: string;
};

type Client = {
  id: string;
  full_name: string | null;
  company_name: string | null;
};

type PropertyEditFormProps = {
  clients: Client[];
  municipalities: Municipality[];
  locations: Location[];
  property: {
    id: string;
    property_code: string | null;
    title: string | null;
    owner_client_id: string | null;
    municipality_id: string | null;
    location_id: string | null;
    address_line_1: string | null;
    address_line_2: string | null;
    country: string | null;
    property_type: string | null;
    status: string | null;
  };
  updateProperty: (formData: FormData) => void;
};

export default function PropertyEditForm({
  clients,
  municipalities,
  locations,
  property,
  updateProperty,
}: PropertyEditFormProps) {
  const nativeSelectClassName =
    "flex h-10 w-full items-center justify-between rounded-md border border-[var(--select-border)] bg-[var(--select-bg)] px-3 py-2 text-sm text-[var(--select-text)] ring-offset-background focus:outline-none focus:ring-2 focus:ring-[var(--select-ring-color)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

  const [selectedMunicipalityId, setSelectedMunicipalityId] = useState(
    property.municipality_id || ""
  );

  return (
    <form action={updateProperty} className="space-y-6">
      <input type="hidden" name="id" value={property.id} />

      <div className="grid-2">
        <FormField label="Property Code">
          <Input
            id="property_code"
            value={property.property_code || ""}
            disabled
          />
        </FormField>

        <FormField label="Title">
          <Input
            id="title"
            name="title"
            defaultValue={property.title || ""}
            required
          />
        </FormField>
      </div>

      <FormField label="Owner">
        <select
          id="owner_client_id"
          name="owner_client_id"
          className={nativeSelectClassName}
          required
          defaultValue={property.owner_client_id || ""}
        >
          <option value="" disabled>
            Select owner
          </option>
          {clients.map((client) => {
            const label = client.company_name || client.full_name || client.id;

            return (
              <option key={client.id} value={client.id}>
                {label}
              </option>
            );
          })}
        </select>
      </FormField>

      <AddressFields
        municipalities={municipalities}
        locations={locations}
        selectedMunicipalityId={selectedMunicipalityId}
        onMunicipalityChange={setSelectedMunicipalityId}
        defaultLocationId={property.location_id || ""}
        defaultAddressLine1={property.address_line_1 || ""}
        defaultAddressLine2={property.address_line_2 || ""}
        defaultCountry={property.country || "Kosovo"}
      />

      <div className="grid-2">
        <FormField label="Property Type">
          <select
            id="property_type"
            name="property_type"
            className={nativeSelectClassName}
            defaultValue={property.property_type || ""}
          >
            <option value="">Select type</option>
            <option value="apartment">Apartment</option>
            <option value="house">House</option>
            <option value="office">Office</option>
            <option value="shop">Shop</option>
            <option value="land">Land</option>
          </select>
        </FormField>

        <FormField label="Status">
          <select
            id="status"
            name="status"
            className={nativeSelectClassName}
            defaultValue={property.status || "active"}
          >
            <option value="active">Active</option>
            <option value="vacant">Vacant</option>
            <option value="inactive">Inactive</option>
            <option value="under_maintenance">Under Maintenance</option>
          </select>
        </FormField>
      </div>

      <div className="flex gap-3">
        <Button type="submit">Save Changes</Button>

        <Button asChild variant="ghost">
          <Link href={`/properties/${property.id}`}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}

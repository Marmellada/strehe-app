"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

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
  const [selectedMunicipalityId, setSelectedMunicipalityId] = useState(
    property.municipality_id || ""
  );

  const filteredLocations = useMemo(() => {
    if (!selectedMunicipalityId) return [];
    return locations
      .filter((location) => location.municipality_id === selectedMunicipalityId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [locations, selectedMunicipalityId]);

  return (
    <form action={updateProperty} className="space-y-6">
      <input type="hidden" name="id" value={property.id} />

      <div className="grid-2">
        <div className="field">
          <label htmlFor="property_code">Property Code</label>
          <input
            id="property_code"
            className="input"
            value={property.property_code || ""}
            disabled
          />
        </div>

        <div className="field">
          <label htmlFor="title">Title</label>
          <input
            id="title"
            name="title"
            className="input"
            defaultValue={property.title || ""}
            required
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="owner_client_id">Owner</label>
        <select
          id="owner_client_id"
          name="owner_client_id"
          className="input"
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
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="municipality_id">Municipality</label>
          <select
            id="municipality_id"
            name="municipality_id"
            className="input"
            required
            value={selectedMunicipalityId}
            onChange={(e) => setSelectedMunicipalityId(e.target.value)}
          >
            <option value="" disabled>
              Select municipality
            </option>
            {municipalities.map((municipality) => (
              <option key={municipality.id} value={municipality.id}>
                {municipality.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="location_id">Neighborhood / Village</label>
          <select
            id="location_id"
            name="location_id"
            className="input"
            required
            defaultValue={property.location_id || ""}
            disabled={!selectedMunicipalityId}
          >
            <option value="" disabled>
              {selectedMunicipalityId
                ? "Select neighborhood / village"
                : "Select municipality first"}
            </option>

            {filteredLocations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="address_line_1">Address Line 1</label>
          <input
            id="address_line_1"
            name="address_line_1"
            className="input"
            defaultValue={property.address_line_1 || ""}
          />
        </div>

        <div className="field">
          <label htmlFor="address_line_2">Address Line 2</label>
          <input
            id="address_line_2"
            name="address_line_2"
            className="input"
            defaultValue={property.address_line_2 || ""}
          />
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="country">Country</label>
          <input
            id="country"
            name="country"
            className="input"
            defaultValue={property.country || "Kosovo"}
          />
        </div>

        <div className="field">
          <label htmlFor="property_type">Property Type</label>
          <select
            id="property_type"
            name="property_type"
            className="input"
            defaultValue={property.property_type || ""}
          >
            <option value="">Select type</option>
            <option value="apartment">Apartment</option>
            <option value="house">House</option>
            <option value="office">Office</option>
            <option value="shop">Shop</option>
            <option value="land">Land</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="status">Status</label>
        <select
          id="status"
          name="status"
          className="input"
          defaultValue={property.status || "active"}
        >
          <option value="active">Active</option>
          <option value="vacant">Vacant</option>
          <option value="inactive">Inactive</option>
          <option value="under_maintenance">Under Maintenance</option>
        </select>
      </div>

      <div className="flex gap-3">
        <button type="submit" className="btn btn-primary">
          Save Changes
        </button>

        <Link href={`/properties/${property.id}`} className="btn btn-ghost">
          Cancel
        </Link>
      </div>
    </form>
  );
}
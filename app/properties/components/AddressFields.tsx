"use client";

import { useMemo, useState } from "react";
import { Input, Label } from "@/components/ui";

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

type AddressFieldsProps = {
  municipalities: Municipality[];
  locations: Location[];
  selectedMunicipalityId: string;
  onMunicipalityChange: (value: string) => void;
  defaultLocationId?: string;
  defaultAddressLine1?: string;
  defaultAddressLine2?: string;
  defaultCountry?: string;
};

export default function AddressFields({
  municipalities,
  locations,
  selectedMunicipalityId,
  onMunicipalityChange,
  defaultLocationId = "",
  defaultAddressLine1 = "",
  defaultAddressLine2 = "",
  defaultCountry = "Kosovo",
}: AddressFieldsProps) {
  const nativeSelectClassName =
    "flex h-10 w-full items-center justify-between rounded-md border border-[var(--select-border)] bg-[var(--select-bg)] px-3 py-2 text-sm text-[var(--select-text)] ring-offset-background focus:outline-none focus:ring-2 focus:ring-[var(--select-ring-color)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

  const [selectedLocationId, setSelectedLocationId] = useState(defaultLocationId);

  const filteredLocations = useMemo(() => {
    if (!selectedMunicipalityId) return [];

    return locations
      .filter((location) => location.municipality_id === selectedMunicipalityId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [locations, selectedMunicipalityId]);

  return (
    <>
      <div className="grid grid-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="municipality_id">Municipality</Label>
          <select
            id="municipality_id"
            name="municipality_id"
            className={nativeSelectClassName}
            required
            value={selectedMunicipalityId}
            onChange={(e) => {
              onMunicipalityChange(e.target.value);
              setSelectedLocationId("");
            }}
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

        <div className="space-y-2">
          <Label htmlFor="location_id">Neighborhood / Village</Label>
          <select
            id="location_id"
            name="location_id"
            className={nativeSelectClassName}
            required
            value={
              filteredLocations.some((location) => location.id === selectedLocationId)
                ? selectedLocationId
                : ""
            }
            onChange={(e) => setSelectedLocationId(e.target.value)}
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

      <div className="grid grid-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="address_line_1">Address Line 1</Label>
          <Input
            id="address_line_1"
            name="address_line_1"
            placeholder="Street name / building"
            defaultValue={defaultAddressLine1}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address_line_2">Address Line 2</Label>
          <Input
            id="address_line_2"
            name="address_line_2"
            placeholder="Apartment / floor / unit"
            defaultValue={defaultAddressLine2}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="country">Country</Label>
        <Input
          id="country"
          name="country"
          defaultValue={defaultCountry}
          readOnly
        />
      </div>
    </>
  );
}

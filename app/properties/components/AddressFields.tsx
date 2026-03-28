"use client";

import { useEffect, useMemo, useState } from "react";

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
  const [selectedLocationId, setSelectedLocationId] = useState(defaultLocationId);

  const filteredLocations = useMemo(() => {
    if (!selectedMunicipalityId) return [];

    return locations
      .filter((location) => location.municipality_id === selectedMunicipalityId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [locations, selectedMunicipalityId]);

  useEffect(() => {
    if (!selectedMunicipalityId) {
      setSelectedLocationId("");
      return;
    }

    const stillValid = filteredLocations.some(
      (location) => location.id === selectedLocationId
    );

    if (!stillValid) {
      setSelectedLocationId("");
    }
  }, [selectedMunicipalityId, filteredLocations, selectedLocationId]);

  return (
    <>
      <div className="grid grid-2 gap-4">
        <div className="field">
          <label htmlFor="municipality_id">Municipality</label>
          <select
            id="municipality_id"
            name="municipality_id"
            className="input"
            required
            value={selectedMunicipalityId}
            onChange={(e) => onMunicipalityChange(e.target.value)}
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
            value={selectedLocationId}
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
        <div className="field">
          <label htmlFor="address_line_1">Address Line 1</label>
          <input
            id="address_line_1"
            name="address_line_1"
            className="input"
            placeholder="Street name / building"
            defaultValue={defaultAddressLine1}
          />
        </div>

        <div className="field">
          <label htmlFor="address_line_2">Address Line 2</label>
          <input
            id="address_line_2"
            name="address_line_2"
            className="input"
            placeholder="Apartment / floor / unit"
            defaultValue={defaultAddressLine2}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="country">Country</label>
        <input
          id="country"
          name="country"
          className="input"
          defaultValue={defaultCountry}
          readOnly
        />
      </div>
    </>
  );
}
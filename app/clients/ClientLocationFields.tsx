"use client";

import { useMemo, useState } from "react";
import { Label } from "@/components/ui/Label";

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

type Props = {
  municipalities: Municipality[];
  locations: Location[];
  defaultMunicipalityId?: string;
  defaultLocationId?: string;
};

export default function ClientLocationFields({
  municipalities,
  locations,
  defaultMunicipalityId = "",
  defaultLocationId = "",
}: Props) {
  const [municipalityId, setMunicipalityId] = useState(defaultMunicipalityId);
  const [locationId, setLocationId] = useState(defaultLocationId);

  const filteredLocations = useMemo(() => {
    if (!municipalityId) return [];

    return locations.filter(
      (location) => location.municipality_id === municipalityId
    );
  }, [locations, municipalityId]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="municipality_id">Municipality</Label>
        <select
          id="municipality_id"
          name="municipality_id"
          value={municipalityId}
          onChange={(e) => {
            setMunicipalityId(e.target.value);
            setLocationId("");
          }}
          className="input"
        >
          <option value="">Select municipality</option>
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
          value={
            filteredLocations.some((location) => location.id === locationId)
              ? locationId
              : ""
          }
          onChange={(e) => setLocationId(e.target.value)}
          disabled={!municipalityId}
          className="input"
        >
          <option value="">
            {municipalityId ? "Select location" : "Select municipality first"}
          </option>

          {filteredLocations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
              {location.type ? ` (${location.type})` : ""}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

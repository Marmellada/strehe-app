"use client";

import { useEffect, useMemo, useState } from "react";

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

  useEffect(() => {
    if (!municipalityId) {
      setLocationId("");
      return;
    }

    const existsInMunicipality = filteredLocations.some(
      (location) => location.id === locationId
    );

    if (!existsInMunicipality) {
      setLocationId("");
    }
  }, [municipalityId, locationId, filteredLocations]);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <label htmlFor="municipality_id" className="text-sm font-medium">
          Municipality
        </label>
        <select
          id="municipality_id"
          name="municipality_id"
          value={municipalityId}
          onChange={(e) => setMunicipalityId(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
        <label htmlFor="location_id" className="text-sm font-medium">
          Neighborhood / Village
        </label>
        <select
          id="location_id"
          name="location_id"
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          disabled={!municipalityId}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
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
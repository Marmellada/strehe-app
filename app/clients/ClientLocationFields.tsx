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
    <div className="grid-2">
      <label className="field">
        Municipality
        <select
          name="municipality_id"
          className="input"
          value={municipalityId}
          onChange={(e) => setMunicipalityId(e.target.value)}
        >
          <option value="">Select municipality</option>
          {municipalities.map((municipality) => (
            <option key={municipality.id} value={municipality.id}>
              {municipality.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        Neighborhood / Village
        <select
          name="location_id"
          className="input"
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          disabled={!municipalityId}
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
      </label>
    </div>
  );
}
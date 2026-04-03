"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ClientRow = {
  id: string;
  full_name: string | null;
  company_name: string | null;
};

type PropertyRow = {
  id: string;
  title: string | null;
  property_code: string | null;
  owner_client_id: string | null;
};

type PackageRow = {
  id: string;
  name: string | null;
  monthly_price: number | string | null;
  is_active?: boolean | null;
};

type SubscriptionRow = {
  id: string;
  property_id: string | null;
  status: string | null;
};

type Props = {
  clients: ClientRow[];
  properties: PropertyRow[];
  packages: PackageRow[];
  subscriptions: SubscriptionRow[];
  action: (formData: FormData) => void | Promise<void>;
};

function formatPrice(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "";
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return "";
  return num.toFixed(2);
}

export default function CreateSubscriptionForm({
  clients,
  properties,
  packages,
  subscriptions,
  action,
}: Props) {
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [monthlyPrice, setMonthlyPrice] = useState("");

  const blockedPropertyIds = useMemo(() => {
    return new Set(
      subscriptions
        .filter((s) => {
          const status = (s.status || "").toLowerCase();
          return status === "active" || status === "paused";
        })
        .map((s) => s.property_id)
        .filter(Boolean) as string[]
    );
  }, [subscriptions]);

  const availableProperties = useMemo(() => {
    if (!selectedClientId) return [];

    return properties.filter((property) => {
      const belongsToClient = property.owner_client_id === selectedClientId;
      const isBlocked = blockedPropertyIds.has(property.id);
      return belongsToClient && !isBlocked;
    });
  }, [properties, selectedClientId, blockedPropertyIds]);

  const selectedPackage = useMemo(() => {
    return packages.find((pkg) => pkg.id === selectedPackageId) || null;
  }, [packages, selectedPackageId]);

  useEffect(() => {
    setSelectedPropertyId("");
  }, [selectedClientId]);

  useEffect(() => {
    if (!selectedPackage) {
      setMonthlyPrice("");
      return;
    }

    setMonthlyPrice(formatPrice(selectedPackage.monthly_price));
  }, [selectedPackage]);

  return (
    <form action={action} className="card space-y-6">
      <div className="grid grid-2 gap-4">
        <div>
          <label htmlFor="client_id" className="field-label">
            Client *
          </label>
          <select
            id="client_id"
            name="client_id"
            required
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="input"
          >
            <option value="" disabled>
              Select client
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company_name || c.full_name || "-"}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="property_id" className="field-label">
            Property *
          </label>
          <select
            id="property_id"
            name="property_id"
            required
            value={selectedPropertyId}
            onChange={(e) => setSelectedPropertyId(e.target.value)}
            className="input"
            disabled={!selectedClientId || availableProperties.length === 0}
          >
            <option value="" disabled>
              {!selectedClientId
                ? "Select client first"
                : availableProperties.length === 0
                ? "No free properties available"
                : "Select property"}
            </option>
            {availableProperties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.property_code
                  ? `${p.property_code} - ${p.title || ""}`
                  : p.title || "-"}
              </option>
            ))}
          </select>

          {selectedClientId && availableProperties.length === 0 ? (
            <p className="page-subtitle mt-2">
              This client has no free properties available for a new contract.
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="package_id" className="field-label">
            Plan *
          </label>
          <select
            id="package_id"
            name="package_id"
            required
            value={selectedPackageId}
            onChange={(e) => setSelectedPackageId(e.target.value)}
            className="input"
          >
            <option value="" disabled>
              Select plan
            </option>
            {packages.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>
                {pkg.name} ({pkg.monthly_price ? `€${pkg.monthly_price}` : "-"})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="monthly_price" className="field-label">
            Monthly Price
          </label>
          <input
            id="monthly_price"
            name="monthly_price"
            type="number"
            step="0.01"
            min="0"
            className="input"
            value={monthlyPrice}
            readOnly
          />
          <p className="page-subtitle mt-2">
            Price is taken automatically from the selected plan.
          </p>
        </div>

        <div>
          <label htmlFor="start_date" className="field-label">
            Start Date *
          </label>
          <input
            id="start_date"
            name="start_date"
            type="date"
            required
            className="input"
          />
        </div>

        <div>
          <label htmlFor="end_date" className="field-label">
            End Date
          </label>
          <input
            id="end_date"
            name="end_date"
            type="date"
            className="input"
          />
        </div>

        <div>
          <label htmlFor="status" className="field-label">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue="active"
            className="input"
          >
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="col-span-2">
          <label htmlFor="notes" className="field-label">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            className="input"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Link href="/subscriptions" className="btn">
          Cancel
        </Link>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={
            !selectedClientId || !selectedPropertyId || !selectedPackageId
          }
        >
          Create Contract
        </button>
      </div>
    </form>
  );
}
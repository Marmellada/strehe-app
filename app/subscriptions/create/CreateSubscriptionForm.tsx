"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { DetailField } from "@/components/ui/DetailField";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { previewPromotionDiscount } from "@/lib/promotions/validation";

type ClientRow = {
  id: string;
  full_name: string | null;
  company_name: string | null;
  email?: string | null;
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

type PromotionCampaignRelation =
  | {
      id: string;
      name: string | null;
      discount_type: "percent" | "fixed_amount";
      discount_percent: number | string | null;
      discount_amount_cents: number | null;
      active: boolean | null;
      starts_at: string | null;
      ends_at: string | null;
    }
  | {
      id: string;
      name: string | null;
      discount_type: "percent" | "fixed_amount";
      discount_percent: number | string | null;
      discount_amount_cents: number | null;
      active: boolean | null;
      starts_at: string | null;
      ends_at: string | null;
    }[]
  | null;

type PromotionCodeRow = {
  id: string;
  code: string;
  assigned_name: string | null;
  assigned_email: string | null;
  status: string | null;
  expires_at: string | null;
  redemption_count: number | null;
  max_redemptions: number | null;
  campaign: PromotionCampaignRelation;
};

type Props = {
  clients: ClientRow[];
  properties: PropertyRow[];
  packages: PackageRow[];
  subscriptions: SubscriptionRow[];
  promotionCodes: PromotionCodeRow[];
  action: (formData: FormData) => void | Promise<void>;
};

function formatPrice(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "";
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return "";
  return num.toFixed(2);
}

function getSingleRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

function isBeforeToday(dateValue: string | null | undefined) {
  if (!dateValue) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(`${dateValue}T00:00:00`);
  return date < today;
}

function isAfterToday(dateValue: string | null | undefined) {
  if (!dateValue) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(`${dateValue}T00:00:00`);
  return date > today;
}

export default function CreateSubscriptionForm({
  clients,
  properties,
  packages,
  subscriptions,
  promotionCodes,
  action,
}: Props) {
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [monthlyPrice, setMonthlyPrice] = useState("");
  const [promotionCodeInput, setPromotionCodeInput] = useState("");

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

  const selectedClient = useMemo(() => {
    return clients.find((client) => client.id === selectedClientId) || null;
  }, [clients, selectedClientId]);

  const selectedProperty = useMemo(() => {
    return properties.find((property) => property.id === selectedPropertyId) || null;
  }, [properties, selectedPropertyId]);

  const promotionMatch = useMemo(() => {
    const normalized = promotionCodeInput.trim().toUpperCase();
    if (!normalized) return null;

    return (
      promotionCodes.find(
        (code) => code.code.trim().toUpperCase() === normalized
      ) || null
    );
  }, [promotionCodeInput, promotionCodes]);

  const promotionPreview = useMemo(() => {
    if (!promotionMatch || !monthlyPrice) return null;

    const campaign = getSingleRelation(promotionMatch.campaign);
    if (!campaign) return null;

    const status = String(promotionMatch.status || "").toLowerCase();
    const isCodeAvailable = ["issued", "sent"].includes(status);
    const isCampaignAvailable =
      campaign.active &&
      !isAfterToday(campaign.starts_at) &&
      !isBeforeToday(campaign.ends_at);
    const redemptions = promotionMatch.redemption_count || 0;
    const maxRedemptions = promotionMatch.max_redemptions || 1;
    const hasRedemptionsLeft = redemptions < maxRedemptions;

    if (!isCodeAvailable || !isCampaignAvailable || !hasRedemptionsLeft) {
      return {
        ok: false as const,
        campaign,
        message: "This promotion code is not currently available.",
      };
    }

    const price = Number(monthlyPrice);
    if (Number.isNaN(price)) return null;

    const calculation = previewPromotionDiscount({
      discountType: campaign.discount_type,
      discountPercent: campaign.discount_percent,
      discountAmountCents: campaign.discount_amount_cents,
      monthlyPrice: price,
    });

    return {
      ok: true as const,
      campaign,
      calculation,
      issuedTo: promotionMatch.assigned_email || promotionMatch.assigned_name || null,
    };
  }, [monthlyPrice, promotionMatch]);

  return (
    <form action={action} className="space-y-6">
      <Card size="sm">
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Creating a contract does not create tasks immediately. The contract
            is saved as the source record, and the scheduled generator reads it later.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="client_id" className="text-sm font-medium">
              Client *
            </label>
            <select
              id="client_id"
              name="client_id"
              required
              value={selectedClientId}
              onChange={(e) => {
                setSelectedClientId(e.target.value);
                setSelectedPropertyId("");
              }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Select client
              </option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.company_name || client.full_name || "-"}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="property_id" className="text-sm font-medium">
              Property *
            </label>
            <select
              id="property_id"
              name="property_id"
              required
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              disabled={!selectedClientId || availableProperties.length === 0}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="" disabled>
                {!selectedClientId
                  ? "Select client first"
                  : availableProperties.length === 0
                    ? "No free properties available"
                    : "Select property"}
              </option>
              {availableProperties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.property_code
                    ? `${property.property_code} - ${property.title || ""}`
                    : property.title || "-"}
                </option>
              ))}
            </select>
            {selectedClientId && availableProperties.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This client has no free properties available for a new contract.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="package_id" className="text-sm font-medium">
              Package *
            </label>
            <select
              id="package_id"
              name="package_id"
              required
              value={selectedPackageId}
              onChange={(e) => {
                const nextPackageId = e.target.value;
                const nextPackage =
                  packages.find((pkg) => pkg.id === nextPackageId) || null;
                setSelectedPackageId(nextPackageId);
                setMonthlyPrice(formatPrice(nextPackage?.monthly_price));
              }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Select package
              </option>
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.name}{" "}
                  {pkg.monthly_price !== null && pkg.monthly_price !== undefined
                    ? `(€${pkg.monthly_price})`
                    : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="monthly_price" className="text-sm font-medium">
              Monthly Price *
            </label>
            <input
              id="monthly_price"
              name="monthly_price"
              type="number"
              step="0.01"
              min="0"
              required
              value={monthlyPrice}
              readOnly
              className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm"
            />
            <p className="text-sm text-muted-foreground">
              Pre-filled from the selected package.
            </p>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="promotion_code" className="text-sm font-medium">
              Promotion Code
            </label>
            <input
              id="promotion_code"
              name="promotion_code"
              value={promotionCodeInput}
              onChange={(event) => setPromotionCodeInput(event.target.value)}
              placeholder="Example: SURVEY-10-X7K2"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm uppercase"
            />
            <p className="text-sm text-muted-foreground">
              Optional. The app validates the code again when the contract is saved.
            </p>

            {promotionCodeInput.trim() && !promotionMatch ? (
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                No local match found. You can still submit; the server will validate
                against the current database.
              </div>
            ) : null}

            {promotionPreview?.ok ? (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant="success">Code ready</Badge>
                  <span className="font-medium">
                    {promotionPreview.campaign.name}
                  </span>
                </div>
                <div className="grid gap-1 text-muted-foreground md:grid-cols-3">
                  <span>
                    Normal: €{promotionPreview.calculation.original.toFixed(2)}
                  </span>
                  <span>
                    Discount: -€{promotionPreview.calculation.discount.toFixed(2)}
                  </span>
                  <span className="font-medium text-foreground">
                    Final: €{promotionPreview.calculation.final.toFixed(2)}
                  </span>
                </div>
                {promotionPreview.issuedTo ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Issued to {promotionPreview.issuedTo}. It can still be used
                    on this contract; the redemption will record the actual client.
                  </p>
                ) : null}
              </div>
            ) : promotionPreview ? (
              <div className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">
                {promotionPreview.message}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="start_date" className="text-sm font-medium">
              Start Date *
            </label>
            <input
              id="start_date"
              name="start_date"
              type="date"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="end_date" className="text-sm font-medium">
              End Date
            </label>
            <input
              id="end_date"
              name="end_date"
              type="date"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="status" className="text-sm font-medium">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue="draft"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="draft">Draft</option>
              <option value="prepared">Prepared</option>
              <option value="paused">Paused</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <p className="text-sm text-muted-foreground">
              A contract becomes active only after someone confirms the physical copy was signed and filed.
            </p>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="notes" className="text-sm font-medium">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={4}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <Card>
          <CardContent className="space-y-4">
            <div className="text-sm font-semibold">Contract Preview</div>
            <DetailField
              label="Client"
              value={selectedClient?.company_name || selectedClient?.full_name || "-"}
            />
            <DetailField
              label="Property"
              value={
                selectedProperty
                  ? selectedProperty.property_code
                    ? `${selectedProperty.property_code} - ${selectedProperty.title || ""}`
                    : selectedProperty.title || "-"
                  : "-"
              }
            />
            <DetailField label="Package" value={selectedPackage?.name || "-"} />
            <DetailField
              label="Monthly Price"
              value={
                promotionPreview?.ok
                  ? `€${promotionPreview.calculation.final.toFixed(2)}`
                  : monthlyPrice
                    ? `€${monthlyPrice}`
                    : "-"
              }
            />
            {promotionPreview?.ok ? (
              <>
                <DetailField
                  label="Original Price"
                  value={`€${promotionPreview.calculation.original.toFixed(2)}`}
                />
                <DetailField
                  label="Promotion"
                  value={`${promotionMatch?.code || "-"} (-€${promotionPreview.calculation.discount.toFixed(2)})`}
                />
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        <Button asChild variant="outline">
          <Link href="/subscriptions">Cancel</Link>
        </Button>
        <Button
          type="submit"
          disabled={!selectedClientId || !selectedPropertyId || !selectedPackageId}
        >
          Create Contract
        </Button>
      </div>
    </form>
  );
}

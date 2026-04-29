import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import {
  cancelPromotionCodeAction,
  createBulkPromotionCodesAction,
  createPromotionCampaignAction,
  createPromotionCodeAction,
  markPromotionCodeSentAction,
} from "@/lib/actions/promotions";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  SectionCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui";

type CampaignRow = {
  id: string;
  name: string;
  description: string | null;
  discount_type: string;
  applies_to: string | null;
  discount_percent: number | string | null;
  discount_amount_cents: number | null;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean | null;
  created_at: string | null;
};

type CodeCampaignRelation =
  | {
      id: string;
      name: string | null;
      discount_type: string | null;
      discount_percent: number | string | null;
      discount_amount_cents: number | null;
    }
  | {
      id: string;
      name: string | null;
      discount_type: string | null;
      discount_percent: number | string | null;
      discount_amount_cents: number | null;
    }[]
  | null;

type CodeRow = {
  id: string;
  code: string;
  assigned_name: string | null;
  assigned_email: string | null;
  source: string | null;
  status: string | null;
  expires_at: string | null;
  redemption_count: number | null;
  max_redemptions: number | null;
  created_at: string | null;
  campaign: CodeCampaignRelation;
};

function getSingleRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDiscount(row: {
  discount_type: string | null;
  discount_percent: number | string | null;
  discount_amount_cents: number | null;
}) {
  if (row.discount_type === "percent") {
    return `${Number(row.discount_percent || 0)}%`;
  }

  return `€${((row.discount_amount_cents || 0) / 100).toFixed(2)}`;
}

function formatAppliesTo(value: string | null | undefined) {
  if (value === "service_lines") return "Service lines";
  if (value === "both") return "Packages and services";
  return "Package fees";
}

function statusVariant(status: string | null) {
  switch (status) {
    case "sent":
      return "info" as const;
    case "redeemed":
      return "success" as const;
    case "expired":
    case "cancelled":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

export default async function PromotionsPage() {
  await requireRole(["admin"]);

  const supabase = await createClient();
  const [campaignsResult, codesResult] = await Promise.all([
    supabase
      .from("promotion_campaigns")
      .select(
        "id, name, description, discount_type, applies_to, discount_percent, discount_amount_cents, starts_at, ends_at, active, created_at"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("promotion_codes")
      .select(
        `
        id,
        code,
        assigned_name,
        assigned_email,
        source,
        status,
        expires_at,
        redemption_count,
        max_redemptions,
        created_at,
        campaign:promotion_campaigns (
          id,
          name,
          discount_type,
          discount_percent,
          discount_amount_cents
        )
      `
      )
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (campaignsResult.error) {
    throw new Error(campaignsResult.error.message);
  }

  if (codesResult.error) {
    throw new Error(codesResult.error.message);
  }

  const campaigns = (campaignsResult.data || []) as CampaignRow[];
  const codes = (codesResult.data || []) as CodeRow[];

  return (
    <main className="space-y-6">
      <div className="space-y-4">
        <Button asChild variant="ghost">
          <Link href="/settings">← Back to Settings</Link>
        </Button>

        <PageHeader
          title="Promotions"
          description="Create campaign discounts and issue unique codes that can be applied to contracts."
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="New Campaign"
          description="Defines the discount rule. For survey testing, create a 10% campaign."
        >
          <form action={createPromotionCampaignAction} className="grid gap-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Campaign Name *
              </label>
              <input
                id="name"
                name="name"
                required
                placeholder="Survey Launch Discount"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                placeholder="10% discount for survey respondents."
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="discount_type" className="text-sm font-medium">
                  Discount Type
                </label>
                <select
                  id="discount_type"
                  name="discount_type"
                  defaultValue="percent"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="percent">Percent</option>
                  <option value="fixed_amount">Fixed Amount</option>
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="applies_to" className="text-sm font-medium">
                  Applies To
                </label>
                <select
                  id="applies_to"
                  name="applies_to"
                  defaultValue="package_fee"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="package_fee">Package fees</option>
                  <option value="service_lines">Service invoice lines</option>
                  <option value="both">Packages and services</option>
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="discount_percent" className="text-sm font-medium">
                  Percent
                </label>
                <input
                  id="discount_percent"
                  name="discount_percent"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  defaultValue="10"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="discount_amount" className="text-sm font-medium">
                  Fixed Amount
                </label>
                <input
                  id="discount_amount"
                  name="discount_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="5.00"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="max_redemptions" className="text-sm font-medium">
                  Campaign Redemption Limit
                </label>
                <input
                  id="max_redemptions"
                  name="max_redemptions"
                  type="number"
                  min="1"
                  placeholder="Optional"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="starts_at" className="text-sm font-medium">
                  Starts
                </label>
                <input
                  id="starts_at"
                  name="starts_at"
                  type="date"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="ends_at" className="text-sm font-medium">
                  Ends
                </label>
                <input
                  id="ends_at"
                  name="ends_at"
                  type="date"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>

            <Button type="submit">Create Campaign</Button>
          </form>
        </SectionCard>

        <SectionCard
          title="Issue Code"
          description="Create a unique code for one respondent or lead."
        >
          {campaigns.length === 0 ? (
            <EmptyState
              title="Create a campaign first"
              description="Codes belong to campaigns so their discount rule stays controlled."
            />
          ) : (
            <form action={createPromotionCodeAction} className="grid gap-4">
              <div className="space-y-2">
                <label htmlFor="campaign_id" className="text-sm font-medium">
                  Campaign *
                </label>
                <select
                  id="campaign_id"
                  name="campaign_id"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name} ({formatDiscount(campaign)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="assigned_name" className="text-sm font-medium">
                    Assigned Name
                  </label>
                  <input
                    id="assigned_name"
                    name="assigned_name"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="assigned_email" className="text-sm font-medium">
                    Assigned Email
                  </label>
                  <input
                    id="assigned_email"
                    name="assigned_email"
                    type="email"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="source" className="text-sm font-medium">
                    Source
                  </label>
                  <select
                    id="source"
                    name="source"
                    defaultValue="survey"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="survey">Survey</option>
                    <option value="manual">Manual</option>
                    <option value="referral">Referral</option>
                    <option value="campaign">Campaign</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="expires_at" className="text-sm font-medium">
                    Expires
                  </label>
                  <input
                    id="expires_at"
                    name="expires_at"
                    type="date"
                    defaultValue="2026-12-31"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="prefix" className="text-sm font-medium">
                    Auto Code Prefix
                  </label>
                  <input
                    id="prefix"
                    name="prefix"
                    defaultValue="SURVEY-10"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="code" className="text-sm font-medium">
                    Custom Code
                  </label>
                  <input
                    id="code"
                    name="code"
                    placeholder="Optional"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="send_email"
                  value="true"
                  className="h-4 w-4 rounded border-input"
                />
                Send email immediately and mark as sent only if delivery request succeeds
              </label>

              <Button type="submit">Create Code</Button>
            </form>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Bulk Survey Codes"
        description="Paste respondents as one per line. Use either email only, or name,email."
      >
        {campaigns.length === 0 ? (
          <EmptyState
            title="Create a campaign first"
            description="Bulk codes need a campaign discount rule."
          />
        ) : (
          <form action={createBulkPromotionCodesAction} className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2 md:col-span-2">
                <label htmlFor="bulk_campaign_id" className="text-sm font-medium">
                  Campaign *
                </label>
                <select
                  id="bulk_campaign_id"
                  name="campaign_id"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name} ({formatDiscount(campaign)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="bulk_prefix" className="text-sm font-medium">
                  Prefix
                </label>
                <input
                  id="bulk_prefix"
                  name="prefix"
                  defaultValue="SURVEY-10"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="bulk_expires_at" className="text-sm font-medium">
                  Expires
                </label>
                <input
                  id="bulk_expires_at"
                  name="expires_at"
                  type="date"
                  defaultValue="2026-12-31"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>

            <input type="hidden" name="source" value="survey" />

            <div className="space-y-2">
              <label htmlFor="recipients" className="text-sm font-medium">
                Respondent List *
              </label>
              <textarea
                id="recipients"
                name="recipients"
                required
                rows={8}
                placeholder={"Arben Krasniqi, arben@example.com\nrita@example.com"}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <p className="text-sm text-muted-foreground">
                Format: one respondent per line. Use `Name, email` or just `email`.
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="send_email"
                value="true"
                className="h-4 w-4 rounded border-input"
              />
              Send emails immediately and mark each code as sent only when the email request succeeds
            </label>

            <Button type="submit">Generate Bulk Codes</Button>
          </form>
        )}
      </SectionCard>

      <Card>
        <CardHeader>
          <CardTitle>Campaigns</CardTitle>
          <CardDescription>
            Campaigns define discount rules. Codes are issued from campaigns.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <EmptyState
              title="No campaigns yet"
              description="Create the survey launch discount campaign first."
            />
          ) : (
            <TableShell>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Applies To</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell>
                        <div className="font-medium">{campaign.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {campaign.description || "No description"}
                        </div>
                      </TableCell>
                      <TableCell>{formatDiscount(campaign)}</TableCell>
                      <TableCell>{formatAppliesTo(campaign.applies_to)}</TableCell>
                      <TableCell>
                        {formatDate(campaign.starts_at)} - {formatDate(campaign.ends_at)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={campaign.active ? "success" : "neutral"}>
                          {campaign.active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableShell>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Issued Codes</CardTitle>
          <CardDescription>
            Recent codes that can be applied during contract creation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {codes.length === 0 ? (
            <EmptyState
              title="No codes yet"
              description="Issue a code after creating a campaign."
            />
          ) : (
            <TableShell>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {codes.map((code) => {
                      const campaign = getSingleRelation(code.campaign);
                      return (
                        <TableRow key={code.id}>
                          <TableCell className="font-mono font-medium">
                            {code.code}
                          </TableCell>
                          <TableCell>
                            {campaign?.name || "-"}{" "}
                            {campaign ? `(${formatDiscount(campaign)})` : ""}
                          </TableCell>
                          <TableCell>
                            <div>{code.assigned_name || "-"}</div>
                            <div className="text-sm text-muted-foreground">
                              {code.assigned_email || ""}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusVariant(code.status)}>
                              {code.status || "issued"}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(code.expires_at)}</TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              {code.status === "issued" ? (
                                <form action={markPromotionCodeSentAction}>
                                  <input type="hidden" name="id" value={code.id} />
                                  <Button type="submit" size="sm" variant="outline">
                                    Mark Sent
                                  </Button>
                                </form>
                              ) : null}
                              {code.status !== "redeemed" &&
                              code.status !== "cancelled" ? (
                                <form action={cancelPromotionCodeAction}>
                                  <input type="hidden" name="id" value={code.id} />
                                  <Button type="submit" size="sm" variant="outline">
                                    Cancel
                                  </Button>
                                </form>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TableShell>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

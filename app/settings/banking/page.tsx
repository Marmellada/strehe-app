import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";

import { PageHeader } from "@/components/ui/PageHeader";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default async function SettingsPage() {
  const { appUser } = await requireRole(["admin"]);

  const cards = [
    {
      title: "General Settings",
      description:
        "Manage company information, branding, contact details, and VAT defaults.",
      href: "/settings/general",
      cta: "Open General Settings",
    },
    {
      title: "Banking",
      description:
        "Manage company bank accounts used for invoices and payment details.",
      href: "/settings/banking",
      cta: "Open Banking",
    },
    {
      title: "Users",
      description: "Manage system users and access roles.",
      href: "/settings/users",
      cta: "Manage Users",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Settings"
        description="Configure company settings, banking, and user access."
      />

      <div className="rounded-2xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        Signed in as:{" "}
        <span className="font-medium text-foreground">
          {appUser.role}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.href} className="flex flex-col">
            <CardHeader>
              <CardTitle>{card.title}</CardTitle>
              <CardDescription>{card.description}</CardDescription>
            </CardHeader>

            <CardContent className="mt-auto">
              <Button asChild>
                <Link href={card.href}>{card.cta}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
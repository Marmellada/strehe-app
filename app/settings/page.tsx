import Link from "next/link";
import {
  Button,
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  PageHeader,
} from "@/components/ui";
import { requireRole } from "@/lib/auth/require-role";

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
    {
      title: "Expense Categories",
      description: "Manage active and inactive expense categories used by expenses.",
      href: "/settings/expense-categories",
      cta: "Manage Categories",
    },
    {
      title: "Vendors",
      description: "Manage vendors used on expense records.",
      href: "/settings/vendors",
      cta: "Manage Vendors",
    },
    {
      title: "Appearance",
      description:
        "Open the shared UI preview and adjust visual tokens for buttons, fields, cards, tables, alerts, and shell colors.",
      href: "/ui-preview",
      cta: "Open Appearance Editor",
    },
  ];

  return (
    <main className="space-y-6">
      <PageHeader
        title="System Settings"
        description={`Configure company settings, banking, and user access. Signed in as ${appUser.role}.`}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.href} className="h-full">
            <CardHeader>
              <CardTitle>{card.title}</CardTitle>
              <CardDescription>{card.description}</CardDescription>
            </CardHeader>
            <CardFooter className="mt-auto">
              <Button asChild>
                <Link href={card.href}>{card.cta}</Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </section>
    </main>
  );
}

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

  const sections = [
    {
      title: "Company",
      description: "Core business identity, contact details, and banking setup.",
      cards: [
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
      ],
    },
    {
      title: "Operations Setup",
      description: "Reference data used by expenses and day-to-day office work.",
      cards: [
        {
          title: "Expense Categories",
          description:
            "Manage active and inactive expense categories used by expenses.",
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
          title: "Promotions",
          description:
            "Create campaigns and issue unique discount codes for contracts.",
          href: "/settings/promotions",
          cta: "Manage Promotions",
        },
      ],
    },
    {
      title: "Access",
      description: "User accounts and permission control for the admin system.",
      cards: [
        {
          title: "Users",
          description: "Manage system users and access roles.",
          href: "/settings/users",
          cta: "Manage Users",
        },
      ],
    },
  ];

  return (
    <main className="space-y-6">
      <PageHeader
        title="System Settings"
        description={`Configure company settings, banking, and user access. Signed in as ${appUser.role}.`}
      />

      <div className="space-y-8">
        {sections.map((section) => (
          <section key={section.title} className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">
                {section.title}
              </h2>
              <p className="text-sm text-muted-foreground">
                {section.description}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {section.cards.map((card) => (
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
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

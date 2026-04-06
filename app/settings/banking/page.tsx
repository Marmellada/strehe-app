import Link from "next/link";
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
  ];

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">System Settings</h1>
          <p className="page-subtitle mt-2">
            Configure company settings, banking, and user access.
          </p>
          <p className="page-subtitle mt-1">
            Signed in as: <strong>{appUser.role}</strong>
          </p>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <article key={card.href} className="card p-6 flex flex-col gap-4">
            <div>
              <h2 className="section-title !mb-1">{card.title}</h2>
              <p className="page-subtitle">{card.description}</p>
            </div>

            <div className="mt-auto">
              <Link href={card.href} className="btn btn-primary">
                {card.cta}
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
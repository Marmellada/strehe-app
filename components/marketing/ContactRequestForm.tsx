"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";

type ContactRequestFormProps = {
  email: string;
  title: string;
  description: string;
  labels: {
    name: string;
    contact: string;
    abroad: string;
    country: string;
    area: string;
    message: string;
    submit: string;
  };
  options: {
    yes: string;
    no: string;
  };
  helper: string;
};

export function ContactRequestForm({
  email,
  title,
  description,
  labels,
  options,
  helper,
}: ContactRequestFormProps) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [abroad, setAbroad] = useState("yes");
  const [country, setCountry] = useState("");
  const [area, setArea] = useState("");
  const [message, setMessage] = useState("");

  const mailtoHref = useMemo(() => {
    const subject = `Website inquiry from ${name || "new contact"}`;
    const body = [
      `${labels.name}: ${name || "-"}`,
      `${labels.contact}: ${contact || "-"}`,
      `${labels.abroad}: ${abroad === "yes" ? options.yes : options.no}`,
      `${labels.country}: ${country || "-"}`,
      `${labels.area}: ${area || "-"}`,
      "",
      `${labels.message}:`,
      message || "-",
    ].join("\n");

    return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [abroad, area, contact, country, email, labels, message, name, options.no, options.yes]);

  return (
    <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(12,18,31,0.94))] p-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-white">{title}</h2>
        <p className="text-sm text-slate-300">{description}</p>
      </div>

      <form className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contact-name">{labels.name}</Label>
          <Input id="contact-name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-direct">{labels.contact}</Label>
          <Input
            id="contact-direct"
            value={contact}
            onChange={(event) => setContact(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-abroad">{labels.abroad}</Label>
          <select
            id="contact-abroad"
            value={abroad}
            onChange={(event) => setAbroad(event.target.value)}
            className="flex h-10 w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--input-text)]"
          >
            <option value="yes">{options.yes}</option>
            <option value="no">{options.no}</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-country">{labels.country}</Label>
          <Input
            id="contact-country"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="contact-area">{labels.area}</Label>
          <Input id="contact-area" value={area} onChange={(event) => setArea(event.target.value)} />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="contact-message">{labels.message}</Label>
          <Textarea
            id="contact-message"
            rows={5}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </div>

        <div className="sm:col-span-2">
          <p className="mb-4 text-sm text-slate-400">{helper}</p>
          <Button asChild className="w-full sm:w-auto">
            <a href={mailtoHref}>{labels.submit}</a>
          </Button>
        </div>
      </form>
    </div>
  );
}

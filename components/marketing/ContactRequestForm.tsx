"use client";

import { useActionState, useMemo, useState } from "react";
import {
  createPublicContactLeadAction,
  type PublicContactLeadState,
} from "@/lib/actions/public-contact";
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
  locale: string;
};

export function ContactRequestForm({
  email,
  title,
  description,
  labels,
  options,
  helper,
  locale,
}: ContactRequestFormProps) {
  const initialState: PublicContactLeadState = {
    status: "idle",
    message: "",
  };
  const [state, formAction, isPending] = useActionState(
    createPublicContactLeadAction,
    initialState
  );
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

      <form action={formAction} className="mt-6 grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="company_email" value={email} />
        <input type="hidden" name="locale" value={locale} />
        <input
          type="text"
          name="website_url"
          tabIndex={-1}
          autoComplete="off"
          className="hidden"
        />

        <div className="space-y-2">
          <Label htmlFor="contact-name">{labels.name}</Label>
          <Input
            id="contact-name"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-direct">{labels.contact}</Label>
          <Input
            id="contact-direct"
            name="contact"
            value={contact}
            onChange={(event) => setContact(event.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-abroad">{labels.abroad}</Label>
          <select
            id="contact-abroad"
            name="abroad"
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
            name="country"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="contact-area">{labels.area}</Label>
          <Input
            id="contact-area"
            name="area"
            value={area}
            onChange={(event) => setArea(event.target.value)}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="contact-message">{labels.message}</Label>
          <Textarea
            id="contact-message"
            name="message"
            rows={5}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </div>

        <div className="sm:col-span-2">
          <p className="mb-4 text-sm text-slate-400">{helper}</p>
          {state.message ? (
            <p
              className={
                state.status === "error"
                  ? "mb-4 text-sm text-red-200"
                  : "mb-4 text-sm text-emerald-200"
              }
            >
              {state.message}
            </p>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button type="submit" className="w-full sm:w-auto" disabled={isPending}>
              {isPending ? "Sending..." : labels.submit}
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <a href={state.mailtoHref || mailtoHref}>Email fallback</a>
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

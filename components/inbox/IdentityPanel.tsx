"use client";

import { FormEvent, useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { SectionCard } from "@/components/ui/SectionCard";
import {
  searchClients,
  searchLeads,
  setIdentityResolution,
  type ClientSearchItem,
  type IdentityAction,
  type LeadSearchItem,
} from "@/lib/actions/inbox";
import { formatStatusLabel } from "@/lib/ui/status";

type LinkedEntity = {
  id: string;
  displayName: string;
  phone: string | null;
  email: string | null;
};

type IdentityPanelProps = {
  conversationId: string;
  identityId: string;
  channel: string;
  resolutionStatus: "unresolved" | "resolved" | "needs_review";
  lead: LinkedEntity | null;
  client: LinkedEntity | null;
};

type ModalMode = "lead" | "client" | "unlink" | null;
type SearchItem = LeadSearchItem | ClientSearchItem;

function getSearchItemName(item: SearchItem) {
  return "display_name" in item
    ? item.display_name
    : item.full_name || "Unnamed lead";
}

export function IdentityPanel({
  conversationId,
  identityId,
  channel,
  resolutionStatus,
  lead,
  client,
}: IdentityPanelProps) {
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const linked = lead || client;
  const linkedType = lead ? "Lead" : client ? "Client" : null;
  const displayStatus =
    resolutionStatus === "resolved" && !linked
      ? "Resolved — link missing"
      : formatStatusLabel(resolutionStatus);

  function openModal(mode: Exclude<ModalMode, null>) {
    setModalMode(mode);
    setQuery("");
    setResults([]);
    setError(null);
  }

  function closeModal() {
    if (!isPending) setModalMode(null);
  }

  function runIdentityAction(action: IdentityAction, targetId: string | null = null) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await setIdentityResolution(
          conversationId,
          identityId,
          action,
          targetId
        );
        if (!result.success) {
          setError(result.error);
          return;
        }
        setModalMode(null);
      } catch {
        setError("Unable to update identity. Please try again.");
      }
    });
  }

  function runSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (modalMode !== "lead" && modalMode !== "client") return;

    setError(null);
    startTransition(async () => {
      const result =
        modalMode === "lead" ? await searchLeads(query) : await searchClients(query);
      if (!result.success) {
        setResults([]);
        setError(result.error);
        return;
      }
      setResults(result.results);
    });
  }

  const searchMode = modalMode === "lead" || modalMode === "client";

  return (
    <>
      <SectionCard title="Identity">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Channel</p>
            <div className="mt-1"><Badge>{formatStatusLabel(channel)}</Badge></div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Identity status</p>
            <div className="mt-1"><Badge>{displayStatus}</Badge></div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Linked record</p>
            <p className="mt-1 text-sm">
              {linked ? `${linkedType}: ${linked.displayName}` : "No linked record"}
            </p>
            {linked ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {[linked.phone, linked.email].filter(Boolean).join(" • ") || "No contact details"}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => openModal("lead")}>
            Link Lead
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => openModal("client")}>
            Link Client
          </Button>
          {linked || resolutionStatus === "resolved" ? (
            <Button type="button" size="sm" variant="outline" onClick={() => openModal("unlink")}>
              Unlink
            </Button>
          ) : null}
          {resolutionStatus !== "needs_review" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => runIdentityAction("needs_review")}
            >
              Mark Needs Review
            </Button>
          ) : null}
        </div>
        {error && !modalMode ? (
          <p className="mt-3 text-sm text-[var(--badge-danger-text)]" role="alert">{error}</p>
        ) : null}
      </SectionCard>

      <Modal
        open={modalMode !== null}
        onClose={closeModal}
        title={
          modalMode === "unlink"
            ? "Unlink identity"
            : `Link ${modalMode === "lead" ? "Lead" : "Client"}`
        }
        description={
          modalMode === "unlink"
            ? "The identity will become unresolved."
            : "Search existing CRM records. No new record will be created."
        }
        size="lg"
      >
        {searchMode ? (
          <form className="space-y-4" onSubmit={runSearch}>
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${modalMode === "lead" ? "leads" : "clients"}`}
                minLength={2}
                maxLength={100}
                autoFocus
              />
              <Button type="submit" disabled={isPending || query.trim().length < 2}>
                Search
              </Button>
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {results.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{getSearchItemName(item)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[item.phone, item.email].filter(Boolean).join(" • ") || "No contact details"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={isPending}
                    onClick={() =>
                      runIdentityAction(
                        modalMode === "lead" ? "link_lead" : "link_client",
                        item.id
                      )
                    }
                  >
                    Select
                  </Button>
                </div>
              ))}
              {!isPending && results.length === 0 && !error ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Enter at least 2 characters to search.
                </p>
              ) : null}
            </div>
          </form>
        ) : (
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={isPending} onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={() => runIdentityAction("unlink")}
            >
              Confirm Unlink
            </Button>
          </div>
        )}
        {error && modalMode ? (
          <p className="mt-3 text-sm text-[var(--badge-danger-text)]" role="alert">{error}</p>
        ) : null}
      </Modal>
    </>
  );
}

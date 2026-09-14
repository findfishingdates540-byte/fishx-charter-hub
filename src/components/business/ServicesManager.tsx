/**
 * Shared listings manager — create, edit, publish and delete bookable
 * listings for any business vertical (guide trips, lodging, workshops,
 * rentals, marina experiences).
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listBusinessServices,
  upsertBusinessService,
  setBusinessServicePublished,
  deleteBusinessService,
} from "@/lib/business-listings.functions";
import { Card, money } from "@/components/operator/OperatorShell";
import { input, btn } from "@/components/business/BusinessSettings";
import { AvailabilityCalendar } from "@/components/business/AvailabilityCalendar";
import { AddonsManager } from "@/components/business/AddonsManager";
import { ImageUpload } from "@/components/business/ImageUpload";

export type ServiceKindKey =
  | "charter_trip"
  | "guided_trip"
  | "slip_rental"
  | "lodging"
  | "workshop"
  | "rental"
  | "other";

const KIND_LABELS: Record<ServiceKindKey, string> = {
  charter_trip: "Charter trip",
  guided_trip: "Guided trip",
  slip_rental: "Slip rental",
  lodging: "Lodging",
  workshop: "Workshop / clinic",
  rental: "Equipment rental",
  other: "Other",
};

type Draft = {
  id?: string;
  title: string;
  kind: ServiceKindKey;
  description: string;
  hero_url: string;
  base_price_cents: number;
  deposit_cents: number;
  capacity: number;
  duration_minutes: number;
  departure_location: string;
  target_species: string;
  includes: string;
  instant_book: boolean;
  is_published: boolean;
};

const emptyDraft = (kind: ServiceKindKey): Draft => ({
  title: "",
  kind,
  description: "",
  hero_url: "",
  base_price_cents: 0,
  deposit_cents: 0,
  capacity: 4,
  duration_minutes: 240,
  departure_location: "",
  target_species: "",
  includes: "",
  instant_book: false,
  is_published: true,
});

export function ServicesManager({
  businessId,
  kinds,
  eyebrow = "Listings",
  title = "Your listings",
  emptyText = "No listings yet — publish your first one so anglers can book.",
}: {
  businessId: string;
  kinds: ServiceKindKey[];
  eyebrow?: string;
  title?: string;
  emptyText?: string;
}) {
  const qc = useQueryClient();
  const fetchList = useServerFn(listBusinessServices);
  const upsert = useServerFn(upsertBusinessService);
  const publish = useServerFn(setBusinessServicePublished);
  const remove = useServerFn(deleteBusinessService);

  const key = ["business-services", businessId];
  const { data: rows, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => fetchList({ data: { businessId } }),
  });
  const [editing, setEditing] = useState<Draft | null>(null);
  const [calendarFor, setCalendarFor] = useState<any | null>(null);
  const [addonsFor, setAddonsFor] = useState<any | null>(null);
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["guide-overview", businessId] });
    qc.invalidateQueries({ queryKey: ["marina-overview", businessId] });
    qc.invalidateQueries({ queryKey: ["captain-dashboard"] });
  };

  const mSave = useMutation({
    mutationFn: (d: Draft) =>
      upsert({
        data: {
          businessId,
          id: d.id,
          title: d.title,
          kind: d.kind,
          description: d.description || null,
          hero_url: d.hero_url || null,
          base_price_cents: Math.round(d.base_price_cents),
          deposit_cents: Math.round(d.deposit_cents),
          capacity: d.capacity,
          duration_minutes: d.duration_minutes || null,
          departure_location: d.departure_location || null,
          target_species: splitList(d.target_species),
          includes: splitList(d.includes),
          instant_book: d.instant_book,
          is_published: d.is_published,
        },
      }),
    onSuccess: () => {
      invalidate();
      setEditing(null);
    },
  });
  const mPublish = useMutation({
    mutationFn: (v: { id: string; isPublished: boolean }) => publish({ data: { businessId, ...v } }),
    onSuccess: invalidate,
  });
  const mDelete = useMutation({
    mutationFn: (id: string) => remove({ data: { businessId, id } }),
    onSuccess: invalidate,
  });

  return (
    <Card
      eyebrow={eyebrow}
      title={title}
      right={
        <button style={btn("primary")} onClick={() => setEditing(emptyDraft(kinds[0]))}>
          + New listing
        </button>
      }
    >
      {editing && (
        <Editor
          businessId={businessId}
          draft={editing}
          kinds={kinds}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          onSave={() => mSave.mutate(editing)}
          saving={mSave.isPending}
          error={mSave.error ? String((mSave.error as Error).message) : null}
        />
      )}

      {calendarFor && (
        <AvailabilityCalendar service={calendarFor} onClose={() => setCalendarFor(null)} />
      )}

      {addonsFor && (
        <AddonsManager
          businessId={businessId}
          service={addonsFor}
          onClose={() => setAddonsFor(null)}
        />
      )}

      {isLoading && <div style={{ fontSize: 13, color: "#92A0AB" }}>Loading listings…</div>}
      {!isLoading && (rows ?? []).length === 0 && !editing && (
        <div style={{ fontSize: 13.5, color: "#92A0AB" }}>{emptyText}</div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {(rows ?? []).map((s: any) => (
          <div
            key={s.id}
            style={{
              display: "flex",
              gap: 14,
              alignItems: "center",
              padding: 12,
              border: "1px solid rgba(255,255,255,.07)",
              borderRadius: 16,
              background: "#1C2936",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                width: 82,
                height: 60,
                borderRadius: 12,
                background: s.hero_url ? `center/cover url(${cachedMediaUrl(s.hero_url)})` : "#e6ecf1",
                flex: "none",
              }}
            />
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#F0F2F5" }}>{s.title}</div>
              <div style={{ fontSize: 12.5, color: "#92A0AB" }}>
                {KIND_LABELS[s.kind as ServiceKindKey] ?? s.kind} · {money(s.base_price_cents)} ·{" "}
                {s.capacity} guests
                {s.duration_minutes ? ` · ${Math.round(s.duration_minutes / 60)}h` : ""}
              </div>
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "5px 10px",
                borderRadius: 999,
                background: s.is_published ? "rgba(34,197,94,.16)" : "rgba(255,255,255,.05)",
                color: s.is_published ? "#22C55E" : "#92A0AB",
              }}
            >
              {s.is_published ? "Live" : "Draft"}
            </span>
            <button
              style={btn("ghost")}
              onClick={() => mPublish.mutate({ id: s.id, isPublished: !s.is_published })}
            >
              {s.is_published ? "Unpublish" : "Publish"}
            </button>
            <button
              style={btn("ghost")}
              onClick={() => setCalendarFor(calendarFor?.id === s.id ? null : s)}
            >
              Availability
            </button>
            <button
              style={btn("ghost")}
              onClick={() => setAddonsFor(addonsFor?.id === s.id ? null : s)}
            >
              Add-ons
            </button>
            <button style={btn("ghost")} onClick={() => setEditing(toDraft(s))}>
              Edit
            </button>
            <button
              style={{ ...btn("ghost"), color: "#F87171" }}
              onClick={() => {
                if (confirm(`Delete "${s.title}"? This can't be undone.`)) mDelete.mutate(s.id);
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function toDraft(s: any): Draft {
  return {
    id: s.id,
    title: s.title ?? "",
    kind: s.kind,
    description: s.description ?? "",
    hero_url: s.hero_url ?? "",
    base_price_cents: s.base_price_cents ?? 0,
    deposit_cents: s.deposit_cents ?? 0,
    capacity: s.capacity ?? 4,
    duration_minutes: s.duration_minutes ?? 0,
    departure_location: s.departure_location ?? "",
    target_species: (s.target_species ?? []).join(", "),
    includes: (s.includes ?? []).join(", "),
    instant_book: !!s.instant_book,
    is_published: !!s.is_published,
  };
}

const splitList = (v: string) =>
  v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

function Editor({
  businessId,
  draft,
  kinds,
  onChange,
  onCancel,
  onSave,
  saving,
  error,
}: {
  businessId: string;
  draft: Draft;
  kinds: ServiceKindKey[];
  onChange: (d: Draft) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
}) {
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,.09)",
        borderRadius: 18,
        padding: 18,
        marginBottom: 18,
        background: "#14202B",
        display: "grid",
        gap: 14,
      }}
    >
      <Row>
        <F label="Title">
          <input style={input} value={draft.title} onChange={(e) => set({ title: e.target.value })} />
        </F>
        <F label="Type">
          <select style={input} value={draft.kind} onChange={(e) => set({ kind: e.target.value as ServiceKindKey })}>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </F>
      </Row>

      <F label="Description">
        <textarea
          style={{ ...input, minHeight: 90, resize: "vertical" }}
          value={draft.description}
          onChange={(e) => set({ description: e.target.value })}
        />
      </F>

      <Row>
        <F label="Price (USD)">
          <input
            style={input}
            type="number"
            value={draft.base_price_cents / 100}
            onChange={(e) => set({ base_price_cents: Math.round(Number(e.target.value) * 100) })}
          />
        </F>
        <F label="Deposit (USD, 0 = platform default 25%)">
          <input
            style={input}
            type="number"
            value={draft.deposit_cents / 100}
            onChange={(e) => set({ deposit_cents: Math.round(Number(e.target.value) * 100) })}
          />
        </F>
      </Row>

      <Row>
        <F label="Capacity (guests)">
          <input
            style={input}
            type="number"
            value={draft.capacity}
            onChange={(e) => set({ capacity: Math.max(1, Number(e.target.value)) })}
          />
        </F>
        <F label="Duration (minutes)">
          <input
            style={input}
            type="number"
            value={draft.duration_minutes}
            onChange={(e) => set({ duration_minutes: Math.max(0, Number(e.target.value)) })}
          />
        </F>
      </Row>

      <Row>
        <F label="Meeting point / departure">
          <input
            style={input}
            value={draft.departure_location}
            onChange={(e) => set({ departure_location: e.target.value })}
          />
        </F>
        <ImageUpload
          businessId={businessId}
          label="Cover image"
          value={draft.hero_url}
          onChange={(url) => set({ hero_url: url })}
        />
      </Row>

      <Row>
        <F label="Target species (comma separated)">
          <input
            style={input}
            value={draft.target_species}
            onChange={(e) => set({ target_species: e.target.value })}
          />
        </F>
        <F label="What's included (comma separated)">
          <input style={input} value={draft.includes} onChange={(e) => set({ includes: e.target.value })} />
        </F>
      </Row>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, color: "#A9B6C1" }}>
          <input
            type="checkbox"
            checked={draft.instant_book}
            onChange={(e) => set({ instant_book: e.target.checked })}
            style={{ accentColor: "#F0F2F5" }}
          />
          Instant book (skip manual approval)
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, color: "#A9B6C1" }}>
          <input
            type="checkbox"
            checked={draft.is_published}
            onChange={(e) => set({ is_published: e.target.checked })}
            style={{ accentColor: "#F0F2F5" }}
          />
          Publish immediately
        </label>
      </div>

      {error && <div style={{ fontSize: 12.5, color: "#F87171" }}>{error}</div>}

      <div style={{ display: "flex", gap: 10 }}>
        <button style={btn("primary")} onClick={onSave} disabled={saving || draft.title.trim().length < 2}>
          {saving ? "Saving…" : "Save listing"}
        </button>
        <button style={btn("ghost")} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 14 }}>{children}</div>;
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".12em", color: "#92A0AB", fontWeight: 700 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

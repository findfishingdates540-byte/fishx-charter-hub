import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCaptainCharters } from "@/lib/captain-charters.functions";
import { upsertCaptainService, toggleServicePublished } from "@/lib/captain-management.functions";
import { getCaptainDashboard } from "@/lib/captain-dashboard.functions";
import { CaptainPageShell } from "@/components/captain/CaptainPageShell";
import { labelStyle, primaryBtn, ghostBtn } from "@/components/captain/ChartersPanel";
import { AddonsManager } from "@/components/business/AddonsManager";
import { AvailabilityCalendar } from "@/components/business/AvailabilityCalendar";

export const Route = createFileRoute("/_authenticated/captain/packages/$packageId")({
  head: () => ({
    meta: [
      { title: "Edit trip package — Fish-X Charters" },
      { name: "description", content: "Update a charter package price, duration, seats, dates and add-ons." },
      { property: "og:title", content: "Edit trip package — Fish-X Charters" },
      { property: "og:description", content: "Update a charter package price, duration, seats, dates and add-ons." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EditPackagePage,
});

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid var(--line)",
  background: "var(--card)",
  fontSize: 13.5,
  color: "var(--ink)",
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

const card: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 18,
  padding: 20,
  background: "rgba(255,255,255,.02)",
  marginBottom: 20,
};

function EditPackagePage() {
  const { packageId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listCharters = useServerFn(listCaptainCharters);
  const dashboard = useServerFn(getCaptainDashboard);

  const { data: charters, isLoading } = useQuery({
    queryKey: ["captain-charters"],
    queryFn: () => listCharters(),
  });
  const { data: dash } = useQuery({ queryKey: ["captain-dashboard"], queryFn: () => dashboard() });

  let pkg: any = null;
  let parent: any = null;
  for (const c of (charters ?? []) as any[]) {
    const found = (c.packages ?? []).find((p: any) => p.id === packageId);
    if (found) {
      pkg = found;
      parent = c;
      break;
    }
  }

  const [draft, setDraft] = useState<{
    title: string;
    price: number;
    hours: number;
    capacity: number;
    is_published: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (pkg && !draft) {
      setDraft({
        title: pkg.title ?? "",
        price: (pkg.base_price_cents ?? 0) / 100,
        hours: (pkg.duration_minutes ?? 240) / 60,
        capacity: pkg.capacity ?? 4,
        is_published: !!pkg.is_published,
      });
    }
  }, [pkg, draft]);

  if (!draft) {
    return (
      <CaptainPageShell title="Edit package">
        <div style={{ color: "var(--tmut)", fontSize: 13 }}>
          {isLoading ? "Loading package…" : "We couldn't find that package."}
        </div>
      </CaptainPageShell>
    );
  }

  async function save() {
    if (!draft) return;
    setError(null);
    setSaving(true);
    try {
      await upsertCaptainService({
        data: {
          id: packageId,
          charter_id: parent?.id ?? null,
          title: draft.title.trim(),
          base_price_cents: Math.max(0, Math.round(draft.price * 100)),
          capacity: Math.max(1, Math.round(draft.capacity)),
          duration_minutes: Math.max(30, Math.round(draft.hours * 60)),
          is_published: draft.is_published,
        },
      });
      await qc.invalidateQueries({ queryKey: ["captain-charters"] });
      qc.invalidateQueries({ queryKey: ["captain-dashboard"] });
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      setError(err?.message || "We couldn't save that package. Check the details and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <CaptainPageShell
      title="Edit trip package"
      subtitle={parent ? `${parent.name} · ${draft.title}` : draft.title}
    >
      <div style={card}>
        {error && (
          <div
            style={{
              marginBottom: 14,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(248,113,113,.4)",
              color: "#F87171",
              fontSize: 12.5,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          <label style={{ gridColumn: "1 / -1" }}>
            <span style={labelStyle}>Package name</span>
            <input
              style={inputStyle}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Half Day"
            />
          </label>
          <label>
            <span style={labelStyle}>Rate (USD)</span>
            <input
              style={inputStyle}
              type="number"
              min={0}
              value={draft.price}
              onChange={(e) => setDraft({ ...draft, price: Math.max(0, Number(e.target.value)) })}
            />
          </label>
          <label>
            <span style={labelStyle}>Duration (hours)</span>
            <input
              style={inputStyle}
              type="number"
              min={0.5}
              step={0.5}
              value={draft.hours}
              onChange={(e) => setDraft({ ...draft, hours: Math.max(0.5, Number(e.target.value)) })}
            />
          </label>
          <label>
            <span style={labelStyle}>Max anglers</span>
            <input
              style={inputStyle}
              type="number"
              min={1}
              max={50}
              value={draft.capacity}
              onChange={(e) => setDraft({ ...draft, capacity: Math.max(1, Number(e.target.value)) })}
            />
          </label>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center", flexWrap: "wrap" }}>
          <button style={primaryBtn} disabled={saving || draft.title.trim().length < 2} onClick={save}>
            {saving ? "Saving…" : "Save package"}
          </button>
          <button
            style={{
              ...ghostBtn,
              color: draft.is_published ? "var(--green)" : "var(--tmut)",
            }}
            onClick={async () => {
              const next = !draft.is_published;
              setDraft({ ...draft, is_published: next });
              await toggleServicePublished({ data: { id: packageId, is_published: next } });
              qc.invalidateQueries({ queryKey: ["captain-charters"] });
            }}
          >
            {draft.is_published ? "Live — tap to unpublish" : "Draft — tap to publish"}
          </button>
          <button style={ghostBtn} onClick={() => navigate({ to: "/dashboard" })}>
            Back
          </button>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Dates & seats</div>
        <AvailabilityCalendar
          service={{
            id: packageId,
            title: draft.title,
            capacity: draft.capacity,
            base_price_cents: Math.round(draft.price * 100),
            duration_minutes: Math.round(draft.hours * 60),
          }}
        />
      </div>

      {dash?.business?.id && (
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Add-ons</div>
          <AddonsManager
            businessId={dash.business.id}
            service={{ id: packageId, title: draft.title }}
          />
        </div>
      )}
    </CaptainPageShell>
  );
}

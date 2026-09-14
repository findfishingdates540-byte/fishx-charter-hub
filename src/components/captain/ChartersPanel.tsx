/**
 * ChartersPanel — captain-facing charter-parent CRUD + package manager.
 *
 * A "charter" is the marketplace listing parent (name, description, boat,
 * images, water_type, target_species). Packages are the bookable_services
 * rows that live under a charter_id (time/duration/price variants).
 */
import { useEffect, useState } from "react";
import { MediaImg } from "@/components/media/MediaImg";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import {
  listCaptainCharters,
  upsertCaptainCharter,
  deleteCaptainCharter,
  listCharterDepartureTimes,
  upsertCharterDepartureTimes,
} from "@/lib/captain-charters.functions";
import {
  upsertCaptainService,
  deleteCaptainService,
  toggleServicePublished,
} from "@/lib/captain-management.functions";
import { listCaptainBoats } from "@/lib/captain-fleet.functions";
import { ImageUpload } from "@/components/business/ImageUpload";
import { DepartureTimesEditor, type DepartureRow } from "@/components/captain/DepartureTimesEditor";
import { DEFAULT_HERO } from "@/lib/platform-photos";

type PackageRow = {
  id: string;
  title: string;
  hero_url: string | null;
  base_price_cents: number;
  capacity: number | null;
  duration_minutes: number | null;
  is_published: boolean;
};

type CharterRow = {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  hero_url: string | null;
  image_urls?: string[] | null;
  water_type: string | null;
  target_species: string[] | null;
  boat_id: string | null;
  boat: { name: string | null } | null;
  is_published: boolean;
  base_price_cents: number;
  duration_minutes: number | null;
  capacity: number;
  created_at: string;
  packages?: PackageRow[] | null;
};

const money = (c: number) =>
  `$${(Math.max(0, c) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export const WATER_TYPES = ["Inshore", "Nearshore", "Offshore", "Flats", "Nearshore/Offshore", "Freshwater"];

export const ghostBtn: React.CSSProperties = {
  background: "transparent",
  color: "var(--tmut)",
  border: "1px solid var(--line)",
  borderRadius: 10,
  padding: "7px 13px",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
};

export const primaryBtn: React.CSSProperties = {
  background: "var(--goldtext)",
  color: "var(--navy)",
  border: 0,
  borderRadius: 10,
  padding: "8px 15px",
  fontSize: 12.5,
  fontWeight: 700,
  cursor: "pointer",
};

export const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  color: "var(--tmut)",
  marginBottom: 5,
};

/* ---- MAIN ---- */

export function ChartersPanel({
  data,
}: {
  data: { business: any };
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [saveError, setSaveError] = useState<string | null>(null);

  const [openCharterId, setOpenCharterId] = useState<string | null>(null);
  const [addingPkgFor, setAddingPkgFor] = useState<string | null>(null);
  const [newPkg, setNewPkg] = useState<PackageDraft>(emptyPackageDraft);

  const listCharters = useServerFn(listCaptainCharters);
  const { data: charterRows, isLoading: chartersLoading } = useQuery({
    queryKey: ["captain-charters"],
    queryFn: () => listCharters(),
  });

  const listBoats = useServerFn(listCaptainBoats);
  const { data: boatsData } = useQuery({
    queryKey: ["captain-boats"],
    queryFn: () => listBoats(),
  });
  const boats = boatsData?.rows ?? [];

  const charters: CharterRow[] = charterRows ?? [];

  return (
    <div style={{ display: "grid", gap: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <button
          style={{ ...primaryBtn, opacity: boats.length === 0 ? 0.5 : 1, cursor: boats.length === 0 ? "not-allowed" : "pointer" }}
          disabled={boats.length === 0}
          title={boats.length === 0 ? "Add a boat in the Fleet tab first" : undefined}
          onClick={() => navigate({ to: "/captain/charters/new" })}
        >
          + Add new charter
        </button>
        {boats.length === 0 && (
          <span style={{ fontSize: 12.5, color: "var(--tmut)" }}>
            Add a boat in the Fleet tab first — every charter trip runs on a boat.
          </span>
        )}
      </div>

      {saveError && (
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
          {saveError}
        </div>
      )}

      {chartersLoading && (
        <div style={{ color: "var(--tmut)", padding: 16, fontSize: 13 }}>Loading charters…</div>
      )}
      {!chartersLoading && charters.length === 0 && (
        <div
          style={{
            color: "var(--tmut)",
            padding: 24,
            fontSize: 13,
            textAlign: "center",
          }}
        >
          No charter trips yet. Add your first charter to get started.
        </div>
      )}

      {charters.map((c, idx) => (
        <CharterRowItem
          key={c.id}
          charter={c}
          isLast={idx === charters.length - 1}
          isExpanded={openCharterId === c.id}
          onToggleExpand={() => setOpenCharterId(openCharterId === c.id ? null : c.id)}
          onEdit={() =>
            navigate({ to: "/captain/charters/$charterId/edit", params: { charterId: c.id } })
          }
          onDelete={async () => {
            if (
              confirm(
                `Delete charter "${c.name}"? All packages, add-ons, and departures will be removed.`,
              )
            ) {
              await deleteCaptainCharter({ data: { id: c.id } });
              qc.invalidateQueries({ queryKey: ["captain-charters"] });
              qc.invalidateQueries({ queryKey: ["captain-dashboard"] });
              if (openCharterId === c.id) setOpenCharterId(null);
            }
          }}
          onTogglePublish={async (published) => {
            setSaveError(null);
            try {
              await upsertCaptainCharter({
                data: { id: c.id, is_published: published },
              });
              await qc.invalidateQueries({ queryKey: ["captain-charters"] });
              qc.invalidateQueries({ queryKey: ["captain-dashboard"] });
            } catch (err: any) {
              setSaveError(err?.message || "We couldn't change that charter's status.");
            }
          }}
          addingPkgFor={addingPkgFor}
          setAddingPkgFor={setAddingPkgFor}
          newPkg={newPkg}
          setNewPkg={setNewPkg}
          data={data}
        />
      ))}
    </div>
  );
}

/* ---- CHARTER FORM ---- */

export type CharterDraft = {
  id?: string;
  name: string;
  description: string;
  slug: string;
  hero_url: string;
  image_urls: string[];
  boat_id: string;
  water_type: string;
  target_species: string;
  base_price_cents: number;
  capacity: number;
  duration_minutes: number | null;
  departure_location: string;
  is_published: boolean;
};

export const emptyCharterDraft: CharterDraft = {
  name: "",
  description: "",
  slug: "",
  hero_url: "",
  image_urls: [],
  boat_id: "",
  water_type: "",
  target_species: "",
  base_price_cents: 0,
  capacity: 4,
  duration_minutes: null,
  departure_location: "",
  is_published: false,
};

export function CharterForm({
  businessId,
  draft,
  boats,
  error,
  onChange,
  onCancel,
  onSave,
}: {
  businessId: string | null;
  draft: CharterDraft;
  boats: { id: string; name: string; hero_image_url?: string | null; image_urls?: string[] | null }[];
  error?: string | null;
  onChange: (d: CharterDraft) => void;
  onCancel: () => void;
  onSave: () => void;
}) {

  const [saving, setSaving] = useState(false);
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

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 18,
        padding: 20,
        background: "rgba(255,255,255,.02)",
        marginBottom: 20,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 14 }}>
        {draft.id ? "Edit charter" : "New charter"}
      </div>

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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <label style={{ gridColumn: "1 / -1" }}>
          <span style={labelStyle}>Charter name</span>
          <input
            style={inputStyle}
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            placeholder="e.g. Half-Day Offshore Adventure"
          />
        </label>

        <label style={{ gridColumn: "1 / -1" }}>
          <span style={labelStyle}>Description</span>
          <textarea
            style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
            value={draft.description}
            onChange={(e) => onChange({ ...draft, description: e.target.value })}
            placeholder="Tell anglers what makes this charter special — the experience, the waters, the target species…"
          />
        </label>

        <label style={{ gridColumn: "1 / -1" }}>
          <span style={labelStyle}>Cover image</span>
          {businessId ? (
            <ImageUpload
              businessId={businessId}
              value={draft.hero_url}
              onChange={(url) => onChange({ ...draft, hero_url: url })}
            />
          ) : (
            <input
              style={inputStyle}
              value={draft.hero_url}
              onChange={(e) => onChange({ ...draft, hero_url: e.target.value })}
              placeholder="https://…"
            />
          )}
        </label>

        {businessId && (
          <div style={{ gridColumn: "1 / -1" }}>
            <span style={labelStyle}>Gallery photos</span>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                gap: 10,
                marginTop: 6,
              }}
            >
              {draft.image_urls.map((url, i) => (
                <div key={`${url}-${i}`} style={{ position: "relative" }}>
                  <MediaImg
                    src={url}
                    alt={`Gallery photo ${i + 1}`}
                    style={{
                      width: "100%",
                      aspectRatio: "16 / 9",
                      objectFit: "cover",
                      borderRadius: 10,
                      border: "1px solid var(--line)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...draft,
                        image_urls: draft.image_urls.filter((_, j) => j !== i),
                      })
                    }
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      border: "none",
                      borderRadius: 999,
                      width: 24,
                      height: 24,
                      cursor: "pointer",
                      background: "rgba(0,0,0,.65)",
                      color: "#fff",
                      fontSize: 13,
                      lineHeight: "24px",
                    }}
                    aria-label="Remove photo"
                  >
                    ×
                  </button>
                </div>
              ))}
              <ImageUpload
                businessId={businessId}
                value=""
                label="Add photo"
                onChange={(url) =>
                  url && onChange({ ...draft, image_urls: [...draft.image_urls, url] })
                }
              />
            </div>
            <div style={{ fontSize: 11.5, color: "var(--tmut)", marginTop: 6 }}>
              Extra photos anglers see in the listing gallery. The cover image stays first.
            </div>
          </div>
        )}

        <label>
          <span style={labelStyle}>Boat</span>
          <select
            style={inputStyle}
            value={draft.boat_id}
            onChange={(e) => onChange({ ...draft, boat_id: e.target.value })}
          >
            <option value="">Select a boat…</option>
            {boats.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          {boats.length === 0 && (
            <div style={{ fontSize: 11.5, color: "var(--tmut)", marginTop: 4 }}>
              Add a boat in the Fleet tab first.
            </div>
          )}
          {(() => {
            const boat = boats.find((b) => b.id === draft.boat_id);
            const gallery = Array.isArray(boat?.image_urls) ? boat!.image_urls! : [];
            const cover = boat?.hero_image_url || gallery[0] || "";
            if (!boat || (!cover && gallery.length === 0)) return null;
            return (
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...draft,
                    hero_url: draft.hero_url || cover,
                    image_urls: Array.from(new Set([...draft.image_urls, ...gallery])),
                  })
                }
                style={{
                  marginTop: 8,
                  padding: "6px 10px",
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid var(--tbord, rgba(255,255,255,.14))",
                  background: "transparent",
                  color: "inherit",
                  cursor: "pointer",
                }}
              >
                Use {boat.name} fleet photos
              </button>
            );
          })()}

        </label>

        <label>
          <span style={labelStyle}>Water type</span>
          <select
            style={inputStyle}
            value={draft.water_type}
            onChange={(e) => onChange({ ...draft, water_type: e.target.value })}
          >
            <option value="">Select…</option>
            {WATER_TYPES.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span style={labelStyle}>Target species</span>
          <input
            style={inputStyle}
            value={draft.target_species}
            onChange={(e) => onChange({ ...draft, target_species: e.target.value })}
            placeholder="Snapper, Grouper, Tuna"
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
            onChange={(e) =>
              onChange({ ...draft, capacity: Math.max(1, Number(e.target.value)) })
            }
          />
        </label>

        <label>
          <span style={labelStyle}>Base rate (USD)</span>
          <input
            style={inputStyle}
            type="number"
            min={0}
            value={draft.base_price_cents / 100}
            onChange={(e) =>
              onChange({
                ...draft,
                base_price_cents: Math.max(0, Math.round(Number(e.target.value) * 100)),
              })
            }
          />
        </label>

        <label>
          <span style={labelStyle}>Duration (hours)</span>
          <input
            style={inputStyle}
            type="number"
            min={0.5}
            step={0.5}
            value={(draft.duration_minutes ?? 240) / 60}
            onChange={(e) =>
              onChange({
                ...draft,
                duration_minutes: Math.max(30, Math.round(Number(e.target.value) * 60)),
              })
            }
          />
        </label>

        <label>
          <span style={labelStyle}>Departure location / port</span>
          <input
            style={inputStyle}
            value={draft.departure_location}
            onChange={(e) => onChange({ ...draft, departure_location: e.target.value })}
            placeholder="e.g. Miami Beach Marina"
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center", flexWrap: "wrap" }}>
        <button
          style={primaryBtn}
          disabled={saving || draft.name.trim().length < 2 || !draft.boat_id}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave();
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Saving…" : draft.id ? "Save charter" : "Create charter"}
        </button>
        {!draft.boat_id && (
          <span style={{ fontSize: 12, color: "var(--tmut)" }}>Select a boat to continue.</span>
        )}

        <button style={ghostBtn} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ---- CHARTER ROW ITEM ---- */

type PackageDraft = {
  title: string;
  base_price_cents: number;
  capacity: number;
  duration_hours: number;
};

const emptyPackageDraft: PackageDraft = {
  title: "",
  base_price_cents: 0,
  capacity: 4,
  duration_hours: 4,
};

function CharterRowItem({
  charter: c,
  isLast,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onTogglePublish,
  addingPkgFor,
  setAddingPkgFor,
  newPkg,
  setNewPkg,
  data,
}: {
  charter: CharterRow;
  isLast: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePublish: (published: boolean) => void;
  addingPkgFor: string | null;
  setAddingPkgFor: (id: string | null) => void;
  newPkg: PackageDraft;
  setNewPkg: (d: PackageDraft) => void;
  data: { business: any };
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const mAddPkg = useMutation({
    mutationFn: async (charterId: string) => {
      await upsertCaptainService({
        data: {
          title: newPkg.title || "New package",
          charter_id: charterId,
          base_price_cents: Math.round(newPkg.base_price_cents * 100),
          capacity: newPkg.capacity,
          duration_minutes: Math.round(newPkg.duration_hours * 60),
          is_published: false,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["captain-charters"] });
      qc.invalidateQueries({ queryKey: ["captain-dashboard"] });
      setAddingPkgFor(null);
      setNewPkg(emptyPackageDraft);
    },
  });

  const mDeletePkg = useMutation({
    mutationFn: (id: string) => deleteCaptainService({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["captain-charters"] });
      qc.invalidateQueries({ queryKey: ["captain-dashboard"] });
    },
  });

  const mTogglePkg = useMutation({
    mutationFn: (v: { id: string; is_published: boolean }) =>
      toggleServicePublished({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["captain-charters"] });
      qc.invalidateQueries({ queryKey: ["captain-dashboard"] });
    },
  });

  const packages = c.packages ?? [];
  const label = isExpanded ? "▾ Packages" : `▸ Packages (${packages.length})`;

  return (
    <div
      style={{
        padding: "14px 0",
        borderBottom: isLast ? "none" : "1px solid var(--line)",
      }}
    >
      <div className="fx-charter-row" style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <MediaImg
          src={c.hero_url || c.image_urls?.[0] || DEFAULT_HERO}
          alt=""
          style={{ width: 56, height: 56, borderRadius: 12, objectFit: "cover", flex: "none" }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{c.name}</div>
          <div style={{ fontSize: 12.5, color: "var(--tmut)" }}>
            {c.boat?.name ?? "No boat set"}
            {c.water_type ? ` · ${c.water_type}` : ""}
            {c.capacity ? ` · up to ${c.capacity}` : ""}
            {c.base_price_cents ? ` · ${money(c.base_price_cents)}` : ""}
          </div>
          {c.is_published && packages.length > 0 && !packages.some((p) => p.is_published) && (
            <div style={{ fontSize: 12, color: "var(--gold, #E0B252)", marginTop: 4 }}>
              Not on your storefront yet — set at least one package to Live.
            </div>
          )}
        </div>
        <div className="fx-charter-actions" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => onTogglePublish(!c.is_published)}
          style={{
            border: "1px solid var(--line)",
            background: "transparent",
            borderRadius: 20,
            padding: "5px 11px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            color: c.is_published ? "var(--green)" : "var(--tmut)",
          }}
        >
          {c.is_published ? "Live" : "Draft"}
        </button>
        <button style={ghostBtn} onClick={onEdit}>
          Edit
        </button>
        <button style={ghostBtn} onClick={onToggleExpand}>
          {label}
        </button>
        <button style={{ ...ghostBtn, color: "#F87171" }} onClick={onDelete}>
          Delete
        </button>
        </div>
      </div>

      {isExpanded && (
        <div className="fx-charter-exp" style={{ marginTop: 14, paddingLeft: 70, display: "grid", gap: 12 }}>

          {packages.length === 0 && (
            <div style={{ fontSize: 12.5, color: "var(--tmut)" }}>
              No packages yet. Add a time/duration variant for this charter.
            </div>
          )}

          {packages.map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                padding: "10px 0",
                borderTop: "1px solid rgba(255,255,255,.06)",
              }}
            >

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.title}</div>
                <div style={{ fontSize: 12, color: "var(--tmut)" }}>
                  {money(p.base_price_cents)}
                  {p.duration_minutes ? ` · ${Math.round(p.duration_minutes / 60)}h` : ""}
                  {p.capacity ? ` · up to ${p.capacity}` : ""}
                </div>
              </div>
              <button
                onClick={() => mTogglePkg.mutate({ id: p.id, is_published: !p.is_published })}
                style={{
                  border: "1px solid var(--line)",
                  background: "transparent",
                  borderRadius: 20,
                  padding: "4px 9px",
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  color: p.is_published ? "var(--green)" : "var(--tmut)",
                }}
              >
                {p.is_published ? "Live" : "Draft"}
              </button>
              <button
                onClick={() =>
                  navigate({ to: "/captain/packages/$packageId", params: { packageId: p.id } })
                }
                style={{ ...ghostBtn, fontSize: 12 }}
              >
                Edit
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete package "${p.title}"?`)) mDeletePkg.mutate(p.id);
                }}
                style={{ ...ghostBtn, color: "#F87171", fontSize: 12 }}
              >
                Delete
              </button>
            </div>
          ))}


          {addingPkgFor === c.id ? (
            <PackageForm
              draft={newPkg}
              onChange={setNewPkg}
              onCancel={() => {
                setAddingPkgFor(null);
                setNewPkg(emptyPackageDraft);
              }}
              onSave={() => mAddPkg.mutate(c.id)}
              saving={mAddPkg.isPending}
            />
          ) : (
            <button
              style={{ ...ghostBtn, alignSelf: "flex-start", fontSize: 12.5 }}
              onClick={() => setAddingPkgFor(c.id)}
            >
              + Add package
            </button>
          )}

          <DepartureTimesSection charterId={c.id} businessId={data.business?.id ?? ""} />
        </div>
      )}
    </div>
  );
}

function PackageForm({
  draft,
  onChange,
  onCancel,
  onSave,
  saving,
}: {
  draft: PackageDraft;
  onChange: (d: PackageDraft) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 11px",
    borderRadius: 10,
    border: "1px solid var(--line)",
    background: "var(--card)",
    fontSize: 13,
    color: "var(--ink)",
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
  };
  return (
    <div
      className="fx-pkg-form"
      style={{
        display: "grid",
        gridTemplateColumns: "1.4fr 1fr 1fr 1fr auto auto",

        gap: 8,
        alignItems: "end",
        padding: 10,
        border: "1px solid var(--line)",
        borderRadius: 12,
        background: "rgba(255,255,255,.02)",
      }}
    >
      <label>
        <span style={labelStyle}>Package name</span>
        <input
          style={inputStyle}
          value={draft.title}
          onChange={(e) => onChange({ ...draft, title: e.target.value })}
          placeholder="Half Day"
        />
      </label>
      <label>
        <span style={labelStyle}>Rate (USD)</span>
        <input
          style={inputStyle}
          type="number"
          min={0}
          value={draft.base_price_cents}
          onChange={(e) => onChange({ ...draft, base_price_cents: Math.max(0, Number(e.target.value)) })}
        />
      </label>
      <label>
        <span style={labelStyle}>Hours</span>
        <input
          style={inputStyle}
          type="number"
          min={0.5}
          step={0.5}
          value={draft.duration_hours}
          onChange={(e) => onChange({ ...draft, duration_hours: Math.max(0.5, Number(e.target.value)) })}
        />
      </label>
      <label>
        <span style={labelStyle}>Max</span>
        <input
          style={inputStyle}
          type="number"
          min={1}
          max={50}
          value={draft.capacity}
          onChange={(e) => onChange({ ...draft, capacity: Math.max(1, Number(e.target.value)) })}
        />
      </label>
      <button
        style={primaryBtn}
        disabled={saving}
        onClick={onSave}
      >
        {saving ? "Adding…" : "Add"}
      </button>
      <button style={ghostBtn} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

/* ---- DEPARTURE TIMES SECTION (per charter) ---- */

function DepartureTimesSection({ charterId, businessId }: { charterId: string; businessId: string }) {
  const qc = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [rows, setRows] = useState<DepartureRow[]>([]);
  const [fetched, setFetched] = useState(false);

  const listDepartures = useServerFn(listCharterDepartureTimes);

  useEffect(() => {
    if (!fetched && charterId) {
      listDepartures({ data: { charterId } }).then((data: any) => {
        setRows(
          (data ?? []).map((r: any) => ({
            id: r.id,
            label: r.label ?? "",
            start_time: (r.start_time ?? "07:00").slice(0, 5),
            days_of_week: Array.isArray(r.days_of_week) ? r.days_of_week : [],
            is_active: r.is_active ?? true,
            sort_order: r.sort_order ?? 0,
          })),
        );
        setFetched(true);
      }).catch(() => setFetched(true));
    }
  }, [charterId, fetched]);

  const mSave = useMutation({
    mutationFn: async () => {
      await upsertCharterDepartureTimes({
        data: {
          charterId,
          businessId,
          rows: rows.map((r, i) => ({
            id: r.id,
            charterId,
            businessId,
            label: r.label || null,
            start_time: r.start_time,
            days_of_week: r.days_of_week,
            is_active: r.is_active,
            sort_order: r.sort_order ?? i,
          })),
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["captain-charters"] });
    },
  });

  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 14, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          style={{
            background: "transparent",
            border: 0,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--cyan)",
            padding: 0,
          }}
        >
          {collapsed ? "▸ Departure times" : "▾ Departure times"}
        </button>
        {!collapsed && (
          <button
            style={primaryBtn}
            onClick={() => {
              setRows([
                ...rows,
                {
                  label: "",
                  start_time: "07:00",
                  days_of_week: [1, 2, 3, 4, 5],
                  is_active: true,
                  sort_order: rows.length,
                },
              ]);
            }}
          >
            + Add time
          </button>
        )}
      </div>

      {!collapsed && (
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          <DepartureTimesEditor rows={rows} onChange={setRows} />
          {rows.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button
                style={primaryBtn}
                disabled={mSave.isPending}
                onClick={() => mSave.mutate()}
              >
                {mSave.isPending ? "Saving…" : "Save departure times"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

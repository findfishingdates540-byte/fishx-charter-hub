/**
 * FleetPanel — the captain's Fleet / Boats tab.
 * Business-scoped CRUD for boats (specs + multi-image gallery), reusing the
 * dark `input`/`btn` atoms from BusinessSettings and ImageUpload for uploads.
 */
import { useEffect, useState } from "react";
import { MediaImg } from "@/components/media/MediaImg";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listCaptainBoats,
  upsertCaptainBoat,
  deleteCaptainBoat,
} from "@/lib/captain-fleet.functions";
import { ImageUpload } from "@/components/business/ImageUpload";
import { input, btn } from "@/components/business/BusinessSettings";

const money = (cents: number) =>
  `$${(Math.max(0, cents) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

type BoatRow = Awaited<ReturnType<typeof listCaptainBoats>>["rows"][number];

type BoatDraft = {
  id?: string;
  name: string;
  make: string;
  model: string;
  length_ft: number;
  capacity: number;
  home_port: string;
  description: string;
  hero_image_url: string;
  image_urls: string[];
  is_active: boolean;
};

function BoatImage({ sources, alt, style }: { sources: string[]; alt: string; style: React.CSSProperties }) {
  const usable = sources.filter((url, index) => Boolean(url) && sources.indexOf(url) === index);
  const [index, setIndex] = useState(0);

  useEffect(() => setIndex(0), [sources.join("|")]);

  if (!usable[index]) return <span style={{ fontSize: 10, color: "var(--tmut)" }}>No img</span>;

  return (
    <MediaImg
      src={usable[index]}
      alt={alt}
      loading="lazy"
      onError={() => setIndex((current) => current + 1)}
      style={style}
    />
  );
}

const emptyDraft: BoatDraft = {
  name: "",
  make: "",
  model: "",
  length_ft: 0,
  capacity: 0,
  home_port: "",
  description: "",
  hero_image_url: "",
  image_urls: [],
  is_active: true,
};

const toDraft = (b: BoatRow): BoatDraft => ({
  id: b.id,
  name: b.name,
  make: (b as any).make ?? "",
  model: (b as any).model ?? "",
  length_ft: (b as any).length_ft ?? 0,
  capacity: (b as any).capacity ?? 0,
  home_port: (b as any).home_port ?? "",
  description: (b as any).description ?? "",
  hero_image_url: (b as any).hero_image_url ?? "",
  image_urls: Array.isArray((b as any).image_urls) ? (b as any).image_urls : [],
  is_active: (b as any).is_active ?? true,
});

export function FleetPanel({ businessId }: { businessId: string | null }) {
  const qc = useQueryClient();
  const list = useServerFn(listCaptainBoats);
  const upsert = useServerFn(upsertCaptainBoat);
  const del = useServerFn(deleteCaptainBoat);
  const [editing, setEditing] = useState<BoatDraft | null>(null);
  const [preview, setPreview] = useState<BoatRow | null>(null);


  const { data, isLoading } = useQuery({
    queryKey: ["captain-boats"],
    queryFn: () => list(),
  });

  const rows = data?.rows ?? [];

  const mUpsert = useMutation({
    mutationFn: (draft: BoatDraft) => upsert({
      data: {
        id: draft.id,
        name: draft.name,
        make: draft.make || null,
        model: draft.model || null,
        length_ft: draft.length_ft || null,
        capacity: draft.capacity || null,
        home_port: draft.home_port || null,
        description: draft.description || null,
        hero_image_url: draft.hero_image_url || null,
        image_urls: draft.image_urls.filter(Boolean),
        is_active: draft.is_active,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["captain-boats"] });
      // the charter form's boat picker reads the same underlying table
      qc.invalidateQueries({ queryKey: ["captain-dashboard"] });
      setEditing(null);
    },
  });

  const mDelete = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["captain-boats"] });
      qc.invalidateQueries({ queryKey: ["captain-dashboard"] });
    },
  });

  // Adds a slot (empty slot = a fresh upload tile the captain can fill in).
  const addImage = (draft: BoatDraft) => {
    if (draft.image_urls.some((u) => !u)) return; // one blank slot at a time
    setEditing({ ...draft, image_urls: [...draft.image_urls, ""] });
  };
  const setImageAt = (draft: BoatDraft, idx: number, url: string) => {
    const next = [...draft.image_urls];
    if (url === "") next.splice(idx, 1);
    else next[idx] = url;
    setEditing({ ...draft, image_urls: next });
  };
  const removeImageAt = (draft: BoatDraft, idx: number) => {
    const next = [...draft.image_urls];
    next.splice(idx, 1);
    setEditing({ ...draft, image_urls: next });
  };


  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, color: "var(--tmut)" }}>
          Build the fleet of boats anglers will book. Each charter trip attaches to one boat.
        </div>
        {!editing && (
          <button
            onClick={() => setEditing({ ...emptyDraft })}
            style={{ ...btn("primary"), background: "var(--goldtext)", color: "#0D161F", border: 0 }}
          >
            + Add boat
          </button>
        )}
      </div>

      {editing && (
        <BoatForm
          businessId={businessId}
          draft={editing}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          onSave={() => mUpsert.mutate(editing)}
          onAddImage={() => addImage(editing)}
          onSetImage={(idx, url) => setImageAt(editing, idx, url)}
          onRemoveImage={(idx) => removeImageAt(editing, idx)}

          saving={mUpsert.isPending}
          error={mUpsert.error ? String(mUpsert.error) : null}
        />
      )}

      {!editing && rows.length === 0 && !isLoading && (
        <div style={{ padding: "40px 0", textAlign: "center", fontSize: 13.5, color: "var(--tmut)" }}>
          No boats yet. Add your first boat to your fleet.
        </div>
      )}

      <div style={{ display: "grid", gap: 14 }}>
        {!editing &&
          rows.map((b, i) => {
            const cover = b.hero_image_url || b.image_urls?.[0] || "";
            return (
              <div
                key={b.id}
                onClick={() => setPreview(b)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPreview(b); } }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 0",
                  cursor: "pointer",
                  borderBottom: i < rows.length - 1 ? "1px solid var(--line)" : "none",
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    flex: "none",
                    overflow: "hidden",
                    background: "var(--line)",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 10,
                    color: "var(--tmut)",
                  }}
                >
                  <BoatImage
                    sources={[cover, ...(b.image_urls ?? [])]}
                    alt={b.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{b.name}</div>
                  <div style={{ fontSize: 12.5, color: "var(--tmut)" }}>
                    {[b.make, b.model, b.length_ft ? `${b.length_ft}ft` : null, b.home_port]
                      .filter(Boolean)
                      .join(" · ") || "No specs"}
                    {b.image_urls?.length ? ` · ${b.image_urls.length} photos` : ""}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setEditing(toDraft(b)); }}
                  style={{ border: 0, background: "transparent", cursor: "pointer", fontSize: 13, color: "var(--goldtext)", fontWeight: 600 }}
                >
                  Edit
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${b.name}"?`)) mDelete.mutate(b.id); }}
                  style={{ border: 0, background: "transparent", cursor: "pointer", fontSize: 13, color: "#F87171" }}
                >
                  Delete
                </button>
              </div>
            );
          })}
      </div>

      {preview && (
        <BoatPreview
          boat={preview}
          onClose={() => setPreview(null)}
          onEdit={() => { setEditing(toDraft(preview)); setPreview(null); }}
        />
      )}

    </div>
  );
}

function BoatForm({
  businessId,
  draft,
  onChange,
  onCancel,
  onSave,
  onAddImage,
  onSetImage,
  onRemoveImage,
  saving,
  error,
}: {
  businessId: string | null;
  draft: BoatDraft;
  onChange: (d: BoatDraft) => void;
  onCancel: () => void;
  onSave: () => void;
  onAddImage: () => void;
  onSetImage: (idx: number, url: string) => void;
  onRemoveImage: (idx: number) => void;

  saving: boolean;
  error: string | null;
}) {
  const upd = (patch: Partial<BoatDraft>) => onChange({ ...draft, ...patch });
  const fmt = (n: number) => (n > 0 ? String(n) : "");
  const parseNum = (v: string) => (v === "" ? 0 : Number(v));

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSave(); }}
      style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 14, padding: 18, marginBottom: 16, display: "grid", gap: 12 }}
    >
      <Field label="Boat name">
        <input required value={draft.name} onChange={(e) => upd({ name: e.target.value })} style={input} placeholder="Sea Shanties" />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        <Field label="Make"><input value={draft.make} onChange={(e) => upd({ make: e.target.value })} style={input} placeholder="Boston Whaler" /></Field>
        <Field label="Model"><input value={draft.model} onChange={(e) => upd({ model: e.target.value })} style={input} placeholder="280 Dauntless" /></Field>
        <Field label="Length (ft)"><input type="number" min={0} step={1} value={fmt(draft.length_ft)} onChange={(e) => upd({ length_ft: parseNum(e.target.value) })} style={input} placeholder="28" /></Field>
        <Field label="Capacity (guests)"><input type="number" min={0} step={1} value={fmt(draft.capacity)} onChange={(e) => upd({ capacity: parseNum(e.target.value) })} style={input} placeholder="6" /></Field>
      </div>

      <Field label="Home port">
        <input value={draft.home_port} onChange={(e) => upd({ home_port: e.target.value })} style={input} placeholder="Hilton Head, SC" />
      </Field>

      <Field label="Description">
        <textarea value={draft.description} onChange={(e) => upd({ description: e.target.value })} rows={3} style={{ ...input, resize: "vertical" }} placeholder="Describe the boat — tackle, amenities, ideal trips…" />
      </Field>

      {businessId && (
        <Field label="Cover photo">
          <ImageUpload businessId={businessId} label="Cover photo" value={draft.hero_image_url} onChange={(url) => upd({ hero_image_url: url })} />
        </Field>
      )}

      {businessId && (
        <Field label="Photo gallery">
          <div style={{ display: "grid", gap: 10 }}>
            {draft.image_urls.length === 0 && (
              <span style={{ fontSize: 12.5, color: "var(--tmut)" }}>
                No gallery photos yet — add a few so anglers can see the boat.
              </span>
            )}
            {draft.image_urls.map((u, idx) => (
              <div key={`slot-${idx}`} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <ImageUpload
                  businessId={businessId}
                  label={`Photo ${idx + 1}`}
                  value={u}
                  onChange={(url) => onSetImage(idx, url)}
                />
                <button
                  type="button"
                  onClick={() => onRemoveImage(idx)}
                  style={{ ...btn("ghost"), padding: "8px 12px", fontSize: 12, color: "#F87171", flex: "none" }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </Field>
      )}

      {businessId && (
        <button
          type="button"
          onClick={onAddImage}
          style={{ ...btn("ghost"), justifySelf: "start", padding: "8px 14px", fontSize: 12.5 }}
        >
          + Add photo
        </button>
      )}



      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
        <input type="checkbox" checked={draft.is_active} onChange={(e) => upd({ is_active: e.target.checked })} />
        Active (available to be booked)
      </label>

      {error && <div style={{ color: "#F87171", fontSize: 12.5 }}>{error}</div>}

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel} style={btn("ghost")}>Cancel</button>
        <button type="submit" disabled={saving} style={btn("primary")}>
          {saving ? "Saving…" : draft.id ? "Save changes" : "Add boat"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 5 }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--tmut)" }}>{label}</span>
      {children}
    </label>
  );
}
function BoatPreview({
  boat,
  onClose,
  onEdit,
}: {
  boat: BoatRow;
  onClose: () => void;
  onEdit: () => void;
}) {
  const b = boat as any;
  const gallery: string[] = [
    ...(b.hero_image_url ? [b.hero_image_url] : []),
    ...(Array.isArray(b.image_urls) ? b.image_urls : []),
  ].filter((u, i, a) => u && a.indexOf(u) === i);
  const [active, setActive] = useState(0);

  const specs: Array<[string, string]> = [
    ["Make", b.make || "—"],
    ["Model", b.model || "—"],
    ["Length", b.length_ft ? `${b.length_ft} ft` : "—"],
    ["Capacity", b.capacity ? `${b.capacity} guests` : "—"],
    ["Home port", b.home_port || "—"],
    ["Status", b.is_active === false ? "Inactive" : "Active"],
  ];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background: "rgba(4,12,20,.68)",
        display: "grid",
        placeItems: "center",
        padding: 18,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(680px,100%)",
          maxHeight: "88vh",
          overflowY: "auto",
          background: "var(--card, #14202B)",
          border: "1px solid var(--line)",
          borderRadius: 18,
          padding: 20,
          display: "grid",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{b.name}</div>
            <div style={{ fontSize: 12.5, color: "var(--tmut)" }}>
              {[b.make, b.model].filter(Boolean).join(" ") || "Boat details"}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ border: 0, background: "transparent", color: "var(--tmut)", fontSize: 20, cursor: "pointer", lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {gallery.length > 0 ? (
          <div style={{ display: "grid", gap: 10 }}>
            <BoatImage
              sources={gallery.slice(Math.min(active, gallery.length - 1)).concat(gallery.slice(0, Math.min(active, gallery.length - 1)))}
              alt={b.name}
              style={{
                width: "100%",
                aspectRatio: "16/9",
                objectFit: "cover",
                borderRadius: 14,
                display: "block",
                background: "var(--line)",
              }}
            />
            {gallery.length > 1 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {gallery.map((u, i) => (
                  <button
                    key={u}
                    onClick={() => setActive(i)}
                    style={{
                      width: 64,
                      height: 48,
                      borderRadius: 9,
                      cursor: "pointer",
                      padding: 0,
                      overflow: "hidden",
                      background: "var(--line)",
                      border: i === active ? "2px solid #2DE2F2" : "1px solid var(--line)",
                    }}
                  >
                    <MediaImg src={u} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              width: "100%",
              aspectRatio: "16/9",
              borderRadius: 14,
              background: "var(--line)",
              display: "grid",
              placeItems: "center",
              fontSize: 12.5,
              color: "var(--tmut)",
            }}
          >
            No photos yet
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12 }}>
          {specs.map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--tmut)" }}>{k}</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{v}</div>
            </div>
          ))}
        </div>

        {b.description && (
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--tmut)", marginBottom: 4 }}>
              Description
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--tmut)" }}>{b.description}</div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btn("ghost")}>Close</button>
          <button onClick={onEdit} style={btn("primary")}>Edit boat</button>
        </div>
      </div>
    </div>
  );
}

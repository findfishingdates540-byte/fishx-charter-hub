/**
 * Per-listing availability calendar. Operators pick days on a month grid and
 * publish dated slots (seats + price). Published seats are the hard ceiling
 * that instant-book reserves against, so a listing can never be instant-booked
 * beyond the seats published for that day.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listServiceSlots,
  updateServiceSlot,
  deleteServiceSlot,
  updateServiceBookingRules,
  checkSlotConflicts,
  previewAvailabilityAdjustment,
  applyAvailabilityAdjustment,
} from "@/lib/availability.functions";

import { money } from "@/components/operator/OperatorShell";
import { timeBlock } from "@/components/booking/PublicAvailabilityCalendar";
import { input, btn } from "@/components/business/BusinessSettings";

const DAY_NAMES = ["S", "M", "T", "W", "T", "F", "S"];
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayIso = iso(new Date());

export function AvailabilityCalendar({
  service,
  onClose,
}: {
  service: {
    id: string;
    title: string;
    capacity?: number | null;
    base_price_cents?: number | null;
    duration_minutes?: number | null;
    instant_book?: boolean | null;
  };
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const fetchSlots = useServerFn(listServiceSlots);
  const update = useServerFn(updateServiceSlot);

  const remove = useServerFn(deleteServiceSlot);
  const saveRules = useServerFn(updateServiceBookingRules);

  const key = ["service-slots", service.id];
  const { data: slots, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => fetchSlots({ data: { serviceId: service.id } }),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [picked, setPicked] = useState<string[]>([]);
  const [startTime, setStartTime] = useState("07:00");
  const [duration, setDuration] = useState(service.duration_minutes || 240);
  const [seats, setSeats] = useState(service.capacity || 4);
  const [price, setPrice] = useState((service.base_price_cents ?? 0) / 100);
  const [instantBook, setInstantBook] = useState(!!service.instant_book);

  const byDate = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const s of slots ?? []) {
      const d = iso(new Date(s.starts_at));
      m.set(d, [...(m.get(d) ?? []), s]);
    }
    return m;
  }, [slots]);

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const out: (string | null)[] = Array(first.getDay()).fill(null);
    for (let i = 1; i <= days; i++) out.push(iso(new Date(cursor.getFullYear(), cursor.getMonth(), i)));
    return out;
  }, [cursor]);

  // Policy for touching days that already have published departures.
  const [mode, setMode] = useState<"keep" | "replace">("keep");

  // Live conflict detection for the pending selection.
  const checkConflicts = useServerFn(checkSlotConflicts);
  const { data: conflictCheck } = useQuery({
    queryKey: ["slot-conflicts", service.id, picked.join(","), startTime, duration],
    enabled: picked.length > 0,
    queryFn: () =>
      checkConflicts({
        data: { serviceId: service.id, dates: picked, startTime, durationMinutes: duration },
      }),
  });
  const conflicts = conflictCheck?.conflicts ?? [];

  // Immediate impact preview for the chosen policy.
  const previewAdjust = useServerFn(previewAvailabilityAdjustment);
  const adjustPayload = {
    serviceId: service.id,
    dates: picked,
    startTime,
    durationMinutes: duration,
    seats,
    priceCents: Math.round(price * 100) || null,
    mode,
  };
  const { data: preview, isFetching: previewing } = useQuery({
    queryKey: [
      "slot-adjust-preview",
      service.id,
      picked.join(","),
      startTime,
      duration,
      seats,
      price,
      mode,
    ],
    enabled: picked.length > 0,
    queryFn: () => previewAdjust({ data: adjustPayload }),
  });

  const applyAdjust = useServerFn(applyAvailabilityAdjustment);
  const mCreate = useMutation({
    mutationFn: () => applyAdjust({ data: adjustPayload }),
    onSuccess: () => {
      setPicked([]);
      invalidate();
    },
  });

  const mUpdate = useMutation({
    mutationFn: (v: { slotId: string; seats?: number; isBlackout?: boolean }) => update({ data: v }),
    onSuccess: invalidate,
  });
  const mDelete = useMutation({
    mutationFn: (slotId: string) => remove({ data: { slotId } }),
    onSuccess: invalidate,
  });
  const mRules = useMutation({
    mutationFn: (v: boolean) => saveRules({ data: { serviceId: service.id, instantBook: v } }),
  });

  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const upcoming = (slots ?? []).filter((s: any) => s.starts_at >= new Date().toISOString());
  const openSeats = upcoming.reduce(
    (n: number, s: any) => n + Math.max((s.seats_available ?? 0) - (s.seats_booked ?? 0), 0),
    0,
  );

  return (
    <div
      className="fx-avail"
      style={{
        border: "1px solid rgba(255,255,255,.09)",
        borderRadius: 18,
        padding: 18,
        marginBottom: 18,
        background: "#14202B",
        display: "grid",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".12em", color: "#92A0AB", fontWeight: 700 }}>
            Availability
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#F0F2F5" }}>{service.title}</div>
          <div style={{ fontSize: 12.5, color: "#92A0AB" }}>
            {upcoming.length} upcoming day{upcoming.length === 1 ? "" : "s"} published · {openSeats} seat
            {openSeats === 1 ? "" : "s"} bookable
          </div>
        </div>
        <button style={btn("ghost")} onClick={onClose}>
          Close
        </button>
      </div>

      <div className="fx-avail-cols" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 18 }}>
        {/* Month grid */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <button
              style={btn("ghost")}
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            >
              ‹
            </button>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#F0F2F5" }}>{monthLabel}</div>
            <button
              style={btn("ghost")}
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            >
              ›
            </button>
          </div>
          <div className="fx-avail-days" style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
            {DAY_NAMES.map((d, i) => (
              <div key={i} style={{ textAlign: "center", fontSize: 10.5, color: "#92A0AB", fontWeight: 700 }}>
                {d}
              </div>
            ))}
            {cells.map((d, i) => {
              if (!d) return <div key={`e${i}`} />;
              const daySlots = byDate.get(d) ?? [];
              const isPast = d < todayIso;
              const sel = picked.includes(d);
              const booked = daySlots.some((s) => (s.seats_booked ?? 0) > 0);
              const blocked = daySlots.length > 0 && daySlots.every((s) => s.is_blackout);
              return (
                <button
                  key={d}
                  disabled={isPast}
                  onClick={() => setPicked(sel ? picked.filter((x) => x !== d) : [...picked, d])}
                  style={{
                    padding: "8px 0 6px",
                    borderRadius: 10,
                    cursor: isPast ? "default" : "pointer",
                    border: sel ? "1px solid #273744" : "1px solid rgba(255,255,255,.07)",
                    background: sel ? "#0D161F" : daySlots.length ? "rgba(34,197,94,.14)" : "#1C2936",
                    color: sel ? "#F0F2F5" : isPast ? "#3A4A57" : "#F0F2F5",
                    fontSize: 12.5,
                    fontWeight: 600,
                    display: "grid",
                    gap: 3,
                    justifyItems: "center",
                  }}
                >
                  {Number(d.slice(-2))}
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 999,
                      background: daySlots.length
                        ? blocked
                          ? "#F87171"
                          : booked
                            ? "#2DE2F2"
                            : "#22C55E"
                        : "transparent",
                    }}
                  />
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 11.5, color: "#92A0AB", marginTop: 8 }}>
            Green = open · Amber = has bookings · Red = blocked
          </div>
        </div>

        {/* Publish form */}
        <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
          <Field label={`Publish ${picked.length} selected day${picked.length === 1 ? "" : "s"}`}>
            <div className="fx-avail-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <input style={input} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              <input
                style={input}
                type="number"
                value={duration}
                onChange={(e) => setDuration(Math.max(30, Number(e.target.value)))}
                placeholder="Minutes"
              />
            </div>
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Seats per day">
              <input
                style={input}
                type="number"
                value={seats}
                onChange={(e) => setSeats(Math.max(1, Number(e.target.value)))}
              />
            </Field>
            <Field label="Price (USD)">
              <input style={input} type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
            </Field>
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, color: "#A9B6C1" }}>
            <input
              type="checkbox"
              checked={instantBook}
              onChange={(e) => {
                setInstantBook(e.target.checked);
                mRules.mutate(e.target.checked);
              }}
              style={{ accentColor: "#F0F2F5" }}
            />
            Instant book — limited to published seats
          </label>
          <Field label="If a selected day is already published">
            <div style={{ display: "grid", gap: 6 }}>
              {(
                [
                  {
                    v: "keep" as const,
                    t: "Keep existing departures",
                    d: "Only brand-new days are published. Nothing already on the calendar changes.",
                  },
                  {
                    v: "replace" as const,
                    t: "Replace with these settings",
                    d: "Empty departures are republished at the new time, seats and price. Days with bookings are kept and updated — never cancelled.",
                  },
                ]
              ).map((o) => (
                <label
                  key={o.v}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr",
                    gap: 8,
                    alignItems: "start",
                    padding: "9px 11px",
                    borderRadius: 12,
                    cursor: "pointer",
                    border:
                      mode === o.v ? "1px solid #273744" : "1px solid rgba(255,255,255,.08)",
                    background: mode === o.v ? "rgba(10,34,54,.04)" : "#1C2936",
                  }}
                >
                  <input
                    type="radio"
                    name="availability-mode"
                    checked={mode === o.v}
                    onChange={() => setMode(o.v)}
                    style={{ accentColor: "#F0F2F5", marginTop: 3 }}
                  />
                  <span>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: "#F0F2F5" }}>{o.t}</span>
                    <span style={{ display: "block", fontSize: 12, color: "#92A0AB" }}>{o.d}</span>
                  </span>
                </label>
              ))}
            </div>
          </Field>

          {picked.length > 0 && (
            <div
              style={{
                fontSize: 12.5,
                color: "#F0F2F5",
                background: "rgba(31,122,77,.07)",
                border: "1px solid rgba(31,122,77,.28)",
                borderRadius: 12,
                padding: "10px 12px",
                display: "grid",
                gap: 5,
              }}
            >
              <strong style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".1em", color: "#22C55E" }}>
                What happens when you save
              </strong>
              {previewing && !preview ? (
                <span style={{ color: "#92A0AB" }}>Checking impact…</span>
              ) : (
                <>
                  <span>{preview?.summary.headline}</span>
                  {(preview?.plan ?? [])
                    .filter((p) => p.action !== "create")
                    .slice(0, 4)
                    .map((p) => (
                      <span key={p.date} style={{ color: "#A9B6C1" }}>
                        {p.date} — {p.detail}
                      </span>
                    ))}
                </>
              )}
            </div>
          )}

          {mode === "keep" && conflicts.length > 0 && (
            <div
              style={{
                fontSize: 12.5,
                color: "#8a5a00",
                background: "rgba(45,226,242,.14)",
                border: "1px solid rgba(31,159,190,.35)",
                borderRadius: 12,
                padding: "10px 12px",
                display: "grid",
                gap: 4,
              }}
            >
              <strong style={{ color: "#8a5a00" }}>
                {conflicts.length} day{conflicts.length === 1 ? "" : "s"} already published — skipped
              </strong>
              {conflicts.slice(0, 4).map((c) => (
                <span key={c.date}>
                  {c.date} — {c.reason}
                </span>
              ))}
              <span>Switch to “Replace with these settings” to update them instead.</span>
            </div>
          )}
          {(mCreate.error || mUpdate.error) && (
            <div style={{ fontSize: 12.5, color: "#F87171" }}>
              {String(((mCreate.error || mUpdate.error) as Error).message)}
            </div>
          )}
          <button
            style={btn("primary")}
            disabled={
              picked.length === 0 ||
              mCreate.isPending ||
              (preview ? preview.summary.created + preview.summary.replaced === 0 : false)
            }
            onClick={() => mCreate.mutate()}
          >
            {mCreate.isPending
              ? "Saving…"
              : mode === "replace"
                ? "Apply to selected days"
                : "Publish availability"}
          </button>
          {preview && preview.summary.created + preview.summary.replaced === 0 && (
            <div style={{ fontSize: 12, color: "#92A0AB" }}>
              Nothing to change with this policy — every selected day is already published.
            </div>
          )}

        </div>
      </div>

      {/* Published slots */}
      <div style={{ display: "grid", gap: 8 }}>
        {isLoading && <div style={{ fontSize: 13, color: "#92A0AB" }}>Loading calendar…</div>}
        {!isLoading && upcoming.length === 0 && (
          <div style={{ fontSize: 13, color: "#92A0AB" }}>
            No published days yet — pick dates above so anglers can book.
          </div>
        )}
        {upcoming.slice(0, 40).map((s: any) => {
          const left = Math.max((s.seats_available ?? 0) - (s.seats_booked ?? 0), 0);
          return (
            <div
              key={s.id}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
                padding: "10px 12px",
                border: "1px solid rgba(255,255,255,.07)",
                borderRadius: 14,
                background: "#1C2936",
              }}
            >
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#F0F2F5", minWidth: 230 }}>
                {new Date(s.starts_at).toLocaleString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
                {" · "}
                {timeBlock({ startsAt: s.starts_at, endsAt: s.ends_at })}
              </div>
              <div style={{ fontSize: 12.5, color: "#92A0AB", flex: 1, minWidth: 150 }}>
                {s.seats_booked ?? 0}/{s.seats_available} booked · {left} left
                {s.price_cents ? ` · ${money(s.price_cents)}` : ""}
              </div>
              <input
                style={{ ...input, width: 78, padding: "6px 8px" }}
                type="number"
                min={Math.max(s.seats_booked ?? 0, 1)}
                title={
                  (s.seats_booked ?? 0) > 0
                    ? `Can't go below ${s.seats_booked} already-booked seat(s)`
                    : undefined
                }
                defaultValue={s.seats_available}
                onBlur={(e) => {
                  const floor = Math.max(s.seats_booked ?? 0, 1);
                  const v = Math.max(floor, Number(e.target.value));
                  e.target.value = String(v);
                  if (v !== s.seats_available) mUpdate.mutate({ slotId: s.id, seats: v });
                }}
              />
              <button
                style={btn("ghost")}
                disabled={(s.seats_booked ?? 0) > 0 && !s.is_blackout}
                title={
                  (s.seats_booked ?? 0) > 0 && !s.is_blackout
                    ? "Cancel the existing bookings before blocking this day"
                    : undefined
                }
                onClick={() => mUpdate.mutate({ slotId: s.id, isBlackout: !s.is_blackout })}
              >
                {s.is_blackout ? "Unblock" : "Block"}
              </button>
              <button
                style={{ ...btn("ghost"), color: "#F87171" }}
                disabled={(s.seats_booked ?? 0) > 0}
                onClick={() => mDelete.mutate(s.id)}
              >
                Delete
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".12em", color: "#92A0AB", fontWeight: 700 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

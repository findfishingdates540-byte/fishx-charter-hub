import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  useSuspenseQuery,
  useMutation,
  useQueryClient,
  queryOptions,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getMarinaOverview,
  upsertSlip,
  deleteSlip,
  upsertReservation,
  publishSlipForBooking,
  bulkCreateSlips,
  bulkUpdateSlips,
} from "@/lib/marina.functions";
import { MarinaServices } from "@/components/marina/MarinaServices";
import { ReservationCalendar } from "@/components/marina/ReservationCalendar";
import {
  OperatorShell,
  OperatorNavItem,
  KPICard,
  Card,
  StatusPill,
  money,
} from "@/components/operator/OperatorShell";
import { PayoutsConnect } from "@/components/operator/PayoutsConnect";
import { PaymentsDashboard } from "@/components/operator/PaymentsDashboard";
import { BusinessSettings } from "@/components/business/BusinessSettings";
import { ServicesManager } from "@/components/business/ServicesManager";
import { OperatorBookings } from "@/components/operator/OperatorBookings";
import { ReadinessGate } from "@/components/operator/ReadinessGate";
import { BusinessInbox } from "@/components/messages/BusinessInbox";
import { MessagesFullScreen } from "@/components/messages/MessagesFullScreen";
import {
  BookingCalendar,
  TripPayouts,
  GuestList,
} from "@/components/operator/ConsolePanels";

type Slip = {
  id: string;
  slip_number: string;
  status: string;
  monthly_rate_cents: number | null;
  nightly_rate_cents: number | null;
  is_bookable?: boolean;
  service_id?: string | null;
};

type Reservation = {
  id: string;
  slip_id?: string | null;
  vessel_name: string;
  captain_name: string | null;
  arrive_date: string;
  depart_date: string;
  total_cents: number | null;
  status: string;
  slip: { slip_number: string } | null;
};

export const marinaOverviewQO = (businessId: string) =>
  queryOptions({
    queryKey: ["marina-overview", businessId],
    queryFn: () => getMarinaOverview({ data: { businessId } }),
  });

const NAV: OperatorNavItem[] = [
  { key: "overview", label: "Overview", icon: <BoxIcon /> },
  { key: "slips", label: "Slips", icon: <BoatIcon /> },
  { key: "bookings", label: "Bookings", icon: <CalIcon /> },
  { key: "calendar", label: "Calendar", icon: <CalIcon /> },
  { key: "guests", label: "Guests", icon: <BoxIcon /> },
  { key: "reservations", label: "Reservations", icon: <CalIcon /> },
  { key: "services", label: "Services", icon: <WrenchIcon /> },
  { key: "listings", label: "Listings", icon: <MTagIcon /> },
  { key: "messages", label: "Messages", icon: <MTagIcon /> },
  { key: "payouts", label: "Payouts", icon: <PayoutIcon /> },
  { key: "settings", label: "Settings", icon: <MGearIcon /> },
];

export function MarinaDashboard({
  businessId,
  businessSlug,
  workspaceName,
  operatorName,
  initialTab,
}: {
  businessId: string;
  businessSlug?: string | null;
  workspaceName: string;
  operatorName: string;
  initialTab?: string;
}) {
  const { data } = useSuspenseQuery(marinaOverviewQO(businessId));
  const navigate = useNavigate();
  const [settingsSection, setSettingsSection] = useState<string>("profile");
  const MARINA_TABS = NAV.map((n) => n.key);
  const [active, setActive] = useState(
    initialTab && MARINA_TABS.includes(initialTab) ? initialTab : "overview",
  );
  useEffect(() => {
    setActive(initialTab && MARINA_TABS.includes(initialTab) ? initialTab : "overview");
  }, [initialTab]);
  const pending = data.reservations.filter((r: Reservation) => r.status === "pending").length;

  const nav = NAV.map((n) =>
    n.key === "reservations" && pending > 0 ? { ...n, badge: pending } : n,
  );

  const titles: Record<string, { t: string; s: string }> = {
    overview: { t: "Harbor overview", s: "Occupancy, reservations, dock health." },
    slips: { t: "Slip inventory", s: "Manage berths, rates, and status." },
    bookings: { t: "Bookings", s: "Guest bookings and requests from Fish-X." },
    calendar: { t: "Booking calendar", s: "Every online booking, month by month." },
    guests: { t: "Guests", s: "Who has stayed with you, and their details." },
    reservations: { t: "Reservations", s: "Vessels arriving and staying." },
    services: { t: "Marina services", s: "Amenities and operating settings." },
    listings: { t: "Bookable listings", s: "Transient slips, lodging and experiences." },
    messages: { t: "Messages", s: "Direct conversations with anglers and boat owners." },
    payouts: { t: "Payouts", s: "Connect your bank and manage payouts." },
    settings: { t: "Settings", s: "Profile, team, notifications and payouts." },
  };

  return (
    <OperatorShell
      workspaceName={workspaceName}
      workspaceKind="Marina"
      operatorName={operatorName}
      operatorRole="Harbormaster"
      nav={nav}
      active={active}
      onNav={(key) => navigate({ to: "/dashboard", search: { tab: key, biz: businessId } })}
      dock={[{ key: "overview", label: "Harbor" }, { key: "slips", label: "Slips" }, { key: "bookings", label: "Bookings" }]}
      pageTitle={(titles[active] ?? titles.overview).t}
      pageSub={(titles[active] ?? titles.overview).s}
      previewSlug={businessSlug}
      headerRight={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            background: "#14202B",
            border: "1px solid rgba(255,255,255,.07)",
            borderRadius: 30,
            padding: "9px 16px",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#22C55E",
            }}
          />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "#F0F2F5" }}>
            VHF Ch. 16 monitored
          </span>
        </div>
      }
    >
      {active === "overview" && (
        <>
          <ReadinessGate
            businessId={businessId}
            onNav={(k) => {
              // Profile and verification are both fixed inside Settings.
              if (k === "profile" || k === "verification") {
                setSettingsSection(k === "verification" ? "visibility" : "profile");
                setActive("settings");
                return;
              }
              setActive(k);
            }}
            compact
          />
          <Overview businessId={businessId} data={data} />
        </>
      )}
      {active === "bookings" && (
        <OperatorBookings
          businessId={businessId}
          requestsEmptyText="No slip or lodging requests waiting on you right now."
        />
      )}
      {active === "calendar" && (
        <BookingCalendar trips={data.bookings ?? []} eyebrow="Harbor" title="Booking calendar" />
      )}
      {active === "guests" && <GuestList trips={data.bookings ?? []} />}
      {active === "slips" && <Slips businessId={businessId} data={data} />}
      {active === "reservations" && (
        <Reservations businessId={businessId} data={data} />
      )}
      {active === "services" && <MarinaServices businessId={businessId} />}
      {active === "listings" && (
        <ServicesManager
          businessId={businessId}
          businessSlug={businessSlug}
          kinds={["slip_rental", "lodging", "workshop", "rental", "charter_trip", "other"]}
          eyebrow="Listings"
          title="Bookable listings"
          emptyText="No bookable listings yet — publish transient slips, lodging or experiences."
        />
      )}
      {active === "payouts" && (
        <div style={{ display: "grid", gap: 18 }}>
          <Card eyebrow="Payouts" title="Bank & payouts">
            <PayoutsConnect businessId={businessId} />
          </Card>
          <TripPayouts trips={data.bookings ?? []} />
          <PaymentsDashboard businessId={businessId} />
        </div>
      )}
      {active === "messages" && (
        <MessagesFullScreen theme="dark" title="Messages" subtitle="Customer conversations" onBack={() => setActive("overview")}>
          <BusinessInbox theme="dark" businessId={businessId} fullHeight />
        </MessagesFullScreen>
      )}
      {active === "settings" && (
        <BusinessSettings businessId={businessId} initialSection={settingsSection} />
      )}
    </OperatorShell>
  );
}

function Overview({ businessId: _b, data }: { businessId: string; data: any }) {
  const c = data.counts;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 18,
        }}
      >
        <KPICard
          label="Occupancy"
          value={`${c.total ? Math.round(((c.occupied + c.reserved) / c.total) * 100) : 0}%`}
          trend={`${c.occupied + c.reserved}/${c.total}`}
        />
        <KPICard label="Available" value={String(c.available)} trend="ready" />
        <KPICard
          label="Maintenance"
          value={String(c.maintenance)}
          trend={c.maintenance ? "action" : "clear"}
          trendPositive={c.maintenance === 0}
        />
        <KPICard label="Month gross" value={money(data.monthGrossCents)} trend="MTD" />
      </div>

      <Card eyebrow="Reservations" title="Latest arrivals">
        <ReservationTable rows={data.reservations.slice(0, 8)} />
      </Card>
    </div>
  );
}

function Slips({ businessId, data }: { businessId: string; data: any }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const upsertFn = useServerFn(upsertSlip);
  const deleteFn = useServerFn(deleteSlip);
  const publishFn = useServerFn(publishSlipForBooking);
  const publishM = useMutation({
    mutationFn: publishFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marina-overview", businessId] }),
  });
  const [editing, setEditing] = useState<Slip | null>(null);
  const [showForm, setShowForm] = useState(false);

  const upsertM = useMutation({
    mutationFn: upsertFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marina-overview", businessId] });
      setEditing(null);
      setShowForm(false);
    },
  });
  const deleteM = useMutation({
    mutationFn: deleteFn,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["marina-overview", businessId] }),
  });

  const colors: Record<string, { bg: string; fg: string; border: string }> = {
    available: { bg: "#14202B", fg: "#92A0AB", border: "#273744" },
    occupied: { bg: "rgba(34,197,94,.14)", fg: "#22C55E", border: "rgba(34,197,94,.35)" },
    reserved: { bg: "rgba(45,226,242,.16)", fg: "#2DE2F2", border: "#2DE2F2" },
    maintenance: { bg: "rgba(248,113,113,.16)", fg: "#F87171", border: "#F87171" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Card
        title="Slip map"
        eyebrow="Berths"
        right={
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            style={btnPrimary}
          >
            + Add slip
          </button>
        }
      >
        {data.slips.length === 0 ? (
          <Empty label="No slips yet — add your first berth." />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(10, minmax(0,1fr))",
              gap: 8,
            }}
          >
            {data.slips.map((s: Slip) => {
              const c = colors[s.status] ?? colors.available;
              return (
                <button
                  key={s.id}
                  onClick={() =>
                    navigate({
                      to: "/marina/slips/$slipId",
                      params: { slipId: s.id },
                      search: { biz: businessId },
                    })
                  }
                  title={`Slip ${s.slip_number} · ${s.status}`}
                  style={{
                    aspectRatio: "1 / 1",
                    borderRadius: 10,
                    border: `1px solid ${c.border}`,
                    background: c.bg,
                    color: c.fg,
                    fontFamily: "'Outfit', system-ui, sans-serif",
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  {s.slip_number}
                </button>
              );
            })}
          </div>
        )}
        <div style={{ marginTop: 18, display: "flex", gap: 18, fontSize: 12, color: "#92A0AB" }}>
          <Legend swatch="#F0F2F5" label={`Occupied ${data.counts.occupied}`} />
          <Legend swatch="#2DE2F2" label={`Reserved ${data.counts.reserved}`} />
          <Legend swatch="#F0F2F5" bordered label={`Available ${data.counts.available}`} />
          <Legend swatch="#F87171" label={`Maintenance ${data.counts.maintenance}`} />
        </div>
      </Card>

      <Card eyebrow="Online booking" title="Bookable berths">
        {data.slips.length === 0 ? (
          <Empty label="Add a slip first." />
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {data.slips.map((s: Slip) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  padding: "10px 12px",
                  border: "1px solid rgba(255,255,255,.07)",
                  borderRadius: 11,
                }}
              >
                <div>
                  <div style={{ color: "#F0F2F5", fontWeight: 700, fontSize: 14 }}>
                    Slip {s.slip_number}
                  </div>
                  <div style={{ color: "#92A0AB", fontSize: 12.5 }}>
                    {s.nightly_rate_cents
                      ? `${money(s.nightly_rate_cents)} / night`
                      : "Set a nightly rate to publish"}
                    {s.is_bookable ? " · Bookable online" : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    style={btnGhost}
                    onClick={() =>
                      navigate({
                        to: "/marina/slips/$slipId",
                        params: { slipId: s.id },
                        search: { biz: businessId },
                      })
                    }
                  >
                    Open
                  </button>
                  <button
                    style={s.is_bookable ? btnGhost : btnPrimary}
                    disabled={publishM.isPending || !s.nightly_rate_cents}
                    onClick={() =>
                      publishM.mutate({
                        data: { businessId, slipId: s.id, enabled: !s.is_bookable },
                      })
                    }
                  >
                    {s.is_bookable ? "Unpublish" : "Publish for booking"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {publishM.isError && (
          <div style={{ color: "#F87171", fontSize: 13, marginTop: 10 }}>
            {(publishM.error as Error).message}
          </div>
        )}
      </Card>

      <DockBuilder businessId={businessId} slips={data.slips as Slip[]} />

      {showForm && (
        <Modal
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
        >
          <SlipForm
            initial={editing ?? undefined}
            onCancel={() => {
              setShowForm(false);
              setEditing(null);
            }}
            onSave={(v) =>
              upsertM.mutate({
                data: { ...v, businessId, id: editing?.id },
              })
            }
            onDelete={
              editing
                ? () =>
                    deleteM.mutate({ data: { id: editing.id, businessId } })
                : undefined
            }
            saving={upsertM.isPending}
          />
        </Modal>
      )}
    </div>
  );
}

export function SlipForm({
  initial,
  onCancel,
  onSave,
  onDelete,
  saving,
}: {
  initial?: Slip;
  onCancel: () => void;
  onSave: (v: {
    slipNumber: string;
    lengthFt: number | null;
    beamFt: number | null;
    amperage: string;
    monthlyRateCents: number | null;
    nightlyRateCents: number | null;
    status: "available" | "occupied" | "reserved" | "maintenance";
  }) => void;
  onDelete?: () => void;
  saving: boolean;
}) {
  const [slipNumber, setSlipNumber] = useState(initial?.slip_number ?? "");
  const [status, setStatus] = useState<
    "available" | "occupied" | "reserved" | "maintenance"
  >((initial?.status as any) ?? "available");
  const [lengthFt, setLengthFt] = useState("");
  const [beamFt, setBeamFt] = useState("");
  const [amperage, setAmperage] = useState("");
  const [monthly, setMonthly] = useState(
    initial?.monthly_rate_cents ? String(initial.monthly_rate_cents / 100) : "",
  );
  const [nightly, setNightly] = useState(
    initial?.nightly_rate_cents ? String(initial.nightly_rate_cents / 100) : "",
  );

  return (
    <Card title={initial ? `Edit slip ${initial.slip_number}` : "Add slip"}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 14,
        }}
      >
        <Field label="Slip #">
          <input value={slipNumber} onChange={(e) => setSlipNumber(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as any)} style={inputStyle}>
            <option value="available">Available</option>
            <option value="occupied">Occupied</option>
            <option value="reserved">Reserved</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </Field>
        <Field label="Amperage">
          <input value={amperage} onChange={(e) => setAmperage(e.target.value)} placeholder="30/50 A" style={inputStyle} />
        </Field>
        <Field label="Length (ft)">
          <input type="number" value={lengthFt} onChange={(e) => setLengthFt(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Beam (ft)">
          <input type="number" value={beamFt} onChange={(e) => setBeamFt(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Monthly $">
          <input type="number" value={monthly} onChange={(e) => setMonthly(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Nightly $">
          <input type="number" value={nightly} onChange={(e) => setNightly(e.target.value)} style={inputStyle} />
        </Field>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 20, alignItems: "center" }}>
        <button
          disabled={saving || !slipNumber}
          onClick={() =>
            onSave({
              slipNumber,
              status,
              lengthFt: lengthFt ? Number(lengthFt) : null,
              beamFt: beamFt ? Number(beamFt) : null,
              amperage,
              monthlyRateCents: monthly ? Math.round(Number(monthly) * 100) : null,
              nightlyRateCents: nightly ? Math.round(Number(nightly) * 100) : null,
            })
          }
          style={btnPrimary}
        >
          {saving ? "Saving…" : "Save slip"}
        </button>
        <button onClick={onCancel} style={btnGhost}>
          Cancel
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            style={{
              ...btnGhost,
              marginLeft: "auto",
              color: "#F87171",
              borderColor: "rgba(216,81,74,.28)",
            }}
          >
            Delete
          </button>
        )}
      </div>
    </Card>
  );
}

function Reservations({
  businessId,
  data,
}: {
  businessId: string;
  data: any;
}) {
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertReservation);
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState<"calendar" | "list">("calendar");

  const upsertM = useMutation({
    mutationFn: upsertFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marina-overview", businessId] });
      setShowForm(false);
    },
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => setView("calendar")}
          style={view === "calendar" ? btnPrimary : btnGhost}
        >
          Calendar
        </button>
        <button onClick={() => setView("list")} style={view === "list" ? btnPrimary : btnGhost}>
          List
        </button>
        <button onClick={() => setShowForm(true)} style={{ ...btnGhost, marginLeft: "auto" }}>
          + New reservation
        </button>
      </div>
      {view === "calendar" ? (
        <ReservationCalendar rows={data.reservations} />
      ) : (
        <Card title="All reservations">
          <ReservationTable rows={data.reservations} businessId={businessId} />
        </Card>
      )}
      {showForm && (
        <Modal onClose={() => setShowForm(false)}>
          <ReservationForm
            slips={data.slips}
            saving={upsertM.isPending}
            onSave={(v) => upsertM.mutate({ data: { ...v, businessId } })}
            onCancel={() => setShowForm(false)}
          />
        </Modal>
      )}
    </div>
  );
}

export function ReservationForm({
  slips,
  initial,
  onSave,
  saving,
  onCancel,
}: {
  slips: Slip[];
  initial?: Reservation & { slip_id?: string | null };
  onSave: (v: {
    vesselName: string;
    captainName: string;
    arriveDate: string;
    departDate: string;
    totalCents: number;
    slipId: string | null;
    status: "pending" | "confirmed" | "checked_in" | "checked_out" | "cancelled";
  }) => void;
  saving: boolean;
  onCancel: () => void;
}) {
  const [vessel, setVessel] = useState(initial?.vessel_name ?? "");
  const [captain, setCaptain] = useState(initial?.captain_name ?? "");
  const [arrive, setArrive] = useState(initial?.arrive_date?.slice(0, 10) ?? "");
  const [depart, setDepart] = useState(initial?.depart_date?.slice(0, 10) ?? "");
  const [total, setTotal] = useState(
    initial?.total_cents != null ? String(initial.total_cents / 100) : "",
  );
  const [slipId, setSlipId] = useState<string>(initial?.slip_id ?? "");
  const [status, setStatus] = useState<
    "pending" | "confirmed" | "checked_in" | "checked_out" | "cancelled"
  >((initial?.status as any) ?? "pending");

  return (
    <Card title={initial ? "Edit reservation" : "New reservation"}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
        <Field label="Vessel name">
          <input value={vessel} onChange={(e) => setVessel(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Captain / owner">
          <input value={captain} onChange={(e) => setCaptain(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Slip">
          <select value={slipId} onChange={(e) => setSlipId(e.target.value)} style={inputStyle}>
            <option value="">Unassigned</option>
            {slips.map((s) => (
              <option key={s.id} value={s.id}>
                {s.slip_number}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Arrive">
          <input type="date" value={arrive} onChange={(e) => setArrive(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Depart">
          <input type="date" value={depart} onChange={(e) => setDepart(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Total $">
          <input type="number" value={total} onChange={(e) => setTotal(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as any)} style={inputStyle}>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="checked_in">Checked in</option>
            <option value="checked_out">Checked out</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </Field>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <button
          disabled={saving || !vessel || !arrive || !depart}
          onClick={() =>
            onSave({
              vesselName: vessel,
              captainName: captain,
              arriveDate: arrive,
              departDate: depart,
              totalCents: total ? Math.round(Number(total) * 100) : 0,
              slipId: slipId || null,
              status,
            })
          }
          style={btnPrimary}
        >
          {saving ? "Saving…" : "Save reservation"}
        </button>
        <button onClick={onCancel} style={btnGhost}>
          Cancel
        </button>
      </div>
    </Card>
  );
}

function ReservationTable({
  rows,
  businessId,
}: {
  rows: Reservation[];
  businessId?: string;
}) {
  if (!rows.length) return <Empty label="No reservations yet." />;
  const toneFor = (s: string) =>
    s === "confirmed"
      ? "green"
      : s === "pending"
        ? "gold"
        : s === "checked_in"
          ? "cyan"
          : s === "cancelled"
            ? "red"
            : "muted";
  return (
    <div style={{ overflowX: "auto" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr .8fr .8fr auto auto",
          gap: 16,
          padding: "10px 4px 12px",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: "#92A0AB",
          borderBottom: "1px solid rgba(255,255,255,.07)",
        }}
      >
        <span>Vessel &amp; captain</span>
        <span>Stay</span>
        <span>Slip</span>
        <span>Amount</span>
        <span>Status</span>
      </div>
      {rows.map((r) => (
        <div
          key={r.id}
          style={{
            display: "grid",
            gridTemplateColumns: "1.5fr 1fr .8fr .8fr auto",
            gap: 16,
            padding: "14px 4px",
            borderBottom: "1px solid rgba(255,255,255,.05)",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#F0F2F5" }}>
              {r.vessel_name}
            </div>
            <div style={{ fontSize: 12.5, color: "#92A0AB" }}>
              {r.captain_name ?? "—"}
            </div>
          </div>
          <span style={{ fontSize: 13.5, color: "#F0F2F5" }}>
            {new Date(r.arrive_date).toLocaleDateString()} →{" "}
            {new Date(r.depart_date).toLocaleDateString()}
          </span>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: "#F0F2F5" }}>
            {r.slip?.slip_number ?? "—"}
          </span>
          <span
            style={{
              fontFamily: "'Outfit', Georgia, serif",
              fontSize: 17,
              fontWeight: 600,
              color: "#F0F2F5",
            }}
          >
            {money(r.total_cents)}
          </span>
          <StatusPill label={r.status.replace("_", " ")} tone={toneFor(r.status) as any} />
        </div>
      ))}
    </div>
  );
}

/* --- tiny UI helpers --- */

function Modal({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background: "rgba(6,21,31,.62)",
        backdropFilter: "blur(4px)",
        display: "flex",
        padding: "40px 16px",
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(760px, 100%)", margin: "auto", borderRadius: 20, boxShadow: "0 30px 80px -20px rgba(0,0,0,.6)" }}
      >
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "#92A0AB",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,.09)",
  borderRadius: 10,
  padding: "10px 12px",
  fontFamily: "'Outfit', system-ui, sans-serif",
  fontSize: 14,
  background: "#14202B",
  color: "#F0F2F5",
  outline: "none",
};

const btnPrimary: React.CSSProperties = {
  background: "#0D161F",
  color: "#F0F2F5",
  border: 0,
  borderRadius: 11,
  padding: "10px 16px",
  fontFamily: "'Outfit', system-ui, sans-serif",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const btnGhost: React.CSSProperties = {
  background: "transparent",
  color: "#F0F2F5",
  border: "1px solid rgba(255,255,255,.09)",
  borderRadius: 11,
  padding: "10px 16px",
  fontFamily: "'Outfit', system-ui, sans-serif",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

function Empty({ label }: { label: string }) {
  return (
    <div style={{ padding: "32px 10px", textAlign: "center", color: "#92A0AB", fontSize: 14 }}>
      {label}
    </div>
  );
}

function Legend({
  swatch,
  label,
  bordered,
}: {
  swatch: string;
  label: string;
  bordered?: boolean;
}) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 3,
          background: swatch,
          border: bordered ? "1px solid rgba(255,255,255,.09)" : "none",
        }}
      />
      {label}
    </span>
  );
}

/* icons */
function BoxIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="8" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
      <rect x="13" y="13" width="8" height="8" rx="2" />
    </svg>
  );
}
function BoatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
      <path d="M4 20V8l8-4 8 4v12M9 20v-6h6v6" />
    </svg>
  );
}
function CalIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
      <rect x="3" y="4" width="18" height="17" rx="2.5" />
      <path d="M3 9h18M8 2v4M16 2v4" />
      <path d="m9 15 2 2 4-4" />
    </svg>
  );
}
function WrenchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-2.4z" />
    </svg>
  );
}
function PayoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
      <rect x="2" y="5" width="20" height="14" rx="2.5" />
      <path d="M2 10h20" />
      <path d="M6 15h4" />
    </svg>
  );
}

// keep useMemo import used to avoid unused warning if we add filters later
void useMemo;

function MTagIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M20.6 13.4 12 4.8H4.8V12l8.6 8.6a1.7 1.7 0 0 0 2.4 0l4.8-4.8a1.7 1.7 0 0 0 0-2.4Z" />
      <circle cx="8.3" cy="8.3" r="1.2" />
    </svg>
  );
}

function MGearIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="12" cy="12" r="3" />
      <path d="M4 12h2m12 0h2M12 4v2m0 12v2M6.5 6.5 8 8m8 8 1.5 1.5M17.5 6.5 16 8M8 16l-1.5 1.5" />
    </svg>
  );
}

/**
 * Dock-level tools: create a whole run of berths at once ("A1..A20") and apply
 * status / publish / rate changes to many slips in one action.
 */
function DockBuilder({ businessId, slips }: { businessId: string; slips: Slip[] }) {
  const qc = useQueryClient();
  const createFn = useServerFn(bulkCreateSlips);
  const updateFn = useServerFn(bulkUpdateSlips);
  const [prefix, setPrefix] = useState("A");
  const [from, setFrom] = useState("1");
  const [to, setTo] = useState("20");
  const [nightly, setNightly] = useState("");
  const [lengthFt, setLengthFt] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["marina-overview", businessId] });

  const createM = useMutation({
    mutationFn: createFn,
    onSuccess: (r: any) => {
      invalidate();
      setNote(
        `${r.created} berth${r.created === 1 ? "" : "s"} added${r.skipped ? ` · ${r.skipped} already existed` : ""}.`,
      );
    },
    onError: (e: any) => setNote(e?.message ?? "Couldn't add those berths."),
  });

  const updateM = useMutation({
    mutationFn: updateFn,
    onSuccess: (r: any) => {
      invalidate();
      setSelected([]);
      setNote(`${r.updated} slip${r.updated === 1 ? "" : "s"} updated.`);
    },
    onError: (e: any) => setNote(e?.message ?? "Couldn't update those slips."),
  });

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const apply = (patch: Record<string, unknown>) =>
    updateM.mutate({ data: { businessId, slipIds: selected, ...patch } as any });

  return (
    <>
      <Card eyebrow="Dock setup" title="Add a run of berths">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))",
            gap: 14,
          }}
        >
          <Field label="Prefix">
            <input value={prefix} onChange={(e) => setPrefix(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="From #">
            <input
              type="number"
              min={0}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="To #">
            <input
              type="number"
              min={0}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Length (ft)">
            <input
              type="number"
              value={lengthFt}
              onChange={(e) => setLengthFt(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Nightly $">
            <input
              type="number"
              value={nightly}
              onChange={(e) => setNightly(e.target.value)}
              style={inputStyle}
            />
          </Field>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
          <button
            style={btnPrimary}
            disabled={createM.isPending}
            onClick={() =>
              createM.mutate({
                data: {
                  businessId,
                  prefix,
                  from: Number(from) || 0,
                  to: Number(to) || 0,
                  lengthFt: lengthFt ? Number(lengthFt) : null,
                  nightlyRateCents: nightly ? Math.round(Number(nightly) * 100) : null,
                },
              })
            }
          >
            {createM.isPending ? "Adding…" : `Add ${prefix}${from}–${prefix}${to}`}
          </button>
          {note && <span style={{ color: "#92A0AB", fontSize: 13 }}>{note}</span>}
        </div>
      </Card>

      <Card eyebrow="Bulk actions" title="Update several slips at once">
        {slips.length === 0 ? (
          <Empty label="Add berths first." />
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              {slips.map((s) => {
                const on = selected.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggle(s.id)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 30,
                      cursor: "pointer",
                      fontFamily: "'Outfit', system-ui, sans-serif",
                      fontSize: 12.5,
                      fontWeight: 700,
                      border: `1px solid ${on ? "#2DE2F2" : "#273744"}`,
                      background: on ? "#2DE2F2" : "transparent",
                      color: on ? "#06131C" : "#92A0AB",
                    }}
                  >
                    {s.slip_number}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button
                style={btnGhost}
                onClick={() => setSelected(slips.map((s) => s.id))}
                type="button"
              >
                Select all
              </button>
              <button style={btnGhost} onClick={() => setSelected([])} type="button">
                Clear
              </button>
              <span style={{ color: "#92A0AB", fontSize: 13 }}>{selected.length} selected</span>
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginTop: 14,
                opacity: selected.length ? 1 : 0.45,
                pointerEvents: selected.length ? "auto" : "none",
              }}
            >
              <button style={btnGhost} onClick={() => apply({ status: "available" })}>
                Mark available
              </button>
              <button style={btnGhost} onClick={() => apply({ status: "maintenance" })}>
                Close for maintenance
              </button>
              <button style={btnGhost} onClick={() => apply({ status: "occupied" })}>
                Mark occupied
              </button>
              <button style={btnPrimary} onClick={() => apply({ isBookable: true })}>
                Publish for booking
              </button>
              <button style={btnGhost} onClick={() => apply({ isBookable: false })}>
                Unpublish
              </button>
            </div>
          </>
        )}
      </Card>
    </>
  );
}

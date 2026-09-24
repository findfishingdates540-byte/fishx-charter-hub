/**
 * Shared operator Settings screen — mounted by every business vertical
 * (charter, guide, marina/lodge, tackle/bait/gear/apparel).
 *
 * Sections: public profile, storefront visibility + public page link,
 * team & roles, notification preferences, payouts.
 */
import { Suspense, useEffect, useState } from "react";
import { MediaImg } from "@/components/media/MediaImg";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getBusinessSettings,
  updateBusinessProfile,
  setBusinessPublished,
  updateTeamMemberRole,
  addTeamMemberByEmail,
  removeTeamMember,
} from "@/lib/business-settings.functions";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/notifications.functions";
import { Card } from "@/components/operator/OperatorShell";
import { PayoutsConnect } from "@/components/operator/PayoutsConnect";
import { ImageUpload } from "@/components/business/ImageUpload";
import { AnglerAccount } from "@/components/profile/AnglerAccount";
import { VerificationDocuments } from "@/components/business/VerificationDocuments";
import { toast } from "sonner";

const NOTIF_CATEGORIES: Array<{ key: string; label: string; hint: string }> = [
  { key: "booking", label: "Bookings", hint: "New requests, confirmations, cancellations." },
  { key: "payment", label: "Payments & payouts", hint: "Deposits captured, payouts released." },
  { key: "message", label: "Messages", hint: "Angler messages and enquiries." },
  { key: "review", label: "Reviews", hint: "New reviews on your listings." },
  { key: "system", label: "Account & verification", hint: "Verification and compliance updates." },
];

const OP_SECTIONS: Array<{ key: string; label: string; hint: string }> = [
  { key: "account", label: "My Account", hint: "Your name, photo and contact details" },
  { key: "profile", label: "Business profile", hint: "Name, story, photos, hours" },
  { key: "visibility", label: "Storefront & visibility", hint: "Publish, verification, public page" },
  { key: "verification", label: "Verification documents", hint: "Credentials, decisions and resubmissions" },
  { key: "team", label: "Team & roles", hint: "Owners, managers, crew" },
  { key: "notifications", label: "Notifications", hint: "What we email you about" },
  { key: "payouts", label: "Payouts", hint: "Bank details & Stripe status" },
];

function usePhoneLayout() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setPhone(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return phone;
}

export function BusinessSettings({
  businessId,
  initialSection,
  onSectionChange,
  extraSections = [],
}: {
  businessId: string;
  initialSection?: string;
  onSectionChange?: (section?: string, replace?: boolean) => void;
  extraSections?: Array<{ key: string; label: string; hint: string; content: React.ReactNode }>;
}) {
  const qc = useQueryClient();
  const fetchSettings = useServerFn(getBusinessSettings);
  const phone = usePhoneLayout();
  const sections = [...OP_SECTIONS, ...extraSections.map(({ key, label, hint }) => ({ key, label, hint }))];
  const isSection = (value?: string) => Boolean(value && sections.some((section) => section.key === value));
  const [active, setActive] = useState<string>(
    isSection(initialSection) ? (initialSection as string) : "account",
  );
  // On phones the menu is a list; a section only opens when tapped (or deep-linked).
  const [openOnPhone, setOpenOnPhone] = useState<boolean>(
    isSection(initialSection),
  );

  // Deep links from the readiness checklist ("Fix →") open the matching section.
  useEffect(() => {
    if (isSection(initialSection)) {
      setActive(initialSection as string);
      setOpenOnPhone(true);
      return;
    }
    setOpenOnPhone(false);
  }, [initialSection]);

  // Hide the operator bottom dock while a section screen is open.
  const dockHidden = phone && openOnPhone;
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("fx-hide-dock", dockHidden);
    return () => document.body.classList.remove("fx-hide-dock");
  }, [dockHidden]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["business-settings", businessId],
    queryFn: () => fetchSettings({ data: { businessId } }),
  });

  if (isLoading) return <Muted>Loading your business settings…</Muted>;
  if (error) return <Muted>Couldn't load settings: {String((error as Error).message)}</Muted>;
  if (!data) return null;

  const canEdit = data.myRole === "owner" || data.myRole === "manager";
  const current = sections.find((s) => s.key === active);

  const body = (
    <>
      {active === "account" && (
        <Suspense fallback={<Muted>Loading your account…</Muted>}>
          <AnglerAccount embedded theme="operator" />
        </Suspense>
      )}
      {active === "profile" && <ProfileCard business={data.business} canEdit={canEdit} />}
      {active === "visibility" && (
        <VisibilityCard
          business={data.business}
          canEdit={canEdit}
          onDone={() => qc.invalidateQueries({ queryKey: ["business-settings", businessId] })}
        />
      )}
      {active === "verification" && <VerificationDocuments businessId={businessId} />}
      {active === "team" && <TeamCard businessId={businessId} team={data.team} myRole={data.myRole} />}
      {active === "notifications" && <NotificationsCard />}
      {active === "payouts" && (
        <Card eyebrow="Money" title="Payouts">
          <PayoutsConnect businessId={businessId} />
        </Card>
      )}
      {extraSections.find((section) => section.key === active)?.content}
    </>
  );

  const openSection = (key: string) => {
    setActive(key);
    setOpenOnPhone(true);
    onSectionChange?.(key);
  };

  const closeSection = () => {
    setOpenOnPhone(false);
    onSectionChange?.(undefined, true);
  };

  /* ---------------------------- phone: drill-in ---------------------------- */
  if (phone) {
    if (openOnPhone) {
      return (
        <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 6,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 2px",
              background: "#0D161F",
            }}
          >
            <button
              type="button"
              onClick={closeSection}
              aria-label="Back to settings"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: 11,
                border: "1px solid rgba(255,255,255,.1)",
                background: "#14202B",
                color: "#E8F2F6",
                cursor: "pointer",
                font: "inherit",
                fontSize: 17,
              }}
            >
              ←
            </button>
            <span style={{ fontSize: 17, fontWeight: 800, color: "#F0F2F5", minWidth: 0, overflowWrap: "anywhere" }}>
              {current?.label ?? "Settings"}
            </span>
          </div>
          <div style={{ display: "grid", gap: 18, minWidth: 0 }}>{body}</div>
        </div>
      );
    }

    return (
      <div style={{ display: "grid", gap: 14, minWidth: 0 }}>
        <div
          style={{
            background: "#14202B",
            border: "1px solid rgba(255,255,255,.08)",
            borderRadius: 16,
            padding: "14px 15px",
            display: "grid",
            gap: 4,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 800, color: "#F0F2F5", overflowWrap: "anywhere" }}>
            {data.business.name}
          </span>
          {data.accountEmail ? (
            <span style={{ fontSize: 12.5, color: "#92A0AB", overflowWrap: "anywhere" }}>
              Signed in as {data.accountEmail}
            </span>
          ) : null}
        </div>
        <div
          style={{
            background: "#14202B",
            border: "1px solid rgba(255,255,255,.08)",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          {sections.map((it, i) => (
            <button
              key={it.key}
              type="button"
              onClick={() => openSection(it.key)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                textAlign: "left",
                border: 0,
                borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,.07)",
                background: "transparent",
                padding: "15px 15px",
                cursor: "pointer",
                font: "inherit",
              }}
            >
              <span style={{ display: "grid", gap: 3, minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#F0F2F5" }}>{it.label}</span>
                <span style={{ fontSize: 12.5, color: "#92A0AB", overflowWrap: "anywhere" }}>{it.hint}</span>
              </span>
              <span aria-hidden="true" style={{ color: "#5E7183", fontSize: 18, flex: "0 0 auto" }}>
                ›
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* --------------------------- desktop / tablet --------------------------- */
  return (
    <div
      className="fx-settings"
      style={{
        display: "grid",
        gridTemplateColumns: "252px minmax(0,1fr)",
        gap: 20,
        alignItems: "start",
      }}
    >
      <nav
        style={{
          background: "#14202B",
          border: "1px solid rgba(255,255,255,.08)",
          borderRadius: 18,
          padding: 10,
          display: "grid",
          gap: 4,
          position: "sticky",
          top: 20,
        }}
      >
        <div
          style={{
            padding: "8px 13px 10px",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: "#5E7183",
          }}
        >
          {data.business.name}
        </div>
        {data.accountEmail ? (
          <div
            style={{
              padding: "0 13px 10px",
              display: "grid",
              gap: 3,
              borderBottom: "1px solid rgba(255,255,255,.08)",
              marginBottom: 6,
            }}
          >
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#5E7183" }}>
              Signed in as
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "#E8F2F6", overflowWrap: "anywhere" }}>
              {data.accountEmail}
            </span>
          </div>
        ) : null}
        {sections.map((it) => {
          const on = active === it.key;
          return (
              <button
              key={it.key}
                onClick={() => {
                  setActive(it.key);
                  onSectionChange?.(it.key);
                }}
              style={{
                textAlign: "left",
                border: 0,
                cursor: "pointer",
                background: on ? "rgba(45,226,242,.12)" : "transparent",
                borderRadius: 12,
                padding: "11px 13px",
                font: "inherit",
              }}
            >
              <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: on ? "#2DE2F2" : "#F0F2F5" }}>
                {it.label}
              </span>
              <span style={{ display: "block", fontSize: 12, color: "#92A0AB", marginTop: 2 }}>{it.hint}</span>
            </button>
          );
        })}
      </nav>

      <section style={{ minWidth: 0, display: "grid", gap: 20 }}>{body}</section>
    </div>
  );
}


/* ------------------------------- visibility ------------------------------ */

function VisibilityCard({
  business,
  canEdit,
  onDone,
}: {
  business: any;
  canEdit: boolean;
  onDone: () => void;
}) {
  const toggle = useServerFn(setBusinessPublished);
  const m = useMutation({
    mutationFn: (v: boolean) => toggle({ data: { businessId: business.id, isPublished: v } }),
    onSuccess: onDone,
    onError: (e: any) => toast.error(e?.message || "We couldn't update your storefront."),
  });

  return (
    <Card
      eyebrow="Storefront"
      title="Visibility"
      right={
        <Link
          to="/b/$slug"
          params={{ slug: business.slug }}
          target="_blank"
          style={{ fontSize: 13, fontWeight: 700, color: "#2DE2F2", textDecoration: "none" }}
        >
          View public page ↗
        </Link>
      }
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14, justifyContent: "space-between" }}>
        <div style={{ fontSize: 13.5, color: "#A9B6C1", maxWidth: 520 }}>
          {business.is_published
            ? "Your business is live in the Fish-X directory and can receive bookings."
            : "Your business is hidden. Publish it to appear in search and accept bookings."}
          <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Pill tone={business.verified_at ? "good" : "warn"}>
              {business.verified_at ? "★ Verified" : "Verification pending"}
            </Pill>
            <Pill tone={business.payouts_enabled ? "good" : "warn"}>
              {business.payouts_enabled ? "Payouts enabled" : "Payouts not connected"}
            </Pill>
            <Pill tone="neutral">fish-x.com/b/{business.slug}</Pill>
          </div>
        </div>
        <button
          disabled={!canEdit || m.isPending}
          onClick={() => m.mutate(!business.is_published)}
          style={btn(business.is_published ? "ghost" : "primary")}
        >
          {m.isPending ? "Saving…" : business.is_published ? "Unpublish" : "Publish storefront"}
        </button>
      </div>
    </Card>
  );
}

function AddMemberRow({ businessId, onDone }: { businessId: string; onDone: () => void }) {
  const add = useServerFn(addTeamMemberByEmail);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"owner" | "manager" | "staff">("staff");
  const m = useMutation({
    mutationFn: () => add({ data: { businessId, email: email.trim(), role } }),
    onSuccess: () => {
      setEmail("");
      onDone();
    },
  });

  return (
    <div style={{ display: "grid", gap: 8, marginBottom: 6 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          style={{ ...input, flex: "1 1 220px" }}
          placeholder="Teammate's Fish-X email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <select style={{ ...input, width: 140 }} value={role} onChange={(e) => setRole(e.target.value as any)}>
          <option value="staff">Crew</option>
          <option value="manager">Manager</option>
          <option value="owner">Owner</option>
        </select>
        <button
          disabled={!email.trim() || m.isPending}
          onClick={() => m.mutate()}
          style={btn("primary")}
        >
          {m.isPending ? "Adding…" : "Add"}
        </button>
      </div>
      {m.error && <Muted tone="bad">{String((m.error as Error).message)}</Muted>}
      {m.isSuccess && !m.isPending && <Muted>Teammate added.</Muted>}
    </div>
  );
}

/* -------------------------------- profile -------------------------------- */

type ProfileDraft = {
  name: string;
  tagline: string;
  description: string;
  hero_url: string;
  logo_url: string;
  website: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  region: string;
  country: string;
};

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function ProfileCard({ business, canEdit }: { business: any; canEdit: boolean }) {
  const qc = useQueryClient();
  const save = useServerFn(updateBusinessProfile);
  const [draft, setDraft] = useState<ProfileDraft>(() => toDraft(business));
  const [hours, setHours] = useState<Record<string, string>>(() => {
    const h = (business.hours_json ?? {}) as Record<string, any>;
    return Object.fromEntries(DAYS.map((d) => [d, typeof h[d] === "string" ? h[d] : ""]));
  });
  const [amenities, setAmenities] = useState<string>(() => {
    const a = (business.amenities_json ?? {}) as any;
    return Array.isArray(a?.list) ? a.list.join(", ") : "";
  });
  const [gallery, setGallery] = useState<string[]>(() =>
    Array.isArray(business.gallery_json) ? (business.gallery_json as string[]) : [],
  );
  const [highlights, setHighlights] = useState<string>(() =>
    Array.isArray(business.highlights_json) ? (business.highlights_json as string[]).join(", ") : "",
  );
  const [yearFounded, setYearFounded] = useState<string>(() =>
    business.year_founded ? String(business.year_founded) : "",
  );
  const [social, setSocial] = useState<Record<string, string>>(() => {
    const s0 = (business.social_json ?? {}) as any;
    return {
      instagram: s0.instagram ?? "",
      facebook: s0.facebook ?? "",
      youtube: s0.youtube ?? "",
      tiktok: s0.tiktok ?? "",
    };
  });
  const [policies, setPolicies] = useState<Record<string, string | boolean>>(() => {
    const p0 = (business.policies_json ?? {}) as any;
    return {
      cancellation: p0.cancellation ?? "",
      payment_methods: p0.payment_methods ?? "",
      languages: p0.languages ?? "",
      rules: p0.rules ?? "",
      shipping: p0.shipping ?? "",
      returns: p0.returns ?? "",
      privacy: p0.privacy ?? "",
      privacy_url: p0.privacy_url ?? "",
      terms: p0.terms ?? "",
      terms_url: p0.terms_url ?? "",
      cookie_notice: p0.cookie_notice !== false,
      marketing_consent: p0.marketing_consent !== false,
    };
  });
  const [faq, setFaq] = useState<Array<{ q: string; a: string }>>(() =>
    Array.isArray(business.faq_json) ? (business.faq_json as any[]) : [],
  );

  useEffect(() => setDraft(toDraft(business)), [business.id]);

  const m = useMutation({
    mutationFn: () =>
      save({
        data: {
          businessId: business.id,
          ...draft,
          hours,
          amenities: amenities
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          gallery: gallery.filter(Boolean),
          highlights: highlights
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          year_founded: yearFounded.trim() ? Number(yearFounded.trim()) : null,
          social,
          policies,
          faq: faq.filter((f) => f.q.trim() && f.a.trim()),
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business-settings", business.id] });
      qc.invalidateQueries({ queryKey: ["my-businesses"] });
    },
  });

  const set = (k: keyof ProfileDraft) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <Card eyebrow="Public profile" title="How anglers see you">
      <div style={{ display: "grid", gap: 16 }}>
        <Grid2>
          <Field label="Business name">
            <input style={input} value={draft.name} onChange={(e) => set("name")(e.target.value)} disabled={!canEdit} />
          </Field>
          <Field label="Tagline">
            <input
              style={input}
              placeholder="Offshore bluewater specialists since 1998"
              value={draft.tagline}
              onChange={(e) => set("tagline")(e.target.value)}
              disabled={!canEdit}
            />
          </Field>
        </Grid2>

        <Field label="About">
          <textarea
            style={{ ...input, minHeight: 110, resize: "vertical", lineHeight: 1.55 }}
            value={draft.description}
            onChange={(e) => set("description")(e.target.value)}
            disabled={!canEdit}
            placeholder="Tell anglers who you are, what you target, and what makes a day with you different."
          />
        </Field>

        <Grid2>
          <ImageUpload
            businessId={business.id}
            label="Cover image"
            value={draft.hero_url}
            onChange={set("hero_url")}
            disabled={!canEdit}
          />
          <ImageUpload
            businessId={business.id}
            label="Logo"
            aspect="1 / 1"
            value={draft.logo_url}
            onChange={set("logo_url")}
            disabled={!canEdit}
          />
        </Grid2>


        <Grid2>
          <Field label="Phone">
            <input style={input} value={draft.phone} onChange={(e) => set("phone")(e.target.value)} disabled={!canEdit} />
          </Field>
          <Field label="Booking email">
            <input style={input} value={draft.email} onChange={(e) => set("email")(e.target.value)} disabled={!canEdit} />
          </Field>
        </Grid2>

        <Grid2>
          <Field label="Website">
            <input style={input} value={draft.website} onChange={(e) => set("website")(e.target.value)} disabled={!canEdit} />
          </Field>
          <Field label="Street address / dock">
            <input style={input} value={draft.address} onChange={(e) => set("address")(e.target.value)} disabled={!canEdit} />
          </Field>
        </Grid2>

        <Grid3>
          <Field label="City">
            <input style={input} value={draft.city} onChange={(e) => set("city")(e.target.value)} disabled={!canEdit} />
          </Field>
          <Field label="State / region">
            <input style={input} value={draft.region} onChange={(e) => set("region")(e.target.value)} disabled={!canEdit} />
          </Field>
          <Field label="Country">
            <input style={input} value={draft.country} onChange={(e) => set("country")(e.target.value)} disabled={!canEdit} />
          </Field>
        </Grid3>

        <Field label="Opening hours">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
            {DAYS.map((d) => (
              <div key={d} style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".1em", color: "#92A0AB", fontWeight: 700 }}>{d}</span>
                <input
                  style={{ ...input, padding: "8px 10px", fontSize: 13 }}
                  placeholder="06:00 – 18:00"
                  value={hours[d] ?? ""}
                  onChange={(e) => setHours((h) => ({ ...h, [d]: e.target.value }))}
                  disabled={!canEdit}
                />
              </div>
            ))}
          </div>
        </Field>

        <Field label="Amenities & features (comma separated)">
          <input
            style={input}
            placeholder="Restrooms on board, Rods & tackle provided, Parking, Fish cleaning"
            value={amenities}
            onChange={(e) => setAmenities(e.target.value)}
            disabled={!canEdit}
          />
        </Field>

        <Field label="Photo gallery (shown on your public page)">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12 }}>
            {[...gallery, ""].map((url, i) => (
              <ImageUpload
                key={`${i}-${url}`}
                businessId={business.id}
                label={url ? `Photo ${i + 1}` : "Add photo"}
                value={url}
                onChange={(v: string) =>
                  setGallery((g) => {
                    const next = [...g];
                    if (i >= next.length) {
                      if (v) next.push(v);
                    } else if (v) next[i] = v;
                    else next.splice(i, 1);
                    return next.slice(0, 24);
                  })
                }
                disabled={!canEdit}
              />
            ))}
          </div>
        </Field>

        <Grid2>
          <Field label="Highlights / specialties (comma separated)">
            <input
              style={input}
              placeholder="Offshore tuna, Fly fishing, Family friendly"
              value={highlights}
              onChange={(e) => setHighlights(e.target.value)}
              disabled={!canEdit}
            />
          </Field>
          <Field label="Year founded">
            <input
              style={input}
              placeholder="1998"
              inputMode="numeric"
              value={yearFounded}
              onChange={(e) => setYearFounded(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
              disabled={!canEdit}
            />
          </Field>
        </Grid2>

        <Field label="Social links">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
            {(["instagram", "facebook", "youtube", "tiktok"] as const).map((k) => (
              <input
                key={k}
                style={input}
                placeholder={`${k} link`}
                value={social[k] ?? ""}
                onChange={(e) => setSocial((s0) => ({ ...s0, [k]: e.target.value }))}
                disabled={!canEdit}
              />
            ))}
          </div>
        </Field>

        <Grid2>
          <Field label="Languages spoken">
            <input
              style={input}
              placeholder="English, Spanish"
              value={String(policies.languages ?? "")}
              onChange={(e) => setPolicies((p) => ({ ...p, languages: e.target.value }))}
              disabled={!canEdit}
            />
          </Field>
          <Field label="Payment methods accepted">
            <input
              style={input}
              placeholder="Card, bank transfer, cash on the dock"
              value={String(policies.payment_methods ?? "")}
              onChange={(e) => setPolicies((p) => ({ ...p, payment_methods: e.target.value }))}
              disabled={!canEdit}
            />
          </Field>
        </Grid2>

        <Field label="Cancellation policy">
          <textarea
            style={{ ...input, minHeight: 88, resize: "vertical", lineHeight: 1.55 }}
            placeholder="Free cancellation up to 7 days before departure…"
            value={String(policies.cancellation ?? "")}
            onChange={(e) => setPolicies((p) => ({ ...p, cancellation: e.target.value }))}
            disabled={!canEdit}
          />
        </Field>

        <Field label="Good to know / house rules">
          <textarea
            style={{ ...input, minHeight: 88, resize: "vertical", lineHeight: 1.55 }}
            placeholder="Arrive 30 minutes early, bring sunscreen, no glass bottles on board."
            value={String(policies.rules ?? "")}
            onChange={(e) => setPolicies((p) => ({ ...p, rules: e.target.value }))}
            disabled={!canEdit}
          />
        </Field>

        <Grid2>
          <Field label="Shipping policy">
            <textarea style={{ ...input, minHeight: 100, resize: "vertical" }} value={String(policies.shipping ?? "")} onChange={(e) => setPolicies((p) => ({ ...p, shipping: e.target.value }))} disabled={!canEdit} placeholder="Processing times, delivery areas and shipping expectations." />
          </Field>
          <Field label="Returns & refunds policy">
            <textarea style={{ ...input, minHeight: 100, resize: "vertical" }} value={String(policies.returns ?? "")} onChange={(e) => setPolicies((p) => ({ ...p, returns: e.target.value }))} disabled={!canEdit} placeholder="Return window, item condition and refund timing." />
          </Field>
          <Field label="Privacy policy">
            <textarea style={{ ...input, minHeight: 100, resize: "vertical" }} value={String(policies.privacy ?? "")} onChange={(e) => setPolicies((p) => ({ ...p, privacy: e.target.value }))} disabled={!canEdit} placeholder="How your shop handles customer information." />
          </Field>
          <Field label="Terms of sale">
            <textarea style={{ ...input, minHeight: 100, resize: "vertical" }} value={String(policies.terms ?? "")} onChange={(e) => setPolicies((p) => ({ ...p, terms: e.target.value }))} disabled={!canEdit} placeholder="Terms that apply to purchases from your shop." />
          </Field>
          <Field label="Privacy policy link">
            <input style={input} value={String(policies.privacy_url ?? "")} onChange={(e) => setPolicies((p) => ({ ...p, privacy_url: e.target.value }))} disabled={!canEdit} placeholder="https://…" />
          </Field>
          <Field label="Terms link">
            <input style={input} value={String(policies.terms_url ?? "")} onChange={(e) => setPolicies((p) => ({ ...p, terms_url: e.target.value }))} disabled={!canEdit} placeholder="https://…" />
          </Field>
        </Grid2>
        <Toggle label="Show the Fish-X cookie notice" hint="Uses the shared Fish-X notice on your storefront." checked={policies.cookie_notice !== false} onChange={(value) => setPolicies((p) => ({ ...p, cookie_notice: value }))} />
        <Toggle label="Offer email marketing consent" hint="Adds an optional consent choice during product checkout." checked={policies.marketing_consent !== false} onChange={(value) => setPolicies((p) => ({ ...p, marketing_consent: value }))} />

        <Field label="Frequently asked questions">
          <div style={{ display: "grid", gap: 10 }}>
            {faq.map((row, i) => (
              <div key={i} style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    style={{ ...input, flex: 1 }}
                    placeholder="Question"
                    value={row.q}
                    onChange={(e) =>
                      setFaq((f) => f.map((r, j) => (j === i ? { ...r, q: e.target.value } : r)))
                    }
                    disabled={!canEdit}
                  />
                  <button
                    type="button"
                    onClick={() => setFaq((f) => f.filter((_, j) => j !== i))}
                    disabled={!canEdit}
                    style={btn("ghost")}
                  >
                    Remove
                  </button>
                </div>
                <textarea
                  style={{ ...input, minHeight: 70, resize: "vertical" }}
                  placeholder="Answer"
                  value={row.a}
                  onChange={(e) =>
                    setFaq((f) => f.map((r, j) => (j === i ? { ...r, a: e.target.value } : r)))
                  }
                  disabled={!canEdit}
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setFaq((f) => [...f, { q: "", a: "" }])}
              disabled={!canEdit || faq.length >= 12}
              style={btn("ghost")}
            >
              + Add question
            </button>
          </div>
        </Field>

        {m.error && <Muted tone="bad">{String((m.error as Error).message)}</Muted>}

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button disabled={!canEdit || m.isPending} onClick={() => m.mutate()} style={btn("primary")}>
            {m.isPending ? "Saving…" : "Save profile"}
          </button>
          {m.isSuccess && !m.isPending && <span style={{ fontSize: 13, color: "#22C55E", fontWeight: 600 }}>Saved ✓</span>}
          {!canEdit && <Muted>Only owners and managers can edit the business profile.</Muted>}
        </div>
      </div>
    </Card>
  );
}

function toDraft(b: any): ProfileDraft {
  return {
    name: b.name ?? "",
    tagline: b.tagline ?? "",
    description: b.description ?? "",
    hero_url: b.hero_url ?? "",
    logo_url: b.logo_url ?? "",
    website: b.website ?? "",
    phone: b.phone ?? "",
    email: b.email ?? "",
    address: b.address ?? "",
    city: b.city ?? "",
    region: b.region ?? "",
    country: b.country ?? "",
  };
}

/* ---------------------------------- team --------------------------------- */

function TeamCard({
  businessId,
  team,
  myRole,
}: {
  businessId: string;
  team: any[];
  myRole: string;
}) {
  const qc = useQueryClient();
  const setRole = useServerFn(updateTeamMemberRole);
  const remove = useServerFn(removeTeamMember);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["business-settings", businessId] });

  const mRole = useMutation({
    mutationFn: (v: { memberId: string; role: "owner" | "manager" | "staff" }) =>
      setRole({ data: { businessId, ...v } }),
    onSuccess: invalidate,
  });
  const mRemove = useMutation({
    mutationFn: (memberId: string) => remove({ data: { businessId, memberId } }),
    onSuccess: invalidate,
  });

  const isOwner = myRole === "owner";

  return (
    <Card eyebrow="Access" title="Team & roles">
      <div style={{ display: "grid", gap: 10 }}>
        {isOwner && <AddMemberRow businessId={businessId} onDone={invalidate} />}
        {team.map((m) => (
          <div
            key={m.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              border: "1px solid rgba(255,255,255,.07)",
              borderRadius: 14,
              background: "#1C2936",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "#0D161F",
                color: "#F0F2F5",
                display: "grid",
                placeItems: "center",
                fontSize: 13,
                fontWeight: 700,
                overflow: "hidden",
                flex: "none",
              }}
            >
              {m.profile?.avatar_url ? (
                <MediaImg src={m.profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                (m.profile?.display_name ?? m.profile?.full_name ?? "?").slice(0, 1).toUpperCase()
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#F0F2F5" }}>
                {m.profile?.display_name ?? m.profile?.full_name ?? "Team member"}
                {m.isMe && <span style={{ color: "#92A0AB", fontWeight: 500 }}> · you</span>}
              </div>
              <div style={{ fontSize: 12, color: "#92A0AB" }}>
                Joined {new Date(m.created_at).toLocaleDateString()}
              </div>
            </div>
            <select
              value={m.role}
              disabled={!isOwner || m.isMe || mRole.isPending}
              onChange={(e) => mRole.mutate({ memberId: m.id, role: e.target.value as any })}
              style={{ ...input, width: 130, padding: "8px 10px", fontSize: 13 }}
            >
              <option value="owner">Owner</option>
              <option value="manager">Manager</option>
              <option value="staff">Staff</option>
            </select>
            {isOwner && !m.isMe && (
              <button onClick={() => mRemove.mutate(m.id)} style={btn("ghost")} disabled={mRemove.isPending}>
                Remove
              </button>
            )}
          </div>
        ))}
        {(mRole.error || mRemove.error) && (
          <Muted tone="bad">{String(((mRole.error ?? mRemove.error) as Error).message)}</Muted>
        )}
        <Muted>
          To add a teammate, ask them to create a FISH-X.COM account, then share their sign-up email with support to
          be attached to this business.
        </Muted>
      </div>
    </Card>
  );
}

/* ----------------------------- notifications ----------------------------- */

function NotificationsCard() {
  const qc = useQueryClient();
  const fetchPrefs = useServerFn(getNotificationPreferences);
  const savePrefs = useServerFn(updateNotificationPreferences);

  const { data } = useQuery({ queryKey: ["notification-prefs"], queryFn: () => fetchPrefs() });
  const m = useMutation({
    mutationFn: (v: { emailEnabled?: boolean; categories?: Record<string, boolean> }) => savePrefs({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification-prefs"] }),
  });

  if (!data) return null;
  const cats = data.categories ?? {};

  return (
    <Card eyebrow="Alerts" title="Notifications">
      <div style={{ display: "grid", gap: 12 }}>
        <Toggle
          label="Email notifications"
          hint="Turn off to receive in-app alerts only."
          checked={data.emailEnabled}
          onChange={(v) => m.mutate({ emailEnabled: v })}
        />
        <div style={{ height: 1, background: "rgba(255,255,255,.06)" }} />
        {NOTIF_CATEGORIES.map((c) => (
          <Toggle
            key={c.key}
            label={c.label}
            hint={c.hint}
            checked={cats[c.key] !== false}
            onChange={(v) => m.mutate({ categories: { ...cats, [c.key]: v } })}
          />
        ))}
      </div>
    </Card>
  );
}

/* --------------------------------- atoms --------------------------------- */

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 18, height: 18, accentColor: "#F0F2F5" }}
      />
      <span style={{ flex: 1 }}>
        <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#F0F2F5" }}>{label}</span>
        {hint && <span style={{ display: "block", fontSize: 12.5, color: "#92A0AB" }}>{hint}</span>}
      </span>
    </label>
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

function Grid2({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>{children}</div>;
}
function Grid3({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>{children}</div>;
}

function Pill({ children, tone }: { children: React.ReactNode; tone: "good" | "warn" | "neutral" }) {
  const map = {
    good: { bg: "rgba(34,197,94,.16)", c: "#22C55E" },
    warn: { bg: "rgba(169,126,60,.12)", c: "#2DE2F2" },
    neutral: { bg: "rgba(255,255,255,.06)", c: "#A9B6C1" },
  }[tone];
  return (
    <span style={{ background: map.bg, color: map.c, fontSize: 12, fontWeight: 700, padding: "5px 10px", borderRadius: 999 }}>
      {children}
    </span>
  );
}

function Muted({ children, tone }: { children: React.ReactNode; tone?: "bad" }) {
  return <div style={{ fontSize: 12.5, color: tone === "bad" ? "#F87171" : "#92A0AB" }}>{children}</div>;
}

export const input: React.CSSProperties = {
  width: "100%",
  padding: "11px 13px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,.10)",
  background: "#14202B",
  fontSize: 14,
  color: "#F0F2F5",
  fontFamily: "inherit",
  outline: "none",
};

export function btn(kind: "primary" | "ghost"): React.CSSProperties {
  return kind === "primary"
    ? {
        background: "#0D161F",
        color: "#F0F2F5",
        border: "1px solid #273744",
        borderRadius: 12,
        padding: "11px 20px",
        fontSize: 13.5,
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "inherit",
      }
    : {
        background: "transparent",
        color: "#A9B6C1",
        border: "1px solid rgba(255,255,255,.12)",
        borderRadius: 12,
        padding: "10px 16px",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: "inherit",
      };
}

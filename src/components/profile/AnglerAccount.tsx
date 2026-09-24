/**
 * Angler Account / Profile settings. Layout + copy ported from
 * /tmp/stitch/zone2/angler-profile.html (header identity card + a
 * "Personal details" form card) but re-skinned into the light `V` palette to
 * match ResolutionCenter.tsx. Only fields backed by real `profiles` columns are
 * shown — no notification prefs, no payment methods. Reads/writes the signed-in
 * angler's own row via src/lib/angler-profile.functions.ts. Email is read-only
 * (it lives in auth, not `profiles`).
 */
import { useRef, useState } from "react";
import { MediaImg } from "@/components/media/MediaImg";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile, updateMyProfile } from "@/lib/angler-profile.functions";
import { AvatarUpload } from "@/components/profile/AvatarUpload";


const V = {
  serif: "'Outfit',Georgia,serif",
  sans: "'Outfit',system-ui,sans-serif",
  ink: "#031029",
  navy: "#072057",
  paper: "#ffffff",
  card: "#ffffff",
  sand: "#2DE2F2",
  sand2: "#27C0E2",
  sandsoft: "#E2F6FA",
  goldtext: "#1F9FBE",
  cyan: "#1f9fbe",
  cyansoft: "#e2eef2",
  green: "#1f8a5b",
  greensoft: "#e2f2ea",
  red: "#d8514a",
  redsoft: "#fbe9e8",
  ond: "#eaf1f6",
  ondmut: "#93a7b7",
  tmut: "#5c6b78",
  line: "rgba(13,34,54,.10)",
  lined: "rgba(255,255,255,.12)",
};

function useToast() {
  const [toast, setToast] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (m: string) => {
    setToast(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 2400);
  };
  return { toast, showToast };
}

function Toast({ toast }: { toast: string }) {
  if (!toast) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 28,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        gap: 11,
        background: V.navy,
        color: "#fff",
        border: "1px solid rgba(255,255,255,.12)",
        borderRadius: 30,
        padding: "13px 22px",
        boxShadow: "0 20px 44px -20px rgba(0,0,0,.6)",
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: V.sand,
          color: "#04121B",
          display: "grid",
          placeItems: "center",
          fontSize: 12,
        }}
      >
        ✓
      </span>
      <span style={{ fontSize: 13.5, fontWeight: 600 }}>{toast}</span>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: V.paper, color: V.ink, fontFamily: V.sans }}>
      <header style={{ position: "sticky", top: 0, zIndex: 30, background: V.navy, color: V.ond }}>
        <div
          style={{
            maxWidth: 980,
            margin: "0 auto",
            padding: "0 28px",
            height: 62,
            display: "flex",
            alignItems: "center",
            gap: 22,
          }}
        >
          <Link
            to="/dashboard"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              color: V.ondmut,
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <span>←</span> Back
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 auto" }}>
            <BrandLogo size="sm" accent={V.sand} />
          </div>
          <span style={{ width: 60 }} />
        </div>
      </header>
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "28px 28px 64px" }}>{children}</main>
    </div>
  );
}

const label = (s: string, colors = V) => (
  <span
    style={{
      display: "block",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: ".14em",
      textTransform: "uppercase",
      color: colors.goldtext,
      marginBottom: 8,
    }}
  >
    {s}
  </span>
);

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: V.paper,
  border: `1px solid ${V.line}`,
  borderRadius: 11,
  padding: "12px 14px",
  fontFamily: V.sans,
  fontSize: 14,
  color: V.ink,
  outline: "none",
};

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("") || "?";

export function AnglerAccount({
  embedded = false,
  theme = "light",
}: {
  embedded?: boolean;
  theme?: "light" | "operator";
} = {}) {
  const { data } = useSuspenseQuery({
    queryKey: ["my-profile"],
    queryFn: () => getMyProfile(),
  });
  const queryClient = useQueryClient();
  const { toast, showToast } = useToast();
  const saveFn = useServerFn(updateMyProfile);

  const p = data.profile;
  const email = data.email;

  const [fullName, setFullName] = useState(p?.full_name ?? "");
  const [displayName, setDisplayName] = useState(p?.display_name ?? "");
  const [phone, setPhone] = useState(p?.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState(p?.avatar_url ?? "");
  const [homePort, setHomePort] = useState((p as any)?.home_port ?? "");
  const [species, setSpecies] = useState((p as any)?.favorite_species ?? "");
  const [bio, setBio] = useState((p as any)?.bio ?? "");

  const dirty =
    fullName !== (p?.full_name ?? "") ||
    displayName !== (p?.display_name ?? "") ||
    phone !== (p?.phone ?? "") ||
    avatarUrl !== (p?.avatar_url ?? "") ||
    homePort !== ((p as any)?.home_port ?? "") ||
    species !== ((p as any)?.favorite_species ?? "") ||
    bio !== ((p as any)?.bio ?? "");

  const saveMut = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          full_name: fullName,
          display_name: displayName,
          phone,
          avatar_url: avatarUrl,
          home_port: homePort,
          favorite_species: species,
          bio,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      showToast("Profile saved");
    },
    onError: (e) => showToast(e instanceof Error ? e.message : "Couldn't save your profile"),
  });

  const shownName = displayName || fullName || email || "Your account";
  const initials = initialsOf(displayName || fullName || email || "");
  const disabled = saveMut.isPending || !dirty;
  const C = theme === "operator"
    ? {
        ...V,
        ink: "#F0F2F5",
        paper: "#14202B",
        card: "#14202B",
        sandsoft: "rgba(45,226,242,.14)",
        goldtext: "#2DE2F2",
        ondmut: "#92A0AB",
        tmut: "#92A0AB",
        line: "rgba(255,255,255,.10)",
      }
    : V;
  const fieldStyle: React.CSSProperties = {
    ...inputStyle,
    background: C.paper,
    border: `1px solid ${C.line}`,
    color: C.ink,
  };

  const Wrap = embedded
    ? ({ children }: { children: React.ReactNode }) => <>{children}</>
    : Shell;

  return (
    <Wrap>
      {!embedded && (
        <>
          <h1
            style={{
              fontFamily: V.serif,
              fontWeight: 600,
              fontSize: 30,
              letterSpacing: "-.01em",
              margin: "0 0 6px",
              color: C.ink,
            }}
          >
            Manage account
          </h1>
          <p style={{ fontSize: 14, color: C.tmut, margin: "0 0 22px" }}>
            Update how you appear to captains and how they can reach you.
          </p>
        </>
      )}


      {/* Identity header card */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          background: C.card,
          border: `1px solid ${C.line}`,
          borderRadius: 20,
          padding: 22,
          marginBottom: 22,
          flexWrap: "wrap",
        }}
      >
        {avatarUrl ? (
          <MediaImg
            src={avatarUrl}
            alt=""
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              objectFit: "cover",
              flex: "none",
              border: `2px solid ${C.sandsoft}`,
            }}
          />
        ) : (
          <span
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: C.sandsoft,
              color: C.goldtext,
              display: "grid",
              placeItems: "center",
              fontFamily: V.serif,
              fontSize: 26,
              fontWeight: 600,
              flex: "none",
            }}
          >
            {initials}
          </span>
        )}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: V.serif,
              fontSize: 24,
              fontWeight: 600,
              color: C.ink,
              lineHeight: 1.1,
            }}
          >
            {shownName}
          </div>
          <div style={{ fontSize: 13, color: C.tmut, marginTop: 4 }}>
            {email ?? "No email on file"}
            <span
              style={{
                marginLeft: 8,
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: C.ondmut,
              }}
            >
              · Sign-in email
            </span>
          </div>
        </div>
      </div>

      {/* Personal details card */}
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.line}`,
          borderRadius: 20,
          padding: 26,
        }}
      >
        <div
          style={{
            fontFamily: V.serif,
            fontSize: 18,
            fontWeight: 600,
            color: C.ink,
            marginBottom: 20,
          }}
        >
          Personal details
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 18 }}>
          <div>
            {label("Full name", C)}
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={120}
              placeholder="Alex Chen"
              style={fieldStyle}
            />
          </div>
          <div>
            {label("Display name", C)}
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={80}
              placeholder="How captains see you"
              style={fieldStyle}
            />
          </div>
          <div>
            {label("Phone number", C)}
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={40}
              placeholder="+1 (305) 555-0129"
              style={fieldStyle}
            />
          </div>
          <div>
            {label("Email address", C)}
            <input
              value={email ?? ""}
              disabled
              readOnly
              placeholder="—"
              style={{ ...fieldStyle, color: C.tmut, cursor: "not-allowed", opacity: 0.75 }}
            />
          </div>
          <div>
            {label("Home port / city", C)}
            <input
              value={homePort}
              onChange={(e) => setHomePort(e.target.value)}
              maxLength={120}
              placeholder="Key West, FL"
              style={fieldStyle}
            />
          </div>
          <div>
            {label("Species you chase", C)}
            <input
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
              maxLength={160}
              placeholder="Tarpon, permit, mahi"
              style={fieldStyle}
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            {label("About you", C)}
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={600}
              rows={4}
              placeholder="A short intro captains and shops will see when you book."
              style={{ ...fieldStyle, minHeight: 104, resize: "vertical", lineHeight: 1.55 }}
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            {label("Profile photo", C)}
            <AvatarUpload
              userId={data.viewerId}
              value={avatarUrl}
              onChange={setAvatarUrl}
              fallback={initials}
            />
          </div>

        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
          <button
            onClick={() => saveMut.mutate()}
            disabled={disabled}
            style={{
              background: C.sand,
              color: "#04121B",
              border: 0,
              borderRadius: 12,
              padding: "13px 28px",
              fontFamily: V.sans,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: ".06em",
              textTransform: "uppercase",
              cursor: disabled ? "default" : "pointer",
              opacity: disabled ? 0.55 : 1,
            }}
          >
            {saveMut.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
      <Toast toast={toast} />
    </Wrap>
  );
}

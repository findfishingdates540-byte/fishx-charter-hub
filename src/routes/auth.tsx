import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type PointerEvent } from "react";
import { flushSync } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { resolveAsset } from "@/lib/dc-template";
import { sendSignupConfirmation } from "@/lib/auth-emails.functions";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

type Vertical = "captain" | "tackle" | "marina" | "manufacturer" | "apparel" | "guide" | "";
type View = "login" | "signup";
type Step = "intent" | "angler" | "vertical" | "business";
type Status = "idle" | "submitting" | "done" | "confirm";
type DoneKind = "login" | "angler" | "business";

const vLabels: Record<Exclude<Vertical, "">, string> = {
  captain: "Charter captain", tackle: "Tackle shop", marina: "Marina",
  manufacturer: "Gear manufacturer", apparel: "Apparel brand", guide: "Guide service",
};
const vBizName: Record<Exclude<Vertical, "">, string> = {
  captain: "Charter / boat name", tackle: "Shop name", marina: "Marina name",
  manufacturer: "Company name", apparel: "Brand name", guide: "Guide service name",
};
const vBizPlaceholder: Record<Exclude<Vertical, "">, string> = {
  captain: "e.g. Sterling Sportfishing", tackle: "e.g. Reel Deal Tackle",
  marina: "e.g. Blue Harbor Marina", manufacturer: "e.g. Apex Rod Co.",
  apparel: "e.g. Tidewater Apparel", guide: "e.g. Backcountry Guides",
};

// -------- reusable style fragments --------
// Confirmation/OAuth links must always land on the live site, never on a
// preview or editor host. Local dev still redirects to localhost.
const appOrigin = () =>
  typeof window !== "undefined" && window.location.origin.includes("localhost")
    ? window.location.origin
    : "https://www.bookfishingtrips.com";

const cssVars: CSSProperties = {
  // @ts-expect-error custom props
  "--serif": "'Outfit',Georgia,serif",
  "--sans": "'Outfit',system-ui,sans-serif",
  "--ink": "#031029", "--navy": "#072057", "--deep": "#031029",
  "--paper": "#f4f6f8", "--paper2": "#e9edf1", "--card": "#ffffff",
  "--sand": "#2DE2F2", "--sand2": "#27C0E2", "--sandsoft": "#DFF6FA", "--goldtext": "#1F9FBE",
  "--cyan": "#27c0e2", "--ond": "#eaf1f6", "--ondmut": "#9bb0c0", "--tmut": "#5c6b78",
  "--line": "rgba(13,34,54,.12)", "--lined": "rgba(255,255,255,.13)",
};

const inputStyle: CSSProperties = {
  width: "100%", background: "var(--card)", border: "1px solid var(--line)",
  borderRadius: 11, padding: "13px 14px", fontFamily: "var(--sans)",
  fontSize: 15, color: "var(--ink)", outline: "none",
  transition: "border-color .2s, box-shadow .2s",
};
const labelSpan: CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".12em",
  textTransform: "uppercase", color: "var(--tmut)", marginBottom: 7,
};
const primaryBtn: CSSProperties = {
  width: "100%", background: "var(--sand)", color: "#04121B", border: 0,
  borderRadius: 12, padding: 16, fontFamily: "var(--sans)", fontSize: 14,
  fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase",
  cursor: "pointer", marginTop: 4, transition: "filter .2s, transform .2s",
};
const socialDark: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
  width: "100%", background: "#0d1117", color: "#fff", border: 0,
  borderRadius: 12, padding: 14, fontFamily: "var(--sans)", fontSize: 14,
  fontWeight: 600, cursor: "pointer", transition: "transform .2s",
};
const socialLight: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
  width: "100%", background: "var(--card)", color: "var(--ink)",
  border: "1px solid var(--line)", borderRadius: 12, padding: 14,
  fontFamily: "var(--sans)", fontSize: 14, fontWeight: 600, cursor: "pointer",
  transition: "border-color .2s, transform .2s",
};
const googleDot: CSSProperties = {
  width: 18, height: 18, borderRadius: "50%",
  background: "conic-gradient(from -40deg,#ea4335,#fbbc05,#34a853,#4285f4,#ea4335)",
  display: "inline-block",
};
const dividerRow = (
  <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "20px 0" }}>
    <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--tmut)" }}>or with email</span>
    <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
  </div>
);

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(220,80,70,.08)", border: "1px solid rgba(220,80,70,.28)", borderRadius: 11, padding: "11px 14px" }}>
      <span style={{ width: 18, height: 18, borderRadius: "50%", border: "1.5px solid #d8514a", color: "#d8514a", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, flex: "none" }}>!</span>
      <span style={{ fontSize: 13.5, color: "#a23a34" }}>{msg}</span>
    </div>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" }) as { view?: string };
  const [view, setView] = useState<View>(search.view === "signup" ? "signup" : "login");
  const [step, setStep] = useState<Step>("intent");
  const [vertical, setVertical] = useState<Vertical>("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [doneKind, setDoneKind] = useState<DoneKind>("login");
  // "Check your inbox" screen: keep the email so the user can request a new link.
  const [confirmEmail, setConfirmEmail] = useState("");
  const [resendIn, setResendIn] = useState(60);
  const [resendMsg, setResendMsg] = useState("");

  // Already signed in? Skip the sign-in form entirely.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) navigate({ to: "/dashboard", replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    document.body.classList.add("dc-body");
    return () => document.body.classList.remove("dc-body");
  }, []);

  const isLogin = view === "login";
  const atIntent = view === "signup" && step === "intent";
  const atAngler = view === "signup" && step === "angler";
  const atVertical = view === "signup" && step === "vertical";
  const atBusiness = view === "signup" && step === "business";
  const showBack = view === "signup" && step !== "intent";
  const stepLabel = atAngler ? "Step 2 of 2" : atVertical ? "Step 2 of 3" : atBusiness ? "Step 3 of 3" : "";
  const isSubmitting = status === "submitting";
  const isDone = status === "done";
  const isConfirm = status === "confirm";
  const pwType = showPw ? "text" : "password";
  const pwToggleLabel = showPw ? "Hide" : "Show";

  useEffect(() => {
    if (!isDone) return;
    const timer = setTimeout(() => {
      navigate({ to: "/dashboard" });
    }, 1200);
    return () => clearTimeout(timer);
  }, [isDone, doneKind, navigate]);

  // 60-second cooldown on the "Resend email" button (Supabase rate-limits
  // repeated resend calls, so the button waits it out).
  useEffect(() => {
    if (!isConfirm || resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [isConfirm, resendIn]);

  // Resends go through our own sender (Resend, verified domain) — the initial
  // sign-up email comes from Supabase's signUp() call, only once.
  const sendConfirmation = async (email: string, bizKind: "angler" | "business") => {
    const result = await sendSignupConfirmation({ data: { email, kind: bizKind } });
    return result.sent;
  };

  const handleResend = async () => {
    if (!confirmEmail || resendIn > 0) return;
    setResendMsg("");
    setResendIn(60);
    try {
      const sent = await sendConfirmation(confirmEmail, doneKind === "business" ? "business" : "angler");
      if (sent) {
        setResendMsg("New link sent — check your inbox (and spam folder).");
      } else {
        setResendIn(0);
        setResendMsg("Couldn't send right now — wait a moment and try again.");
      }
    } catch {
      setResendIn(0);
      setResendMsg("Couldn't send right now — wait a moment and try again.");
    }
  };

  const doneTitle = doneKind === "business" ? "Workspace created" : doneKind === "angler" ? "Account created" : "You’re in";
  const doneMsg = doneKind === "business"
    ? "Welcome aboard. Complete a few quick steps to get verified and start selling."
    : doneKind === "angler"
      ? "Welcome aboard — let’s find your first charter."
      : "Welcome back — the water’s calling.";
  const doneCta = doneKind === "business" ? "Go to dashboard" : "Enter Fish-X";
  const submittingTitle = doneKind === "business" ? "Creating your workspace…" : "Securing your account…";

  const switchView = (nextView: View) => {
    flushSync(() => {
      setView(nextView);
      setStep("intent");
      setError("");
      setStatus("idle");
    });
  };
  const setLogin = () => switchView("login");
  const setSignup = () => switchView("signup");
  const setLoginNow = (event: PointerEvent<HTMLButtonElement>) => { event.preventDefault(); setLogin(); };
  const setSignupNow = (event: PointerEvent<HTMLButtonElement>) => { event.preventDefault(); setSignup(); };
  const goAngler = () => { setStep("angler"); setError(""); };
  const goBusiness = () => { setStep("vertical"); setError(""); };
  const pickVertical = (v: Exclude<Vertical, "">) => { setVertical(v); setStep("business"); setError(""); };
  const back = () => {
    if (step === "business") { setStep("vertical"); setError(""); }
    else if (step === "vertical" || step === "angler") { setStep("intent"); setError(""); }
  };
  const togglePw = () => setShowPw(v => !v);
  const clearError = () => { if (error) setError(""); };
  const reset = () => { setView("login"); setStep("intent"); setStatus("idle"); setError(""); };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const val = (name: string) => String((form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? "").trim();
    const checked = (name: string) => !!(form.elements.namedItem(name) as HTMLInputElement | null)?.checked;
    const email = val("email");
    const pw = val("password");
    const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
    let kind: DoneKind = "login";

    if (isLogin) {
      if (!emailOk) return setError("Please enter a valid email address.");
      if (pw.length < 6) return setError("Please enter your password.");
      kind = "login";
    } else if (atAngler) {
      if (!val("name")) return setError("Please enter your name.");
      if (!emailOk) return setError("Please enter a valid email address.");
      if (pw.length < 8) return setError("Password must be at least 8 characters.");
      if (!checked("terms")) return setError("Please accept the terms to continue.");
      kind = "angler";
    } else if (atBusiness) {
      if (!val("name")) return setError("Please enter your name.");
      if (!emailOk) return setError("Please enter a valid work email.");
      if (pw.length < 8) return setError("Password must be at least 8 characters.");
      if (!val("bizName")) return setError("Please enter your business name.");
      if (!val("location")) return setError("Please add your location.");
      if (!checked("terms")) return setError("Please accept the terms to continue.");
      kind = "business";
    }

    setError("");
    setStatus("submitting");
    setDoneKind(kind);

    const origin = appOrigin();
    try {
      if (kind === "login") {
        const { error: e2 } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (e2) throw e2;
      } else if (kind === "angler") {
        const { data: signData, error: e2 } = await supabase.auth.signUp({
          email, password: pw,
          options: {
            emailRedirectTo: `${origin}/dashboard`,
            data: { intended_role: "angler", full_name: val("name") },
          },
        });
        if (e2) throw e2;
        // Email confirmation is on: no session yet. Show the check-your-inbox
        // screen; the link in the email opens /dashboard once confirmed.
        if (!signData.session) {
          setConfirmEmail(email); setResendIn(60); setResendMsg(""); setStatus("confirm"); return;
        }
      } else {
        // The vertical picked at signup becomes the account's role, so the
        // operator always lands on the matching workspace.
        const VERTICAL_ROLE: Record<string, string> = {
          captain: "captain",
          tackle: "tackle_shop",
          marina: "marina",
          manufacturer: "gear_mfg",
          apparel: "apparel",
          guide: "guide_service",
        };
        const intendedRole = VERTICAL_ROLE[vertical] ?? "business_owner";
        const { data: signData, error: e2 } = await supabase.auth.signUp({
          email, password: pw,
          options: {
            emailRedirectTo: `${origin}/onboarding`,
            data: {
              intended_role: intendedRole, full_name: val("name"),
              vertical, business_name: val("bizName"),
              location: val("location"), vertical_detail: val("detail"),
            },
          },
        });
        if (e2) throw e2;
        // Same confirmation rule for operators: the email link opens
        // /onboarding, and finishing setup routes to their console.
        if (!signData.session) {
          setConfirmEmail(email); setResendIn(60); setResendMsg(""); setStatus("confirm"); return;
        }
      }
      setStatus("done");
    } catch (err) {
      setStatus("idle");
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    }
  };

  const handleDoneCta = () => {
    if (doneKind === "business") navigate({ to: "/onboarding" });
    else navigate({ to: "/dashboard" });
  };

  const oauth = async (provider: "google" | "apple", role?: "angler") => {
    setError("");
    setStatus("submitting");
    setDoneKind(role ? "angler" : "login");
    try {
      // Google/Apple refuse to render inside an iframe (the editor preview),
      // so there we hand the sign-in page to a new tab instead of redirecting.
      const inFrame = typeof window !== "undefined" && window.top !== window.self;
      const { data: oauthData, error: e2 } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          // Must be a public page; /auth sends signed-in users on to /dashboard.
          redirectTo: `${window.location.origin}/auth`,
          skipBrowserRedirect: inFrame,
          queryParams: provider === "google" ? { prompt: "select_account" } : undefined,
          ...(role ? { data: { intended_role: role } } : {}),
        },
      });
      if (e2) throw e2;
      if (inFrame && oauthData?.url) {
        window.open(oauthData.url, "_blank", "noopener,noreferrer");
        setStatus("idle");
      }
    } catch (err) {
      setStatus("idle");
      setError(err instanceof Error ? err.message : "OAuth sign-in failed. Try again.");
    }
  };

  const pwField = (autoComplete: string, placeholder: string) => (
    <label style={{ display: "block" }}>
      <span style={labelSpan}>Password</span>
      <span style={{ position: "relative", display: "block" }}>
        <input name="password" type={pwType} autoComplete={autoComplete} placeholder={placeholder} onInput={clearError}
          style={{ ...inputStyle, padding: "13px 64px 13px 14px" }} />
        <button type="button" onClick={togglePw}
          style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "transparent", border: 0, color: "var(--tmut)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "8px 10px" }}>
          {pwToggleLabel}
        </button>
      </span>
    </label>
  );

  const asset = useMemo(() => ({
    seascape: resolveAsset("seascape.jpg"),
    james: resolveAsset("james.jpg"),
  }), []);

  return (
    <div className="dc-auth" style={{
      ...cssVars, minHeight: "100vh", display: "grid",
      gridTemplateColumns: "repeat(auto-fit,minmax(min(468px,100%),1fr))",
      fontFamily: "var(--sans)", color: "var(--ink)",
    }}>
      {/* ============ BRAND PANEL ============ */}
      <aside style={{ position: "relative", overflow: "hidden", background: "var(--navy)", color: "var(--ond)", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "46px 54px", minHeight: "100vh" }}>
        <img src={asset.seascape} alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 38%", opacity: .24 }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(155deg,rgba(6,21,31,.74) 0%,rgba(8,28,46,.88) 55%,rgba(6,21,31,.97) 100%)" }} />
        <div style={{ position: "absolute", top: -140, right: -120, width: 480, height: 480, background: "radial-gradient(circle,rgba(45,226,242,.16),rgba(45,226,242,0) 62%)", pointerEvents: "none" }} />

        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none", color: "var(--ond)" }}>
            <BrandLogo size="md" accent="var(--sand)" color="var(--ond)" />
          </a>
          <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "var(--ondmut)", textDecoration: "none", fontSize: 13, fontWeight: 500, border: "1px solid var(--lined)", borderRadius: 30, padding: "8px 14px" }}>
            <span>←</span> Back to site
          </a>
        </div>

        <div style={{ position: "relative", maxWidth: 440 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--sand)" }}>The fishing-industry platform</span>
          <h1 style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: "clamp(38px,4.4vw,54px)", lineHeight: 1.04, letterSpacing: "-.015em", margin: "16px 0 22px", color: "#fbfdff" }}>Where the fishing industry does business.</h1>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {["Charters, tackle, marinas & wholesale in one place", "Verified operators across every category", "Every transaction secured by escrow"].map((t) => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 15, color: "var(--ond)" }}>
                <span style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(45,226,242,.14)", display: "grid", placeItems: "center", color: "var(--sand)", fontSize: 13, flex: "none" }}>✓</span>
                {t}
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: "relative", background: "rgba(255,255,255,.06)", border: "1px solid var(--lined)", borderRadius: 16, padding: "20px 22px", backdropFilter: "blur(6px)", maxWidth: 440 }}>
          <div style={{ color: "var(--sand)", fontSize: 13, letterSpacing: 2, marginBottom: 10 }}>★★★★★</div>
          <p style={{ fontFamily: "var(--serif)", fontSize: 18, lineHeight: 1.4, color: "#fff", margin: "0 0 16px", fontWeight: 500 }}>
            “Fish-X put my bookings, my gear orders and my payouts in one place — and I never chase a deposit anymore.”
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <img src={asset.james} alt="Capt. James Sterling" style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", objectPosition: "50% 30%", border: "1px solid var(--lined)" }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Capt. James Sterling</div>
              <div style={{ fontSize: 12, color: "var(--ondmut)" }}>Charter operator · Florida Keys</div>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 600, color: "var(--sand)", lineHeight: 1 }}>$40M+</div>
              <div style={{ fontSize: 10.5, color: "var(--ondmut)" }}>secured in escrow</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ============ FORM / WIZARD PANEL ============ */}
      <main style={{ position: "relative", background: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 40px", minHeight: "100vh" }}>
        <div style={{ width: "100%", maxWidth: 462 }}>
          {/* Top control */}
          {(isLogin || atIntent) && (
            <div style={{ display: "flex", gap: 4, background: "var(--paper2)", border: "1px solid var(--line)", borderRadius: 14, padding: 5, marginBottom: 32 }}>
              <button type="button" onPointerDown={setLoginNow} onClick={setLogin} style={{ flex: 1, background: isLogin ? "var(--card)" : "transparent", boxShadow: isLogin ? "0 4px 14px -6px rgba(13,34,54,.35)" : "none", border: 0, borderRadius: 10, cursor: "pointer", padding: "12px 0", fontFamily: "var(--sans)", fontSize: 14, fontWeight: 600, color: isLogin ? "var(--ink)" : "var(--tmut)", transition: "none" }}>Sign in</button>
              <button type="button" onPointerDown={setSignupNow} onClick={setSignup} style={{ flex: 1, background: isLogin ? "transparent" : "var(--card)", boxShadow: isLogin ? "none" : "0 4px 14px -6px rgba(13,34,54,.35)", border: 0, borderRadius: 10, cursor: "pointer", padding: "12px 0", fontFamily: "var(--sans)", fontSize: 14, fontWeight: 600, color: isLogin ? "var(--tmut)" : "var(--ink)", transition: "none" }}>Create account</button>
            </div>
          )}
          {showBack && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 26 }}>
              <button onClick={back} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "transparent", border: "1px solid var(--line)", borderRadius: 30, padding: "9px 15px", cursor: "pointer", fontFamily: "var(--sans)", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                <span style={{ fontSize: 15 }}>←</span> Back
              </button>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--goldtext)" }}>{stepLabel}</span>
            </div>
          )}

          {/* ===== LOGIN ===== */}
          {isLogin && (
            <div>
              <div style={{ marginBottom: 22 }}>
                <h2 style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 33, letterSpacing: "-.01em", margin: "0 0 6px", color: "var(--ink)" }}>Welcome back.</h2>
                <p style={{ fontSize: 15, color: "var(--tmut)", margin: 0 }}>Sign in to manage your listings, bookings and payouts.</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                <button type="button" onClick={() => oauth("apple")} disabled={isSubmitting} style={{ ...socialDark, opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? "wait" : "pointer" }}><span style={{ fontSize: 16 }}></span> Continue with Apple</button>
                <button type="button" onClick={() => oauth("google")} disabled={isSubmitting} style={{ ...socialLight, opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? "wait" : "pointer" }}><span style={googleDot} /> Continue with Google</button>
              </div>
              {dividerRow}
              <form onSubmit={submit} noValidate style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                <label style={{ display: "block" }}>
                  <span style={labelSpan}>Email address</span>
                  <input name="email" type="email" autoComplete="email" placeholder="you@email.com" onInput={clearError} style={inputStyle} />
                </label>
                <label style={{ display: "block" }}>
                  <span style={{ ...labelSpan, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    Password <a href="#" style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".02em", textTransform: "none", color: "var(--goldtext)", textDecoration: "none" }}>Forgot?</a>
                  </span>
                  <span style={{ position: "relative", display: "block" }}>
                    <input name="password" type={pwType} autoComplete="current-password" placeholder="••••••••" onInput={clearError}
                      style={{ ...inputStyle, padding: "13px 64px 13px 14px" }} />
                    <button type="button" onClick={togglePw}
                      style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "transparent", border: 0, color: "var(--tmut)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "8px 10px" }}>{pwToggleLabel}</button>
                  </span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginTop: -2 }}>
                  <input name="remember" type="checkbox" style={{ width: 18, height: 18, accentColor: "#1F9FBE", cursor: "pointer" }} />
                  <span style={{ fontSize: 13.5, color: "var(--tmut)" }}>Keep me signed in</span>
                </label>
                {error && <ErrorBox msg={error} />}
                <button type="submit" disabled={isSubmitting} style={{ ...primaryBtn, opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? "wait" : "pointer" }}>{isSubmitting ? "Signing in…" : "Sign in →"}</button>
              </form>
              <div style={{ textAlign: "center", marginTop: 22, fontSize: 14, color: "var(--tmut)" }}>
                New to Fish-X?{" "}
                <button onClick={setSignup} style={{ background: "transparent", border: 0, cursor: "pointer", fontFamily: "var(--sans)", fontSize: 14, fontWeight: 700, color: "var(--ink)", textDecoration: "underline", textDecorationColor: "var(--sand)", textUnderlineOffset: 3 }}>Create an account</button>
              </div>
            </div>
          )}

          {/* ===== INTENT ===== */}
          {atIntent && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 33, letterSpacing: "-.01em", margin: "0 0 6px", color: "var(--ink)" }}>Join Fish-X.</h2>
                <p style={{ fontSize: 15, color: "var(--tmut)", margin: 0 }}>First, tell us how you’ll use the platform.</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <button onClick={goAngler} style={{ display: "flex", alignItems: "center", gap: 18, textAlign: "left", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: 22, cursor: "pointer", fontFamily: "var(--sans)", transition: "transform .25s,box-shadow .25s,border-color .25s" }}>
                  <span style={{ width: 52, height: 52, flex: "none", borderRadius: 14, background: "var(--sandsoft)", display: "grid", placeItems: "center", color: "var(--goldtext)" }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 12c3-5 8-7 13-7 2 0 3.5 2 3.5 2s2 0 2 1-1.5 2-3 2c0 0-.5 3-3 5-4 3-12 1-15-1 2 0 3-1 3-3z" /><circle cx="16.5" cy="9.5" r=".9" fill="currentColor" stroke="none" /></svg>
                  </span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: "block", fontFamily: "var(--serif)", fontSize: 21, fontWeight: 600, color: "var(--ink)" }}>I’m an angler</span>
                    <span style={{ display: "block", fontSize: 14, color: "var(--tmut)", marginTop: 2 }}>Book charters, buy gear, and manage your trips.</span>
                  </span>
                  <span style={{ color: "var(--goldtext)", fontSize: 20 }}>→</span>
                </button>
                <button onClick={goBusiness} style={{ display: "flex", alignItems: "center", gap: 18, textAlign: "left", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: 22, cursor: "pointer", fontFamily: "var(--sans)", transition: "transform .25s,box-shadow .25s,border-color .25s" }}>
                  <span style={{ width: 52, height: 52, flex: "none", borderRadius: 14, background: "var(--navy)", display: "grid", placeItems: "center", color: "var(--sand)" }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="8" width="18" height="12" rx="2" /><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" /></svg>
                  </span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: "block", fontFamily: "var(--serif)", fontSize: 21, fontWeight: 600, color: "var(--ink)" }}>I run a fishing business</span>
                    <span style={{ display: "block", fontSize: 14, color: "var(--tmut)", marginTop: 2 }}>List services or products and get paid through escrow.</span>
                  </span>
                  <span style={{ color: "var(--goldtext)", fontSize: 20 }}>→</span>
                </button>
              </div>
              <div style={{ textAlign: "center", marginTop: 24, fontSize: 14, color: "var(--tmut)" }}>
                Already have an account?{" "}
                <button onClick={setLogin} style={{ background: "transparent", border: 0, cursor: "pointer", fontFamily: "var(--sans)", fontSize: 14, fontWeight: 700, color: "var(--ink)", textDecoration: "underline", textDecorationColor: "var(--sand)", textUnderlineOffset: 3 }}>Sign in</button>
              </div>
            </div>
          )}

          {/* ===== ANGLER ===== */}
          {atAngler && (
            <div>
              <div style={{ marginBottom: 22 }}>
                <h2 style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 33, letterSpacing: "-.01em", margin: "0 0 6px", color: "var(--ink)" }}>Create your angler account.</h2>
                <p style={{ fontSize: 15, color: "var(--tmut)", margin: 0 }}>Book verified charters and gear in minutes.</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                <button type="button" onClick={() => oauth("apple", "angler")} disabled={isSubmitting} style={{ ...socialDark, opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? "wait" : "pointer" }}><span style={{ fontSize: 16 }}></span> Sign up with Apple</button>
                <button type="button" onClick={() => oauth("google", "angler")} disabled={isSubmitting} style={{ ...socialLight, opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? "wait" : "pointer" }}><span style={googleDot} /> Sign up with Google</button>
              </div>
              {dividerRow}
              <form onSubmit={submit} noValidate style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                <label style={{ display: "block" }}><span style={labelSpan}>Full name</span><input name="name" type="text" autoComplete="name" placeholder="Alexander Sterling" onInput={clearError} style={inputStyle} /></label>
                <label style={{ display: "block" }}><span style={labelSpan}>Email address</span><input name="email" type="email" autoComplete="email" placeholder="you@email.com" onInput={clearError} style={inputStyle} /></label>
                {pwField("new-password", "At least 8 characters")}
                <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                  <input name="terms" type="checkbox" style={{ width: 18, height: 18, marginTop: 1, accentColor: "#1F9FBE", flex: "none", cursor: "pointer" }} />
                  <span style={{ fontSize: 13, lineHeight: 1.5, color: "var(--tmut)" }}>I agree to the <a href="#" style={{ color: "var(--goldtext)", textDecoration: "none", fontWeight: 600 }}>Terms</a> and <a href="#" style={{ color: "var(--goldtext)", textDecoration: "none", fontWeight: 600 }}>Privacy Policy</a>.</span>
                </label>
                {error && <ErrorBox msg={error} />}
                <button type="submit" disabled={isSubmitting} style={{ ...primaryBtn, opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? "wait" : "pointer" }}>{isSubmitting ? "Creating account…" : "Create account →"}</button>
              </form>
            </div>
          )}

          {/* ===== VERTICAL PICKER ===== */}
          {atVertical && (
            <div>
              <div style={{ marginBottom: 22 }}>
                <h2 style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 33, letterSpacing: "-.01em", margin: "0 0 6px", color: "var(--ink)" }}>What kind of business?</h2>
                <p style={{ fontSize: 15, color: "var(--tmut)", margin: 0 }}>We’ll tailor your setup and only ask for what you need.</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <VerticalCard label="Charter captain" sub="Trips, bookings & payouts" onClick={() => pickVertical("captain")}
                  svg={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3v18M12 21c-4 0-7-3-7-7h14c0 4-3 7-7 7zM5 9l7-3 7 3" /><circle cx="12" cy="4" r="1.4" /></svg>} />
                <VerticalCard label="Tackle shop" sub="Sell gear online & in-store" onClick={() => pickVertical("tackle")}
                  svg={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M20.6 13.4 12 4.8V4H5v7h.8l8.6 8.6a2 2 0 0 0 2.8 0l3.4-3.4a2 2 0 0 0 0-2.8z" /><circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" /></svg>} />
                <VerticalCard label="Marina" sub="Slips, moorage & services" onClick={() => pickVertical("marina")}
                  svg={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="5" r="2" /><path d="M12 7v13M8 11H5a7 7 0 0 0 14 0h-3M12 20a7 7 0 0 1-4-1.3M12 20a7 7 0 0 0 4-1.3" /></svg>} />
                <VerticalCard label="Gear manufacturer" sub="Wholesale & distribution" onClick={() => pickVertical("manufacturer")}
                  svg={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 21V9l6 3V9l6 3V9l6 3v9z" /><path d="M3 21h18" /></svg>} />
                <VerticalCard label="Apparel brand" sub="Retail & wholesale" onClick={() => pickVertical("apparel")}
                  svg={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M8 3 4 6l2 3 2-1v10h8V8l2 1 2-3-4-3-2 2h-4z" /></svg>} />
                <VerticalCard label="Guide service" sub="Guided trips & bookings" onClick={() => pickVertical("guide")}
                  svg={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" fill="currentColor" stroke="none" /></svg>} />
              </div>
            </div>
          )}

          {/* ===== BUSINESS ===== */}
          {atBusiness && vertical && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--sandsoft)", borderRadius: 30, padding: "6px 13px", marginBottom: 14 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--goldtext)" }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--goldtext)" }}>{vLabels[vertical]}</span>
                </div>
                <h2 style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 31, letterSpacing: "-.01em", margin: "0 0 6px", color: "var(--ink)" }}>Set up your business.</h2>
                <p style={{ fontSize: 14.5, color: "var(--tmut)", margin: 0 }}>Just the essentials — you can add verification and listings next.</p>
              </div>
              <form onSubmit={submit} noValidate style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--goldtext)" }}>Your details</div>
                <label style={{ display: "block" }}><span style={labelSpan}>Your name</span><input name="name" type="text" autoComplete="name" placeholder="Alexander Sterling" onInput={clearError} style={inputStyle} /></label>
                <label style={{ display: "block" }}><span style={labelSpan}>Work email</span><input name="email" type="email" autoComplete="email" placeholder="you@yourbusiness.com" onInput={clearError} style={inputStyle} /></label>
                {pwField("new-password", "At least 8 characters")}
                <div style={{ height: 1, background: "var(--line)", margin: "4px 0" }} />
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--goldtext)" }}>Your business</div>
                <label style={{ display: "block" }}><span style={labelSpan}>{vBizName[vertical]}</span><input name="bizName" type="text" placeholder={vBizPlaceholder[vertical]} onInput={clearError} style={inputStyle} /></label>
                <label style={{ display: "block" }}><span style={labelSpan}>{vertical === "manufacturer" || vertical === "apparel" ? "Headquarters" : "Location"}</span><input name="location" type="text" placeholder="City, region or country" onInput={clearError} style={inputStyle} /></label>

                <VerticalDetail vertical={vertical} />

                <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                  <input name="terms" type="checkbox" style={{ width: 18, height: 18, marginTop: 1, accentColor: "#1F9FBE", flex: "none", cursor: "pointer" }} />
                  <span style={{ fontSize: 13, lineHeight: 1.5, color: "var(--tmut)" }}>I agree to the <a href="#" style={{ color: "var(--goldtext)", textDecoration: "none", fontWeight: 600 }}>Terms</a>, <a href="#" style={{ color: "var(--goldtext)", textDecoration: "none", fontWeight: 600 }}>Privacy Policy</a> and seller agreement.</span>
                </label>
                {error && <ErrorBox msg={error} />}
                <button type="submit" disabled={isSubmitting} style={{ ...primaryBtn, opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? "wait" : "pointer" }}>{isSubmitting ? "Creating workspace…" : "Create workspace →"}</button>
              </form>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 22, color: "var(--tmut)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="4" y="10" width="16" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
            <span style={{ fontSize: 11.5, letterSpacing: ".04em" }}>Secured with bank-level encryption & escrow</span>
          </div>
        </div>

        {/* Submitting overlay */}
        {isSubmitting && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(244,246,248,.84)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ position: "relative", width: 74, height: 74, margin: "0 auto 22px" }}>
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid var(--line)" }} />
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid transparent", borderTopColor: "var(--cyan)", animation: "fx-spin 1s linear infinite" }} />
                <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--ink)" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="4" y="10" width="16" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
                </div>
              </div>
              <div style={{ fontFamily: "var(--serif)", fontSize: 25, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>{submittingTitle}</div>
              <div style={{ fontSize: 14, color: "var(--tmut)" }}>Encrypting your details and setting up escrow.</div>
            </div>
          </div>
        )}

        {/* Success overlay */}
        {isDone && (
          <div style={{ position: "absolute", inset: 0, background: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 6 }}>
            <div style={{ textAlign: "center", maxWidth: 380, padding: "0 30px" }}>
              <div style={{ width: 78, height: 78, borderRadius: "50%", background: "var(--sandsoft)", display: "grid", placeItems: "center", margin: "0 auto 24px", animation: "fx-pop .5s both" }}>
                <span style={{ color: "var(--goldtext)", fontSize: 34 }}>✓</span>
              </div>
              <h2 style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 31, letterSpacing: "-.01em", margin: "0 0 10px", color: "var(--ink)" }}>{doneTitle}</h2>
              <p style={{ fontSize: 15.5, lineHeight: 1.55, color: "var(--tmut)", margin: "0 0 26px" }}>{doneMsg}</p>
              {doneKind === "business" && (
                <div style={{ textAlign: "left", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: "18px 20px", marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--goldtext)", marginBottom: 12 }}>Next: get verified to go live</div>
                  {["Upload license & insurance", "Connect payouts & escrow", "Add your first listing"].map((t, i) => (
                    <div key={t} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--ink)", marginBottom: i < 2 ? 9 : 0 }}>
                      <span style={{ width: 20, height: 20, borderRadius: "50%", border: "1.5px solid var(--sand)", color: "var(--goldtext)", display: "grid", placeItems: "center", fontSize: 11, flex: "none" }}>{i + 1}</span> {t}
                    </div>
                  ))}
                </div>
              )}
              <button onClick={handleDoneCta} style={{ display: "inline-flex", alignItems: "center", gap: 9, background: "var(--sand)", color: "#04121B", border: 0, textDecoration: "none", fontSize: 13, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", padding: "15px 30px", borderRadius: 40, cursor: "pointer" }}>{doneCta} →</button>
              <div style={{ marginTop: 18 }}>
                <button onClick={reset} style={{ background: "transparent", border: 0, cursor: "pointer", fontSize: 13, color: "var(--tmut)", fontFamily: "var(--sans)" }}>Back to sign in</button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm-your-email overlay (signup without a session yet) */}
        {isConfirm && (
          <div style={{ position: "fixed", inset: 0, height: "100dvh", overflowY: "hidden", background: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}>
            <div style={{ textAlign: "center", maxWidth: 380, padding: "0 30px", maxHeight: "100dvh", overflowY: "hidden" }}>
              <div style={{ width: 78, height: 78, borderRadius: "50%", background: "var(--sandsoft)", display: "grid", placeItems: "center", margin: "0 auto 24px", animation: "fx-pop .5s both" }}>
                <span style={{ color: "var(--goldtext)", fontSize: 32 }}>✉</span>
              </div>
              <h2 style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 31, letterSpacing: "-.01em", margin: "0 0 10px", color: "var(--ink)" }}>Check your inbox.</h2>
              <p style={{ fontSize: 15.5, lineHeight: 1.55, color: "var(--tmut)", margin: "0 0 26px" }}>
                We sent a confirmation link to your email. Open it and you’ll be signed straight into
                {doneKind === "business" ? " your setup — then your dashboard" : " your dashboard"}.
              </p>
              {resendMsg && (
                <p style={{ fontSize: 13, lineHeight: 1.5, color: resendMsg.startsWith("New link") ? "var(--goldtext)" : "#a23a34", margin: "-14px 0 18px" }}>{resendMsg}</p>
              )}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginTop: 4 }}>
                <button type="button" onClick={handleResend} disabled={resendIn > 0}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 9,
                    background: resendIn > 0 ? "var(--paper2)" : "var(--sand)", color: resendIn > 0 ? "var(--tmut)" : "#04121B",
                    border: 0, fontSize: 13, fontWeight: 700, letterSpacing: ".08em",
                    textTransform: "uppercase", padding: "14px 28px", borderRadius: 40,
                    cursor: resendIn > 0 ? "default" : "pointer", fontFamily: "var(--sans)",
                  }}>
                  {resendIn > 0 ? `Resend email in ${resendIn}s` : "Resend email"}
                </button>
                <button onClick={reset} style={{ background: "transparent", border: 0, cursor: "pointer", fontSize: 13, color: "var(--tmut)", fontFamily: "var(--sans)" }}>Back to sign in</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function VerticalCard({ label, sub, onClick, svg }: { label: string; sub: string; onClick: () => void; svg: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      textAlign: "left", background: "var(--card)", border: "1px solid var(--line)",
      borderRadius: 14, padding: 18, cursor: "pointer", fontFamily: "var(--sans)",
      transition: "transform .2s,box-shadow .2s,border-color .2s",
    }}>
      <span style={{ width: 40, height: 40, borderRadius: 11, background: "var(--paper2)", display: "grid", placeItems: "center", color: "var(--ink)", marginBottom: 12 }}>{svg}</span>
      <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{label}</span>
      <span style={{ display: "block", fontSize: 12.5, color: "var(--tmut)", marginTop: 2 }}>{sub}</span>
    </button>
  );
}

function VerticalDetail({ vertical }: { vertical: Exclude<Vertical, ""> }) {
  const select = (label: string, options: string[]) => (
    <label style={{ display: "block" }}>
      <span style={labelSpan}>{label}</span>
      <select name="detail" style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  );
  if (vertical === "captain") return select("Waters you fish", ["Offshore / bluewater", "Inshore", "Nearshore & reef", "Fly & light tackle"]);
  if (vertical === "tackle") return select("Sales channel", ["In-store & online", "In-store only", "Online only"]);
  if (vertical === "marina") return (
    <label style={{ display: "block" }}>
      <span style={labelSpan}>Number of slips</span>
      <input name="detail" type="number" min={0} placeholder="e.g. 120" style={inputStyle} />
    </label>
  );
  if (vertical === "manufacturer") return select("Product category", ["Rods & reels", "Terminal tackle & lures", "Electronics & sonar", "Boats & motors", "Other"]);
  if (vertical === "apparel") return select("Product focus", ["Performance fishing wear", "Casual & lifestyle", "Outerwear & foul-weather", "Accessories"]);
  return select("Type of guiding", ["Fly fishing", "Bass & freshwater", "Inshore / flats", "Offshore", "Ice fishing"]);
}

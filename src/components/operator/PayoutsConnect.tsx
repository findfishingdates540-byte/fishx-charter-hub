/**
 * Payouts / bank-connection block for operator settings (captain, marina,
 * tackle/shop, guide). Reads live Stripe Connect status and lets operators
 * connect their bank via Stripe-hosted onboarding if they haven't yet.
 *
 * Renders inner content only — the caller wraps it in its own Panel/Card so
 * it matches each vertical's chrome.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getConnectStatus,
  createConnectOnboardingLink,
  createConnectDashboardLink,
} from "@/lib/stripe-connect.functions";

async function readErr(e: unknown): Promise<string> {
  if (e instanceof Response) return (await e.text()).slice(0, 200);
  if (e instanceof Error) return e.message;
  return String(e);
}

export function PayoutsConnect({ businessId }: { businessId?: string }) {
  const statusFn = useServerFn(getConnectStatus);
  const startConnect = useServerFn(createConnectOnboardingLink);
  const openDashboard = useServerFn(createConnectDashboardLink);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["connect-status", businessId ?? "me"],
    queryFn: () => statusFn({ data: businessId ? { businessId } : {} }),
    // Stripe can finish enabling an account a few seconds AFTER it redirects the
    // operator back from onboarding. While a Stripe account exists but isn't
    // fully enabled yet, poll so the card flips to "Connected" on its own
    // instead of making them reload. Stops polling once connected (or if no
    // account has been created yet).
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d) return false;
      const isConnected = d.chargesEnabled && d.payoutsEnabled;
      return d.stripeAccountId && !isConnected ? 4000 : false;
    },
  });

  const s = q.data;
  const connected = !!s && s.chargesEnabled && s.payoutsEnabled;
  const started = !!s?.stripeAccountId;

  function friendly(msg: string): string {
    if (msg.includes("not configured"))
      return "Payouts aren't available yet — the platform hasn't finished Stripe setup. Try again later.";
    if (msg.toLowerCase().includes("signed up for connect"))
      return "Stripe Connect needs to be enabled on the platform account. Please contact support.";
    return msg || "Something went wrong. Please try again.";
  }

  async function connect() {
    setErr(null);
    setBusy(true);
    try {
      const res = await startConnect({
        data: {
          ...(businessId ? { businessId } : {}),
          returnUrl: window.location.href,
        },
      });
      if (!res?.url) throw new Error("Stripe did not return an onboarding link.");
      window.location.assign(res.url);
    } catch (e) {
      setErr(friendly(await readErr(e)));
      setBusy(false);
    }
  }

  async function manage() {
    setErr(null);
    setBusy(true);
    try {
      const res = await openDashboard({ data: businessId ? { businessId } : {} });
      if (!res?.url) throw new Error("Could not open your payout dashboard.");
      window.location.assign(res.url);
    } catch (e) {
      setErr(friendly(await readErr(e)));
      setBusy(false);
    }
  }

  const intro =
    "Fish-X uses Stripe Connect for payouts. Funds are held in escrow and released 72 hours after trip completion.";

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ fontSize: 13.5, color: "var(--tmut, #92A0AB)", lineHeight: 1.6 }}>
        {intro}
      </div>

      {q.isLoading ? (
        <div style={{ fontSize: 13, color: "var(--tmut, #92A0AB)" }}>Checking payout status…</div>
      ) : q.isError ? (
        <div style={{ fontSize: 13, color: "#F87171" }}>
          Couldn't load payout status. Reload the page to try again.
        </div>
      ) : s?.noBusiness ? (
        <div style={{ fontSize: 13, color: "var(--tmut, #92A0AB)", lineHeight: 1.6 }}>
          Set up your business profile first — once your business exists you can connect a bank
          account here to receive payouts.
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
            border: "1px solid var(--line, rgba(255,255,255,.07))",
            borderRadius: 14,
            padding: "14px 16px",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink, #F0F2F5)" }}>
              Bank account
            </div>
            <div style={{ fontSize: 12.5, color: "var(--tmut, #92A0AB)", marginTop: 2 }}>
              {connected
                ? "Connected — you're set up to receive payouts."
                : started
                  ? "Setup started — finish connecting to receive payouts."
                  : "Connect your bank to receive escrow payouts."}
            </div>
            {!connected && s && s.requirementsDue.length > 0 && (
              <div style={{ fontSize: 12, color: "#2DE2F2", marginTop: 4 }}>
                Stripe still needs a few details to finish setup.
              </div>
            )}
          </div>

          {connected ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "none" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  background: "var(--greensoft, rgba(34,197,94,.14))",
                  color: "var(--green, #22C55E)",
                  borderRadius: 20,
                  padding: "7px 13px",
                  fontSize: 12.5,
                  fontWeight: 700,
                }}
              >
                <span
                  style={{
                    width: 15,
                    height: 15,
                    borderRadius: "50%",
                    background: "var(--green, #22C55E)",
                    color: "#F0F2F5",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 10,
                  }}
                >
                  ✓
                </span>
                Connected
              </span>
              <button
                onClick={manage}
                disabled={busy}
                style={{
                  background: "transparent",
                  border: 0,
                  color: "var(--goldtext, #2DE2F2)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: busy ? "default" : "pointer",
                }}
              >
                {busy ? "Opening…" : "Manage payouts →"}
              </button>
            </div>
          ) : (
            <button
              onClick={connect}
              disabled={busy}
              style={{
                flex: "none",
                background: "#2DE2F2",
                color: "#0D161F",
                border: 0,
                borderRadius: 10,
                padding: "11px 20px",
                fontSize: 13,
                fontWeight: 700,
                cursor: busy ? "default" : "pointer",
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? "Opening…" : started ? "Finish connecting bank" : "Connect bank"}
            </button>

          )}
        </div>
      )}

      {err && <div style={{ fontSize: 12.5, color: "#F87171" }}>{err}</div>}

      <div style={{ fontSize: 11.5, color: "var(--tmut, #92A0AB)" }}>
        Charters: you keep 85% of the deposit (15% platform fee) plus the balance you collect on the day. Merchandise: 92% to you, 8% platform fee. Bank details are handled
        securely by Stripe — Fish-X never sees your account numbers.
      </div>
    </div>
  );
}

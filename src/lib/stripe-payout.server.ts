/**
 * Last mile of the money flow: after a transfer moves the operator's share
 * into their connected Stripe account, this makes sure it actually leaves
 * Stripe and lands in their bank.
 *
 * Stripe accounts on an automatic schedule pay out on their own — we simply
 * report the next expected arrival. Accounts on a manual schedule need an
 * explicit payout, which we create here.
 *
 * Server-only: load inside a handler with `await import(...)`.
 */
import type Stripe from "stripe";

export type BankSettlement = {
  /** Stripe payout id on the connected account, when one was created. */
  bankPayoutId: string | null;
  /** 'automatic' when Stripe pays out on its own schedule. */
  mode: "automatic" | "manual" | "unknown";
  /** ISO date the money is expected to hit the bank, when known. */
  arrivalDate: string | null;
  /** Ledger status for the payouts row. */
  status: "paid" | "in_transit" | "pending";
  error: string | null;
};

/**
 * Pushes the connected account's available balance out to their bank when the
 * account is on a manual payout schedule. Never throws — a failure here must
 * not undo a transfer that already succeeded.
 */
export async function settleToBank(
  stripe: Stripe,
  accountId: string,
  amountCents: number,
  metadata: Record<string, string> = {},
): Promise<BankSettlement> {
  const base: BankSettlement = {
    bankPayoutId: null,
    mode: "unknown",
    arrivalDate: null,
    status: "in_transit",
    error: null,
  };

  try {
    const account = await stripe.accounts.retrieve(accountId);
    const interval = account.settings?.payouts?.schedule?.interval ?? "daily";
    if (interval !== "manual") {
      return { ...base, mode: "automatic" };
    }

    // Manual schedule: only what has already cleared can be paid out now.
    const balance = await stripe.balance.retrieve(undefined, { stripeAccount: accountId });
    const available =
      balance.available.find((b) => b.currency === "usd")?.amount ??
      balance.available[0]?.amount ??
      0;
    const amount = Math.min(amountCents, available);
    if (amount <= 0) {
      // Funds are still settling; the next run (or Stripe's own retry) picks it up.
      return { ...base, mode: "manual", status: "pending" };
    }

    const payout = await stripe.payouts.create(
      { amount, currency: "usd", metadata },
      { stripeAccount: accountId, idempotencyKey: `bank-payout-${metadata["source_id"] ?? amount}` },
    );

    return {
      bankPayoutId: payout.id,
      mode: "manual",
      arrivalDate: payout.arrival_date
        ? new Date(payout.arrival_date * 1000).toISOString().slice(0, 10)
        : null,
      status: payout.status === "paid" ? "paid" : "in_transit",
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[stripe] bank settlement failed", message);
    return { ...base, error: message.slice(0, 300) };
  }
}

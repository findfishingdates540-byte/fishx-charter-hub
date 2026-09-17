/**
 * Notification fan-out for domain events (server-only).
 *
 * The booking service never sends email or writes notifications inline — it
 * only emits `domain_events`. The outbox dispatcher calls `handleDomainEvent`
 * for each event, which resolves recipients, writes in-app notifications and
 * (optionally) queues an email. Every write is idempotent per
 * (dedupe_key, user_id, channel) so redelivery never double-notifies.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

type Admin = SupabaseClient<any, "public", any>;

export type DomainEvent = {
  id: string;
  topic: string;
  aggregate_type: string;
  aggregate_id: string | null;
  payload: Record<string, unknown>;
};

export type NotificationDraft = {
  userId: string;
  category: string;
  title: string;
  body?: string | null;
  link?: string | null;
  severity?: "info" | "success" | "warning" | "critical";
  meta?: Record<string, unknown>;
  /** Skip the email channel for chatty categories. */
  email?: boolean;
  /** Full booking receipt — renders the detailed confirmation email. */
  receipt?: BookingReceipt;
};

/** Everything the angler confirmation email needs, resolved server-side. */
export type BookingReceipt = {
  reference: string;
  packageTitle: string;
  businessName: string;
  dateLabel: string;
  timeLabel: string | null;
  partySize: number;
  durationLabel: string | null;
  departure: string | null;
  addons: Array<{ title: string; quantity: number; unit: string; totalCents: number }>;
  note: string | null;
  totalCents: number;
  depositCents: number;
  balanceDueCents: number;
  instant: boolean;
};

const APP_URL =
  process.env["PUBLIC_APP_URL"] ?? "https://booking.fish-x.com";

function money(cents?: number | null) {
  if (typeof cents !== "number") return "";
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

/** Angler + every staff member of the operating business. */
async function bookingAudience(admin: Admin, bookingId: string) {
  const { data: booking } = await admin
    .from("bookings")
    .select(
      "id,angler_id,captain_id,business_id,trip_date,start_time,party_size,total_cents,deposit_cents,balance_due_cents,payout_cents,notes,instant_book,accept_deadline_at,service:bookable_services(title,duration_minutes,departure_location),business:businesses(name)",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return null;

  const operators = new Set<string>();
  if (booking.captain_id) operators.add(booking.captain_id);
  if (booking.business_id) {
    const { data: members } = await admin
      .from("business_members")
      .select("user_id")
      .eq("business_id", booking.business_id);
    for (const m of members ?? []) operators.add(m.user_id as string);
  }
  operators.delete(booking.angler_id as string);

  return {
    booking,
    anglerId: booking.angler_id as string | null,
    operatorIds: [...operators],
    service: (booking.service ?? null) as
      | { title?: string; duration_minutes?: number | null; departure_location?: string | null }
      | null,
    tripLabel:
      (booking.service as { title?: string } | null)?.title ?? "your trip",
    businessName:
      (booking.business as { name?: string } | null)?.name ?? "the operator",
    dateLabel: booking.trip_date
      ? new Date(`${booking.trip_date}T00:00:00`).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      : "",
  };
}

/** Resolve the selected package, add-ons and captain note for one booking. */
async function bookingReceipt(
  admin: Admin,
  ctx: NonNullable<Awaited<ReturnType<typeof bookingAudience>>>,
): Promise<BookingReceipt> {
  const { booking, service, tripLabel, businessName, dateLabel } = ctx;

  const { data: addonRows } = await admin
    .from("booking_addons")
    .select("title,unit,quantity,total_cents")
    .eq("booking_id", booking.id);

  const total = (booking.total_cents as number) ?? 0;
  const deposit = (booking.deposit_cents as number) ?? 0;
  const balance =
    typeof booking.balance_due_cents === "number"
      ? booking.balance_due_cents
      : Math.max(total - deposit, 0);
  const mins = service?.duration_minutes ?? null;

  return {
    reference: String(booking.id).slice(0, 8).toUpperCase(),
    packageTitle: tripLabel,
    businessName,
    dateLabel,
    timeLabel: booking.start_time ? String(booking.start_time).slice(0, 5) : null,
    partySize: (booking.party_size as number) ?? 1,
    durationLabel: mins ? `${Math.round((mins / 60) * 10) / 10} hrs` : null,
    departure: service?.departure_location ?? null,
    addons: (addonRows ?? []).map((a: any) => ({
      title: a.title as string,
      quantity: (a.quantity as number) ?? 1,
      unit: (a.unit as string) ?? "per_trip",
      totalCents: (a.total_cents as number) ?? 0,
    })),
    note: (booking.notes as string | null)?.trim() || null,
    totalCents: total,
    depositCents: deposit,
    balanceDueCents: balance,
    instant: booking.instant_book !== false,
  };
}

/** Build the notification drafts for one domain event. */
export async function draftsForEvent(
  admin: Admin,
  evt: DomainEvent,
): Promise<NotificationDraft[]> {
  const topic = evt.topic;

  /* New chat message — notify everyone on the thread except the sender. */
  if (topic === "message.sent") {
    const bookingId = (evt.payload["booking_id"] as string) ?? evt.aggregate_id;
    const senderId = evt.payload["sender_id"] as string | undefined;
    if (!bookingId) return [];
    const ctx = await bookingAudience(admin, bookingId);
    if (!ctx) return [];
    const preview = String(evt.payload["preview"] ?? "").trim();
    const senderName = (evt.payload["sender_name"] as string) || "New message";
    const recipients = [ctx.anglerId, ...ctx.operatorIds].filter(
      (u): u is string => !!u && u !== senderId,
    );
    return recipients.map((userId) => ({
      userId,
      category: "message",
      title: `${senderName} · ${ctx.tripLabel}`,
      body: preview || "Sent you a message.",
      link: userId === ctx.anglerId ? `/trips/detail?id=${bookingId}` : `/bookings/detail?id=${bookingId}`,
      email: false,
    }));
  }

  /* Merchandise orders — payouts and delivery go to the selling shop. */
  if (evt.aggregate_type === "product_order" || topic.startsWith("order.")) {
    const orderId = (evt.payload["order_id"] as string) ?? evt.aggregate_id;
    if (!orderId) return [];
    const { data: order } = await admin
      .from("product_orders")
      .select("id,business_id,buyer_id,total_cents")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return [];
    const staff = new Set<string>();
    if (order.business_id) {
      const { data: members } = await admin
        .from("business_members")
        .select("user_id")
        .eq("business_id", order.business_id);
      for (const m of members ?? []) staff.add(m.user_id as string);
    }
    const ref = String(order.id).slice(0, 8).toUpperCase();
    if (topic === "payout.released") {
      return [...staff].map((userId) => ({
        userId,
        category: "payout",
        title: "Order payout released",
        body: `${money((evt.payload["amount_cents"] as number) ?? 0)} for order ${ref} is on its way to your bank.`,
        link: "/payouts-status",
        severity: "success" as const,
      }));
    }
    if (topic === "order.cancelled_by_buyer") {
      return [...staff].map((userId) => ({
        userId,
        category: "order",
        title: `Order ${ref} cancelled`,
        body: "The buyer cancelled this order before it shipped.",
        link: "/dashboard?tab=orders",
        severity: "warning" as const,
      }));
    }
    return [];
  }

  if (topic.startsWith("booking.") || topic.startsWith("payout.")) {
    const id = (evt.payload["booking_id"] as string) ?? evt.aggregate_id;
    if (!id) return [];
    const ctx = await bookingAudience(admin, id);
    if (!ctx) return [];

    const { booking, anglerId, operatorIds, tripLabel, businessName, dateLabel } = ctx;
    const anglerLink = `/trips/detail?id=${booking.id}`;
    const opLink = `/bookings/detail?id=${booking.id}`;
    const out: NotificationDraft[] = [];
    const push = (
      users: Array<string | null>,
      d: Omit<NotificationDraft, "userId">,
    ) => {
      for (const u of users) if (u) out.push({ userId: u, ...d });
    };

    switch (topic) {
      case "booking.created": {
        const instant = booking_instant(evt);
        push([anglerId], {
          category: "booking",
          title: instant ? "Booking started" : "Request sent to the captain",
          body: instant
            ? `Finish payment to lock in ${tripLabel} on ${dateLabel}.`
            : `${businessName} has 24 hours to accept ${tripLabel} on ${dateLabel}.`,
          link: anglerLink,
        });
        break;
      }
      case "booking.pending_confirmation": {
        const receipt = await bookingReceipt(admin, ctx);
        push([anglerId], {
          category: "booking",
          title: `Request sent — ${tripLabel} on ${dateLabel}`,
          body: `${businessName} has 24 hours to accept. Your card is authorised but not charged until they confirm.`,
          link: anglerLink,
          receipt,
        });
        push(operatorIds, {
          category: "booking",
          title: "New booking request",
          body: `${tripLabel} on ${dateLabel} · ${booking.party_size} angler(s) · ${money(booking.total_cents)}. Accept within 24 hours or it auto-declines.`,
          link: opLink,
          severity: "warning",
        });
        break;
      }
      case "booking.confirmed": {
        const receipt = await bookingReceipt(admin, ctx);
        push([anglerId], {
          category: "booking",
          title: `Your trip is confirmed — ${tripLabel} on ${dateLabel}`,
          body: `${tripLabel} with ${businessName} on ${dateLabel}. Funds are held in escrow until 24h after the trip.`,
          link: anglerLink,
          severity: "success",
          receipt,
        });
        push(operatorIds, {
          category: "booking",
          title: "Trip confirmed",
          body: `${tripLabel} on ${dateLabel} · ${booking.party_size} angler(s).`,
          link: opLink,
          severity: "success",
        });
        break;
      }
      case "booking.in_progress":
        push([anglerId, ...operatorIds], {
          category: "booking",
          title: "Trip day",
          body: `${tripLabel} is underway. Tight lines.`,
          link: anglerLink,
          email: false,
        });
        break;
      case "booking.completed":
        push([anglerId], {
          category: "review",
          title: "How was your trip?",
          body: `Leave a review for ${businessName} — it unlocks their payout and helps other anglers.`,
          link: `/review?booking=${booking.id}`,
        });
        push(operatorIds, {
          category: "payout",
          title: "Trip completed — payout pending",
          body: `${money(booking.payout_cents)} releases 72 hours after completion unless a dispute is opened.`,
          link: opLink,
        });
        break;
      case "booking.declined":
        push([anglerId], {
          category: "booking",
          title: "Booking declined",
          body: `${businessName} could not take ${tripLabel} on ${dateLabel}. Any authorised payment has been released.`,
          link: anglerLink,
          severity: "warning",
        });
        break;
      case "booking.expired":
        push([anglerId], {
          category: "booking",
          title: "Your hold expired",
          body: `The seats for ${tripLabel} on ${dateLabel} were released because checkout wasn't completed.`,
          link: anglerLink,
          severity: "warning",
        });
        break;
      case "booking.cancelled_angler":
      case "booking.cancelled_captain":
        push([anglerId, ...operatorIds], {
          category: "booking",
          title: "Booking cancelled",
          body: `${tripLabel} on ${dateLabel} was cancelled. Refunds follow the cancellation policy.`,
          link: anglerLink,
          severity: "warning",
        });
        break;
      case "booking.refunded":
        push([anglerId], {
          category: "payment",
          title: "Refund issued",
          body: `Your refund for ${tripLabel} is on its way back to your card.`,
          link: anglerLink,
          severity: "success",
        });
        break;
      case "booking.disputed":
        push([anglerId, ...operatorIds], {
          category: "dispute",
          title: "Resolution case opened",
          body: `Payout for ${tripLabel} is frozen while Fish-X reviews the case.`,
          link: "/resolution-center",
          severity: "critical",
        });
        break;
      case "booking.reminder_48h":
      case "booking.reminder_24h": {
        const hrs = topic.endsWith("48h") ? 48 : 24;
        push([anglerId], {
          category: "reminder",
          title: `${tripLabel} in ${hrs} hours`,
          body: `${dateLabel} with ${businessName}. Check the departure details and message your captain with any questions.`,
          link: anglerLink,
        });
        push(operatorIds, {
          category: "reminder",
          title: `Trip in ${hrs} hours`,
          body: `${tripLabel} on ${dateLabel} · ${booking.party_size} angler(s).`,
          link: opLink,
        });
        break;
      }
      case "payout.released":
        push(operatorIds, {
          category: "payout",
          title: "Payout released",
          body: `${money((evt.payload["amount_cents"] as number) ?? booking.payout_cents)} is on its way to your bank.`,
          link: "/payouts-status",
          severity: "success",
        });
        break;
      default:
        return [];
    }
    return out;
  }

  if (topic === "message.unread_nudge") {
    const userId = evt.payload["user_id"] as string | undefined;
    const count = Number(evt.payload["count"] ?? 0);
    if (!userId || count < 1) return [];
    return [
      {
        userId,
        category: "message",
        title: `${count} unread message${count === 1 ? "" : "s"}`,
        body: "Someone is waiting on your reply inside Fish-X.",
        link: (evt.payload["link"] as string) ?? "/messages",
      },
    ];
  }

  return [];
}

function booking_instant(evt: DomainEvent) {
  return evt.payload["instant_book"] !== false;
}

async function emailAllowed(admin: Admin, userId: string, category: string) {
  const { data } = await admin
    .from("notification_preferences")
    .select("email_enabled,categories")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return true;
  if (!data.email_enabled) return false;
  const cats = (data.categories ?? {}) as Record<string, boolean>;
  return cats[category] !== false;
}

async function recipientEmail(admin: Admin, userId: string) {
  const { data } = await admin.auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
}

/**
 * Send one transactional email via Resend.
 *
 * Falls back to `skipped` when Resend is not configured so a missing email
 * setup can never fail a booking.
 */
async function sendEmail(to: string, draft: NotificationDraft) {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["EMAIL_FROM"];
  if (!apiKey || !from) return { sent: false, reason: "email_not_configured" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: draft.title,
      html: draft.receipt ? receiptHtml(draft) : emailHtml(draft),
    }),
  });
  if (!res.ok) {
    return { sent: false, reason: `${res.status}: ${(await res.text()).slice(0, 300)}` };
  }
  return { sent: true, reason: null as string | null };
}

/**
 * One-off notification outside the domain-event pipeline (e.g. a team invite):
 * writes the in-app row and sends the email when Resend is configured.
 */
export async function sendDirectNotification(
  admin: Admin,
  draft: NotificationDraft & { to?: string | null },
) {
  await admin.from("notifications").insert({
    user_id: draft.userId,
    category: draft.category,
    title: draft.title,
    body: draft.body ?? null,
    link: draft.link ?? null,
    severity: draft.severity ?? "info",
    meta: draft.meta ?? {},
  });
  const to = draft.to ?? (await recipientEmail(admin, draft.userId));
  if (!to) return { sent: false, reason: "no email on file" };
  return sendEmail(to, draft);
}


function emailHtml(draft: NotificationDraft) {
  const link = draft.link ? `${APP_URL}${draft.link}` : APP_URL;
  return `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:'Outfit',system-ui,sans-serif;color:#031029">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <div style="font-family:Georgia,serif;font-size:20px;font-weight:700;letter-spacing:.02em">FISH-X.COM</div>
    <h1 style="font-family:Georgia,serif;font-size:26px;margin:24px 0 10px">${escapeHtml(draft.title)}</h1>
    <p style="font-size:15px;line-height:1.6;color:#5c6b78;margin:0 0 24px">${escapeHtml(draft.body ?? "")}</p>
    <a href="${link}" style="display:inline-block;background:#031029;color:#ffffff;text-decoration:none;border-radius:10px;padding:13px 22px;font-size:14px;font-weight:700">Open FISH-X.COM</a>
    <p style="font-size:12px;color:#8a97a3;margin-top:32px">You're receiving this because of activity on your FISH-X.COM account. Manage notification settings in your account page.</p>
  </div></body></html>`;
}

/** Detailed booking confirmation: package, add-ons, note and money split. */
function receiptHtml(draft: NotificationDraft) {
  const r = draft.receipt!;
  const link = draft.link ? `${APP_URL}${draft.link}` : APP_URL;
  const row = (label: string, value: string, strong = false) =>
    `<tr>
      <td style="padding:9px 0;font-size:13.5px;color:#5c6b78">${escapeHtml(label)}</td>
      <td style="padding:9px 0;font-size:${strong ? "15px;font-weight:700" : "13.5px"};color:#031029;text-align:right">${escapeHtml(value)}</td>
    </tr>`;

  const addonRows = r.addons.length
    ? r.addons
        .map(
          (a) =>
            `<tr>
              <td style="padding:8px 0;font-size:13.5px;color:#031029">${escapeHtml(a.title)}${
                a.unit === "per_person" ? ` <span style="color:#8a97a3">× ${a.quantity} anglers</span>` : ""
              }</td>
              <td style="padding:8px 0;font-size:13.5px;color:#031029;text-align:right">${money(a.totalCents)}</td>
            </tr>`,
        )
        .join("")
    : `<tr><td style="padding:8px 0;font-size:13.5px;color:#8a97a3">No add-ons selected</td><td></td></tr>`;

  const noteBlock = r.note
    ? `<div style="margin-top:22px;background:#f4f7f9;border-left:3px solid #1f9fbe;border-radius:0 12px 12px 0;padding:16px 18px">
        <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#1f9fbe;font-weight:700;margin-bottom:7px">Your note to ${escapeHtml(r.businessName)}</div>
        <div style="font-size:14px;line-height:1.6;color:#031029;white-space:pre-wrap">${escapeHtml(r.note)}</div>
      </div>`
    : "";

  const when = `${r.dateLabel}${r.timeLabel ? ` · ${r.timeLabel}` : ""}`;

  return `<!doctype html><html><body style="margin:0;background:#eef2f5;font-family:'Outfit',system-ui,sans-serif;color:#031029">
  <div style="max-width:600px;margin:0 auto;padding:30px 18px">
    <div style="font-family:Georgia,serif;font-size:20px;font-weight:700;letter-spacing:.02em;margin-bottom:16px">FISH-X.COM</div>
    <div style="background:#031029;color:#ffffff;border-radius:18px 18px 0 0;padding:28px 26px">
      <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#2DE2F2;font-weight:700">${
        r.instant ? "Booking confirmed" : "Request sent to the captain"
      }</div>
      <h1 style="font-family:Georgia,serif;font-size:29px;margin:10px 0 6px;font-weight:600">${escapeHtml(r.packageTitle)}</h1>
      <div style="font-size:14px;color:#93a7b7">${escapeHtml(r.businessName)} · ${escapeHtml(when)}</div>
      <div style="margin-top:16px;display:inline-block;background:rgba(255,255,255,.09);border-radius:999px;padding:7px 14px;font-size:12px;color:#eaf1f6">Reference #${escapeHtml(r.reference)}</div>
    </div>
    <div style="background:#ffffff;border-radius:0 0 18px 18px;padding:26px">
      <div style="font-family:Georgia,serif;font-size:19px;margin-bottom:6px">Trip package</div>
      <table style="width:100%;border-collapse:collapse;border-bottom:1px solid rgba(13,34,54,.10)">
        ${row("Package", r.packageTitle)}
        ${row("Departure", when)}
        ${r.durationLabel ? row("Duration", r.durationLabel) : ""}
        ${row("Party size", `${r.partySize} angler${r.partySize === 1 ? "" : "s"}`)}
        ${r.departure ? row("Meeting point", r.departure) : ""}
      </table>

      <div style="font-family:Georgia,serif;font-size:19px;margin:24px 0 6px">Add-ons</div>
      <table style="width:100%;border-collapse:collapse;border-bottom:1px solid rgba(13,34,54,.10)">${addonRows}</table>

      ${noteBlock}

      <div style="font-family:Georgia,serif;font-size:19px;margin:24px 0 6px">Payment</div>
      <table style="width:100%;border-collapse:collapse">
        ${row("Trip total", money(r.totalCents))}
        ${row(r.instant ? "Deposit paid today" : "Deposit authorised", money(r.depositCents), true)}
        ${row("Balance due to the captain on the day", money(r.balanceDueCents))}
      </table>

      <p style="font-size:13px;line-height:1.6;color:#5c6b78;margin:20px 0 22px">${
        r.instant
          ? "Your deposit is held in Fish-X escrow and only released to the captain 72 hours after the trip is completed."
          : "Nothing is captured until the captain accepts. If they can't take the date, the authorisation is released in full."
      }</p>
      <a href="${link}" style="display:inline-block;background:#2DE2F2;color:#04121B;text-decoration:none;border-radius:11px;padding:14px 24px;font-size:14px;font-weight:700">View your trip</a>
      <p style="font-size:12px;color:#8a97a3;margin-top:28px">Cancel 7+ days out for a full deposit refund. Captain-declared weather calls are always fully refundable or free to reschedule.</p>
    </div>
  </div></body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/** Idempotently deliver every notification for one domain event. */
export async function handleDomainEvent(admin: Admin, evt: DomainEvent) {
  const drafts = await draftsForEvent(admin, evt);
  let created = 0;
  let emailed = 0;

  for (const draft of drafts) {
    const dedupe = `${evt.topic}:${evt.id}`;

    const claim = await admin
      .from("notification_deliveries")
      .insert({
        event_id: evt.id,
        dedupe_key: dedupe,
        user_id: draft.userId,
        channel: "in_app",
        status: "sent",
      })
      .select("id")
      .maybeSingle();
    // Unique violation => already delivered for this event/user; skip entirely.
    if (claim.error) continue;

    const ins = await admin.from("notifications").insert({
      user_id: draft.userId,
      category: draft.category,
      title: draft.title,
      body: draft.body ?? null,
      link: draft.link ?? null,
      severity: draft.severity ?? "info",
      meta: { ...(draft.meta ?? {}), topic: evt.topic, event_id: evt.id },
    });
    if (!ins.error) created += 1;

    if (draft.email === false) continue;
    if (!(await emailAllowed(admin, draft.userId, draft.category))) continue;

    const emailClaim = await admin
      .from("notification_deliveries")
      .insert({
        event_id: evt.id,
        dedupe_key: dedupe,
        user_id: draft.userId,
        channel: "email",
        status: "pending",
      })
      .select("id")
      .maybeSingle();
    if (emailClaim.error || !emailClaim.data) continue;

    const to = await recipientEmail(admin, draft.userId);
    if (!to) {
      await admin
        .from("notification_deliveries")
        .update({ status: "skipped", error: "no email on file" })
        .eq("id", emailClaim.data.id);
      continue;
    }
    const result = await sendEmail(to, draft);
    await admin
      .from("notification_deliveries")
      .update({
        status: result.sent ? "sent" : "skipped",
        error: result.reason,
      })
      .eq("id", emailClaim.data.id);
    if (result.sent) emailed += 1;
  }

  return { created, emailed };
}

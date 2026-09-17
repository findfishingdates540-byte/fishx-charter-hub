/**
 * Marina dashboard server functions: slips, reservations, KPIs.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertMember(
  ctx: { supabase: any; userId: string },
  businessId: string,
) {
  const { data, error } = await ctx.supabase.rpc("is_business_member", {
    _business_id: businessId,
    _user_id: ctx.userId,
    _min_role: "staff",
  });
  if (error) throw new Response(error.message, { status: 500 });
  if (!data) throw new Response("Forbidden", { status: 403 });
}

export const getMarinaOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { businessId: string }) =>
    z.object({ businessId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context, data.businessId);
    const { supabase } = context;

    const [{ data: slips }, { data: reservations }, { data: bookingRows }] = await Promise.all([
      supabase
        .from("marina_slips")
        .select("id, slip_number, status, monthly_rate_cents, nightly_rate_cents, is_bookable, service_id, length_ft, beam_ft, amperage")
        .eq("business_id", data.businessId),
      supabase
        .from("marina_reservations")
        .select(
          "id, vessel_name, captain_name, arrive_date, depart_date, total_cents, status, slip:marina_slips(slip_number)",
        )
        .eq("business_id", data.businessId)
        .order("arrive_date", { ascending: false })
        .limit(50),
      supabase
        .from("bookings")
        .select(
          "id, trip_date, start_time, party_size, status, total_cents, escrow_state, notes, angler_id, created_at, service:bookable_services(id,title,kind)",
        )
        .eq("business_id", data.businessId)
        .order("trip_date", { ascending: false })
        .limit(200),
    ]);

    // Guest profiles for the booking calendar / guest list (operators may read
    // the profile of anyone who booked with them — see can_view_profile).
    const anglerIds = [
      ...new Set((bookingRows ?? []).map((b: any) => b.angler_id).filter(Boolean)),
    ] as string[];
    const profileMap = new Map<string, any>();
    if (anglerIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, display_name, avatar_url, bio, home_port, favorite_species, phone")
        .in("id", anglerIds);
      (profiles ?? []).forEach((p: any) => profileMap.set(p.id, p));
    }
    const bookings = (bookingRows ?? []).map((b: any) => ({
      ...b,
      angler: b.angler_id ? profileMap.get(b.angler_id) ?? null : null,
    }));

    const total = slips?.length ?? 0;
    const occupied = slips?.filter((s: any) => s.status === "occupied").length ?? 0;
    const reserved = slips?.filter((s: any) => s.status === "reserved").length ?? 0;
    const maintenance = slips?.filter((s: any) => s.status === "maintenance").length ?? 0;
    const available = total - occupied - reserved - maintenance;

    const monthGross =
      reservations
        ?.filter(
          (r: any) =>
            r.status !== "cancelled" &&
            new Date(r.arrive_date).getMonth() === new Date().getMonth(),
        )
        .reduce((acc: number, r: any) => acc + (r.total_cents ?? 0), 0) ?? 0;

    return {
      counts: { total, occupied, reserved, available, maintenance },
      monthGrossCents: monthGross,
      slips: slips ?? [],
      reservations: reservations ?? [],
      bookings,
    };
  });

export const upsertSlip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid().optional(),
        businessId: z.string().uuid(),
        slipNumber: z.string().min(1).max(10),
        lengthFt: z.number().nullable().optional(),
        beamFt: z.number().nullable().optional(),
        amperage: z.string().optional(),
        monthlyRateCents: z.number().int().nullable().optional(),
        nightlyRateCents: z.number().int().nullable().optional(),
        status: z.enum(["available", "occupied", "reserved", "maintenance"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context, data.businessId);
    const payload = {
      business_id: data.businessId,
      slip_number: data.slipNumber,
      length_ft: data.lengthFt ?? null,
      beam_ft: data.beamFt ?? null,
      amperage: data.amperage ?? null,
      monthly_rate_cents: data.monthlyRateCents ?? null,
      nightly_rate_cents: data.nightlyRateCents ?? null,
      status: data.status,
    };
    const q = data.id
      ? context.supabase
          .from("marina_slips")
          .update(payload)
          .eq("id", data.id)
          .select()
          .single()
      : context.supabase.from("marina_slips").insert(payload).select().single();
    const { data: row, error } = await q;
    if (error) throw new Response(error.message, { status: 400 });
    return row;
  });

export const deleteSlip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ id: z.string().uuid(), businessId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context, data.businessId);
    const { error } = await context.supabase
      .from("marina_slips")
      .delete()
      .eq("id", data.id);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

export const upsertReservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid().optional(),
        businessId: z.string().uuid(),
        slipId: z.string().uuid().nullable().optional(),
        vesselName: z.string().min(1).max(120),
        captainName: z.string().max(120).optional(),
        arriveDate: z.string(),
        departDate: z.string(),
        nightlyRateCents: z.number().int().optional(),
        totalCents: z.number().int().optional(),
        status: z.enum(["pending", "confirmed", "checked_in", "checked_out", "cancelled"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context, data.businessId);
    const payload = {
      business_id: data.businessId,
      slip_id: data.slipId ?? null,
      vessel_name: data.vesselName,
      captain_name: data.captainName ?? null,
      arrive_date: data.arriveDate,
      depart_date: data.departDate,
      nightly_rate_cents: data.nightlyRateCents ?? null,
      total_cents: data.totalCents ?? null,
      status: data.status,
    };
    const q = data.id
      ? context.supabase
          .from("marina_reservations")
          .update(payload)
          .eq("id", data.id)
          .select()
          .single()
      : context.supabase
          .from("marina_reservations")
          .insert(payload)
          .select()
          .single();
    const { data: row, error } = await q;
    if (error) throw new Response(error.message, { status: 400 });
    return row;
  });

/* ---------------------------------------------------------------------- *
 * Online slip booking — slips ride the same bookable_services spine as
 * charters so holds, escrow and payouts behave identically.
 * ---------------------------------------------------------------------- */

const NIGHT_CHECK_IN_HOUR = 14;
const NIGHT_CHECK_OUT_HOUR = 11;

function nightBounds(dayISO: string) {
  const start = new Date(`${dayISO}T00:00:00Z`);
  start.setUTCHours(NIGHT_CHECK_IN_HOUR, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  end.setUTCHours(NIGHT_CHECK_OUT_HOUR, 0, 0, 0);
  return { starts_at: start.toISOString(), ends_at: end.toISOString() };
}

/** Create/refresh the slip_rental listing for a slip and seed nightly slots. */
export const publishSlipForBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        businessId: z.string().uuid(),
        slipId: z.string().uuid(),
        enabled: z.boolean(),
        nights: z.number().int().min(30).max(365).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context, data.businessId);
    const { supabase } = context;

    const { data: slip, error: slipErr } = await supabase
      .from("marina_slips")
      .select("*")
      .eq("id", data.slipId)
      .single();
    if (slipErr || !slip) throw new Response("Slip not found", { status: 404 });

    if (!data.enabled) {
      if (slip.service_id) {
        await supabase
          .from("bookable_services")
          .update({ is_published: false })
          .eq("id", slip.service_id);
      }
      await supabase
        .from("marina_slips")
        .update({ is_bookable: false })
        .eq("id", data.slipId);
      return { ok: true, serviceId: slip.service_id ?? null };
    }

    const nightly = slip.nightly_rate_cents ?? 0;
    if (nightly <= 0) {
      throw new Response("Set a nightly rate before publishing this slip.", { status: 400 });
    }

    // A bookable slip takes real money, so payouts must be live first.
    const { checkVendorsPayable } = await import("./vendor-payments.server");
    const [payStatus] = await checkVendorsPayable(supabase as never, [data.businessId]);
    if (payStatus && !payStatus.ready) {
      throw new Response(
        "Connect your payout account in Payments before putting a slip up for online booking.",
        { status: 409 },
      );
    }

    const payload = {
      business_id: data.businessId,
      kind: "slip_rental" as const,
      title: `Slip ${slip.slip_number}`,
      description: [
        slip.length_ft ? `${slip.length_ft} ft LOA` : null,
        slip.beam_ft ? `${slip.beam_ft} ft beam` : null,
        slip.amperage ? `${slip.amperage} power` : null,
      ]
        .filter(Boolean)
        .join(" · ") || null,
      capacity: 1,
      base_price_cents: nightly,
      duration_minutes: 1260,
      is_published: true,
    };

    let serviceId = slip.service_id as string | null;
    if (serviceId) {
      const { error } = await supabase
        .from("bookable_services")
        .update(payload)
        .eq("id", serviceId);
      if (error) throw new Response(error.message, { status: 400 });
    } else {
      const { data: created, error } = await supabase
        .from("bookable_services")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw new Response(error.message, { status: 400 });
      serviceId = created.id;
    }

    await supabase
      .from("marina_slips")
      .update({ service_id: serviceId, is_bookable: true })
      .eq("id", data.slipId);

    // Seed one bookable night per day, skipping nights already held by a
    // manual reservation on this slip.
    const nights = data.nights ?? 120;
    const today = new Date();
    const horizon = new Date(today);
    horizon.setUTCDate(horizon.getUTCDate() + nights);

    const { data: manual } = await supabase
      .from("marina_reservations")
      .select("arrive_date, depart_date, status")
      .eq("slip_id", data.slipId)
      .neq("status", "cancelled");

    const blocked = new Set<string>();
    for (const r of manual ?? []) {
      const cur = new Date(`${r.arrive_date}T00:00:00Z`);
      const end = new Date(`${r.depart_date}T00:00:00Z`);
      while (cur < end) {
        blocked.add(cur.toISOString().slice(0, 10));
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }

    const { data: existing } = await supabase
      .from("service_availability")
      .select("starts_at")
      .eq("service_id", serviceId)
      .gte("starts_at", today.toISOString());
    const have = new Set(
      (existing ?? []).map((r: any) => String(r.starts_at).slice(0, 10)),
    );

    const rows: any[] = [];
    const cursor = new Date(today);
    while (cursor < horizon) {
      const day = cursor.toISOString().slice(0, 10);
      if (!have.has(day) && !blocked.has(day)) {
        rows.push({
          service_id: serviceId,
          ...nightBounds(day),
          seats_available: 1,
          price_cents: nightly,
          source: "generated",
        });
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    if (rows.length) {
      for (let i = 0; i < rows.length; i += 200) {
        await supabase.from("service_availability").insert(rows.slice(i, i + 200));
      }
    }

    return { ok: true, serviceId, seeded: rows.length };
  });

/* ------------------------- Marina amenities ------------------------- */

export const MARINA_AMENITIES = [
  { key: "fuel", label: "Fuel dock" },
  { key: "ice", label: "Ice" },
  { key: "pump_out", label: "Pump-out" },
  { key: "laundry", label: "Laundry" },
  { key: "haul_out", label: "Haul-out" },
  { key: "showers", label: "Showers" },
  { key: "wifi", label: "Wi-Fi" },
  { key: "power", label: "Shore power" },
  { key: "water", label: "Fresh water" },
  { key: "bait", label: "Bait & tackle" },
] as const;

export const getMarinaServices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { businessId: string }) =>
    z.object({ businessId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context, data.businessId);
    const [{ data: biz }, { data: requests }] = await Promise.all([
      context.supabase
        .from("businesses")
        .select("amenities_json")
        .eq("id", data.businessId)
        .single(),
      context.supabase
        .from("marina_service_requests")
        .select("*, slip:marina_slips(slip_number)")
        .eq("business_id", data.businessId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    const raw = (biz?.amenities_json ?? {}) as Record<string, unknown>;
    const amenities: Record<string, boolean> = {};
    for (const a of MARINA_AMENITIES) amenities[a.key] = raw[a.key] === true;
    return { amenities, requests: requests ?? [] };
  });

export const setMarinaAmenities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        businessId: z.string().uuid(),
        amenities: z.record(z.string(), z.boolean()),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context, data.businessId);
    const { data: biz } = await context.supabase
      .from("businesses")
      .select("amenities_json")
      .eq("id", data.businessId)
      .single();
    const merged = { ...((biz?.amenities_json ?? {}) as object), ...data.amenities };
    const { error } = await context.supabase
      .from("businesses")
      .update({ amenities_json: merged })
      .eq("id", data.businessId);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

export const updateServiceRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        businessId: z.string().uuid(),
        id: z.string().uuid(),
        status: z.enum(["new", "scheduled", "done", "declined"]),
        staffNote: z.string().max(1000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context, data.businessId);
    const { error } = await context.supabase
      .from("marina_service_requests")
      .update({ status: data.status, staff_note: data.staffNote ?? null })
      .eq("id", data.id)
      .eq("business_id", data.businessId);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

/** Public: a boater asks the marina for a dock service. */
export const submitServiceRequest = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        businessId: z.string().uuid(),
        serviceKey: z.string().min(1).max(40),
        vesselName: z.string().max(120).optional(),
        contactName: z.string().max(120).optional(),
        contactEmail: z.string().email().max(160).optional(),
        contactPhone: z.string().max(40).optional(),
        requestedDate: z.string().max(20).optional(),
        note: z.string().max(1000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    // Server-side publishable client: the browser client can't run here, and
    // the insert policy already allows anonymous requests for published marinas.
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const client = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
            h.delete("Authorization");
          }
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { error } = await client.from("marina_service_requests").insert({
      business_id: data.businessId,
      service_key: data.serviceKey,
      vessel_name: data.vesselName ?? null,
      contact_name: data.contactName ?? null,
      contact_email: data.contactEmail ?? null,
      contact_phone: data.contactPhone ?? null,
      requested_date: data.requestedDate || null,
      note: data.note ?? null,
    });
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

/**
 * Bulk berth creation — "A1..A20" style numbering in one go. Existing slip
 * numbers are skipped so a re-run tops up the dock instead of erroring.
 */
export const bulkCreateSlips = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        businessId: z.string().uuid(),
        prefix: z.string().max(6).default(""),
        from: z.number().int().min(0),
        to: z.number().int().min(0),
        lengthFt: z.number().nullable().optional(),
        beamFt: z.number().nullable().optional(),
        amperage: z.string().optional(),
        monthlyRateCents: z.number().int().nullable().optional(),
        nightlyRateCents: z.number().int().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context, data.businessId);
    if (data.to < data.from) throw new Response("End number must be higher", { status: 400 });
    if (data.to - data.from > 199) throw new Response("Add at most 200 slips at once", { status: 400 });

    const numbers: string[] = [];
    for (let n = data.from; n <= data.to; n++) numbers.push(`${data.prefix}${n}`);

    const { data: existing } = await context.supabase
      .from("marina_slips")
      .select("slip_number")
      .eq("business_id", data.businessId)
      .in("slip_number", numbers);
    const taken = new Set((existing ?? []).map((r: any) => r.slip_number));

    const rows = numbers
      .filter((s) => !taken.has(s))
      .map((slip_number) => ({
        business_id: data.businessId,
        slip_number,
        length_ft: data.lengthFt ?? null,
        beam_ft: data.beamFt ?? null,
        amperage: data.amperage ?? null,
        monthly_rate_cents: data.monthlyRateCents ?? null,
        nightly_rate_cents: data.nightlyRateCents ?? null,
        status: "available",
      }));

    if (rows.length > 0) {
      const { error } = await context.supabase.from("marina_slips").insert(rows);
      if (error) throw new Response(error.message, { status: 400 });
    }
    return { created: rows.length, skipped: numbers.length - rows.length };
  });

/**
 * Set status (or publish state) on many slips at once — e.g. close a whole
 * dock for maintenance, or publish every berth that already has a rate.
 */
export const bulkUpdateSlips = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        businessId: z.string().uuid(),
        slipIds: z.array(z.string().uuid()).min(1).max(300),
        status: z.enum(["available", "occupied", "reserved", "maintenance"]).optional(),
        isBookable: z.boolean().optional(),
        nightlyRateCents: z.number().int().min(0).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context, data.businessId);
    const patch: {
      status?: string;
      is_bookable?: boolean;
      nightly_rate_cents?: number;
    } = {};
    if (data.status) patch.status = data.status;
    if (typeof data.isBookable === "boolean") patch.is_bookable = data.isBookable;
    if (typeof data.nightlyRateCents === "number") patch.nightly_rate_cents = data.nightlyRateCents;
    if (Object.keys(patch).length === 0) return { updated: 0 };

    const { error, count } = await context.supabase
      .from("marina_slips")
      .update(patch, { count: "exact" })
      .eq("business_id", data.businessId)
      .in("id", data.slipIds);
    if (error) throw new Response(error.message, { status: 400 });
    return { updated: count ?? data.slipIds.length };
  });

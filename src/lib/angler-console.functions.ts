/**
 * Angler console data: full booking history, money tracking (deposits, escrow,
 * refunds) and message activity. Runs as the signed-in angler (RLS applies),
 * so it only ever returns that angler's own rows.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAnglerLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: bookingRows, error } = await supabase
      .from("bookings")
      .select(
        "id,trip_date,start_time,status,escrow_state,party_size,total_cents,deposit_cents,balance_due_cents,created_at,service:bookable_services(id,title,kind,hero_url),business:businesses(id,slug,name,city,region)",
      )
      .eq("angler_id", userId)
      .order("trip_date", { ascending: false })
      .limit(200);
    if (error) throw new Response(error.message, { status: 500 });

    const bookings = bookingRows ?? [];
    const ids = bookings.map((b: any) => b.id);

    let refunds: any[] = [];
    let unreadMessages = 0;
    if (ids.length) {
      const [refundRes, msgRes] = await Promise.all([
        supabase
          .from("refunds")
          .select("id,booking_id,amount_cents,status,created_at")
          .in("booking_id", ids),
        supabase
          .from("booking_messages")
          .select("id,booking_id,sender_id,read_at")
          .in("booking_id", ids)
          .is("read_at", null)
          .neq("sender_id", userId)
          .limit(500),
      ]);
      refunds = refundRes.data ?? [];
      unreadMessages = (msgRes.data ?? []).length;
    }

    const { data: orders } = await supabase
      .from("product_orders")
      .select("id,status,total_cents,created_at,business:businesses(name)")
      .eq("buyer_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    const live = bookings.filter(
      (b: any) =>
        !["cancelled_angler", "cancelled_captain", "declined", "expired"].includes(b.status),
    );
    const escrowCents = live
      .filter((b: any) => b.escrow_state === "held")
      .reduce((a: number, b: any) => a + (b.total_cents ?? 0), 0);
    const releasedCents = live
      .filter((b: any) => b.escrow_state === "released")
      .reduce((a: number, b: any) => a + (b.total_cents ?? 0), 0);
    const paidCents = live.reduce(
      (a: number, b: any) => a + (b.deposit_cents ?? 0),
      0,
    );
    const balanceDueCents = live
      .filter((b: any) => ["confirmed", "in_progress"].includes(b.status))
      .reduce((a: number, b: any) => a + (b.balance_due_cents ?? 0), 0);
    const refundedCents = refunds
      .filter((r: any) => r.status === "succeeded" || r.status === "completed")
      .reduce((a: number, r: any) => a + (r.amount_cents ?? 0), 0);

    return {
      bookings,
      refunds,
      orders: orders ?? [],
      unreadMessages,
      totals: {
        escrowCents,
        releasedCents,
        paidCents,
        balanceDueCents,
        refundedCents,
        tripsBooked: live.length,
        tripsCompleted: bookings.filter((b: any) =>
          ["completed", "reviewed"].includes(b.status),
        ).length,
      },
    };
  });

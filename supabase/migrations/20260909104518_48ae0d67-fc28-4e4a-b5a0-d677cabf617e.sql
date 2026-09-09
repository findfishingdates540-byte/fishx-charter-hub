CREATE OR REPLACE FUNCTION public.reconcile_payouts(_run_date date DEFAULT ((now() AT TIME ZONE 'utc'::text))::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_matched int := 0;
  v_problem int := 0;
BEGIN
  DELETE FROM public.payout_reconciliations WHERE run_date = _run_date;

  -- Booking payouts: only payout rows that are meant to belong to a booking.
  INSERT INTO public.payout_reconciliations
    (run_date, scope, status, payout_id, booking_id, business_id, expected_cents, actual_cents, delta_cents, detail)
  SELECT
    _run_date,
    'booking',
    CASE
      WHEN p.booking_id IS NOT NULL AND b.id IS NULL THEN 'orphan'
      WHEN p.booking_id IS NULL THEN 'orphan'
      WHEN expected.cents = p.amount_cents THEN 'matched'
      ELSE 'mismatch'
    END,
    p.id, p.booking_id, p.business_id,
    COALESCE(expected.cents, 0), p.amount_cents,
    p.amount_cents - COALESCE(expected.cents, 0),
    CASE
      WHEN p.booking_id IS NULL THEN 'Payout is linked to neither a trip nor a shop order'
      WHEN b.id IS NULL THEN 'Payout has no matching booking'
      WHEN expected.cents <> p.amount_cents THEN 'Payout amount differs from the booking payout'
      ELSE NULL
    END
  FROM public.payouts p
  LEFT JOIN public.bookings b ON b.id = p.booking_id
  LEFT JOIN LATERAL (
    SELECT GREATEST(0, COALESCE(b.payout_cents, 0) - COALESCE(b.refunded_cents, 0)) AS cents
  ) expected ON true
  WHERE p.order_id IS NULL;

  -- Bookings whose payout was released but have no payout row at all
  INSERT INTO public.payout_reconciliations
    (run_date, scope, status, booking_id, business_id, expected_cents, actual_cents, delta_cents, detail)
  SELECT
    _run_date, 'booking', 'missing', b.id, b.business_id,
    COALESCE(b.payout_cents, 0), 0, -COALESCE(b.payout_cents, 0),
    'Booking payout released but no payout record exists'
  FROM public.bookings b
  WHERE b.payout_released_at IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.payouts p WHERE p.booking_id = b.id);

  -- Shop orders: released payouts must carry a Stripe transfer and match the payout amount
  INSERT INTO public.payout_reconciliations
    (run_date, scope, status, order_id, business_id, expected_cents, actual_cents, delta_cents, detail)
  SELECT
    _run_date, 'product_order',
    CASE
      WHEN o.stripe_transfer_id IS NULL THEN 'missing'
      WHEN COALESCE(o.payout_cents, 0) <> (COALESCE(o.total_cents,0) - COALESCE(o.application_fee_cents,0)) THEN 'mismatch'
      ELSE 'matched'
    END,
    o.id, o.business_id,
    COALESCE(o.total_cents,0) - COALESCE(o.application_fee_cents,0),
    COALESCE(o.payout_cents, 0),
    COALESCE(o.payout_cents,0) - (COALESCE(o.total_cents,0) - COALESCE(o.application_fee_cents,0)),
    CASE
      WHEN o.stripe_transfer_id IS NULL THEN 'Order payout released with no Stripe transfer'
      WHEN COALESCE(o.payout_cents, 0) <> (COALESCE(o.total_cents,0) - COALESCE(o.application_fee_cents,0))
        THEN 'Order payout differs from order total minus platform fee'
      ELSE NULL
    END
  FROM public.product_orders o
  WHERE o.payout_released_at IS NOT NULL;

  SELECT count(*) FILTER (WHERE status = 'matched'),
         count(*) FILTER (WHERE status <> 'matched')
    INTO v_matched, v_problem
  FROM public.payout_reconciliations WHERE run_date = _run_date;

  RETURN jsonb_build_object('run_date', _run_date, 'matched', v_matched, 'problems', v_problem);
END;
$function$;
-- 1. Vertical roles ---------------------------------------------------------
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'marina';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'tackle_shop';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'bait_shop';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gear_mfg';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'apparel';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'guide_service';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'lodge';

-- 2. Reconciliation ledger --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payout_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  scope text NOT NULL,                    -- 'booking' | 'product_order'
  status text NOT NULL,                   -- 'matched' | 'mismatch' | 'missing' | 'orphan'
  payout_id uuid REFERENCES public.payouts(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.product_orders(id) ON DELETE SET NULL,
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  expected_cents integer NOT NULL DEFAULT 0,
  actual_cents integer NOT NULL DEFAULT 0,
  delta_cents integer NOT NULL DEFAULT 0,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payout_recon_run_idx ON public.payout_reconciliations (run_date DESC, status);
CREATE INDEX IF NOT EXISTS payout_recon_biz_idx ON public.payout_reconciliations (business_id);

GRANT SELECT ON public.payout_reconciliations TO authenticated;
GRANT ALL ON public.payout_reconciliations TO service_role;

ALTER TABLE public.payout_reconciliations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read payout reconciliations" ON public.payout_reconciliations;
CREATE POLICY "Admins read payout reconciliations"
  ON public.payout_reconciliations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Daily reconciliation routine -------------------------------------------
CREATE OR REPLACE FUNCTION public.reconcile_payouts(_run_date date DEFAULT (now() AT TIME ZONE 'utc')::date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_matched int := 0;
  v_problem int := 0;
BEGIN
  DELETE FROM public.payout_reconciliations WHERE run_date = _run_date;

  -- Booking payouts: every payout row matched to its booking's payout amount
  INSERT INTO public.payout_reconciliations
    (run_date, scope, status, payout_id, booking_id, business_id, expected_cents, actual_cents, delta_cents, detail)
  SELECT
    _run_date,
    'booking',
    CASE
      WHEN b.id IS NULL THEN 'orphan'
      WHEN COALESCE(b.payout_cents, 0) = p.amount_cents THEN 'matched'
      ELSE 'mismatch'
    END,
    p.id, p.booking_id, p.business_id,
    COALESCE(b.payout_cents, 0), p.amount_cents,
    p.amount_cents - COALESCE(b.payout_cents, 0),
    CASE
      WHEN b.id IS NULL THEN 'Payout has no matching booking'
      WHEN COALESCE(b.payout_cents, 0) <> p.amount_cents THEN 'Payout amount differs from the booking payout'
      ELSE NULL
    END
  FROM public.payouts p
  LEFT JOIN public.bookings b ON b.id = p.booking_id;

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
$$;

REVOKE ALL ON FUNCTION public.reconcile_payouts(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_payouts(date) TO service_role;
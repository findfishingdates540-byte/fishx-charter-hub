CREATE TABLE public.charter_trip_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charter_id uuid NOT NULL REFERENCES public.charters(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  label text NOT NULL,
  description text,
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  duration_minutes integer,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX charter_trip_options_charter_idx
  ON public.charter_trip_options (charter_id) WHERE is_active;

GRANT SELECT ON public.charter_trip_options TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.charter_trip_options TO authenticated;
GRANT ALL ON public.charter_trip_options TO service_role;

ALTER TABLE public.charter_trip_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads active trip options"
  ON public.charter_trip_options FOR SELECT
  USING (is_active OR public.is_business_member(business_id, auth.uid(), 'staff'));

CREATE POLICY "Members manage trip options"
  ON public.charter_trip_options FOR ALL TO authenticated
  USING (public.is_business_member(business_id, auth.uid(), 'staff'))
  WITH CHECK (public.is_business_member(business_id, auth.uid(), 'staff'));

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS trip_option_id uuid REFERENCES public.charter_trip_options(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS trip_option_label text;

DROP FUNCTION IF EXISTS public.reserve_slot(uuid, integer, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.reserve_slot(_slot_id uuid, _party_size integer, _idempotency_key text DEFAULT NULL::text, _notes text DEFAULT NULL::text, _hold_minutes integer DEFAULT 15, _addon_cents integer DEFAULT 0, _trip_option_id uuid DEFAULT NULL)
 RETURNS bookings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  slot public.service_availability;
  svc public.bookable_services;
  biz public.businesses;
  opt public.charter_trip_options;
  b public.bookings;
  rate numeric;
  drate numeric;
  total integer;
  deposit integer;
  balance integer;
  fee integer;
  payout integer;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF _party_size IS NULL OR _party_size < 1 THEN
    RAISE EXCEPTION 'Party size must be at least 1' USING ERRCODE = '22023';
  END IF;

  IF _idempotency_key IS NOT NULL THEN
    SELECT * INTO b FROM public.bookings
      WHERE idempotency_key = _idempotency_key AND angler_id = uid;
    IF FOUND THEN
      RETURN b;
    END IF;
  END IF;

  UPDATE public.bookings
     SET status = 'expired', hold_expires_at = now(), updated_at = now()
   WHERE angler_id = uid
     AND status = 'pending_payment';

  SELECT * INTO slot FROM public.service_availability WHERE id = _slot_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot not found' USING ERRCODE = 'P0002';
  END IF;
  IF slot.is_blackout THEN
    RAISE EXCEPTION 'This date is not available' USING ERRCODE = '22023';
  END IF;
  IF slot.starts_at < now() THEN
    RAISE EXCEPTION 'This slot has already departed' USING ERRCODE = '22023';
  END IF;
  IF slot.seats_booked + _party_size > slot.seats_available THEN
    RAISE EXCEPTION 'Only % seat(s) left on this trip', slot.seats_available - slot.seats_booked
      USING ERRCODE = '23514';
  END IF;

  IF public.trip_block_conflict(slot.service_id, slot.starts_at, slot.ends_at, slot.id) IS NOT NULL THEN
    RAISE EXCEPTION 'This operator is already booked out during that time block — pick another departure.'
      USING ERRCODE = '23505';
  END IF;

  SELECT * INTO svc FROM public.bookable_services WHERE id = slot.service_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO biz FROM public.businesses WHERE id = svc.business_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business not found' USING ERRCODE = 'P0002';
  END IF;

  IF _trip_option_id IS NOT NULL THEN
    SELECT * INTO opt FROM public.charter_trip_options
      WHERE id = _trip_option_id AND is_active;
    IF NOT FOUND OR opt.charter_id IS DISTINCT FROM svc.charter_id THEN
      RAISE EXCEPTION 'That trip option is no longer available — pick another one.'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  total   := COALESCE(opt.price_cents, slot.price_cents, svc.base_price_cents, 0)
             + GREATEST(COALESCE(_addon_cents, 0), 0);
  rate    := COALESCE(biz.commission_rate, 0.15);
  drate   := LEAST(GREATEST(COALESCE(biz.deposit_rate, 0.25), rate), 1.0);
  deposit := ROUND(total * drate);
  balance := total - deposit;
  fee     := LEAST(ROUND(total * rate), deposit);
  payout  := deposit - fee;

  INSERT INTO public.bookings (
    angler_id, captain_id, business_id, service_id, slot_id,
    trip_date, start_time, party_size,
    total_cents, deposit_cents, balance_due_cents, payout_cents, application_fee_cents, commission_rate,
    status, escrow_state, instant_book, notes, idempotency_key,
    hold_expires_at, accept_deadline_at, cancellation_policy,
    trip_option_id, trip_option_label
  ) VALUES (
    uid, biz.created_by, biz.id, svc.id, slot.id,
    (slot.starts_at AT TIME ZONE 'UTC')::date,
    (slot.starts_at AT TIME ZONE 'UTC')::time,
    _party_size,
    total, deposit, balance, payout, fee, rate,
    'pending_payment', 'none', svc.instant_book, _notes, _idempotency_key,
    now() + make_interval(mins => GREATEST(COALESCE(_hold_minutes, 15), 1)),
    CASE WHEN svc.instant_book THEN NULL
         ELSE now() + make_interval(hours => COALESCE(svc.accept_window_hours, 24)) END,
    jsonb_build_object('policy', COALESCE(svc.cancellation_policy, 'moderate')),
    opt.id, opt.label
  )
  RETURNING * INTO b;

  UPDATE public.service_availability
     SET seats_booked = seats_booked + _party_size
   WHERE id = slot.id;

  INSERT INTO public.booking_holds (slot_id, booking_id, angler_id, expires_at)
  VALUES (slot.id, b.id, uid, b.hold_expires_at);

  PERFORM public.emit_domain_event(
    'booking.created', 'booking', b.id,
    jsonb_build_object(
      'booking_id', b.id, 'angler_id', uid, 'business_id', biz.id,
      'service_id', svc.id, 'slot_id', slot.id, 'party_size', _party_size,
      'instant_book', svc.instant_book,
      'trip_option_id', opt.id, 'trip_option_label', opt.label,
      'total_cents', total, 'deposit_cents', deposit, 'balance_due_cents', balance
    )
  );

  RETURN b;
END;
$function$;

REVOKE ALL ON FUNCTION public.reserve_slot(uuid, integer, text, text, integer, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_slot(uuid, integer, text, text, integer, integer, uuid) TO authenticated;
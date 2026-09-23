
ALTER TABLE public.verification_requests
  ADD COLUMN IF NOT EXISTS rejection_reason text;

CREATE TABLE IF NOT EXISTS public.business_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  area text NOT NULL,
  event_type text NOT NULL,
  field text,
  previous_value text,
  new_value text,
  note text,
  actor_id uuid,
  meta_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS business_audit_events_business_idx
  ON public.business_audit_events (business_id, created_at DESC);

GRANT SELECT ON public.business_audit_events TO authenticated;
GRANT ALL ON public.business_audit_events TO service_role;

ALTER TABLE public.business_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read all business history" ON public.business_audit_events;
CREATE POLICY "Staff can read all business history"
  ON public.business_audit_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Team can read their business history" ON public.business_audit_events;
CREATE POLICY "Team can read their business history"
  ON public.business_audit_events FOR SELECT TO authenticated
  USING (public.is_business_member(business_id, auth.uid(), 'staff'));

CREATE OR REPLACE FUNCTION public.log_business_audit(
  _business_id uuid,
  _area text,
  _event_type text,
  _field text,
  _previous text,
  _new text,
  _note text,
  _actor uuid,
  _meta jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.business_audit_events
    (business_id, area, event_type, field, previous_value, new_value, note, actor_id, meta_json)
  VALUES (_business_id, _area, _event_type, _field, _previous, _new, _note, _actor, coalesce(_meta, '{}'::jsonb));
$$;

CREATE OR REPLACE FUNCTION public.businesses_log_readiness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
BEGIN
  IF (OLD.verified_at IS DISTINCT FROM NEW.verified_at) THEN
    PERFORM public.log_business_audit(NEW.id, 'verification',
      CASE WHEN NEW.verified_at IS NULL THEN 'verification_cleared' ELSE 'verified' END,
      'verified_at', OLD.verified_at::text, NEW.verified_at::text, NULL, actor);
  END IF;
  IF (OLD.charges_enabled IS DISTINCT FROM NEW.charges_enabled) THEN
    PERFORM public.log_business_audit(NEW.id, 'payments', 'payments_changed',
      'charges_enabled', OLD.charges_enabled::text, NEW.charges_enabled::text, NULL, actor);
  END IF;
  IF (OLD.payouts_enabled IS DISTINCT FROM NEW.payouts_enabled) THEN
    PERFORM public.log_business_audit(NEW.id, 'payments', 'payments_changed',
      'payouts_enabled', OLD.payouts_enabled::text, NEW.payouts_enabled::text, NULL, actor);
  END IF;
  IF (OLD.stripe_account_id IS DISTINCT FROM NEW.stripe_account_id) THEN
    PERFORM public.log_business_audit(NEW.id, 'payments', 'payments_changed',
      'stripe_account_id', OLD.stripe_account_id, NEW.stripe_account_id, NULL, actor);
  END IF;
  IF (OLD.is_published IS DISTINCT FROM NEW.is_published) THEN
    PERFORM public.log_business_audit(NEW.id, 'profile', 'storefront_visibility',
      'is_published', OLD.is_published::text, NEW.is_published::text, NULL, actor);
  END IF;
  IF (OLD.listing_ready IS DISTINCT FROM NEW.listing_ready) THEN
    PERFORM public.log_business_audit(NEW.id, 'profile', 'listing_readiness',
      'listing_ready', OLD.listing_ready::text, NEW.listing_ready::text, NULL, actor);
  END IF;
  IF (OLD.name IS DISTINCT FROM NEW.name) THEN
    PERFORM public.log_business_audit(NEW.id, 'profile', 'profile_updated', 'name', OLD.name, NEW.name, NULL, actor);
  END IF;
  IF (OLD.city IS DISTINCT FROM NEW.city) THEN
    PERFORM public.log_business_audit(NEW.id, 'profile', 'profile_updated', 'city', OLD.city, NEW.city, NULL, actor);
  END IF;
  IF (OLD.phone IS DISTINCT FROM NEW.phone) THEN
    PERFORM public.log_business_audit(NEW.id, 'profile', 'profile_updated', 'phone', OLD.phone, NEW.phone, NULL, actor);
  END IF;
  IF (OLD.email IS DISTINCT FROM NEW.email) THEN
    PERFORM public.log_business_audit(NEW.id, 'profile', 'profile_updated', 'email', OLD.email, NEW.email, NULL, actor);
  END IF;
  IF (OLD.description IS DISTINCT FROM NEW.description) THEN
    PERFORM public.log_business_audit(NEW.id, 'profile', 'profile_updated', 'description', NULL, NULL, 'Description updated', actor);
  END IF;
  IF (OLD.hero_url IS DISTINCT FROM NEW.hero_url) THEN
    PERFORM public.log_business_audit(NEW.id, 'profile', 'profile_updated', 'hero_url', NULL, NULL, 'Cover photo updated', actor);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS businesses_log_readiness_trg ON public.businesses;
CREATE TRIGGER businesses_log_readiness_trg
  AFTER UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.businesses_log_readiness();

CREATE OR REPLACE FUNCTION public.verification_requests_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_business_audit(NEW.business_id, 'verification', 'documents_submitted', 'status',
      NULL, NEW.status, NULL, NEW.submitted_by,
      jsonb_build_object('requestId', NEW.id, 'docCount', coalesce(array_length(NEW.doc_urls, 1), 0)));
  ELSIF (OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.log_business_audit(NEW.business_id, 'verification',
      CASE WHEN NEW.status = 'approved' THEN 'documents_approved'
           WHEN NEW.status = 'rejected' THEN 'documents_rejected'
           ELSE 'documents_' || NEW.status END,
      'status', OLD.status, NEW.status,
      coalesce(NEW.rejection_reason, NEW.notes), NEW.reviewer_id,
      jsonb_build_object('requestId', NEW.id));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS verification_requests_log_trg ON public.verification_requests;
CREATE TRIGGER verification_requests_log_trg
  AFTER INSERT OR UPDATE ON public.verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.verification_requests_log();

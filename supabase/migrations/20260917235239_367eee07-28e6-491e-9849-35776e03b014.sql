ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS listing_ready boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS listing_grace boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.business_has_bookable(_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bookable_services s
    JOIN public.service_availability a ON a.service_id = s.id
    WHERE s.business_id = _business_id
      AND s.is_published
      AND a.is_blackout = false
      AND a.starts_at > now()
  ) OR EXISTS (
    SELECT 1
    FROM public.inventory_products p
    WHERE p.business_id = _business_id
      AND p.is_published
      AND COALESCE(p.stock_qty, 0) > 0
  );
$$;
REVOKE EXECUTE ON FUNCTION public.business_has_bookable(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.business_is_listable(_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = _business_id
      AND b.is_published
      AND (b.listing_ready OR b.listing_grace)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.business_is_listable(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.business_is_listable(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.recompute_listing_ready(_business_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ready boolean;
BEGIN
  SELECT (b.charges_enabled AND b.payouts_enabled AND public.business_has_bookable(b.id))
    INTO _ready
  FROM public.businesses b
  WHERE b.id = _business_id;

  IF _ready IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.businesses
     SET listing_ready = _ready,
         listing_grace = CASE WHEN _ready THEN false ELSE listing_grace END
   WHERE id = _business_id
     AND (listing_ready IS DISTINCT FROM _ready OR (_ready AND listing_grace));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.recompute_listing_ready(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.businesses_set_listing_ready()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.listing_ready := COALESCE(NEW.charges_enabled, false)
    AND COALESCE(NEW.payouts_enabled, false)
    AND public.business_has_bookable(NEW.id);
  IF NEW.listing_ready THEN
    NEW.listing_grace := false;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.businesses_set_listing_ready() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_businesses_listing_ready ON public.businesses;
CREATE TRIGGER trg_businesses_listing_ready
  BEFORE UPDATE OF charges_enabled, payouts_enabled, is_published ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.businesses_set_listing_ready();

CREATE OR REPLACE FUNCTION public.child_recompute_listing_ready()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _biz uuid;
BEGIN
  IF TG_TABLE_NAME = 'service_availability' THEN
    SELECT s.business_id INTO _biz FROM public.bookable_services s
     WHERE s.id = COALESCE(NEW.service_id, OLD.service_id);
  ELSE
    _biz := COALESCE(NEW.business_id, OLD.business_id);
  END IF;
  IF _biz IS NOT NULL THEN
    PERFORM public.recompute_listing_ready(_biz);
  END IF;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.child_recompute_listing_ready() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_services_listing_ready ON public.bookable_services;
CREATE TRIGGER trg_services_listing_ready
  AFTER INSERT OR UPDATE OF is_published, business_id OR DELETE ON public.bookable_services
  FOR EACH ROW EXECUTE FUNCTION public.child_recompute_listing_ready();

DROP TRIGGER IF EXISTS trg_availability_listing_ready ON public.service_availability;
CREATE TRIGGER trg_availability_listing_ready
  AFTER INSERT OR UPDATE OF starts_at, is_blackout OR DELETE ON public.service_availability
  FOR EACH ROW EXECUTE FUNCTION public.child_recompute_listing_ready();

DROP TRIGGER IF EXISTS trg_products_listing_ready ON public.inventory_products;
CREATE TRIGGER trg_products_listing_ready
  AFTER INSERT OR UPDATE OF is_published, stock_qty, business_id OR DELETE ON public.inventory_products
  FOR EACH ROW EXECUTE FUNCTION public.child_recompute_listing_ready();

-- Backfill: compute readiness, and grandfather every operator that is public today.
UPDATE public.businesses b
   SET listing_ready = (b.charges_enabled AND b.payouts_enabled AND public.business_has_bookable(b.id));

UPDATE public.businesses
   SET listing_grace = true
 WHERE is_published = true AND listing_ready = false;

-- Public visibility now requires readiness (or the grandfather flag).
DROP POLICY IF EXISTS "Published businesses are public" ON public.businesses;
CREATE POLICY "Published businesses are public" ON public.businesses FOR SELECT
  USING (is_published = true AND (listing_ready = true OR listing_grace = true));

DROP POLICY IF EXISTS "Published services are public" ON public.bookable_services;
CREATE POLICY "Published services are public" ON public.bookable_services FOR SELECT
  USING (is_published = true AND public.business_is_listable(business_id));

DROP POLICY IF EXISTS "Public can view published products" ON public.inventory_products;
CREATE POLICY "Public can view published products" ON public.inventory_products FOR SELECT
  USING (is_published = true AND public.business_is_listable(business_id));
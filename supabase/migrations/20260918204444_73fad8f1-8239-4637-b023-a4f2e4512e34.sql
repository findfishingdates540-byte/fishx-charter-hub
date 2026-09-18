CREATE OR REPLACE FUNCTION public.user_booked_business(_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.business_id = _business_id
      AND auth.uid() IS NOT NULL
      AND (b.angler_id = auth.uid() OR b.customer_id = auth.uid())
  );
$$;
REVOKE EXECUTE ON FUNCTION public.user_booked_business(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_booked_business(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.user_booked_service(_service_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.service_id = _service_id
      AND auth.uid() IS NOT NULL
      AND (b.angler_id = auth.uid() OR b.customer_id = auth.uid())
  );
$$;
REVOKE EXECUTE ON FUNCTION public.user_booked_service(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_booked_service(uuid) TO authenticated;

DROP POLICY IF EXISTS "Customers can view businesses they booked" ON public.businesses;
CREATE POLICY "Customers can view businesses they booked" ON public.businesses FOR SELECT
  TO authenticated
  USING (public.user_booked_business(id));

DROP POLICY IF EXISTS "Customers can view services they booked" ON public.bookable_services;
CREATE POLICY "Customers can view services they booked" ON public.bookable_services FOR SELECT
  TO authenticated
  USING (public.user_booked_service(id));
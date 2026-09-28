CREATE OR REPLACE FUNCTION public.business_is_listable(_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = _business_id
      AND b.is_published
      AND (b.listing_ready OR b.listing_grace)
  );
$function$;
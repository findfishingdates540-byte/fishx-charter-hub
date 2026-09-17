CREATE TABLE public.product_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  code text NOT NULL,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  value integer NOT NULL CHECK (value > 0),
  minimum_order_cents integer NOT NULL DEFAULT 0 CHECK (minimum_order_cents >= 0),
  starts_at timestamptz,
  expires_at timestamptz,
  max_redemptions integer CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  redemption_count integer NOT NULL DEFAULT 0 CHECK (redemption_count >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX product_discounts_business_code_unique
  ON public.product_discounts (business_id, lower(code));
CREATE INDEX product_discounts_business_active_idx
  ON public.product_discounts (business_id, is_active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_discounts TO authenticated;
GRANT ALL ON public.product_discounts TO service_role;

ALTER TABLE public.product_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view product discounts"
ON public.product_discounts FOR SELECT TO authenticated
USING (public.is_business_member(business_id, auth.uid(), 'staff'));

CREATE POLICY "Business managers can create product discounts"
ON public.product_discounts FOR INSERT TO authenticated
WITH CHECK (public.is_business_member(business_id, auth.uid(), 'manager'));

CREATE POLICY "Business managers can update product discounts"
ON public.product_discounts FOR UPDATE TO authenticated
USING (public.is_business_member(business_id, auth.uid(), 'manager'))
WITH CHECK (public.is_business_member(business_id, auth.uid(), 'manager'));

CREATE POLICY "Business managers can delete product discounts"
ON public.product_discounts FOR DELETE TO authenticated
USING (public.is_business_member(business_id, auth.uid(), 'manager'));

CREATE TRIGGER update_product_discounts_updated_at
BEFORE UPDATE ON public.product_discounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.product_orders
  ADD COLUMN IF NOT EXISTS discount_code text,
  ADD COLUMN IF NOT EXISTS discount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS buyer_marketing_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_consent_at timestamptz;

CREATE OR REPLACE FUNCTION public.validate_product_discount_dates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.starts_at IS NOT NULL AND NEW.expires_at IS NOT NULL AND NEW.expires_at <= NEW.starts_at THEN
    RAISE EXCEPTION 'Discount expiry must be after its start date';
  END IF;
  IF NEW.discount_type = 'percentage' AND NEW.value > 100 THEN
    RAISE EXCEPTION 'Percentage discounts cannot exceed 100 percent';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_product_discount_dates_trigger
BEFORE INSERT OR UPDATE ON public.product_discounts
FOR EACH ROW EXECUTE FUNCTION public.validate_product_discount_dates();
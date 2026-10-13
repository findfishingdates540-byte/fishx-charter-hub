DROP POLICY IF EXISTS "Shipping settings are publicly readable" ON public.vendor_shipping_settings;
CREATE POLICY "Signed-in users can read shipping settings" ON public.vendor_shipping_settings FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON public.vendor_shipping_settings FROM anon;
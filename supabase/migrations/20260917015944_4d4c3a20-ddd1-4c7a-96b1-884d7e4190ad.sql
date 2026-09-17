
-- 1. Businesses: anonymous visitors lose access to financial/Stripe columns.
REVOKE SELECT ON public.businesses FROM anon;
GRANT SELECT (
  id, slug, name, category_key, tagline, description, hero_url, logo_url, website,
  phone, email, address, city, region, country, lat, lng, hours_json, amenities_json,
  is_published, verified_at, premium_until, fishx_business_id, created_by, created_at,
  updated_at, charges_enabled, payouts_enabled, onboarding_completed_at, gallery_json,
  social_json, policies_json, highlights_json, faq_json, year_founded
) ON public.businesses TO anon;

-- 2. Chat attachments: participant-only reads.
DROP POLICY IF EXISTS "message media readable" ON storage.objects;

CREATE POLICY "message media participants read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'message-media'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR EXISTS (
        SELECT 1 FROM public.booking_messages m
        WHERE m.attachment_url IS NOT NULL
          AND m.attachment_url LIKE '%' || storage.objects.name
      )
      OR EXISTS (
        SELECT 1 FROM public.business_messages bm
        WHERE bm.attachment_url IS NOT NULL
          AND bm.attachment_url LIKE '%' || storage.objects.name
      )
    )
  );

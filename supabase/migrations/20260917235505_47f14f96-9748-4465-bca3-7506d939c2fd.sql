ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS listing_grace_notified_at timestamptz;
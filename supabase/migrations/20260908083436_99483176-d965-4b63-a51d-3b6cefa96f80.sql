ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS stripe_transfer_id text,
  ADD COLUMN IF NOT EXISTS stripe_bank_payout_id text,
  ADD COLUMN IF NOT EXISTS destination_account_id text,
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.product_orders(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payouts_bank_payout_id_key
  ON public.payouts (stripe_bank_payout_id) WHERE stripe_bank_payout_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payouts_transfer_id_idx ON public.payouts (stripe_transfer_id);

UPDATE public.payouts SET stripe_transfer_id = stripe_payout_id
  WHERE stripe_transfer_id IS NULL AND stripe_payout_id LIKE 'tr_%';
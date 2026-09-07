SELECT cron.schedule(
  'daily-payout-reconciliation',
  '0 4 * * *',
  $$ SELECT public.reconcile_payouts(); $$
);
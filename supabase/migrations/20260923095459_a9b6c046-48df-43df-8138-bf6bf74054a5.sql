REVOKE EXECUTE ON FUNCTION public.log_business_audit(uuid, text, text, text, text, text, text, uuid, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.businesses_log_readiness() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.verification_requests_log() FROM anon, authenticated, public;
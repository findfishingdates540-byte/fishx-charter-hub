CREATE TABLE public.verification_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  request_id uuid REFERENCES public.verification_requests(id) ON DELETE SET NULL,
  document_key text NOT NULL,
  document_label text NOT NULL,
  file_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','reopened')),
  rejection_reason text,
  reviewer_id uuid,
  decided_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  is_current boolean NOT NULL DEFAULT true,
  replaces_document_id uuid REFERENCES public.verification_documents(id) ON DELETE SET NULL,
  submitted_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.verification_documents TO authenticated;
GRANT ALL ON public.verification_documents TO service_role;
ALTER TABLE public.verification_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members view verification documents"
  ON public.verification_documents FOR SELECT TO authenticated
  USING (public.is_business_member(business_id, auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Managers submit verification documents"
  ON public.verification_documents FOR INSERT TO authenticated
  WITH CHECK (
    public.is_business_member(business_id, auth.uid(), 'manager')
    AND submitted_by = auth.uid()
    AND status = 'pending'
    AND reviewer_id IS NULL
    AND decided_at IS NULL
  );
CREATE UNIQUE INDEX verification_documents_one_current
  ON public.verification_documents (business_id, document_key)
  WHERE is_current;
CREATE INDEX verification_documents_business_status_idx
  ON public.verification_documents (business_id, is_current, status, created_at DESC);
CREATE TRIGGER trg_verification_documents_updated
  BEFORE UPDATE ON public.verification_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.submit_verification_document(
  _business_id uuid,
  _document_key text,
  _document_label text,
  _file_path text
) RETURNS public.verification_documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current public.verification_documents;
  _new public.verification_documents;
  _version integer := 1;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_business_member(_business_id, auth.uid(), 'manager') THEN
    RAISE EXCEPTION 'You do not have permission to manage this business';
  END IF;
  IF _document_key !~ '^[a-z0-9_]{1,64}$' OR length(trim(_document_label)) < 2 OR length(trim(_file_path)) < 3 THEN
    RAISE EXCEPTION 'Invalid document details';
  END IF;
  IF _file_path NOT LIKE _business_id::text || '/%' THEN
    RAISE EXCEPTION 'Invalid document path';
  END IF;

  SELECT * INTO _current
  FROM public.verification_documents
  WHERE business_id = _business_id AND document_key = _document_key AND is_current
  FOR UPDATE;

  IF FOUND THEN
    IF _current.status NOT IN ('rejected', 'reopened') THEN
      RAISE EXCEPTION 'This document is locked while pending or approved';
    END IF;
    _version := _current.version + 1;
    UPDATE public.verification_documents SET is_current = false WHERE id = _current.id;
  END IF;

  INSERT INTO public.verification_documents (
    business_id, document_key, document_label, file_path, status,
    version, replaces_document_id, submitted_by
  ) VALUES (
    _business_id, _document_key, trim(_document_label), _file_path, 'pending',
    _version, _current.id, auth.uid()
  ) RETURNING * INTO _new;

  UPDATE public.businesses SET verified_at = NULL WHERE id = _business_id;
  RETURN _new;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_verification_document(uuid,text,text,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_verification_document(uuid,text,text,text) FROM anon, public;

INSERT INTO public.verification_documents (
  business_id, request_id, document_key, document_label, file_path, status,
  rejection_reason, reviewer_id, decided_at, version, is_current, submitted_by, created_at, updated_at
)
SELECT
  vr.business_id,
  vr.id,
  'legacy_' || files.ordinality::text,
  'Legacy document ' || files.ordinality::text,
  files.file_path,
  CASE vr.status WHEN 'approved' THEN 'approved' WHEN 'rejected' THEN 'rejected' ELSE 'pending' END,
  CASE WHEN vr.status = 'rejected' THEN coalesce(vr.rejection_reason, vr.notes) END,
  vr.reviewer_id,
  vr.decided_at,
  1,
  true,
  vr.submitted_by,
  vr.created_at,
  vr.updated_at
FROM public.verification_requests vr
CROSS JOIN LATERAL unnest(vr.doc_urls) WITH ORDINALITY AS files(file_path, ordinality)
WHERE NOT EXISTS (
  SELECT 1 FROM public.verification_documents vd WHERE vd.request_id = vr.id AND vd.file_path = files.file_path
);
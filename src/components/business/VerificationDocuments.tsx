import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileCheck2, FileClock, FileWarning, LockKeyhole, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createVerificationUploadUrl } from "@/lib/onboarding.functions";
import { getVerificationDocuments, submitVerificationDocument } from "@/lib/verification-documents.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/operator/OperatorShell";
import { toast } from "sonner";

const statusCopy: Record<string, { label: string; color: string; icon: typeof FileCheck2 }> = {
  approved: { label: "Accepted", color: "#22C55E", icon: FileCheck2 },
  pending: { label: "Under review", color: "#2DE2F2", icon: FileClock },
  rejected: { label: "Needs resubmission", color: "#F87171", icon: FileWarning },
  reopened: { label: "Replacement requested", color: "#FBBF24", icon: FileWarning },
};

export function VerificationDocuments({ businessId }: { businessId: string }) {
  const fetchDocs = useServerFn(getVerificationDocuments);
  const createUpload = useServerFn(createVerificationUploadUrl);
  const submit = useServerFn(submitVerificationDocument);
  const qc = useQueryClient();
  const [uploading, setUploading] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["verification-documents", businessId], queryFn: () => fetchDocs({ data: { businessId } }) });
  const mutation = useMutation({
    mutationFn: async ({ key, title, file }: { key: string; title: string; file: File }) => {
      setUploading(key);
      const signed = await createUpload({ data: { docKey: key, filename: file.name } });
      const { error } = await supabase.storage.from("verification-docs").uploadToSignedUrl(signed.path, signed.token, file);
      if (error) throw error;
      return submit({ data: { businessId, documentKey: key, documentLabel: title, filePath: signed.path } });
    },
    onSuccess: () => { toast.success("Document sent for review"); qc.invalidateQueries({ queryKey: ["verification-documents", businessId] }); qc.invalidateQueries({ queryKey: ["business-settings", businessId] }); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Document could not be submitted"),
    onSettled: () => setUploading(null),
  });
  if (query.isLoading) return <Card eyebrow="Compliance" title="Verification documents"><p style={{ color: "#92A0AB" }}>Loading documents…</p></Card>;
  if (query.error || !query.data) return <Card eyebrow="Compliance" title="Verification documents"><p style={{ color: "#F87171" }}>Documents could not be loaded.</p></Card>;
  const byKey = new Map(query.data.documents.map((doc: any) => [doc.document_key, doc]));
  return <Card eyebrow="Compliance" title="Verification documents">
    <div style={{ display: "grid", gap: 12 }}>
      <p style={{ color: "#92A0AB", fontSize: 13.5, margin: 0 }}>Accepted files are locked. If a replacement is needed, Fish-X staff will reopen that document.</p>
      {query.data.required.map((spec) => {
        const doc: any = byKey.get(spec.key);
        const state = doc ? statusCopy[doc.status] ?? statusCopy.pending : { label: "Not submitted", color: "#92A0AB", icon: Upload };
        const Icon = state.icon;
        const canUpload = !doc || doc.status === "rejected" || doc.status === "reopened";
        return <div key={spec.key} style={{ border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: 16, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <Icon size={20} color={state.color} style={{ marginTop: 2, flex: "0 0 auto" }} />
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ color: "#F0F2F5", fontWeight: 700 }}>{spec.title}</div><div style={{ color: "#92A0AB", fontSize: 12.5 }}>{spec.desc}</div></div>
            <span style={{ color: state.color, fontSize: 12, fontWeight: 800 }}>{state.label}</span>
          </div>
          {doc?.rejection_reason ? <div style={{ background: "rgba(248,113,113,.1)", borderLeft: "3px solid #F87171", padding: "10px 12px", color: "#F0F2F5", fontSize: 13 }}>{doc.rejection_reason}</div> : null}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {doc?.viewUrl ? <a href={doc.viewUrl} target="_blank" rel="noreferrer" style={{ color: "#2DE2F2", fontSize: 13, fontWeight: 700 }}>View file ↗</a> : null}
            {doc?.decided_at ? <span style={{ color: "#5E7183", fontSize: 12 }}>Reviewed {new Date(doc.decided_at).toLocaleDateString()}</span> : null}
            {canUpload ? <Button asChild size="sm" disabled={mutation.isPending} style={{ marginLeft: "auto" }}><label style={{ cursor: "pointer" }}><Upload size={14} />{uploading === spec.key ? "Uploading…" : doc ? "Upload replacement" : "Upload document"}<input hidden type="file" accept="image/*,.pdf" disabled={mutation.isPending} onChange={(event) => { const file = event.target.files?.[0]; if (file) mutation.mutate({ key: spec.key, title: spec.title, file }); event.target.value = ""; }} /></label></Button> : <span style={{ marginLeft: "auto", color: "#92A0AB", fontSize: 12, display: "inline-flex", gap: 6, alignItems: "center" }}><LockKeyhole size={13} />{doc?.status === "approved" ? "Locked" : "Awaiting decision"}</span>}
          </div>
        </div>;
      })}
      {query.data.documents.filter((doc: any) => doc.document_key.startsWith("legacy_")).length > 0 ? <div style={{ color: "#92A0AB", fontSize: 12.5 }}>Earlier submitted documents remain securely stored in your verification history.</div> : null}
    </div>
  </Card>;
}
/**
 * Admin document viewer: shows the operator's file inline (image or PDF) with
 * the approve / reject / reopen decision beside it. Approve unlocks once the
 * file has been displayed.
 */
import { useEffect, useState } from "react";

const T = { bg: "#0D161F", card: "#14202B", line: "#22333F", ink: "#E8F2F6", mut: "#8AA2B0", accent: "#2DE2F2", bad: "#F87171" };
const btn: React.CSSProperties = { background: T.accent, color: "#04121B", border: 0, borderRadius: 10, padding: "9px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" };
const ghost: React.CSSProperties = { ...btn, background: "transparent", color: T.ink, border: `1px solid ${T.line}` };

function kindOf(doc: any): "image" | "pdf" | "other" {
  const path = String(doc.file_path ?? doc.viewUrl ?? "").split("?")[0].toLowerCase();
  if (/\.(png|jpe?g|gif|webp|heic|avif)$/.test(path)) return "image";
  if (path.endsWith(".pdf")) return "pdf";
  return "other";
}

export function DocumentPreviewDialog({
  doc,
  busy,
  error,
  onClose,
  onDecide,
}: {
  doc: any;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onDecide: (action: "approve" | "reject" | "reopen", reason?: string) => void;
}) {
  const [seen, setSeen] = useState(false);
  const [mode, setMode] = useState<null | "reject" | "reopen">(null);
  const [reason, setReason] = useState("");
  const kind = kindOf(doc);

  useEffect(() => {
    const t = setTimeout(() => setSeen(true), kind === "other" ? 0 : 1200);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, [kind, onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={`${doc.document_label} preview`} onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 100, display: "grid", placeItems: "center", padding: 12 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, width: "min(1000px,100%)", maxHeight: "94vh", display: "grid", gridTemplateRows: "auto 1fr auto", overflow: "hidden", color: T.ink, fontFamily: "Outfit, sans-serif" }}>
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.line}`, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}>{doc.document_label}</div>
            <div style={{ color: T.mut, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {doc.business?.name ?? "Unknown business"} · version {doc.version} · {String(doc.status)}
            </div>
          </div>
          <button aria-label="Close" onClick={onClose} style={{ ...ghost, padding: "6px 11px" }}>✕</button>
        </div>

        <div style={{ background: T.bg, overflow: "auto", minHeight: 300, display: "grid", placeItems: "center" }}>
          {kind === "image" && <img src={doc.viewUrl} alt={doc.document_label} onLoad={() => setSeen(true)} style={{ maxWidth: "100%", maxHeight: "68vh", objectFit: "contain" }} />}
          {kind === "pdf" && <iframe src={doc.viewUrl} title={doc.document_label} style={{ width: "100%", height: "68vh", border: 0, background: "#fff" }} />}
          {kind === "other" && (
            <div style={{ padding: 30, textAlign: "center", color: T.mut }}>
              This file type can't be shown here. Open it in a new tab to check it.
            </div>
          )}
        </div>

        <div style={{ padding: "14px 18px", borderTop: `1px solid ${T.line}`, display: "grid", gap: 10 }}>
          {mode && (
            <>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                placeholder={mode === "reopen" ? "Why does this accepted document need replacing?" : "What's wrong with this document? The operator sees this."}
                style={{ background: T.bg, color: T.ink, border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 12px", fontSize: 13.5, fontFamily: "inherit", resize: "vertical" }} />
              {reason.trim().length < 10 && <div style={{ color: T.mut, fontSize: 12 }}>A reason of at least 10 characters is required.</div>}
            </>
          )}
          {error && <div style={{ color: T.bad, fontSize: 13 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a href={doc.viewUrl} target="_blank" rel="noreferrer" onClick={() => setSeen(true)} style={{ ...ghost, textDecoration: "none" }}>Open in new tab</a>
              <a href={doc.viewUrl} download style={{ ...ghost, textDecoration: "none" }}>Download</a>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {doc.status === "pending" && !mode && (
                <>
                  <button style={{ ...ghost, color: T.bad, borderColor: T.bad }} disabled={busy} onClick={() => setMode("reject")}>Reject</button>
                  <button style={{ ...btn, opacity: seen ? 1 : 0.5 }} disabled={busy || !seen} title={seen ? "" : "Look over the document first"} onClick={() => onDecide("approve")}>
                    {busy ? "Saving…" : "Approve"}
                  </button>
                </>
              )}
              {doc.status === "approved" && !mode && <button style={ghost} disabled={busy} onClick={() => setMode("reopen")}>Reopen</button>}
              {mode && (
                <>
                  <button style={ghost} onClick={() => { setMode(null); setReason(""); }}>Cancel</button>
                  <button style={{ ...btn, background: T.bad }} disabled={busy || reason.trim().length < 10} onClick={() => onDecide(mode, reason.trim())}>
                    {busy ? "Saving…" : mode === "reopen" ? "Reopen document" : "Reject with reason"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

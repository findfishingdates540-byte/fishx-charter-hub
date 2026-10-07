import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount } from "@/lib/account-deletion.functions";

export function DeleteAccountCard({ dark }: { dark?: boolean }) {
  const del = useServerFn(deleteMyAccount);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ink = dark ? "#eaf1f6" : "#031029";
  const mut = dark ? "#9fb3c4" : "#5b6b7c";
  const line = dark ? "rgba(255,255,255,.12)" : "rgba(3,16,41,.12)";

  const run = async () => {
    setBusy(true);
    setErr("");
    const res = await del({ data: { confirm: "DELETE" } }).catch(() => ({ ok: false as const, message: "Something went wrong. Try again." }));
    if (!res.ok) {
      setErr(res.message);
      setBusy(false);
      return;
    }
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/welcome", replace: true });
  };

  return (
    <div style={{ marginTop: 22, border: `1px solid ${line}`, borderRadius: 20, padding: 22, color: ink }}>
      <h2 style={{ fontSize: 17, margin: "0 0 6px" }}>Delete account</h2>
      <p style={{ fontSize: 13, color: mut, margin: "0 0 14px" }}>
        Permanently remove your account and sign-in. This can't be undone.
      </p>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)}
          style={{ padding: "10px 16px", borderRadius: 12, border: "1px solid #d9443a", background: "transparent", color: "#d9443a", fontWeight: 600 }}>
          Delete my account
        </button>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          <label style={{ fontSize: 13, color: mut }}>
            Type DELETE to confirm
            <input value={text} onChange={(e) => setText(e.target.value)}
              style={{ display: "block", width: "100%", marginTop: 6, padding: 10, borderRadius: 10, border: `1px solid ${line}`, background: "transparent", color: ink }} />
          </label>
          {err && <p role="alert" style={{ color: "#d9443a", fontSize: 13, margin: 0 }}>{err}</p>}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" disabled={text !== "DELETE" || busy} onClick={run}
              style={{ padding: "10px 16px", borderRadius: 12, border: 0, background: "#d9443a", color: "#fff", fontWeight: 600, opacity: text !== "DELETE" || busy ? 0.5 : 1 }}>
              {busy ? "Deleting…" : "Permanently delete"}
            </button>
            <button type="button" onClick={() => { setOpen(false); setText(""); }}
              style={{ padding: "10px 16px", borderRadius: 12, border: `1px solid ${line}`, background: "transparent", color: ink }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/brand/BrandLogo";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — FISH-X.COM" },
      { name: "description", content: "Choose a new password for your FISH-X.COM account." },
      { property: "og:title", content: "Set a new password — FISH-X.COM" },
      { property: "og:description", content: "Choose a new password for your FISH-X.COM account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(error.message);
    setDone(true);
    setTimeout(() => navigate({ to: "/dashboard" }), 1500);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-6 flex justify-center"><BrandLogo /></div>
        <h1 className="text-2xl font-semibold text-foreground">Set a new password</h1>
        {done ? (
          <p className="mt-4 text-sm text-muted-foreground">Password updated. Taking you to your dashboard…</p>
        ) : !ready ? (
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <p>Open this page from the reset link in your email. If the link expired, request a new one.</p>
            <button type="button" className="text-primary underline" onClick={() => navigate({ to: "/auth" })}>
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <input type="password" autoComplete="new-password" placeholder="New password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground" />
            <input type="password" autoComplete="new-password" placeholder="Confirm new password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground" />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button type="submit" disabled={busy}
              className="w-full rounded-lg bg-primary px-3 py-2 font-medium text-primary-foreground disabled:opacity-60">
              {busy ? "Saving…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

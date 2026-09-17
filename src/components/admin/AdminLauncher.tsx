/**
 * Small floating shortcut into the admin console. Only rendered for signed-in
 * accounts that actually hold the platform `admin` role (checked server-side).
 */
import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { isPlatformAdmin } from "@/lib/admin.functions";

export function AdminLauncher() {
  const [signedIn, setSignedIn] = useState(false);
  const check = useServerFn(isPlatformAdmin);
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setSignedIn(Boolean(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(Boolean(session));
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const { data } = useQuery({
    queryKey: ["is-platform-admin"],
    queryFn: () => check(),
    enabled: signedIn,
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (!data?.admin || path.startsWith("/admin")) return null;

  return (
    <Link
      to="/admin"
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 60,
        background: "#2DE2F2",
        color: "#04121B",
        borderRadius: 999,
        padding: "10px 16px",
        fontSize: 13,
        fontWeight: 700,
        textDecoration: "none",
        boxShadow: "0 8px 24px rgba(0,0,0,.35)",
      }}
    >
      Admin console
    </Link>
  );
}

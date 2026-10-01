import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Bell, LogOut, Menu, MessageCircle, Settings, X } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  displayName?: string | null;
  actions?: ReactNode;
};

const MEMBER_LINKS = [
  { to: "/dashboard", tab: "home", label: "Home" },
  { to: "/dashboard", tab: "trips", label: "My Trips" },
  { to: "/dashboard", tab: "history", label: "History" },
  { to: "/dashboard", tab: "explore", label: "Explore" },
  { to: "/dashboard", tab: "wallet", label: "Wallet" },
  { to: "/dashboard", tab: "orders", label: "Orders" },
] as const;

export function AuthenticatedHeader({ displayName, actions }: Props) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const currentTab = useRouterState({
    select: (state) => {
      const tab = (state.location.search as { tab?: unknown } | undefined)?.tab;
      return typeof tab === "string" ? tab : "home";
    },
  });
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const name = displayName?.trim() || "Account";
  const initial = name.charAt(0).toUpperCase() || "A";

  async function signOut() {
    await supabase.auth.signOut();
    setOpen(false);
    navigate({ to: "/", replace: true });
  }

  function memberLink(item: (typeof MEMBER_LINKS)[number]) {
    const active = pathname === "/dashboard" && currentTab === item.tab;
    return (
      <Link
        key={item.tab}
        to={item.to}
        search={{ tab: item.tab }}
        className={active ? "is-active" : undefined}
        onClick={() => setOpen(false)}
      >
        {item.label}
      </Link>
    );
  }

  return (
    <header className="fx-member-header" data-open={open ? "true" : "false"}>
      <div className="fx-member-bar">
        <Link to="/dashboard" className="fx-member-brand" aria-label="Fish-X dashboard">
          <BrandLogo size="md" accent="var(--sand)" color="var(--ond)" />
        </Link>
        <nav className="fx-member-nav" aria-label="Signed-in navigation">
          {MEMBER_LINKS.map(memberLink)}
          <Link to="/messages" className={pathname.startsWith("/messages") ? "is-active" : undefined}>Messages</Link>
          <Link to="/marketplace" className={pathname.startsWith("/marketplace") ? "is-active" : undefined}>Marketplace</Link>
        </nav>
        <div className="fx-member-actions">
          {actions && <div className="fx-member-custom-actions">{actions}</div>}
          <NotificationBell />
          <Link to="/settings" className="fx-member-icon" title="Settings" aria-label="Settings"><Settings size={18} strokeWidth={1.7} /></Link>
          <Link to="/settings" className="fx-member-account" title="Your account"><span>{initial}</span><strong>{name.split(" ")[0]}</strong></Link>
          <button type="button" className="fx-member-icon fx-member-signout" onClick={signOut} title="Sign out" aria-label="Sign out"><LogOut size={18} strokeWidth={1.7} /></button>
          <button type="button" className="fx-member-menu" onClick={() => setOpen((value) => !value)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      <div className="fx-member-drawer">
        <div className="fx-member-drawer-profile"><span>{initial}</span><div><strong>{name}</strong><small>Signed in</small></div></div>
        <nav aria-label="Mobile signed-in navigation">
          {MEMBER_LINKS.map(memberLink)}
          <Link to="/messages" onClick={() => setOpen(false)}><MessageCircle size={17} /> Messages</Link>
          <Link to="/notifications" onClick={() => setOpen(false)}><Bell size={17} /> Notifications</Link>
          <Link to="/settings" onClick={() => setOpen(false)}><Settings size={17} /> Account & settings</Link>
          <button type="button" onClick={signOut}><LogOut size={17} /> Sign out</button>
        </nav>
      </div>
    </header>
  );
}
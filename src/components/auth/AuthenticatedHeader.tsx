import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Bell, LogOut, Menu, MessageCircle, Settings, X } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { supabase } from "@/integrations/supabase/client";

export type AuthenticatedHeaderTab = { key: string; label: string };

type Props = {
  displayName?: string | null;
  tabs?: AuthenticatedHeaderTab[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
  actions?: ReactNode;
};

const BROWSE_LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/charters/search", label: "Charters" },
  { to: "/services/search", label: "Explore" },
  { to: "/marketplace", label: "Marketplace" },
] as const;

export function AuthenticatedHeader({ displayName, tabs, activeTab, onTabChange, actions }: Props) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const name = displayName?.trim() || "Account";
  const initial = name.charAt(0).toUpperCase() || "A";

  async function signOut() {
    await supabase.auth.signOut();
    setOpen(false);
    navigate({ to: "/", replace: true });
  }

  function tabButton(tab: AuthenticatedHeaderTab) {
    return (
      <button key={tab.key} type="button" className={activeTab === tab.key ? "is-active" : undefined} onClick={() => { onTabChange?.(tab.key); setOpen(false); }}>
        {tab.label}
      </button>
    );
  }

  function browseLink(item: (typeof BROWSE_LINKS)[number]) {
    return (
      <Link key={item.to} to={item.to} className={pathname.startsWith(item.to) ? "is-active" : undefined} onClick={() => setOpen(false)}>
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
          {tabs ? tabs.map(tabButton) : BROWSE_LINKS.map(browseLink)}
          <Link to="/messages" className={pathname.startsWith("/messages") ? "is-active" : undefined}>Messages</Link>
          {tabs && <Link to="/marketplace" className={pathname.startsWith("/marketplace") ? "is-active" : undefined}>Marketplace</Link>}
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
          {tabs ? tabs.map(tabButton) : BROWSE_LINKS.map(browseLink)}
          <Link to="/messages" onClick={() => setOpen(false)}><MessageCircle size={17} /> Messages</Link>
          <Link to="/notifications" onClick={() => setOpen(false)}><Bell size={17} /> Notifications</Link>
          <Link to="/settings" onClick={() => setOpen(false)}><Settings size={17} /> Account & settings</Link>
          <button type="button" onClick={signOut}><LogOut size={17} /> Sign out</button>
        </nav>
      </div>
    </header>
  );
}
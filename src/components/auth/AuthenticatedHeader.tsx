import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, LogOut, Menu, MessageCircle, Settings, X } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { supabase } from "@/integrations/supabase/client";
import { getMyBootstrap } from "@/lib/auth.functions";

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

const SHOP_KINDS = ["tackle_shop", "bait_shop", "gear_mfg", "apparel"];

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
  const { data: bootstrap } = useQuery({
    queryKey: ["my-bootstrap"],
    queryFn: () => getMyBootstrap(),
    staleTime: 5 * 60_000,
  });
  const name = displayName?.trim() || "Account";
  const initial = name.charAt(0).toUpperCase() || "A";
  const memberships = Array.isArray(bootstrap?.businesses) ? bootstrap.businesses : [];
  const business = memberships.map((membership) => membership?.business).find(Boolean);
  const category = business?.category_key;
  const businessId = business?.id ?? "";
  const isOperator = Boolean(business);

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

  function operatorLinks() {
    if (SHOP_KINDS.includes(category ?? "")) {
      return (
        <>
          <Link to="/shop/$section" params={{ section: "overview" }} search={{ biz: businessId }}>Home</Link>
          <Link to="/shop/$section" params={{ section: "orders" }} search={{ biz: businessId }}>Orders</Link>
          <Link to="/shop/$section" params={{ section: "products" }} search={{ biz: businessId }}>Products</Link>
          <Link to="/shop/$section" params={{ section: "messages" }} search={{ biz: businessId }}>Messages</Link>
          <Link to="/shop/$section" params={{ section: "payments" }} search={{ biz: businessId }}>Payments</Link>
          <Link to="/shop/$section" params={{ section: "settings" }} search={{ biz: businessId }}>Settings</Link>
          <Link to="/marketplace">Marketplace</Link>
        </>
      );
    }
    if (category === "marina" || category === "lodge") {
      return (
        <>
          <Link to="/marina/$section" params={{ section: "overview" }} search={{ biz: businessId }}>Home</Link>
          <Link to="/marina/$section" params={{ section: "bookings" }} search={{ biz: businessId }}>Bookings</Link>
          <Link to="/marina/$section" params={{ section: "listings" }} search={{ biz: businessId }}>Listings</Link>
          <Link to="/marina/$section" params={{ section: "messages" }} search={{ biz: businessId }}>Messages</Link>
          <Link to="/marina/$section" params={{ section: "payouts" }} search={{ biz: businessId }}>Payouts</Link>
          <Link to="/marina/$section" params={{ section: "settings" }} search={{ biz: businessId }}>Settings</Link>
          <Link to="/marketplace">Marketplace</Link>
        </>
      );
    }
    if (category === "guide_service") {
      return (
        <>
          <Link to="/guide/$section" params={{ section: "overview" }} search={{ biz: businessId }}>Home</Link>
          <Link to="/guide/$section" params={{ section: "trips" }} search={{ biz: businessId }}>Trips</Link>
          <Link to="/guide/$section" params={{ section: "listings" }} search={{ biz: businessId }}>Listings</Link>
          <Link to="/guide/$section" params={{ section: "messages" }} search={{ biz: businessId }}>Messages</Link>
          <Link to="/guide/$section" params={{ section: "payouts" }} search={{ biz: businessId }}>Payouts</Link>
          <Link to="/guide/$section" params={{ section: "settings" }} search={{ biz: businessId }}>Settings</Link>
          <Link to="/marketplace">Marketplace</Link>
        </>
      );
    }
    return (
      <>
        <Link to="/captain/$section" params={{ section: "overview" }}>Home</Link>
        <Link to="/captain/$section" params={{ section: "bookings" }}>Bookings</Link>
        <Link to="/captain/$section" params={{ section: "services" }}>Charters</Link>
        <Link to="/captain/$section" params={{ section: "messages" }}>Messages</Link>
        <Link to="/captain/$section" params={{ section: "earnings" }}>Earnings</Link>
        <Link to="/captain/$section" params={{ section: "settings" }}>Settings</Link>
        <Link to="/marketplace">Marketplace</Link>
      </>
    );
  }

  return (
    <header className="fx-member-header" data-open={open ? "true" : "false"}>
      <div className="fx-member-bar">
        <Link to="/dashboard" className="fx-member-brand" aria-label="Fish-X dashboard">
          <BrandLogo size="md" accent="var(--sand)" color="var(--ond)" />
        </Link>
        <nav className="fx-member-nav" aria-label="Signed-in navigation">
          {isOperator ? operatorLinks() : <>{MEMBER_LINKS.map(memberLink)}<Link to="/messages" className={pathname.startsWith("/messages") ? "is-active" : undefined}>Messages</Link><Link to="/marketplace" className={pathname.startsWith("/marketplace") ? "is-active" : undefined}>Marketplace</Link></>}
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
        {actions && <div className="fx-member-drawer-actions" onClick={() => setOpen(false)}>{actions}</div>}
        <nav aria-label="Mobile signed-in navigation">
          {isOperator ? operatorLinks() : <>{MEMBER_LINKS.map(memberLink)}<Link to="/messages" onClick={() => setOpen(false)}><MessageCircle size={17} /> Messages</Link></>}
          <Link to="/notifications" onClick={() => setOpen(false)}><Bell size={17} /> Notifications</Link>
          <Link to="/settings" onClick={() => setOpen(false)}><Settings size={17} /> Account & settings</Link>
          <button type="button" onClick={signOut}><LogOut size={17} /> Sign out</button>
        </nav>
      </div>
    </header>
  );
}
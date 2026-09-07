import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // getSession() reads the cached session locally; getUser() costs a network
    // round trip on every navigation, which delayed the dashboard paint.
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    return { user: data.session.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Inject a hamburger toggle + profile dropdown into any sticky top-nav header.
  useEffect(() => {
    const HAMBURGER_SVG =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
    const CLOSE_SVG =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6l-12 12"/></svg>';

    const decorate = () => {
      const headers = document.querySelectorAll<HTMLElement>(
        '.fx-authed header[style*="sticky"]',
      );
      headers.forEach((header) => {
        // ---- Profile dropdown (Account + Sign out) ----
        const signOutBtn = header.querySelector<HTMLButtonElement>(
          'button[title="Sign out"]',
        );
        if (signOutBtn && !header.querySelector(".fx-profile-menu")) {
          const trigger = signOutBtn.previousElementSibling as HTMLElement | null;
          if (trigger) {
            trigger.style.position = "relative";
            trigger.setAttribute("role", "button");
            trigger.setAttribute("aria-haspopup", "menu");
            const menu = document.createElement("div");
            menu.className = "fx-profile-menu";
            menu.setAttribute("hidden", "");
            menu.innerHTML =
              '<a href="/account" data-fx-account>Account</a>' +
              '<button type="button" data-fx-signout>Sign out</button>';
            trigger.appendChild(menu);

            trigger.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();
              const open = !menu.hasAttribute("hidden");
              if (open) menu.setAttribute("hidden", "");
              else menu.removeAttribute("hidden");
            });
            menu
              .querySelector<HTMLButtonElement>("[data-fx-signout]")!
              .addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                menu.setAttribute("hidden", "");
                signOutBtn.click();
              });
            menu.addEventListener("click", (e) => e.stopPropagation());
          }
        }

        // ---- Hamburger for mobile nav ----
        const nav = header.querySelector("nav");
        if (!nav) return;
        if (header.querySelector(".fx-hamburger")) return;
        const inner = header.firstElementChild as HTMLElement | null;
        if (!inner) return;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "fx-hamburger";
        btn.setAttribute("aria-label", "Menu");
        btn.setAttribute("aria-expanded", "false");
        btn.innerHTML = HAMBURGER_SVG;
        btn.addEventListener("click", () => {
          const open = header.getAttribute("data-nav-open") === "true";
          const next = !open;
          header.setAttribute("data-nav-open", next ? "true" : "false");
          btn.setAttribute("aria-expanded", next ? "true" : "false");
          btn.innerHTML = next ? CLOSE_SVG : HAMBURGER_SVG;
          if (next) window.scrollTo({ top: 0, behavior: "smooth" });
        });
        inner.appendChild(btn);

        nav.addEventListener("click", (e) => {
          const t = e.target as HTMLElement;
          if (t.closest("a, button")) {
            header.setAttribute("data-nav-open", "false");
            btn.setAttribute("aria-expanded", "false");
            btn.innerHTML = HAMBURGER_SVG;
          }
        });
      });
    };

    decorate();
    const mo = new MutationObserver(decorate);
    mo.observe(document.body, { childList: true, subtree: true });

    // Close any open profile menu on outside click.
    const onDocClick = () => {
      document
        .querySelectorAll<HTMLElement>(".fx-profile-menu")
        .forEach((m) => m.setAttribute("hidden", ""));
    };
    document.addEventListener("click", onDocClick);

    return () => {
      mo.disconnect();
      document.removeEventListener("click", onDocClick);
    };
  }, []);


  // Close any open nav on route change.
  useEffect(() => {
    document
      .querySelectorAll<HTMLElement>('.fx-authed header[data-nav-open="true"]')
      .forEach((h) => {
        h.setAttribute("data-nav-open", "false");
        const btn = h.querySelector<HTMLButtonElement>(".fx-hamburger");
        if (btn) {
          btn.setAttribute("aria-expanded", "false");
          btn.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
        }
      });
  }, [pathname]);

  return (
    <div className="fx-authed">
      <Outlet />
    </div>
  );
}

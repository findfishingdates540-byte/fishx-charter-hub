import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import landingRaw from "@/dc-templates/landing.html?raw";
import { cleanTemplate, parseDcHtml, runDcScript } from "@/lib/dc-template";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FISH-X.COM Bookings & Marketplace — One platform for the entire fishing industry" },
      {
        name: "description",
        content:
          "Book fishing charters and buy from tackle shops, marinas, guides and gear brands in one escrow-secured marketplace for the whole fishing industry.",
      },
      { property: "og:title", content: "FISH-X.COM Bookings & Marketplace" },
      {
        property: "og:description",
        content: "One platform for the entire fishing industry — charters, tackle, marinas and wholesale.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const hostRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Signed-in visitors go straight to their dashboard instead of the marketing page.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) navigate({ to: "/dashboard", replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const { template, script } = useMemo(() => {
    const parsed = parseDcHtml(landingRaw);
    return { template: cleanTemplate(parsed.template), script: parsed.script };
  }, []);

  useEffect(() => {
    if (!hostRef.current) return;
    document.body.classList.add("dc-body");
    const dispose = runDcScript(script, {
      palette: "Sand Gold",
      animate: true,
      showMarquee: true,
    });

    // Wire the hero search widget to the real results pages.
    const host = hostRef.current;
    const go = () => {
      const active = host.querySelector<HTMLElement>("[data-cats] [data-cat][data-active='1']");
      const cat = active?.getAttribute("data-cat") ?? "charters";
      const q = host.querySelector<HTMLInputElement>("[data-search-input]")?.value.trim() ?? "";
      const city = host.querySelector<HTMLInputElement>("[data-loc-input]")?.value.trim() ?? "";
      if (cat === "charters") {
        navigate({
          to: "/charters/search",
          search: { ...(q ? { q } : {}), ...(city ? { city } : {}), sort: "recommended" as const },
        });
        return;
      }
      const vertical = cat === "tackle" ? "tackle" : cat === "marinas" ? "marinas" : "gear";
      navigate({ to: "/explore/$vertical", params: { vertical }, search: city ? { city } : {} });
    };

    const onClick = (e: Event) => {
      const t = e.target as HTMLElement;
      const chip = t.closest<HTMLElement>("[data-cats] [data-cat]");
      if (chip) {
        host
          .querySelectorAll<HTMLElement>("[data-cats] [data-cat]")
          .forEach((b) => b.removeAttribute("data-active"));
        chip.setAttribute("data-active", "1");
        return;
      }
      if (t.closest("[data-search-btn]")) go();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      const t = e.target as HTMLElement;
      if (t.matches("[data-search-input],[data-loc-input]")) go();
    };
    host.querySelector<HTMLElement>("[data-cats] [data-cat]")?.setAttribute("data-active", "1");
    host.addEventListener("click", onClick);
    host.addEventListener("keydown", onKey);

    return () => {
      host.removeEventListener("click", onClick);
      host.removeEventListener("keydown", onKey);
      dispose();
      document.body.classList.remove("dc-body");
    };
  }, [script, navigate]);


  return (
    <div
      ref={hostRef}
      className="dc-landing"
      dangerouslySetInnerHTML={{ __html: template }}
    />
  );
}

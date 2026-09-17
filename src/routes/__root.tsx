import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { AdminLauncher } from "@/components/admin/AdminLauncher";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="text-label-caps text-sandy-gold">Off course</p>
        <h1 className="mt-3 text-display text-7xl">404</h1>
        <h2 className="mt-2 text-lg font-medium text-on-deep">This dock doesn't exist</h2>
        <p className="mt-2 text-sm text-on-deep-muted">
          The page you're looking for has drifted out to sea.
        </p>
        <div className="mt-6">
          <Link to="/" className="btn-gold btn-gold-hover inline-block">
            Back to home port
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="text-label-caps text-soft-coral">Rough water</p>
        <h1 className="mt-3 text-display text-3xl">Something went sideways</h1>
        <p className="mt-2 text-sm text-on-deep-muted">
          Try again or head back to safe harbor.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="btn-gold btn-gold-hover"
          >
            Try again
          </button>
          <a href="/" className="rounded-full border border-border px-6 py-3 text-sm font-medium">
            Home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "FISH-X.COM Bookings & Marketplace" },
      { name: "description", content: "Run your charter business from the helm. Bookings, customers, boats, and trips — all in one place." },
      { name: "author", content: "Fish-X" },
      { name: "theme-color", content: "#0c1626" },
      { property: "og:title", content: "FISH-X.COM Bookings & Marketplace" },
      { property: "og:description", content: "Run your charter business from the helm. Bookings, customers, boats, and trips — all in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@FishX" },
      { name: "twitter:title", content: "FISH-X.COM Bookings & Marketplace" },
      { name: "twitter:description", content: "Run your charter business from the helm. Bookings, customers, boats, and trips — all in one place." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/212cea98-fb6c-4586-a101-05058c5a319a/id-preview-cdc932f1--4a189ca1-59dc-44ca-8329-9ae70115297f.lovable.app-1785763591884.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/212cea98-fb6c-4586-a101-05058c5a319a/id-preview-cdc932f1--4a189ca1-59dc-44ca-8329-9ae70115297f.lovable.app-1785763591884.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      // Outfit is the booking app's brand font (headings, body, UI).
      // Lexend is reserved for scoreboard / competition hub sections.
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Lexend:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // SIGNED_IN can fire while an authenticated route's async beforeLoad is
      // still resolving. Invalidating at that point starts a second load and
      // can leave TanStack Router rendering a cleared match promise. Login
      // already navigates explicitly, so only session loss/profile changes
      // need global invalidation here.
      if (event === "SIGNED_OUT") {
        queryClient.clear();
        router.invalidate();
      } else if (event === "USER_UPDATED") {
        queryClient.invalidateQueries();
        router.invalidate();
      }
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <AdminLauncher />
    </QueryClientProvider>
  );
}

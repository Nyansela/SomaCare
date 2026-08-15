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
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { requestNotificationPermissions } from "@/lib/notifications";
import { ThemeInit } from "@/components/theme-customizer";
import "../i18n";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Button asChild>
            <Link to="/">Go home</Link>
          </Button>
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Try again
          </Button>
          <Button variant="outline" asChild>
            <a href="/">Go home</a>
          </Button>
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
      {
        httpEquiv: "Content-Security-Policy",
        content:
          "default-src 'self' https: data: blob: 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' https: wss:;",
      },
      { title: "SomaCare — Your AI Health Companion" },
      {
        name: "description",
        content:
          "Soma Health is a next-generation AI health companion: personalized vitals, medications, appointments, and an assistant that knows your history.",
      },
      { name: "theme-color", content: "#16a34a" },
      { property: "og:title", content: "SomaCare — Your AI Health Companion" },
      {
        property: "og:description",
        content:
          "Track vitals, manage medications, book care and chat with an AI assistant that understands your health.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      // Favicon references
      { rel: "icon", type: "image/svg+xml", href: "/images/branding/logo.svg" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/images/branding/logo.jpg" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/images/branding/logo.jpg" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/images/branding/logo.jpg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Playfair+Display:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
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
        {/* Apply the device-cached theme before first paint to avoid a flash of
         * the default light theme. Idempotent with theme-store's applyTheme(). */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){try{function g(k){try{return localStorage.getItem(k)}catch(e){return null}}var raw=g("soma.theme.v2")||g("soma.theme.v1");if(!raw)return;var s=JSON.parse(raw);if(!s||typeof s!=="object")return;var root=document.documentElement;var dark=s.appearance==="dark"||(s.appearance==="system"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);root.classList.toggle("dark",!!dark);if(s.layout)root.setAttribute("data-layout",s.layout);if(s.highContrast)root.setAttribute("data-high-contrast","true");if(s.reducedMotion)root.setAttribute("data-reduced-motion","true");var r={sharp:"0.35rem",soft:"0.9rem",pill:"1.6rem"}[s.radius];if(r)root.style.setProperty("--radius",r);var fs={sm:"0.875rem",md:"1rem",lg:"1.125rem"}[s.fontSize];if(fs)root.style.setProperty("--font-size-base",fs);if(typeof s.accentColor==="string"&&/^#[0-9a-f]{6}$/i.test(s.accentColor)){var n=parseInt(s.accentColor.slice(1),16);var rr=((n>>16)&255)/255,gg=((n>>8)&255)/255,bb=(n&255)/255;function lin(c){return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4)}var L=0.2126*lin(rr)+0.7152*lin(gg)+0.0722*lin(bb);root.style.setProperty("--primary",s.accentColor);root.style.setProperty("--primary-foreground",L>0.45?"#000000":"#ffffff")}if(dark&&s.darkModeBackground==="pure-black"){root.style.setProperty("--background","#000000");root.style.setProperty("--surface","#121212");root.style.setProperty("--card","#121212")}else if(dark&&s.darkModeBackground==="custom"&&/^#[0-9a-f]{6}$/i.test(String(s.customDarkBackground||""))){root.style.setProperty("--background",s.customDarkBackground);root.style.setProperty("--surface",s.customDarkBackground);root.style.setProperty("--card",s.customDarkBackground)}}catch(e){}})();`,
          }}
        />
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
    requestNotificationPermissions();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeInit />
      <Outlet />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}

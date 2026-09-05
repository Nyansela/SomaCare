import {
  createFileRoute,
  Outlet,
  redirect,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import i18n from "@/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  // Guard so the one-time redirect never fires twice (StrictMode double
  // effects, refetches, or navigation back to /upgrade).
  const welcomeHandledRef = useRef(false);

  // New users are shown the subscription page once, right after joining: on
  // their first visit anywhere in the app, if they're on the free tier and
  // haven't seen it yet, redirect to /upgrade?welcome=1 and mark the flag so
  // it never happens again. Existing accounts default welcome_seen=true and
  // are never redirected, and paid users skip it entirely — no nagging.
  useEffect(() => {
    if (welcomeHandledRef.current || location.pathname === "/upgrade") return;
    let cancelled = false;
    void (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user || cancelled) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_tier, bypass_paywall, welcome_seen")
        .eq("id", u.user.id)
        .maybeSingle();
      if (cancelled || !profile || profile.welcome_seen) return;
      if (profile.bypass_paywall || profile.subscription_tier !== "free") return;
      welcomeHandledRef.current = true;
      // Mark it seen BEFORE navigating so a refresh or back-navigation cannot
      // re-trigger the redirect.
      await supabase.from("profiles").update({ welcome_seen: true }).eq("id", u.user.id);
      if (cancelled) return;
      void navigate({ to: "/upgrade", search: { welcome: true }, replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [location.pathname, navigate]);

  // Restore the user's saved UI language on app start. i18n defaults to "en",
  // so without this the interface (and the AI's reply language) would not
  // match the language they picked until they revisit the profile page.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("locale, preferences")
        .eq("id", u.user.id)
        .maybeSingle();
      if (cancelled || !profile) return;
      const prefs = (profile.preferences ?? {}) as Record<string, unknown>;
      const lang = (prefs.language as string) || (profile.locale as string) || "en";
      if (i18n.language !== lang) i18n.changeLanguage(lang);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return <Outlet />;
}

import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
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
      const lang =
        (prefs.language as string) || (profile.locale as string) || "en";
      if (i18n.language !== lang) i18n.changeLanguage(lang);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return <Outlet />;
}

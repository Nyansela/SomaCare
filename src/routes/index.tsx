import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// The landing page was removed — `/` now sends users straight to the
// sign-up / sign-in screen (or the app if already authenticated).
export const Route = createFileRoute("/")({
  component: LandingRedirect,
  head: () => ({
    meta: [{ title: "SomaCare" }],
  }),
});

function LandingRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      navigate({ to: data.session ? "/app" : "/auth", replace: true });
    });
  }, [navigate]);
  return null;
}

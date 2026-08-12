import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getHealthContext } from "@/lib/health-context";

export const Route = createFileRoute("/api/health-share/$token")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { token } = params;
        if (!token) {
          return new Response(JSON.stringify({ error: "Token required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseServiceKey =
          process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
          return new Response(JSON.stringify({ error: "Server configuration error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        // Verify share token exists, is not revoked, and not expired
        const { data: share, error: shareError } = await supabase
          .from("health_shares")
          .select("user_id, expires_at, revoked_at")
          .eq("token", token)
          .maybeSingle();

        if (shareError || !share) {
          return new Response(JSON.stringify({ error: "Link not found", expired: true }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        const now = new Date();
        const expiresAt = new Date(share.expires_at);
        if (share.revoked_at || expiresAt <= now) {
          return new Response(
            JSON.stringify({ error: "This link has expired or has been revoked", expired: true }),
            {
              status: 410,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        // Fetch health context for user_id
        try {
          const healthContext = await getHealthContext(
            supabaseUrl,
            supabaseServiceKey,
            share.user_id,
            true,
          );
          return new Response(
            JSON.stringify({ success: true, healthContext, expiresAt: share.expires_at }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        } catch (err) {
          return new Response(
            JSON.stringify({
              error: err instanceof Error ? err.message : "Failed to load health context",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      },
    },
  },
});

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AuthenticatedRequest = {
  userId: string;
  supabase: SupabaseClient<Database>;
};

/**
 * Validates the `Authorization: Bearer <token>` header on a server route and
 * returns a user-scoped Supabase client (RLS applies) plus the user id.
 * Returns null when the token is missing or invalid so callers can respond 401.
 */
export async function authenticateRequest(
  request: Request,
): Promise<AuthenticatedRequest | null> {
  const auth = request.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7);

  const supabase = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    },
  );

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return null;

  return { userId: userData.user.id, supabase };
}

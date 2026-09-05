-- Lock subscription columns to the service role only.
--
-- The existing "own profile" RLS policy lets an authenticated user update
-- their own profiles row, which would let them set subscription_tier or
-- bypass_paywall themselves and bypass the paywall. Revoke column-level
-- UPDATE for the authenticated role: only the service role (used by the
-- Stripe webhook) can change these columns now.

revoke update (subscription_tier, bypass_paywall) on public.profiles from authenticated;

-- Sanity check: service_role keeps full access (it is granted `all` by the
-- base migration), so the webhook's admin client can still update the tier.
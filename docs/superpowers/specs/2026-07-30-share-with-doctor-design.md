# Design Spec: Share with Doctor Feature for SomaCare

## Overview
The "Share with Doctor" feature allows SomaCare users to generate secure, time-limited share links from their Health Vault page. These links provide unauthenticated, read-only doctor-facing snapshots of the user's health context (vitals, allergies with severity, chronic conditions, medications, medical history events, lifestyle, sleep, hydration, and emergency contacts).

## Requirements & Assumptions
1. **Secure Generation & Expiry**: Users can generate a share link with configurable expiration (24, 48, or 72 hours). Uses cryptographically secure random tokens (`crypto.randomUUID()` or crypto random strings), not sequential IDs.
2. **Public Doctor-Facing View**: Accessible via a public route (`src/routes/health-share/$token.tsx`), completely outside the `_authenticated` route tree (removing any old `_authenticated/health-share/$token.tsx`). Requires no login for the doctor.
3. **Account Management UI**: Users can view all active and past shares in their account (creation time, expiration time, status), copy links, and manually revoke active shares early.
4. **Graceful Expiry & Revocation Handling**: Expired or manually revoked links display a clean "This link has expired or has been revoked" message rather than a broken page or raw error.
5. **Search Engine Protection & Privacy**: Includes `<meta name="robots" content="noindex" />` on the doctor-facing view and has no account-level navigation links pointing to individual share URLs.
6. **Reusability**: Reuses `getHealthContext()` to fetch data consistently without duplicating queries.

## Architecture & Components
- **Database Table**: `public.health_shares` (already defined in migration `20260801000000_health_shares.sql`).
- **API Route**: `src/routes/api/health-share/$token.ts` (or backend data loader endpoint / server function) that validates the token against `health_shares` (checking `revoked_at IS NULL AND expires_at > NOW()`) and calls `getHealthContext()`.
- **Frontend Management Component**: `src/components/health-vault/HealthVaultShareManager.tsx`, imported into `src/routes/_authenticated/health-vault.tsx`.
- **Public Doctor View Route**: `src/routes/health-share/$token.tsx` (public layout with `noindex`, clean responsive health snapshot presentation).

## Security & RLS
- `health_shares` has RLS policies: users manage their own rows (`auth.uid() = user_id`), and public can select valid unexpired/unrevoked shares by token.
- API route/backend fetches using service role or secure token validation to safely aggregate patient health context.

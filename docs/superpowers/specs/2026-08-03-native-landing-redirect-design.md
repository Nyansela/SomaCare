# Design Specification: Native App Landing Page Bypass for Capacitor

## Objective
For the native app (Capacitor/APK) build of SomaCare, skip the marketing landing page entirely and redirect native users directly to the sign up / log in screen (`/auth`), while keeping the marketing landing page intact for the web version.

## Requirements
1. **Platform Detection**: Use Capacitor's `Capacitor.isNativePlatform()` (from `@capacitor/core`).
2. **Root Route Behavior (`src/routes/index.tsx`)**:
   - On component mount / auth check, check if `Capacitor.isNativePlatform()` is true (or if running natively).
   - If running as a native app:
     - Check if user has an active Supabase session.
     - If logged in, navigate/redirect to `/app`.
     - If not logged in, navigate/redirect to `/auth` (sign up / log in screen).
   - If running on web:
     - Keep existing behavior (check auth session -> redirect to `/app` if logged in, otherwise display the marketing landing page).
3. **Build Verification**: Run `npm run build` and confirm zero errors.

## Architecture & Data Flow
- **File Modified**: `src/routes/index.tsx`
- **Imports**: `import { Capacitor } from '@capacitor/core';`
- **Logic in `Landing` component `useEffect`**:
  ```ts
  useEffect(() => {
    const checkAuthAndPlatform = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate({ to: "/app" });
        return;
      }
      if (Capacitor.isNativePlatform()) {
        navigate({ to: "/auth" });
      }
    };
    checkAuthAndPlatform();
  }, [navigate]);
  ```
- **Fallback / Loading state**: While checking auth/platform or before redirect, a minimal loading state or smooth transition prevents flickering of the landing page on native devices.

## Testing & Verification
- Verify web version still renders landing page correctly when not logged in.
- Run `npm run build` to verify TypeScript compilation, bundling, and zero errors.

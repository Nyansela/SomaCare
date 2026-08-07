# Native App Landing Page Bypass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Skip the marketing landing page on native Capacitor/APK builds and redirect native users directly to the sign up/log in screen (`/auth`), while preserving the landing page for the web version.

**Architecture:** Check Capacitor platform support via `@capacitor/core` (`Capacitor.isNativePlatform()`) in `src/routes/index.tsx` during initial session/auth check. If running as a native app and unauthenticated, redirect to `/auth`. If authenticated, redirect to `/app`. If on web, show landing page (or redirect to `/app` if authenticated).

**Tech Stack:** TanStack Start, React, Capacitor (`@capacitor/core`), TypeScript.

## Global Constraints
- Preserve marketing landing page on web version.
- Use `Capacitor.isNativePlatform()` for platform detection.
- Confirm zero errors with `npm run build` before completion.

---

### Task 1: Update Root Route (`src/routes/index.tsx`) with Native Platform Redirect

**Files:**
- Modify: `src/routes/index.tsx:33-43`

**Interfaces:**
- Consumes: `Capacitor` from `@capacitor/core`, `supabase` from `@integrations/supabase/client`.
- Produces: Conditional redirect in `useEffect` when `Capacitor.isNativePlatform()` is true and user is unauthenticated.

- [ ] **Step 1: Read `src/routes/index.tsx` around `useEffect` to get exact lines**

Run: `grep` or `Read` on `src/routes/index.tsx` lines 25-45.

- [ ] **Step 2: Edit `src/routes/index.tsx` to import `Capacitor` and update `useEffect` check**

```typescript
import { Capacitor } from "@capacitor/core";
```
And inside `Landing` component:
```typescript
  // Redirect logged-in users to the app, or native users to auth if unauthenticated
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

- [ ] **Step 3: Test build to verify TypeScript compilation and zero errors**

Run: `npm run build`
Expected: SUCCESS with zero errors.

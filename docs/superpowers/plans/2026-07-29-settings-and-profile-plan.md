# Unified Theme Settings & Comprehensive Profile Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix appearance settings and theme application so all appearance options work correctly, and create a comprehensive Profile page for user management.

**Architecture:** Integrate settings page with `theme-store.ts`, align preference saving, and build a full-featured profile route in `src/routes/_authenticated/profile.tsx`.

**Tech Stack:** TanStack Router, React, Tailwind CSS, Supabase, shadcn/ui.

## Global Constraints
- Zero build errors (`npm run build`).
- TypeScript strictness (`npx tsc --noEmit`).

---

### Task 1: Unify Settings Appearance with Theme Store

**Files:**
- Modify: `src/routes/_authenticated/settings.tsx`
- Modify: `src/lib/theme-store.ts`

- [ ] **Step 1: Update settings.tsx to load/save using theme-store integration**

Replace the custom `applyTheme` in `settings.tsx` with the global `applyTheme` and `saveThemeToSupabase` from `@/lib/theme-store`.

- [ ] **Step 2: Verify build and type check**

Run: `npx tsc --noEmit`
Expected: Zero type errors in `settings.tsx`.

---

### Task 2: Create Comprehensive Profile Page

**Files:**
- Create: `src/routes/_authenticated/profile.tsx`
- Modify: `src/routeTree.gen.ts` (auto-generated or manually added)

- [ ] **Step 1: Write profile page component**

Implement `src/routes/_authenticated/profile.tsx` with sections for Personal Info, Medical Baseline (blood type, height, weight, allergies, chronic conditions), Emergency Contacts, and Avatar.

- [ ] **Step 2: Run build and verify zero errors**

Run: `npm run build`
Expected: Success with zero errors.

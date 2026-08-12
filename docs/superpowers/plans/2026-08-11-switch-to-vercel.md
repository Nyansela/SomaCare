# Switch Deployment Target to Vercel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch deployment target from Cloudflare Workers (`cloudflare-module`) to Vercel in Nitro/Vite config, remove Cloudflare-specific wrangler configuration, list required server-side environment variables for Vercel dashboard, and verify successful local build.

**Architecture:** Update `vite.config.ts` to pass `{ nitro: { preset: "vercel" } }` to `defineConfig` from `@lovable.dev/vite-tanstack-config`, clean up wrangler notes/blocks, and test build output.

**Tech Stack:** TanStack Start, Vite, Nitro, Vercel

## Global Constraints
- Target Vercel preset (`vercel` or `vercel-edge` — standard Vercel serverless / edge).
- Retain all required environment variables.
- Ensure successful `npm run build` output.

---

### Task 1: Update Nitro preset in `vite.config.ts`

**Files:**
- Modify: `vite.config.ts`

**Interfaces:**
- Consumes: `@lovable.dev/vite-tanstack-config`
- Produces: Vercel Nitro build configuration

- [ ] **Step 1: Read current `vite.config.ts`**
  Read `vite.config.ts` to verify exact structure.
- [ ] **Step 2: Update `vite.config.ts` to target Vercel**
  Configure `nitro: { preset: "vercel" }` and remove Cloudflare wrangler notes.
- [ ] **Step 3: Verify configuration syntax**
  Check that TypeScript / Vite parses the config correctly.

---

### Task 2: Clean up Cloudflare-specific wrangler config

**Files:**
- Modify/Remove: `wrangler.json` (can be deleted or ignored since Vercel does not use wrangler)

- [ ] **Step 1: Remove `wrangler.json`**
  Delete `wrangler.json` to prevent confusion or accidental wrangler deployments.

---

### Task 3: Document server-side environment variables for Vercel dashboard

**Files:**
- Document in summary / response (and optionally a config doc if requested, but list them clearly).

- [ ] **Step 1: Compile complete list of required server-side and client-side environment variables**
  - `SUPABASE_URL`
  - `SUPABASE_PUBLISHABLE_KEY` (and `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`)
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `NVIDIA_API_KEY`
  - `GEMINI_API_KEY` / `LOVABLE_API_KEY` (optional AI fallbacks)

---

### Task 4: Run build and verify output directory structure for Vercel

**Files:**
- Test output: `.output/` (Nitro output directory)

- [ ] **Step 1: Run build command**
  Run `npm run build` via Bash.
- [ ] **Step 2: Inspect output directory structure**
  Verify generated files in `.output/` (or Vercel output structure).

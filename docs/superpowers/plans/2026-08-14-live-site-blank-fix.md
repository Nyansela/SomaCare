# Live Site Blank — Fix Summary & Handoff (2026-08-14)

> Written for another AI agent to pick up where this session left off. The live site is
> currently WORKING. Remaining work is cleanup + optional improvements.

## What was wrong

The live site (Cloudflare worker `nyansela-somacare`) showed a blank page.

**Root cause:** The worker was last deployed on **Aug 11** — one day *before* the blank-page
fix commit `3f98d2b` ("Fix blank page on live deploy", Aug 12). So production was running the
old build that served the bare `index.html` shell (empty `<div id="root">`), i.e. a blank page.

The fix commit itself is: `vite.config.ts` sets `nitro.renderer: false` so TanStack Start's SSR
renderer is installed (see the comment in the file — without it, nitro's auto-detected
`index.html` template wins and every request falls through to the empty shell).

**Also confirmed:** the user's browser console showed `Uncaught (in promise) TypeError ... content.js`
and `polyfill.js ... Receiving end does not exist` — those are **browser-extension errors**, not
from the app. The page loads fine in a clean/incognito browser. No app-side JS errors.

## What I did (verified working)

1. Local verification:
   - `npm run build` succeeds (current preset: `cloudflare-module`).
   - Ran the built worker locally: `cd .output/server && npx wrangler dev --config wrangler.json --port 8787`
     → HTTP 200 with full SSR-rendered landing page.
   - Note: `npx wrangler dev` from the project root FAILS on Windows (config path collision between
     `wrangler.json` and `.wrangler/deploy/config.json`). Always run it from inside `.output/server`
     with `--config wrangler.json`.
2. Redeployed the fixed build:
   ```bash
   cd .output/server && npx wrangler deploy --config wrangler.json
   ```
   → New version `d515a334`, live at **https://nyansela-somacare.somalabs.workers.dev**
   (note the `somalabs` account subdomain — the URL without it does not resolve).
3. Verified live:
   - `/`, `/auth`, `/app`, `/onboarding` all 200 with correct titles; no error page.
   - All 28 JS/CSS assets + 7 SVG landing images return 200.
   - Fresh headless Chrome profile (no cache/extensions) renders the full landing page with
     **zero console errors**.

## Current repo state (important for the next agent)

- Working tree has **uncommitted changes** that match what is deployed:
  - `vite.config.ts`: nitro preset switched `vercel` → `cloudflare-module` (commit still says `vercel`)
  - `src/routes/index.tsx` + `src/components/landing/feature-images.ts`: feature images `.jpg` → `.svg`
  - `src/components/landing/color-bends.tsx`: scene background left null so CSS gradient shows through
  - Untracked: `public/images/landing/*.svg` (7 files)
- The last commit `3f98d2b` targets **Vercel** (`preset: "vercel"`). The working tree targets
  **Cloudflare**. This flip-flop should be resolved deliberately (see "To do next").
- Two build-output dirs exist: `.output/` (Cloudflare, current) and `.vercel/output/` (Vercel, stale).
  `somacare.vercel.app` is a DIFFERENT app ("Lasting Relief from Chronic Back Pain") — not this project.
- `.gitignore` already ignores `.output`, `.wrangler/`, `.vercel`.

## To do next (pick-up tasks for another agent)

1. **Decide the deployment target and commit.** If staying on Cloudflare (current state):
   - Commit the working-tree changes (vite.config.ts, index.tsx, feature-images.ts, color-bends.tsx,
     public/images/landing/*.svg) with a message like "Deploy to Cloudflare Workers".
   - Do NOT commit `.output/`, `.wrangler/`, or `.vercel/` (already gitignored).
   - If instead going back to Vercel: flip `preset` back to `vercel`, run `npm run build`, and deploy
     to Vercel — but note `.vercel/output` and `somacare.vercel.app` need the correct Vercel project.
2. **Add a deploy script** to `package.json` so redeploys are one command, e.g.:
   ```json
   "deploy:cf": "npm run build && cd .output/server && npx wrangler deploy --config wrangler.json"
   ```
3. **Custom domain (recommended):** the workers.dev URL is long and easy to mistype (the `somalabs`
   subdomain tripped the user up). Point a real domain at the worker to avoid this.
4. **Cleanup (optional):** remove the stale `.vercel/output` and `dist-native` artifacts, and the
   leftover `scripts-tmp-add-medications-i18n.mjs` / `test-chat.mjs` root scripts if no longer needed.

## Gotchas / environment notes

- Windows + Git Bash: always use POSIX commands; run wrangler from `.output/server`.
- `vite.config.ts` header warns NOT to re-add plugins manually (duplicate-plugin breakage).
- The `renderer: false` line in `vite.config.ts` is load-bearing — do not remove it.
- Keep `src/server.ts`'s ASSETS-serving logic in sync with the Cloudflare binding (`env.ASSETS`);
  it serves `/assets/`, `/images/`, favicon, `/_headers` directly from the static dir.

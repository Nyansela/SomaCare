# Capacitor Native Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separate `build:native` script and configuration for building SomaCare in pure SPA/client-only mode for Capacitor, updating `capacitor.config.ts`, and ensuring native API routing and landing page redirection behave correctly.

**Architecture:** Create a dedicated Vite configuration (`vite.config.native.ts`) with `nitro: false` targeting output directory `dist-native`, restore `index.html` as the static entry point, update `capacitor.config.ts`'s `webDir` to `dist-native`, add `"build:native"` script to `package.json`, and ensure native platform checks handle API endpoints and landing page redirection properly.

**Tech Stack:** TanStack Start, Vite, Capacitor, TypeScript, React.

## Global Constraints
- Target output directory for native build: `dist-native`
- Do not break existing Cloudflare SSR web build (`npm run build`).
- Ensure `index.html` exists for Capacitor static web asset requirements.

---

### Task 1: Setup Static Entry (`index.html`) and Native Vite Config (`vite.config.native.ts`)

**Files:**
- Create: `index.html` (from `index.html.bak`)
- Create: `vite.config.native.ts`

**Interfaces:**
- Produces: `dist-native/` directory with static `index.html` and client JS/CSS bundles upon running `vite build --config vite.config.native.ts`.

- [ ] **Step 1: Create `index.html` from `index.html.bak`**

```bash
cp index.html.bak index.html
```

- [ ] **Step 2: Create `vite.config.native.ts`**

```ts
import { defineConfig } from "./vite.config";

export default defineConfig({
  nitro: false,
  vite: {
    build: {
      outDir: "dist-native",
      emptyOutDir: true,
    },
  },
});
```

- [ ] **Step 3: Test native build command**

Run: `npx vite build --config vite.config.native.ts`
Expected: SUCCESS, producing `dist-native/index.html` and built assets.

- [ ] **Step 4: Commit**

```bash
git add index.html vite.config.native.ts
git commit -m "feat: add vite.config.native.ts and static index.html for Capacitor"
```

---

### Task 2: Update `package.json` and `capacitor.config.ts`

**Files:**
- Modify: `package.json:6-14`
- Modify: `capacitor.config.ts:3-9`

**Interfaces:**
- Consumes: `dist-native` build output.
- Produces: `build:native` script in `package.json` and `webDir: "dist-native"` in `capacitor.config.ts`.

- [ ] **Step 1: Update `package.json` scripts**

Add `"build:native": "vite build --config vite.config.native.ts"` to `scripts` in `package.json`.

```json
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "build:native": "vite build --config vite.config.native.ts",
    "build:dev": "vite build --mode development",
    "preview": "vite preview",
    "lint": "eslint .",
    "format": "prettier --write ."
  },
```

- [ ] **Step 2: Update `capacitor.config.ts`**

Set `webDir` to `"dist-native"`:

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.somalabsgh.somacare',
  appName: 'SomaCare',
  webDir: 'dist-native'
};

export default config;
```

- [ ] **Step 3: Run `npm run build:native`**

Run: `npm run build:native`
Expected: SUCCESS, generating `dist-native/index.html`.

- [ ] **Step 4: Run `npx cap sync android`**

Run: `npx cap sync android`
Expected: SUCCESS, copying web assets from `dist-native` to Android project without errors.

- [ ] **Step 5: Commit**

```bash
git add package.json capacitor.config.ts
git commit -m "feat: add build:native script and update capacitor.config.ts webDir to dist-native"
```

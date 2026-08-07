# Capacitor Native SPA Build Design Spec

## Overview
SomaCare is a TanStack Start + Vite + Capacitor application targeting Cloudflare Workers for web (SSR mode) and a standalone native bundle for Capacitor (Android/iOS). Because Capacitor runs locally on-device without an SSR server, it requires a static SPA build containing a real `index.html` and bundled client assets.

## Architecture & Components

### 1. Dedicated Vite Native Config (`vite.config.native.ts`)
- Extends or builds upon `@lovable.dev/vite-tanstack-config` with `nitro: false` (disabling Cloudflare/Nitro SSR output).
- Configures Vite build output directory to `dist-native`.
- Bundles client-only assets and outputs a static `index.html`.

### 2. Static Entry (`index.html`)
- Restores/creates root `index.html` from `index.html.bak` so Vite can generate the entry point for the SPA bundle.

### 3. Capacitor Configuration (`capacitor.config.ts`)
- Updates `webDir` from `.output/public` to `dist-native`.

### 4. Native API Routing (`src/routes/_authenticated/assistant.tsx`)
- Ensures `/api/chat` calls are routed to `https://tanstack-start-ts.somalabs.workers.dev/api/chat` when `Capacitor.isNativePlatform()` is true.

### 5. Package.json Scripts
- Adds `"build:native": "vite build --config vite.config.native.ts"`.
- Keeps `"build": "vite build"` (Cloudflare SSR build) unchanged.

## Verification Plan
1. Create `index.html` from `index.html.bak`.
2. Create `vite.config.native.ts`.
3. Update `capacitor.config.ts` (`webDir: "dist-native"`).
4. Update `assistant.tsx` to handle native API base URL if needed.
5. Run `npm run build:native` and verify `dist-native/index.html` exists.
6. Run `npx cap sync android` and confirm successful sync.

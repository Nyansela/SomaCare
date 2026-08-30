# Three Integrations (Google Maps, RxNorm, openFDA) - Design Spec

## Overview
Wire in three integrations across SomaCare:
1. **Google Maps**: Fix existing hospital finder map component to read `VITE_GOOGLE_MAPS_API_KEY` and update `.env.example`.
2. **RxNorm**: Create server-side helper (`src/lib/rxnorm.server.ts`) for drug name normalization (`normalizeDrugName`) and autocomplete search (`searchDrugs`), add `rxcui` column to `medications` table via Supabase migration, and wire autocomplete into the Medications form.
3. **openFDA**: Create server-side helper (`src/lib/openfda.server.ts`) for drug label fetching (`getDrugLabel`), add agentic tool `checkDrugInteractionWarnings(medicationNames: string[])` to `/api/chat`, and document `OPENFDA_API_KEY` in `.env.example`.

## Detailed Components

### Part A: Google Maps Fix
- In `src/routes/_authenticated/find.hospitals.tsx`, update `BROWSER_KEY` to read `import.meta.env.VITE_GOOGLE_MAPS_API_KEY`.
- Add `VITE_GOOGLE_MAPS_API_KEY=` to `.env.example`.

### Part B: RxNorm Integration
- **Migration**: `supabase/migrations/20260825000002_medications_rxcui.sql` adding `rxcui text` to `medications`.
- **Helper (`src/lib/rxnorm.server.ts`)**:
  - `searchDrugs(query)` -> queries `https://rxnav.nlm.nih.gov/REST/drugs.json?name=<query>`
  - `normalizeDrugName(name)` -> queries `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=<name>`
- **API Endpoint / Client Helper**: `/api/medications/search?q=...` or direct client fetch to RxNorm REST API for autocomplete in Medications dialog.
- **Medication form**: Update medication creation dialog to allow selecting an autocomplete suggestion, saving both name and resolved `rxcui`.

### Part C: openFDA Integration & Agentic Tool
- **Helper (`src/lib/openfda.server.ts`)**:
  - `getDrugLabel(drugName)` -> queries `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"<drugName>"&api_key=OPENFDA_API_KEY&limit=1` using `process.env.OPENFDA_API_KEY`.
  - Extracts `drug_interactions` and `warnings` fields. Returns fallback safely on error or missing label.
- **Agentic Tool in `/api/chat`**:
  - `checkDrugInteractionWarnings`: Read-only tool (`execute` function) taking `medicationNames: string[]`. Calls `getDrugLabel` for each medication and returns structured summary of FDA interactions/warnings.
- **Documentation**: Add `# OPENFDA_API_KEY= (set via wrangler secret OPENFDA_API_KEY)` to `.env.example`.

## Constraints
- Plain `fetch()` only.
- Do NOT import `ai` package broadly or trigger `@ai-sdk/gateway`.
- Never hardcode any key in source code.

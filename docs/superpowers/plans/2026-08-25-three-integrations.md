# Three Integrations (Google Maps, RxNorm, openFDA) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire in Google Maps API key configuration, RxNorm medication name normalization & autocomplete, and openFDA drug interaction warnings tool in AI chat, with zero Vercel AI SDK gateway imports.

**Architecture:** 
1. Update `src/routes/_authenticated/find.hospitals.tsx` to read `import.meta.env.VITE_GOOGLE_MAPS_API_KEY` and update `.env.example`.
2. Create server-side helper `src/lib/rxnorm.server.ts` and Supabase migration for `rxcui` column on `medications`, plus wire autocomplete in medications UI.
3. Create server-side helper `src/lib/openfda.server.ts` and add `checkDrugInteractionWarnings` read tool to `/api/chat`.

**Tech Stack:** React, TanStack Start, TypeScript, Supabase, RxNorm REST API, openFDA API, Google Maps JS API.

## Global Constraints
- Do NOT import the 'ai' package broadly or trigger `@ai-sdk/gateway`. Use plain `fetch()`.
- Never hardcode any key in source code.
- Handle missing keys/failed API responses gracefully.

---

### Task 1: Google Maps Key Configuration Fix & `.env.example` Update

**Files:**
- Modify: `src/routes/_authenticated/find.hospitals.tsx:26-27`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `import.meta.env.VITE_GOOGLE_MAPS_API_KEY`

- [ ] **Step 1: Edit `src/routes/_authenticated/find.hospitals.tsx`**

```ts
const BROWSER_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as
  string | undefined;
```

- [ ] **Step 2: Update `.env.example`**

Add `VITE_GOOGLE_MAPS_API_KEY=` and `OPENFDA_API_KEY=` (commented as wrangler secret) to `.env.example`.

- [ ] **Step 3: Verify build**
Run: `npm run build`
Expected: PASS

---

### Task 2: RxNorm Integration & Medications Autocomplete

**Files:**
- Create: `supabase/migrations/20260825000002_medications_rxcui.sql`
- Create: `src/lib/rxnorm.server.ts`
- Modify: `src/routes/_authenticated/medications.tsx`

**Interfaces:**
- Produces: `src/lib/rxnorm.server.ts` (`searchDrugs`, `normalizeDrugName`).
- Consumes: `medications` table with `rxcui` column.

- [ ] **Step 1: Create Supabase migration `supabase/migrations/20260825000002_medications_rxcui.sql`**

```sql
alter table public.medications add column if not exists rxcui text;
```

- [ ] **Step 2: Create `src/lib/rxnorm.server.ts`**

```ts
export type RxNormDrugSuggestion = {
  rxcui?: string;
  name: string;
};

export async function searchDrugs(query: string): Promise<RxNormDrugSuggestion[]> {
  if (!query || query.trim().length < 2) return [];
  try {
    const res = await fetch(`https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(query.trim())}`);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      drugGroup?: {
        conceptGroup?: Array<{
          conceptProperties?: Array<{ rxcui?: string; name?: string }>;
        }>;
      };
    };
    const results: RxNormDrugSuggestion[] = [];
    const groups = data.drugGroup?.conceptGroup || [];
    for (const group of groups) {
      if (group.conceptProperties) {
        for (const prop of group.conceptProperties) {
          if (prop.name) {
            results.push({ rxcui: prop.rxcui, name: prop.name });
          }
        }
      }
    }
    return results.slice(0, 10);
  } catch {
    return [];
  }
}

export async function normalizeDrugName(name: string): Promise<{ rxcui: string | null; name: string }> {
  if (!name || name.trim().length === 0) return { rxcui: null, name };
  try {
    const res = await fetch(`https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(name.trim())}`);
    if (!res.ok) return { rxcui: null, name };
    const data = (await res.json()) as { idGroup?: { rxnormId?: string[] } };
    const rxcui = data.idGroup?.rxnormId?.[0] || null;
    return { rxcui, name: name.trim() };
  } catch {
    return { rxcui: null, name: name.trim() };
  }
}
```

- [ ] **Step 3: Update `src/routes/_authenticated/medications.tsx` to add autocomplete & rxcui saving**

- [ ] **Step 4: Verify build**
Run: `npm run build`
Expected: PASS

---

### Task 3: openFDA Integration & Agentic Tool in `/api/chat`

**Files:**
- Create: `src/lib/openfda.server.ts`
- Modify: `src/routes/api/chat.ts`

**Interfaces:**
- Produces: `src/lib/openfda.server.ts` (`getDrugLabel`).
- Consumes: `OPENFDA_API_KEY` from `process.env`.

- [ ] **Step 1: Create `src/lib/openfda.server.ts`**

```ts
export type OpenFdaLabelResult = {
  drugName: string;
  warnings?: string[];
  drugInteractions?: string[];
  error?: string;
};

export async function getDrugLabel(drugName: string): Promise<OpenFdaLabelResult> {
  const apiKey = process.env.OPENFDA_API_KEY;
  if (!apiKey) {
    return { drugName, error: "openfda_api_key_unset" };
  }
  try {
    const url = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encodeURIComponent(
      drugName,
    )}"&api_key=${apiKey}&limit=1`;
    const res = await fetch(url);
    if (!res.ok) {
      // Try generic name search fallback
      const genericUrl = `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${encodeURIComponent(
        drugName,
      )}"&api_key=${apiKey}&limit=1`;
      const genericRes = await fetch(genericUrl);
      if (!genericRes.ok) {
        return { drugName, error: "no_label_found" };
      }
      const data = (await genericRes.json()) as {
        results?: Array<{
          warnings?: string[];
          drug_interactions?: string[];
        }>;
      };
      const result = data.results?.[0];
      if (!result) return { drugName, error: "no_label_found" };
      return {
        drugName,
        warnings: result.warnings,
        drugInteractions: result.drug_interactions,
      };
    }
    const data = (await res.json()) as {
      results?: Array<{
        warnings?: string[];
        drug_interactions?: string[];
      }>;
    };
    const result = data.results?.[0];
    if (!result) return { drugName, error: "no_label_found" };
    return {
      drugName,
      warnings: result.warnings,
      drugInteractions: result.drug_interactions,
    };
  } catch {
    return { drugName, error: "fetch_failed" };
  }
}
```

- [ ] **Step 2: Add `checkDrugInteractionWarnings` tool to `src/routes/api/chat.ts`**

```ts
import { getDrugLabel } from "@/lib/openfda.server";

const checkDrugInteractionWarningsTool = tool({
  description:
    "Check openFDA drug labels and interaction warnings for a list of medications the user is taking. Executes immediately (read-only).",
  inputSchema: z.object({
    medicationNames: z.array(z.string()).describe("List of medication names to check"),
  }),
  execute: async ({ medicationNames }) => {
    if (!medicationNames || medicationNames.length === 0) {
      return { status: "no_medications_provided" };
    }
    const results = await Promise.all(
      medicationNames.map((name) => getDrugLabel(name)),
    );
    return {
      results: results.map((r) => ({
        medication: r.drugName,
        warnings: r.warnings?.slice(0, 2) || [],
        interactions: r.drugInteractions?.slice(0, 2) || [],
        status: r.error || "success",
      })),
      disclaimer: "Information sourced from openFDA. Consult a qualified clinician or pharmacist for medical advice.",
    };
  },
});
```

- [ ] **Step 3: Register `checkDrugInteractionWarnings` tool in `streamText` tools dictionary in `src/routes/api/chat.ts`**

- [ ] **Step 4: Verify build**
Run: `npm run build`
Expected: PASS

---

### Task 4: Mandatory Verification

- [ ] **Step 1: Run build**
Run: `npm run build`
Expected: PASS

- [ ] **Step 2: Start wrangler dev and test**
Run: `npx wrangler dev --config .output/server/wrangler.json`
Test RxNorm search / autocomplete and openFDA interaction tool gracefully handling unset key.

# Full App i18n Pass & Ewe (ee) / Ga (ga) Translation Audit Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Perform a complete i18n pass across the entire SomaCare web application, converting all hardcoded English UI strings to `useTranslation()` / `t()`, updating all four translation locale files (`en.json`, `tw.json`, `ee.json`, `ga.json`) with complete translation keys for all sections, and confirming language switching works across multiple pages in English, Twi, Ewe, and Ga.

**Architecture:** Use `react-i18next` with `useTranslation()` hook in React components. Store translation key-value mappings in JSON files under `src/locales/`. Use fallback strings in `t("key", "Fallback")` to guarantee graceful rendering. Store user language preference in `i18next` state and Supabase profile settings.

**Tech Stack:** React 18, TanStack Router / TanStack Query, i18next / react-i18next, TypeScript, Tailwind CSS, Vite.

## Global Constraints

- **AI-Translated Disclaimer:** Explicitly flag in documentation and PR notes that Ewe (`ee.json`) and Ga (`ga.json`) translations are AI-translated and subject to native speaker review before production release.
- **Strict Verification:** Run `npm run build` with zero TypeScript or Vite compilation errors before completing.
- **Completeness:** Ensure every route/component updated uses `useTranslation()` so switching languages updates visible UI elements on Dashboard, Nutrition, Fitness, Health Vault, Doctor Sharing, Assistant, Settings, and Nav Shell.

---

### Task 1: Audit & Expand Translation Locale Files (`en.json`, `tw.json`, `ee.json`, `ga.json`)

**Files:**
- Modify: `src/locales/en.json`
- Modify: `src/locales/tw.json`
- Modify: `src/locales/ee.json`
- Modify: `src/locales/ga.json`

**Interfaces:**
- Produces: Complete translation dictionaries with namespaces: `nav`, `settings`, `assistant`, `dashboard`, `nutrition`, `fitness`, `healthVault`, `doctorSharing`, `medications`, `vitals`, `hydration`, `sleep`, `records`, `appointments`, `common`.

- [ ] **Step 1: Audit existing locale files and structure key namespaces**

Inspect `en.json`, `tw.json`, `ee.json`, `ga.json` and harmonize all missing keys so that all 4 files have matching key structure for `nav`, `settings`, `assistant`, `dashboard`, `nutrition`, `fitness`, `healthVault`, `doctorSharing`, `medications`, `vitals`, `common`.

- [ ] **Step 2: Update `src/locales/en.json` with all required UI keys**

Add full English text for all app features and subcomponents.

- [ ] **Step 3: Update `src/locales/tw.json` with Twi translations**

Ensure Twi locale has corresponding translations for all new keys.

- [ ] **Step 4: Update `src/locales/ee.json` with Ewe (ee) translations**

Provide complete Ewe translations for all keys (flagged as AI-generated).

- [ ] **Step 5: Update `src/locales/ga.json` with Ga (ga) translations**

Provide complete Ga translations for all keys (flagged as AI-generated).

- [ ] **Step 6: Verify JSON syntax validity across all 4 files**

Run `node -e "['en','tw','ee','ga'].forEach(l => JSON.parse(fs.readFileSync('src/locales/'+l+'.json')))"` to confirm valid JSON.

- [ ] **Step 7: Commit locale updates**

```bash
git add src/locales/*.json
git commit -m "i18n: audit and expand en, tw, ee, and ga locale translation dictionaries"
```

---

### Task 2: Wire Up `AppShell` and `Settings` Components

**Files:**
- Modify: `src/components/app-shell.tsx`
- Modify: `src/routes/_authenticated/settings.tsx`

**Interfaces:**
- Consumes: `useTranslation()` from `react-i18next`, `nav`, `settings` translation keys.

- [ ] **Step 1: Replace hardcoded strings in `AppShell` with `t()` calls**

Update header clock aria-labels, sign out button, settings link, avatar fallbacks, and mobile overlay text to use `t()`.

- [ ] **Step 2: Wire up `Settings` tabs, headers, descriptions, and labels to `t()`**

Replace hardcoded tab names ("Appearance", "Health", "Notifications", "Privacy & Security", "Account", "Integrations", "Reports & Exports", "Accessibility"), card titles, and language dropdown options with `t()`.

- [ ] **Step 3: Verify TypeScript compilation for `AppShell` and `Settings`**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 4: Commit `AppShell` and `Settings` changes**

```bash
git add src/components/app-shell.tsx src/routes/_authenticated/settings.tsx
git commit -m "i18n: wire useTranslation in AppShell and Settings page"
```

---

### Task 3: Wire Up Core Pages (Dashboard, Nutrition, Fitness, Health Vault, Doctor Sharing, Assistant)

**Files:**
- Modify: `src/routes/_authenticated/app.tsx` (Dashboard)
- Modify: `src/routes/_authenticated/nutrition.tsx`
- Modify: `src/routes/_authenticated/fitness.tsx`
- Modify: `src/routes/_authenticated/health-vault.tsx`
- Modify: `src/components/health-vault/HealthVaultShareManager.tsx`
- Modify: `src/routes/_authenticated/assistant.tsx`

**Interfaces:**
- Consumes: `useTranslation()` from `react-i18next`, locale keys for `dashboard`, `nutrition`, `fitness`, `healthVault`, `doctorSharing`, `assistant`.

- [ ] **Step 1: Wire up Dashboard (`app.tsx`) with `useTranslation()`**

Replace titles ("Dashboard", "Upcoming appointments", "Recent results", "Ask about your health", "Current prescription", "Notifications", buttons, empty states) with `t()`.

- [ ] **Step 2: Wire up Nutrition (`nutrition.tsx`) with `useTranslation()`**

Replace headers, meal labels ("Breakfast", "Lunch", "Dinner", "Snacks"), plan generation buttons, empty states, and notes with `t()`.

- [ ] **Step 3: Wire up Fitness (`fitness.tsx`) with `useTranslation()`**

Replace headers, recommendation cards, workout buttons, target goals, and empty states with `t()`.

- [ ] **Step 4: Wire up Health Vault (`health-vault.tsx`) & Doctor Sharing (`HealthVaultShareManager.tsx`) with `useTranslation()`**

Replace Vault title, Share button, modal titles, access level dropdowns, expiration settings, share link labels with `t()`.

- [ ] **Step 5: Wire up AI Assistant (`assistant.tsx`) with `useTranslation()`**

Replace headers, placeholder text, disclaimer text, new chat button, and action buttons with `t()`.

- [ ] **Step 6: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 7: Commit core pages i18n wiring**

```bash
git add src/routes/_authenticated/app.tsx src/routes/_authenticated/nutrition.tsx src/routes/_authenticated/fitness.tsx src/routes/_authenticated/health-vault.tsx src/components/health-vault/HealthVaultShareManager.tsx src/routes/_authenticated/assistant.tsx
git commit -m "i18n: wire useTranslation in Dashboard, Nutrition, Fitness, Health Vault, Doctor Sharing, and AI Assistant"
```

---

### Task 4: Wire Up Remaining Pages (Medications, Vitals, Hydration, Sleep, Records, Appointments, Schedule, Find Hospitals, Emergency, Profile, Onboarding)

**Files:**
- Modify: `src/routes/_authenticated/medications.tsx`
- Modify: `src/routes/_authenticated/trackers.vitals.tsx`
- Modify: `src/routes/_authenticated/hydration.tsx`
- Modify: `src/routes/_authenticated/sleep.tsx`
- Modify: `src/routes/_authenticated/records.tsx`
- Modify: `src/routes/_authenticated/appointments.tsx`
- Modify: `src/routes/_authenticated/schedule.tsx`
- Modify: `src/routes/_authenticated/find.hospitals.tsx`
- Modify: `src/routes/_authenticated/emergency.tsx`
- Modify: `src/routes/_authenticated/profile.tsx`
- Modify: `src/routes/onboarding.tsx`

**Interfaces:**
- Consumes: `useTranslation()` across remaining pages and components.

- [ ] **Step 1: Wire up Medications, Vitals, Hydration, Sleep with `useTranslation()`**

Replace section titles, card headers, input labels, buttons, and empty states with `t()`.

- [ ] **Step 2: Wire up Records, Appointments, Schedule, Find Hospitals, Emergency, Profile, Onboarding with `useTranslation()`**

Replace section titles, card headers, action buttons, filter options, and empty states with `t()`.

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 4: Commit remaining pages i18n wiring**

```bash
git add src/routes/_authenticated/*.tsx src/routes/onboarding.tsx
git commit -m "i18n: wire useTranslation across all remaining application pages"
```

---

### Task 5: Build Verification, Multi-Language UI Testing & Final Clearance

**Files:**
- Test: All route components, language switcher in `Settings`, and locale resources in `src/locales/`.

- [ ] **Step 1: Execute production build**

Run: `npm run build`
Expected: Build succeeds with zero errors (`0 errors`).

- [ ] **Step 2: Test language switching across all 4 languages (EN, TW, EE, GA) on 3+ distinct pages**

Verify that selecting English, Twi, Ewe, or Ga updates visible text in real-time across:
1. Nav Shell / Settings
2. Dashboard (`/app`)
3. Nutrition (`/nutrition`)
4. Fitness (`/fitness`)
5. Health Vault (`/health-vault`)

- [ ] **Step 3: Document AI-translated disclaimer**

Include explicit notice in final output that Ewe (`ee`) and Ga (`ga`) translations are AI-translated and should ideally be reviewed by a native speaker before final production deployment.

- [ ] **Step 4: Commit final verification**

```bash
git add .
git commit -m "i18n: final build verification and multi-language support completion"
```

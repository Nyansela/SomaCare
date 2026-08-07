# SomaCare Comprehensive Fixes & Features - Design Document

## Overview
This document outlines the comprehensive fixes and new features needed to make SomaCare production-ready. The work spans UI fixes, new features, and system improvements.

## Issues to Fix

### 1. Merge "Customize your Adwoa" with Settings Appearance Tab
**Problem**: The ThemeCustomizer in AppShell sidebar ("Customize your Adwoa") conflicts with Settings > Appearance tab.
**Solution**: 
- Remove ThemeCustomizer from AppShell header
- Enhance Settings > Appearance tab to include ALL customization options from ThemeCustomizer
- Migrate theme-store logic to use Supabase user preferences for persistence
- Keep ThemeInit for initial load

### 2. Fix Fitness Tab Not Loading
**Problem**: Fitness page may not be loading due to query issues or missing imports.
**Investigation needed**: Check if the page renders correctly, verify all imports, check for React errors.

### 3. Fix PDF Generation Error
**Problem**: `pdf(<HealthReportPDF {...pdfData} />).toBlob()` is incorrect API usage.
**Correct API**: 
```typescript
import { pdf } from '@react-pdf/renderer';
const blob = await pdf(<HealthReportPDF {...pdfData} />).toBlob();
// OR
const { blob } = await pdf(<HealthReportPDF {...pdfData} />).toBlob();
```

### 4. Fix Settings Tab Layout (Cards Overlaying Tabs)
**Problem**: TabsContent components don't have proper structure causing overlay.
**Solution**: 
- Ensure each TabsContent has a proper wrapper div
- Add `className="space-y-6"` or similar spacing
- Verify the Tabs component from shadcn/ui is used correctly

### 5. Revamp AI Assistant Page
**Goals**: More functional, reactive, and nicer design.
**Improvements**:
- Add health context indicator showing what data Adwoa has access to
- Add message reactions (helpful/not helpful)
- Add voice input support
- Add conversation export
- Improve empty state with better onboarding
- Add typing indicator with better UX
- Add message search/filter
- Add quick actions based on health context
- Improve message bubbles with better markdown rendering
- Add conversation pinning

### 6. Secure Health Sharing Feature
**Requirements**:
- Create `health_shares` table with: id, user_id, token, expires_at, created_at, revoked_at
- Generate secure time-limited share links (24h, 7d, 30d)
- "Share with Doctor" button in Health Vault
- Read-only view page at `/share/:token` 
- RLS: anonymous access via token only, no user data exposure
- List previous shares with revoke option
- Clear expiration messaging

### 7. Add Ghanaian Food Context to Nutrition
**Requirements**:
- Update `/api/nutrition` prompt to suggest authentic Ghanaian dishes
- Include: waakye, banku with tilapia, jollof rice, kenkey, fufu with light soup, red red, kelewele, plantain-based meals
- Respect dietary preferences, allergies, chronic conditions
- Explain WHY each dish fits their health profile
- Update fallback example meal plan with Ghanaian examples

## Implementation Plan

### Phase 1: Core Fixes (Parallel)
1. Fix PDF generation error
2. Fix Settings tab layout
3. Fix Fitness tab loading
4. Merge ThemeCustomizer with Settings Appearance

### Phase 2: Feature Implementation (Parallel)
1. Revamp AI Assistant page
2. Add secure health sharing feature
3. Add Ghanaian food context to Nutrition

### Phase 3: Integration & Polish
1. System-wide testing
2. Build verification
3. Clean up any remaining issues

## Database Migrations Needed

### 1. health_shares table
```sql
CREATE TABLE public.health_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

ALTER TABLE public.health_shares ENABLE ROW LEVEL SECURITY;

-- Policy for token-based read access (no auth required, token in URL)
CREATE POLICY "read by token" ON public.health_shares
  FOR SELECT USING (token IS NOT NULL AND expires_at > now() AND revoked_at IS NULL);

-- Policy for user to manage their own shares
CREATE POLICY "user manages own shares" ON public.health_shares
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX health_shares_token ON public.health_shares (token);
CREATE INDEX health_shares_user ON public.health_shares (user_id);
```

### 2. Add share_duration preference to profiles
```sql
-- Already handled via JSONB preferences column
```

## API Routes Needed

### 1. POST /api/health-share/generate
- Generate secure token, store in health_shares
- Return share URL with expiration info

### 2. DELETE /api/health-share/:id
- Revoke share (set revoked_at)

### 3. GET /api/health-share/list
- List user's shares with status

### 4. GET /share/:token (public page)
- Read-only health summary view
- No authentication required
- Uses token to fetch data server-side

## Files to Modify

### Core Fixes
- `src/routes/_authenticated/health-vault.tsx` - Fix PDF generation
- `src/routes/_authenticated/settings.tsx` - Fix layout, merge theme customizer
- `src/routes/_authenticated/fitness.tsx` - Fix loading issue
- `src/routes/_authenticated/assistant.tsx` - Complete revamp
- `src/routes/_authenticated/nutrition.tsx` - Minor updates for Ghanaian context

### New Files
- `src/routes/public/share/[token].tsx` - Read-only share view
- `src/routes/api/health-share/generate.ts` - Generate share link
- `src/routes/api/health-share/revoke.ts` - Revoke share
- `src/routes/api/health-share/list.ts` - List shares
- `supabase/migrations/XXX_health_shares.sql` - Migration

### Theme Integration
- `src/lib/theme-store.ts` - Modify to use Supabase preferences
- `src/components/theme-customizer.tsx` - Remove from AppShell, enhance Settings
- `src/components/app-shell.tsx` - Remove ThemeCustomizer from header

### Nutrition
- `src/routes/api/nutrition.ts` - Update prompt for Ghanaian dishes

## Technical Details

### PDF Generation Fix
```typescript
// Current (broken):
const blob = await pdf(<HealthReportPDF {...pdfData} />).toBlob();

// Correct:
const { blob } = await pdf(<HealthReportPDF {...pdfData} />).toBlob();
// OR
const blob = await pdf(<HealthReportPDF {...pdfData} />).toBlob();
```

### Settings Layout Fix
Each TabsContent should be:
```tsx
<TabsContent value="appearance" className="space-y-6 p-4">
  <Card>...</Card>
</TabsContent>
```

### Fitness Tab Debug
Check if the issue is:
- Missing import (React.useEffect not imported as React)
- Query error causing crash
- Missing Suspense boundary

## Acceptance Criteria
- [ ] All pages load without errors
- [ ] PDF generation works and downloads correctly
- [ ] Settings tab layout is clean, no overlay
- [ ] Theme customization works and persists to Supabase
- [ ] AI Assistant is modern, functional, reactive
- [ ] Health sharing generates secure links with proper expiration
- [ ] Read-only share view works without login
- [ ] Nutrition plans include authentic Ghanaian dishes
- [ ] All builds pass with zero errors
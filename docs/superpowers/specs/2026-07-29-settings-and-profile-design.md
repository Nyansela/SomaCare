# Design Spec: Unified Theme Settings & Comprehensive Profile Page

## 1. Overview
This design addresses two major areas:
1. **Unified Theme & Appearance Settings**: Resolves the bug where appearance options (presets, dark mode background, typography, corner radius, layout density) do not persist or apply properly in `settings.tsx`. It unifies the settings state with `src/lib/theme-store.ts`, eliminating duplicate custom `applyTheme` logic and ensuring immediate application and robust database persistence via `profiles.preferences`.
2. **Comprehensive Profile Page**: Implements a dedicated Profile page (`_authenticated/profile.tsx`) allowing users to manage their personal details (display name, date of birth, sex, blood type, height, weight), avatar, emergency contacts, and medical baseline summary.

## 2. Architecture & Components
- **Theme Store Integration**: `settings.tsx` will load and save theme settings using the standardized functions from `src/lib/theme-store.ts`.
- **Profile Page (`src/routes/_authenticated/profile.tsx`)**:
  - Profile header with avatar placeholder / upload capability.
  - Personal Information form (Display Name, Date of Birth, Sex, Blood Type, Height, Weight).
  - Emergency Contacts list.
  - Medical History summary link / shortcut.
- **Navigation / Shell**: Add a link to the Profile page in the AppShell navigation if not already present.

## 3. Data Flow
- **Theme**: Stored in `profiles.preferences.theme` and `localStorage`, applied instantly via `applyTheme()` on `document.documentElement`.
- **Profile**: Stored in the `profiles` table (`display_name`, `date_of_birth`, `sex`, `blood_type`, `height_cm`, `emergency_contacts`, etc.).

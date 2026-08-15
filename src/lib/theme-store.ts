// Client-side theme + layout customization.
// Single source of truth for appearance settings. Persists to localStorage
// (device cache) and Supabase profiles.preferences (account), and applies
// CSS variables + data attributes to <html>.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Appearance = "light" | "dark" | "system";
export type RadiusMode = "sharp" | "soft" | "pill";
export type FontMode = "modern" | "editorial" | "mono";
export type LayoutMode = "compact" | "sidebar" | "spacious";
export type FontSizeMode = "sm" | "md" | "lg";
export type DarkBackgroundMode = "material" | "pure-black" | "custom";

export type SavedTheme = {
  id: string;
  name: string;
  createdAt: string;
  settings: ThemeSettings;
};

export type ThemeSettings = {
  /** Palette preset id (see THEME_PRESETS). */
  preset: string;
  appearance: Appearance;
  radius: RadiusMode;
  font: FontMode;
  layout: LayoutMode;
  fontSize: FontSizeMode;
  /** Hex override for the primary/accent color. Empty string = follow preset. */
  accentColor: string;
  darkModeBackground: DarkBackgroundMode;
  customDarkBackground: string;
  highContrast: boolean;
  reducedMotion: boolean;
  savedThemes: SavedTheme[];
};

export type ThemePreset = {
  id: string;
  name: string;
  /** swatch[0] is also the default accent hex for the preset. */
  swatch: string[];
  vars: Record<string, string>;
  /** Vars applied on top of `vars` in dark mode. */
  dark?: Record<string, string>;
};

// ---------------------------------------------------------------------------
// Presets & option maps
// ---------------------------------------------------------------------------

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "soma-indigo",
    name: "Soma Green",
    swatch: ["#16a34a", "#15803d", "#f0fdf4", "#052e16"],
    vars: {
      "--primary": "oklch(0.55 0.16 145)",
      "--accent": "oklch(0.94 0.03 145)",
      "--accent-foreground": "oklch(0.3 0.08 145)",
    },
    dark: {
      "--accent": "oklch(0.28 0.05 145)",
      "--accent-foreground": "oklch(0.93 0.02 145)",
    },
  },
  {
    id: "emerald-mint",
    name: "Emerald Mint",
    swatch: ["#10b981", "#059669", "#ecfdf5", "#064e3b"],
    vars: {
      "--primary": "oklch(0.68 0.15 160)",
      "--accent": "oklch(0.94 0.05 160)",
      "--accent-foreground": "oklch(0.35 0.1 160)",
    },
    dark: {
      "--accent": "oklch(0.3 0.06 160)",
      "--accent-foreground": "oklch(0.94 0.03 160)",
    },
  },
  {
    id: "sunset-coral",
    name: "Sunset Coral",
    swatch: ["#fb7185", "#e11d48", "#fff1f2", "#4c0519"],
    vars: {
      "--primary": "oklch(0.7 0.18 15)",
      "--accent": "oklch(0.95 0.04 15)",
      "--accent-foreground": "oklch(0.4 0.14 15)",
    },
    dark: {
      "--accent": "oklch(0.3 0.07 15)",
      "--accent-foreground": "oklch(0.94 0.03 15)",
    },
  },
  {
    id: "ocean-blue",
    name: "Ocean Blue",
    swatch: ["#0ea5e9", "#0284c7", "#e0f2fe", "#082f49"],
    vars: {
      "--primary": "oklch(0.68 0.14 230)",
      "--accent": "oklch(0.94 0.04 230)",
      "--accent-foreground": "oklch(0.35 0.12 230)",
    },
    dark: {
      "--accent": "oklch(0.28 0.06 230)",
      "--accent-foreground": "oklch(0.93 0.03 230)",
    },
  },
  {
    id: "amber-warmth",
    name: "Amber Warmth",
    swatch: ["#f59e0b", "#d97706", "#fffbeb", "#451a03"],
    vars: {
      "--primary": "oklch(0.75 0.15 70)",
      "--accent": "oklch(0.95 0.05 75)",
      "--accent-foreground": "oklch(0.4 0.12 60)",
    },
    dark: {
      "--accent": "oklch(0.3 0.07 70)",
      "--accent-foreground": "oklch(0.94 0.03 70)",
    },
  },
  {
    id: "midnight",
    name: "Midnight Violet",
    swatch: ["#a78bfa", "#7c3aed", "#1e1b4b", "#0b1020"],
    vars: {
      "--primary": "oklch(0.72 0.18 295)",
      "--accent": "oklch(0.35 0.1 295)",
      "--accent-foreground": "oklch(0.95 0.02 295)",
    },
    dark: {
      "--accent": "oklch(0.3 0.09 295)",
      "--accent-foreground": "oklch(0.94 0.02 295)",
    },
  },
];

export const RADIUS_MAP: Record<RadiusMode, string> = {
  sharp: "0.35rem",
  soft: "0.9rem",
  pill: "1.6rem",
};

export const FONT_MAP: Record<FontMode, { display: string; sans: string }> = {
  modern: {
    display: `"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif`,
    sans: `"Inter", ui-sans-serif, system-ui, sans-serif`,
  },
  editorial: {
    display: `"Playfair Display", Georgia, serif`,
    sans: `"Inter", ui-sans-serif, system-ui, sans-serif`,
  },
  mono: {
    display: `"JetBrains Mono", ui-monospace, monospace`,
    sans: `"JetBrains Mono", ui-monospace, monospace`,
  },
};

export const FONT_SIZE_MAP: Record<FontSizeMode, string> = {
  sm: "0.875rem",
  md: "1rem",
  lg: "1.125rem",
};

/** Quick accent swatches offered in the customizer (accentColor stores a hex). */
export const ACCENT_SWATCHES: { id: string; label: string; color: string }[] = [
  { id: "green", label: "Green", color: "#16a34a" },
  { id: "blue", label: "Blue", color: "#2563eb" },
  { id: "purple", label: "Purple", color: "#7c3aed" },
  { id: "orange", label: "Orange", color: "#f59e0b" },
  { id: "red", label: "Red", color: "#dc2626" },
];

const HEX_RE = /^#[0-9a-f]{6}$/i;

// ---------------------------------------------------------------------------
// Defaults & persistence
// ---------------------------------------------------------------------------

const KEY = "soma.theme.v2";
const LEGACY_KEY = "soma.theme.v1";

export const DEFAULT_THEME: ThemeSettings = {
  preset: "soma-indigo",
  appearance: "system",
  radius: "soft",
  font: "modern",
  layout: "sidebar",
  fontSize: "md",
  accentColor: "",
  darkModeBackground: "material",
  customDarkBackground: "#121212",
  highContrast: false,
  reducedMotion: false,
  savedThemes: [],
};

function sanitize(raw: Partial<ThemeSettings>): ThemeSettings {
  const s: ThemeSettings = { ...DEFAULT_THEME, ...raw };
  if (!THEME_PRESETS.some((p) => p.id === s.preset)) s.preset = DEFAULT_THEME.preset;
  if (!["light", "dark", "system"].includes(s.appearance)) s.appearance = DEFAULT_THEME.appearance;
  if (!(s.radius in RADIUS_MAP)) s.radius = DEFAULT_THEME.radius;
  if (!(s.font in FONT_MAP)) s.font = DEFAULT_THEME.font;
  if (!["compact", "sidebar", "spacious"].includes(s.layout)) s.layout = DEFAULT_THEME.layout;
  if (!(s.fontSize in FONT_SIZE_MAP)) s.fontSize = DEFAULT_THEME.fontSize;
  if (!["material", "pure-black", "custom"].includes(s.darkModeBackground)) {
    s.darkModeBackground = DEFAULT_THEME.darkModeBackground;
  }
  s.accentColor =
    typeof s.accentColor === "string" && HEX_RE.test(s.accentColor) ? s.accentColor : "";
  s.customDarkBackground =
    typeof s.customDarkBackground === "string" && HEX_RE.test(s.customDarkBackground)
      ? s.customDarkBackground
      : DEFAULT_THEME.customDarkBackground;
  s.highContrast = !!s.highContrast;
  s.reducedMotion = !!s.reducedMotion;
  if (!Array.isArray(s.savedThemes)) {
    s.savedThemes = [];
  } else {
    s.savedThemes = s.savedThemes
      .filter((t) => t && typeof t === "object" && typeof t.name === "string")
      .map((t) => ({
        id: typeof t.id === "string" ? t.id : String(Date.now() + Math.random()),
        name: t.name,
        createdAt: typeof t.createdAt === "string" ? t.createdAt : "",
        settings: sanitize(t.settings ?? {}),
      }));
  }
  return s;
}

/** Flatten a ThemeSettings into the subset of keys persisted on profiles.preferences. */
function themeFields(s: ThemeSettings): Record<string, unknown> {
  return {
    preset: s.preset,
    appearance: s.appearance,
    radius: s.radius,
    font: s.font,
    layout: s.layout,
    fontSize: s.fontSize,
    accentColor: s.accentColor,
    darkModeBackground: s.darkModeBackground,
    customDarkBackground: s.customDarkBackground,
    highContrast: s.highContrast,
    reducedMotion: s.reducedMotion,
    savedThemes: s.savedThemes,
  };
}

/** Pick theme fields out of a profiles.preferences object (handles the legacy nested `theme` key). */
function pickThemeFields(
  prefs: Record<string, unknown> | null | undefined,
): Partial<ThemeSettings> {
  const base = prefs && typeof prefs === "object" ? prefs : {};
  const legacy = base.theme && typeof base.theme === "object" ? (base.theme as object) : {};
  return { ...legacy, ...base } as Partial<ThemeSettings>;
}

/** Load from localStorage, migrating the v1 schema. */
export function loadTheme(): ThemeSettings {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return sanitize(JSON.parse(raw));
  } catch {
    /* fall through to legacy / default */
  }
  try {
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const s = sanitize(JSON.parse(legacy));
      saveTheme(s);
      return s;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME;
}

export function saveTheme(s: ThemeSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
}

/**
 * Load theme from Supabase profiles.preferences (account), falling back to
 * the localStorage device cache. Call after mount and apply the result.
 */
export async function loadThemeFromSupabase(
  supabase: SupabaseClient<Database>,
): Promise<ThemeSettings> {
  if (typeof window === "undefined") return DEFAULT_THEME;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return loadTheme();

    const { data: profile } = await supabase
      .from("profiles")
      .select("preferences")
      .eq("id", user.id)
      .maybeSingle();

    const prefs = (profile?.preferences ?? {}) as Record<string, unknown>;
    const theme = sanitize(pickThemeFields(prefs));
    if (theme.preset) return theme;
  } catch (e) {
    console.warn("Failed to load theme from Supabase:", e);
  }

  return loadTheme();
}

/** Merge theme fields into profiles.preferences (account-level) and cache to localStorage. */
export async function saveThemeToSupabase(
  supabase: SupabaseClient<Database>,
  s: ThemeSettings,
): Promise<{ ok: boolean; error?: unknown }> {
  saveTheme(s);
  if (typeof window === "undefined") return { ok: false, error: "not in browser" };

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "not signed in" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("preferences")
      .eq("id", user.id)
      .maybeSingle();

    const currentPrefs = (profile?.preferences as Record<string, unknown> | null | undefined) || {};
    const nextPrefs = {
      ...currentPrefs,
      ...themeFields(s),
    } as Json;

    const { error } = await supabase
      .from("profiles")
      .update({ preferences: nextPrefs })
      .eq("id", user.id);

    if (error) return { ok: false, error };
    return { ok: true };
  } catch (e) {
    console.warn("Failed to save theme to Supabase:", e);
    return { ok: false, error: e };
  }
}

// ---------------------------------------------------------------------------
// Color helpers (WCAG contrast for the accent picker)
// ---------------------------------------------------------------------------

export function hexToRgb(hex: string): [number, number, number] {
  const h = String(hex).replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n) || full.length !== 6) return [255, 255, 255];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colors (1..21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Best readable foreground (black or white) for a background hex. */
export function bestForeground(hex: string): string {
  return relativeLuminance(hex) > 0.45 ? "#000000" : "#ffffff";
}

// ---------------------------------------------------------------------------
// Application
// ---------------------------------------------------------------------------

/** CSS custom properties applyTheme manages inline on <html>. */
const MANAGED_PROPS = [
  "--primary",
  "--primary-strong",
  "--ring",
  "--accent",
  "--accent-foreground",
  "--background",
  "--surface",
  "--card",
  "--sidebar",
  "--radius",
  "--font-display",
  "--font-sans",
  "--font-size-base",
];

export function getPreset(id: string): ThemePreset {
  return THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0];
}

export function isDark(appearance: Appearance): boolean {
  if (appearance === "dark") return true;
  if (appearance === "light") return false;
  return (
    typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches
  );
}

/**
 * Apply a full ThemeSettings to <html>: dark class, preset palette vars,
 * radius, fonts, font size, layout/high-contrast/reduced-motion data attrs,
 * accent override and dark background override.
 */
export function applyTheme(s: ThemeSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const preset = getPreset(s.preset);
  const prefersDark = isDark(s.appearance);

  // Clear any inline vars from a previous apply so stylesheet defaults + the
  // color-mix derivations (--primary-strong, --ring) take over again.
  MANAGED_PROPS.forEach((k) => root.style.removeProperty(k));

  root.classList.toggle("dark", prefersDark);

  const baseVars = prefersDark ? { ...preset.vars, ...preset.dark } : preset.vars;
  Object.entries(baseVars).forEach(([k, v]) => root.style.setProperty(k, v));

  root.style.setProperty("--radius", RADIUS_MAP[s.radius]);
  root.style.setProperty("--font-display", FONT_MAP[s.font].display);
  root.style.setProperty("--font-sans", FONT_MAP[s.font].sans);
  root.style.setProperty("--font-size-base", FONT_SIZE_MAP[s.fontSize]);

  root.dataset.layout = s.layout;
  root.dataset.highContrast = s.highContrast ? "true" : "false";
  root.dataset.reducedMotion = s.reducedMotion ? "true" : "false";

  // Accent override — --primary-strong and --ring derive via color-mix in CSS.
  if (HEX_RE.test(s.accentColor)) {
    root.style.setProperty("--primary", s.accentColor);
    root.style.setProperty("--primary-foreground", bestForeground(s.accentColor));
  }

  // Dark background override.
  if (prefersDark && s.darkModeBackground !== "material") {
    if (s.darkModeBackground === "pure-black") {
      root.style.setProperty("--background", "#000000");
      root.style.setProperty("--surface", "#121212");
      root.style.setProperty("--card", "#121212");
      root.style.setProperty("--sidebar", "#0a0a0a");
    } else if (s.darkModeBackground === "custom" && HEX_RE.test(s.customDarkBackground)) {
      root.style.setProperty("--background", s.customDarkBackground);
      root.style.setProperty("--surface", s.customDarkBackground);
      root.style.setProperty("--card", s.customDarkBackground);
      root.style.setProperty("--sidebar", s.customDarkBackground);
    }
  }
}

// ---------------------------------------------------------------------------
// Export / import
// ---------------------------------------------------------------------------

export function serializeThemeExport(settings: ThemeSettings): string {
  const { savedThemes: _saved, ...rest } = settings;
  return JSON.stringify({ name: "SomaCare theme", version: 2, settings: rest }, null, 2);
}

export function parseThemeExport(json: string): { name: string; settings: ThemeSettings } | null {
  try {
    const data = JSON.parse(json);
    if (!data || typeof data !== "object") return null;
    const settings = sanitize({ ...DEFAULT_THEME, ...(data.settings ?? data) });
    const name =
      typeof data.name === "string" && data.name.trim() ? data.name.trim() : "Imported theme";
    return { name, settings };
  } catch {
    return null;
  }
}

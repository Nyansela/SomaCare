// Client-side theme + layout customization.
// Persists to Supabase profiles.preferences and applies CSS variables to <html>.

export type ThemePreset = {
  id: string;
  name: string;
  swatch: string[];
  vars: Record<string, string>;
  dark?: Record<string, string>;
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "soma-indigo",
    name: "Soma Green",
    swatch: ["#16a34a", "#15803d", "#f0fdf4", "#052e16"],
    vars: {
      "--primary": "oklch(0.55 0.16 145)",
      "--primary-strong": "oklch(0.48 0.18 145)",
      "--ring": "oklch(0.66 0.16 145)",
      "--accent": "oklch(0.94 0.03 145)",
      "--accent-foreground": "oklch(0.3 0.08 145)",
    },
  },
  {
    id: "emerald-mint",
    name: "Emerald Mint",
    swatch: ["#10b981", "#059669", "#ecfdf5", "#064e3b"],
    vars: {
      "--primary": "oklch(0.68 0.15 160)",
      "--primary-strong": "oklch(0.6 0.17 160)",
      "--ring": "oklch(0.68 0.15 160)",
      "--accent": "oklch(0.94 0.05 160)",
      "--accent-foreground": "oklch(0.35 0.1 160)",
    },
  },
  {
    id: "sunset-coral",
    name: "Sunset Coral",
    swatch: ["#fb7185", "#e11d48", "#fff1f2", "#4c0519"],
    vars: {
      "--primary": "oklch(0.7 0.18 15)",
      "--primary-strong": "oklch(0.62 0.2 15)",
      "--ring": "oklch(0.7 0.18 15)",
      "--accent": "oklch(0.95 0.04 15)",
      "--accent-foreground": "oklch(0.4 0.14 15)",
    },
  },
  {
    id: "ocean-blue",
    name: "Ocean Blue",
    swatch: ["#0ea5e9", "#0284c7", "#e0f2fe", "#082f49"],
    vars: {
      "--primary": "oklch(0.68 0.14 230)",
      "--primary-strong": "oklch(0.6 0.16 230)",
      "--ring": "oklch(0.68 0.14 230)",
      "--accent": "oklch(0.94 0.04 230)",
      "--accent-foreground": "oklch(0.35 0.12 230)",
    },
  },
  {
    id: "amber-warmth",
    name: "Amber Warmth",
    swatch: ["#f59e0b", "#d97706", "#fffbeb", "#451a03"],
    vars: {
      "--primary": "oklch(0.75 0.15 70)",
      "--primary-strong": "oklch(0.68 0.17 65)",
      "--ring": "oklch(0.75 0.15 70)",
      "--accent": "oklch(0.95 0.05 75)",
      "--accent-foreground": "oklch(0.4 0.12 60)",
    },
  },
  {
    id: "midnight",
    name: "Midnight Violet",
    swatch: ["#a78bfa", "#7c3aed", "#1e1b4b", "#0b1020"],
    vars: {
      "--primary": "oklch(0.72 0.18 295)",
      "--primary-strong": "oklch(0.65 0.2 295)",
      "--ring": "oklch(0.72 0.18 295)",
      "--accent": "oklch(0.35 0.1 295)",
      "--accent-foreground": "oklch(0.95 0.02 295)",
    },
  },
];

export type LayoutMode = "sidebar" | "compact" | "spacious";
export type RadiusMode = "sharp" | "soft" | "pill";
export type FontMode = "modern" | "editorial" | "mono";
export type Appearance = "light" | "dark" | "system";

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

export type ThemeSettings = {
  preset: string;
  radius: RadiusMode;
  font: FontMode;
  layout: LayoutMode;
  appearance: Appearance;
};

const KEY = "soma.theme.v1";

export const DEFAULT_THEME: ThemeSettings = {
  preset: "soma-indigo",
  radius: "soft",
  font: "modern",
  layout: "sidebar",
  appearance: "light",
};

/**
 * Load theme from Supabase profiles.preferences, fallback to localStorage
 */
export async function loadThemeFromSupabase(supabase: any): Promise<ThemeSettings> {
  if (typeof window === "undefined") return DEFAULT_THEME;
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return loadTheme();
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("preferences")
      .eq("id", user.id)
      .maybeSingle();
    
    if (profile?.preferences?.theme) {
      return { ...DEFAULT_THEME, ...profile.preferences.theme };
    }
  } catch (e) {
    console.warn("Failed to load theme from Supabase:", e);
  }
  
  return loadTheme();
}

export function loadTheme(): ThemeSettings {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_THEME;
    return { ...DEFAULT_THEME, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_THEME;
  }
}

export function saveTheme(s: ThemeSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
}

export async function saveThemeToSupabase(supabase: any, s: ThemeSettings) {
  if (typeof window === "undefined") return;
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", user.id)
    .maybeSingle();
  
  const currentPrefs = profile?.preferences || {};
  const newPrefs = { ...currentPrefs, theme: s };
  
  await supabase
    .from("profiles")
    .update({ preferences: newPrefs })
    .eq("id", user.id);
  
  // Also save to localStorage as backup
  saveTheme(s);
}

export function applyTheme(s: ThemeSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const preset = THEME_PRESETS.find((p) => p.id === s.preset) ?? THEME_PRESETS[0];

  Object.entries(preset.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  root.style.setProperty("--radius", RADIUS_MAP[s.radius]);
  root.style.setProperty("--font-display", FONT_MAP[s.font].display);
  root.style.setProperty("--font-sans", FONT_MAP[s.font].sans);

  const prefersDark =
    s.appearance === "dark" ||
    (s.appearance === "system" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", prefersDark);

  root.dataset.layout = s.layout;
}

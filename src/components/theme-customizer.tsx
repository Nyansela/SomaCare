"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeSettingsPanel } from "@/components/theme-settings-panel";
import {
  applyTheme,
  DEFAULT_THEME,
  loadTheme,
  loadThemeFromSupabase,
  saveTheme,
  saveThemeToSupabase,
  type ThemeSettings,
} from "@/lib/theme-store";
import { supabase } from "@/integrations/supabase/client";

/**
 * Applies the saved theme on the root layout. Loads the account theme from
 * Supabase (falling back to the device cache) and keeps "system" appearance
 * in sync when the OS theme changes.
 */
export function ThemeInit() {
  useEffect(() => {
    // Auth page always shows the default light theme — skip stored preference.
    if (window.location.pathname === "/auth") {
      document.documentElement.classList.remove("dark");
      return;
    }

    let disposed = false;

    (async () => {
      const s = await loadThemeFromSupabase(supabase);
      if (disposed) return;
      applyTheme(s);
      saveTheme(s);
    })();

    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onSchemeChange = () => {
      if (disposed) return;
      const s = loadTheme();
      if (s.appearance === "system") applyTheme(s);
    };
    mq?.addEventListener?.("change", onSchemeChange);

    return () => {
      disposed = true;
      mq?.removeEventListener?.("change", onSchemeChange);
    };
  }, []);

  return null;
}

/**
 * Quick-access appearance sheet for the app header. Changes apply and persist
 * to the device instantly, and sync to the account (debounced) when signed in.
 */
export function ThemeCustomizer() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<ThemeSettings>(DEFAULT_THEME);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSettings(loadTheme());
  }, []);

  useEffect(() => {
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, []);

  const update = (patch: Partial<ThemeSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    applyTheme(next);
    saveTheme(next);

    // Debounce account sync so dragging/clicking through the panel doesn't spam writes.
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      void saveThemeToSupabase(supabase, next).then((res) => {
        if (!res.ok && res.error !== "not signed in") {
          console.warn("Theme sync failed:", res.error);
        }
      });
    }, 500);
  };

  const reset = () => {
    const next = { ...DEFAULT_THEME, savedThemes: settings.savedThemes };
    setSettings(next);
    applyTheme(next);
    saveTheme(next);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={t("theme.open", "Customize appearance")}
        >
          <Palette className="h-5 w-5" />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full soma-gradient" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2 font-display">
            <Palette className="h-4 w-4 text-primary" />
            {t("theme.title", "Customize appearance")}
          </SheetTitle>
          <SheetDescription>
            {t(
              "theme.subtitle",
              "Colors, typography, density and more. Saved to your device and account.",
            )}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          <ThemeSettingsPanel settings={settings} onChange={update} onReset={reset} />
          <div className="mt-6 flex justify-end">
            <Button
              size="sm"
              onClick={() => setOpen(false)}
              className="soma-gradient border-0 text-white"
            >
              {t("theme.done", "Done")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

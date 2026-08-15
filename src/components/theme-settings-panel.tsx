"use client";

import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Check,
  Sun,
  Moon,
  Monitor,
  Type,
  Layout,
  Sparkles,
  Download,
  Upload,
  Trash2,
  Save,
  Palette,
  Paintbrush,
} from "lucide-react";
import {
  ACCENT_SWATCHES,
  bestForeground,
  contrastRatio,
  FONT_MAP,
  getPreset,
  parseThemeExport,
  serializeThemeExport,
  THEME_PRESETS,
  type Appearance,
  type FontMode,
  type FontSizeMode,
  type LayoutMode,
  type RadiusMode,
  type SavedTheme,
  type ThemeSettings,
} from "@/lib/theme-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  settings: ThemeSettings;
  onChange: (patch: Partial<ThemeSettings>) => void;
  onReset: () => void;
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function ThemeSettingsPanel({ settings, onChange, onReset }: Props) {
  const { t } = useTranslation();
  const [themeName, setThemeName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const accentHex = /^#[0-9a-f]{6}$/i.test(settings.accentColor)
    ? settings.accentColor
    : getPreset(settings.preset).swatch[0];

  const accentContrast = contrastRatio(accentHex, bestForeground(accentHex));
  const contrastLabel = accentContrast >= 7 ? "AAA" : accentContrast >= 4.5 ? "AA" : "Low";
  const contrastOk = accentContrast >= 4.5;

  const saveCurrentTheme = () => {
    const name = themeName.trim() || t("theme.unnamed", "My theme");
    const saved: SavedTheme = {
      id: uid(),
      name,
      createdAt: new Date().toISOString(),
      settings: { ...settings, savedThemes: [] },
    };
    onChange({ savedThemes: [...settings.savedThemes, saved] });
    setThemeName("");
    toast.success(t("theme.savedToast", "Theme saved"));
  };

  const applySavedTheme = (saved: SavedTheme) => {
    const { savedThemes: _keep, ...rest } = saved.settings;
    onChange({ ...rest, savedThemes: settings.savedThemes });
    toast.success(t("theme.appliedToast", "Theme applied"));
  };

  const deleteSavedTheme = (id: string) => {
    onChange({ savedThemes: settings.savedThemes.filter((x) => x.id !== id) });
  };

  const exportTheme = () => {
    const blob = new Blob([serializeThemeExport(settings)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "somacare-theme.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importTheme = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseThemeExport(text);
      if (!parsed) throw new Error("bad file");
      const { savedThemes: _keep, ...rest } = parsed.settings;
      const saved: SavedTheme = {
        id: uid(),
        name: parsed.name,
        createdAt: new Date().toISOString(),
        settings: { ...parsed.settings, savedThemes: [] },
      };
      onChange({ ...rest, savedThemes: [...settings.savedThemes, saved] });
      toast.success(t("theme.importedToast", "Theme imported"));
    } catch {
      toast.error(t("theme.invalidFile", "That file isn't a valid theme."));
    }
  };

  return (
    <div className="space-y-6">
      {/* Color palette presets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            {t("theme.colorPalette", "Color palette")}
          </CardTitle>
          <CardDescription>
            {t(
              "theme.colorPaletteDesc",
              "Choose a palette. Its accent, rings and highlights stay consistent in light and dark mode.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {THEME_PRESETS.map((p) => {
              const active = p.id === settings.preset;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onChange({ preset: p.id })}
                  className={cn(
                    "group flex flex-col gap-2 rounded-xl border p-3 text-left transition",
                    active
                      ? "border-primary bg-accent/50 shadow-[0_10px_30px_-15px_var(--color-primary)]"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <div className="flex h-10 overflow-hidden rounded-lg">
                    {p.swatch.map((c) => (
                      <div key={c} className="flex-1" style={{ background: c }} />
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{p.name}</span>
                    {active && <Check className="h-3.5 w-3.5 text-primary" />}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Accent color */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Paintbrush className="h-4 w-4 text-primary" />
            {t("theme.accent", "Accent color")}
          </CardTitle>
          <CardDescription>
            {t(
              "theme.accentDesc",
              "Override the palette's primary color with any color. Text on it is picked automatically for contrast.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange({ accentColor: "" })}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                settings.accentColor === ""
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {t("theme.accentDefault", "From palette")}
            </button>
            <div className="flex gap-1.5">
              {ACCENT_SWATCHES.map((s) => {
                const active = settings.accentColor.toLowerCase() === s.color;
                return (
                  <button
                    key={s.id}
                    type="button"
                    title={s.label}
                    aria-label={s.label}
                    onClick={() => onChange({ accentColor: s.color })}
                    className={cn(
                      "h-7 w-7 rounded-full border-2 transition",
                      active ? "border-foreground" : "border-transparent hover:scale-110",
                    )}
                    style={{ background: s.color }}
                  />
                );
              })}
            </div>
            <label className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full border border-border transition hover:scale-110">
              <span
                className="absolute inset-0"
                style={{
                  background:
                    "conic-gradient(#f87171, #fbbf24, #4ade80, #38bdf8, #a78bfa, #f87171)",
                }}
              />
              <input
                type="color"
                value={accentHex}
                onChange={(e) => onChange({ accentColor: e.target.value })}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label={t("theme.accentCustom", "Custom accent color")}
              />
            </label>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span
              className="inline-block h-5 w-5 rounded-full border border-border"
              style={{ background: accentHex, color: bestForeground(accentHex) }}
              aria-hidden
            />
            <span className="font-mono uppercase">{accentHex}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-semibold",
                contrastOk ? "bg-success/15 text-success" : "bg-warning/15 text-warning",
              )}
              title={t("theme.contrastHint", "Contrast ratio against the auto-picked foreground")}
            >
              {settings.accentColor === ""
                ? t("theme.fromPaletteBadge", "Palette")
                : `${contrastLabel} ${accentContrast.toFixed(1)}:1`}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Appearance mode */}
      <SectionCard
        icon={Sun}
        title={t("theme.appearance", "Appearance")}
        description={t("theme.appearanceDesc", "Light, dark, or follow your device.")}
      >
        <SegGroup
          value={settings.appearance}
          onChange={(v) => onChange({ appearance: v as Appearance })}
          options={[
            { value: "light", label: t("theme.light", "Light"), icon: Sun },
            { value: "dark", label: t("theme.dark", "Dark"), icon: Moon },
            { value: "system", label: t("theme.system", "System"), icon: Monitor },
          ]}
        />
      </SectionCard>

      {/* Dark background */}
      <SectionCard
        icon={Moon}
        title={t("theme.darkBg", "Dark background")}
        description={t("theme.darkBgDesc", "Applies whenever dark mode is active.")}
      >
        <SegGroup
          value={settings.darkModeBackground}
          onChange={(v) =>
            onChange({ darkModeBackground: v as ThemeSettings["darkModeBackground"] })
          }
          options={[
            { value: "material", label: t("theme.material", "Material") },
            { value: "pure-black", label: t("theme.pureBlack", "Pure black") },
            { value: "custom", label: t("theme.custom", "Custom") },
          ]}
        />
        {settings.darkModeBackground === "custom" && (
          <div className="mt-3">
            <Label htmlFor="custom-dark-bg">{t("theme.customBgColor", "Background color")}</Label>
            <Input
              id="custom-dark-bg"
              type="color"
              value={settings.customDarkBackground}
              onChange={(e) => onChange({ customDarkBackground: e.target.value })}
              className="mt-1.5 h-10 w-full"
            />
          </div>
        )}
      </SectionCard>

      {/* Corner radius */}
      <SectionCard
        title={t("theme.radius", "Corner radius")}
        description={t("theme.radiusDesc", "Roundness of buttons, cards and inputs.")}
      >
        <SegGroup
          value={settings.radius}
          onChange={(v) => onChange({ radius: v as RadiusMode })}
          options={[
            { value: "sharp", label: t("theme.sharp", "Sharp") },
            { value: "soft", label: t("theme.soft", "Soft") },
            { value: "pill", label: t("theme.pill", "Pill") },
          ]}
        />
      </SectionCard>

      {/* Typography */}
      <SectionCard
        icon={Type}
        title={t("theme.typography", "Typography")}
        description={t("theme.typographyDesc", "Font pairing for headings and body text.")}
      >
        <div className="grid gap-2">
          {(["modern", "editorial", "mono"] as FontMode[]).map((f) => {
            const active = f === settings.font;
            return (
              <button
                key={f}
                type="button"
                onClick={() => onChange({ font: f })}
                className={cn(
                  "flex items-center justify-between rounded-xl border p-3 text-left transition",
                  active ? "border-primary bg-accent/50" : "border-border hover:border-primary/40",
                )}
              >
                <div>
                  <div
                    className="text-base font-semibold"
                    style={{ fontFamily: FONT_MAP[f].display }}
                  >
                    Aa — Your health today
                  </div>
                  <div className="text-xs capitalize text-muted-foreground">
                    {t(`theme.font.${f}`, f)}
                  </div>
                </div>
                {active && <Check className="h-4 w-4 text-primary" />}
              </button>
            );
          })}
        </div>
      </SectionCard>

      {/* Font size */}
      <SectionCard
        icon={Type}
        title={t("theme.fontSize", "Font size")}
        description={t("theme.fontSizeDesc", "Scales all text in the app.")}
      >
        <SegGroup
          value={settings.fontSize}
          onChange={(v) => onChange({ fontSize: v as FontSizeMode })}
          options={[
            { value: "sm", label: t("theme.small", "Small") },
            { value: "md", label: t("theme.medium", "Medium") },
            { value: "lg", label: t("theme.large", "Large") },
          ]}
        />
      </SectionCard>

      {/* Layout density */}
      <SectionCard
        icon={Layout}
        title={t("theme.layout", "Layout density")}
        description={t(
          "theme.layoutDesc",
          "Compact tightens spacing and the sidebar; Spacious opens them up.",
        )}
      >
        <SegGroup
          value={settings.layout}
          onChange={(v) => onChange({ layout: v as LayoutMode })}
          options={[
            { value: "compact", label: t("theme.compact", "Compact") },
            { value: "sidebar", label: t("theme.standard", "Standard") },
            { value: "spacious", label: t("theme.spacious", "Spacious") },
          ]}
        />
      </SectionCard>

      {/* My themes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {t("theme.myThemes", "My themes")}
          </CardTitle>
          <CardDescription>
            {t("theme.myThemesDesc", "Save the current look, or export / import a theme as JSON.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={themeName}
              onChange={(e) => setThemeName(e.target.value)}
              placeholder={t("theme.namePlaceholder", "Name this theme…")}
              className="h-9"
            />
            <Button size="sm" onClick={saveCurrentTheme} className="shrink-0">
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {t("theme.save", "Save")}
            </Button>
          </div>

          {settings.savedThemes.length > 0 && (
            <ul className="space-y-2">
              {settings.savedThemes.map((saved) => (
                <li
                  key={saved.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{saved.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {saved.settings.preset} ·{" "}
                      {saved.settings.accentColor || t("theme.paletteAccent", "palette accent")}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="sm" onClick={() => applySavedTheme(saved)}>
                      {t("theme.apply", "Apply")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteSavedTheme(saved.id)}
                      aria-label={t("theme.delete", "Delete theme")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={exportTheme}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {t("theme.export", "Export")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              {t("theme.import", "Import")}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importTheme(file);
                e.target.value = "";
              }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <button
          type="button"
          onClick={onReset}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {t("theme.reset", "Reset to defaults")}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {Icon && <Icon className="h-4 w-4 text-primary" />}
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function SegGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: React.ComponentType<{ className?: string }> }[];
}) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-secondary/40 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.icon && <o.icon className="h-3.5 w-3.5" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

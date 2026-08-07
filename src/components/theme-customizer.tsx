import { useEffect, useState } from "react";
import { Palette, Check, Sun, Moon, Monitor, Layout, Type, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  applyTheme,
  DEFAULT_THEME,
  FONT_MAP,
  loadTheme,
  saveTheme,
  THEME_PRESETS,
  type Appearance,
  type FontMode,
  type LayoutMode,
  type RadiusMode,
  type ThemeSettings,
} from "@/lib/theme-store";
import { cn } from "@/lib/utils";

export function ThemeInit() {
  useEffect(() => {
    applyTheme(loadTheme());
  }, []);
  return null;
}

export function ThemeCustomizer() {
  const [settings, setSettings] = useState<ThemeSettings>(DEFAULT_THEME);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setSettings(loadTheme());
  }, []);

  const update = (patch: Partial<ThemeSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    applyTheme(next);
    saveTheme(next);
  };

  const reset = () => {
    setSettings(DEFAULT_THEME);
    applyTheme(DEFAULT_THEME);
    saveTheme(DEFAULT_THEME);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Customize appearance"
        >
          <Palette className="h-5 w-5" />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full soma-gradient" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2 font-display">
            <Sparkles className="h-4 w-4 text-primary" />
            Customize your Adwoa
          </SheetTitle>
          <SheetDescription>
            Personalize colors, typography, spacing and layout. Saved to your device.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-8">
          <Section title="Color palette">
            <div className="grid grid-cols-2 gap-2">
              {THEME_PRESETS.map((p) => {
                const active = p.id === settings.preset;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => update({ preset: p.id })}
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
          </Section>

          <Section title="Appearance" icon={Sun}>
            <SegGroup
              value={settings.appearance}
              onChange={(v) => update({ appearance: v as Appearance })}
              options={[
                { value: "light", label: "Light", icon: Sun },
                { value: "dark", label: "Dark", icon: Moon },
                { value: "system", label: "System", icon: Monitor },
              ]}
            />
          </Section>

          <Section title="Corner radius">
            <SegGroup
              value={settings.radius}
              onChange={(v) => update({ radius: v as RadiusMode })}
              options={[
                { value: "sharp", label: "Sharp" },
                { value: "soft", label: "Soft" },
                { value: "pill", label: "Pill" },
              ]}
            />
          </Section>

          <Section title="Typography" icon={Type}>
            <div className="grid gap-2">
              {(["modern", "editorial", "mono"] as FontMode[]).map((f) => {
                const active = f === settings.font;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => update({ font: f })}
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
                      <div className="text-xs capitalize text-muted-foreground">{f}</div>
                    </div>
                    {active && <Check className="h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="Layout density" icon={Layout}>
            <SegGroup
              value={settings.layout}
              onChange={(v) => update({ layout: v as LayoutMode })}
              options={[
                { value: "compact", label: "Compact" },
                { value: "sidebar", label: "Sidebar" },
                { value: "spacious", label: "Spacious" },
              ]}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Compact tightens padding, Spacious opens it up.
            </p>
          </Section>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <button
              type="button"
              onClick={reset}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Reset to defaults
            </button>
            <Button size="sm" onClick={() => setOpen(false)} className="soma-gradient border-0 text-white">
              Done
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />} {title}
      </div>
      {children}
    </div>
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

import { Suspense, lazy, useEffect, useState } from "react";
import type { ComponentProps } from "react";

type SonnerComponent = React.ComponentType<ComponentProps<"div"> & Record<string, unknown>>;

/**
 * Lazy-load the Sonner Toaster so its module (sonner v2) is only imported
 * client-side.  sonner v2 calls `document.hidden` in a useState initializer
 * and accesses other DOM APIs during module evaluation, both of which crash
 * during server-side rendering.
 */
const LazySonner = lazy<SonnerComponent>(() =>
  import("sonner").then((m) => ({ default: m.Toaster as SonnerComponent })),
);

/**
 * Theme-aware Sonner toaster.
 * Reads the `.dark` class on <html> so toasts match the current theme
 * even though the app uses a custom theme system (not next-themes).
 */
const Toaster = ({ ...props }: { [key: string]: unknown }) => {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    setMounted(true);
    const root = document.documentElement;
    setTheme(root.classList.contains("dark") ? "dark" : "light");
    const observer = new MutationObserver(() => {
      setTheme(root.classList.contains("dark") ? "dark" : "light");
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  if (!mounted) return null;

  return (
    <Suspense>
      <LazySonner
        theme={theme}
        className="toaster group"
        toastOptions={{
          classNames: {
            toast:
              "group toast " +
              "group-[.toaster]:bg-background group-[.toaster]:text-foreground " +
              "group-[.toaster]:border group-[.toaster]:border-border " +
              "group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl",
            description: "group-[.toast]:text-muted-foreground",
            actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
            cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          },
        }}
        {...props}
      />
    </Suspense>
  );
};

export { Toaster };

import { Toaster as Sonner } from "sonner";
import type { ComponentProps } from "react";

type ToasterProps = ComponentProps<typeof Sonner>;

/**
 * Theme-aware Sonner toaster.
 *
 * Sonner renders each toast as:
 *   <li data-sonner-toast data-type="success|error|warning|info" class="toast ...">
 *     <div data-title class="title">...</div>
 *     <div data-description class="description">...</div>
 *   </li>
 *
 * The `classNames` keys map to those elements' classes.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast " +
            "group-[.toaster]:bg-card group-[.toaster]:text-card-foreground " +
            "group-[.toaster]:border group-[.toaster]:border-border " +
            "group-[.toaster]:shadow-lg group-[.toaster]:rounded-2xl " +
            "group-[.toaster]:min-h-[3.5rem] " +
            "group-[.toaster]:animate-toast-in " +
            "group-[.toaster]:cursor-default group-[.toaster]:hover:shadow-xl " +
            "group-[.toaster]:transition-shadow group-[.toaster]:duration-200",
          description:
            "group-[.toast]:text-muted-foreground group-[.toast]:text-[0.8125rem] group-[.toast]:mt-0.5 group-[.toast]:leading-snug",
          title:
            "group-[.toast]:font-semibold group-[.toast]:text-[0.875rem] group-[.toast]:leading-tight",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground " +
            "group-[.toast]:rounded-xl group-[.toast]:px-4 group-[.toast]:py-1.5 " +
            "group-[.toast]:text-xs group-[.toast]:font-semibold " +
            "group-[.toast]:shadow-md group-[.toast]:hover:shadow-lg " +
            "group-[.toast]:transition-all group-[.toast]:duration-200",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground " +
            "group-[.toast]:rounded-xl group-[.toast]:px-4 group-[.toast]:py-1.5 " +
            "group-[.toast]:text-xs group-[.toast]:font-medium " +
            "group-[.toast]:hover:bg-accent group-[.toast]:transition-colors",
          closeButton:
            "group-[.toast]:text-muted-foreground group-[.toast]:hover:text-foreground " +
            "group-[.toast]:rounded-full group-[.toast]:hover:bg-muted " +
            "group-[.toast]:transition-all group-[.toast]:duration-150 " +
            "group-[.toast]:opacity-0 group-[.toast]:group-hover/toast:opacity-100",
        },
      }}
      position="top-right"
      richColors
      gap={10}
      {...props}
    />
  );
};

export { Toaster };

/**
 * Capacitor-safe clipboard and browser helpers.
 *
 * - `safeCopyToClipboard` wraps navigator.clipboard with a textarea fallback
 *   for older Android WebViews where the Clipboard API may be unavailable.
 * - `safeOpenUrl` uses @capacitor/browser on native and falls back to
 *   window.open on the web.
 */

import { Capacitor } from "@capacitor/core";

/** Copy text to the clipboard. Returns true on success. */
export async function safeCopyToClipboard(text: string): Promise<boolean> {
  try {
    // Modern browsers & recent Android WebViews
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to textarea fallback
  }

  // Fallback: temporary textarea (works everywhere)
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Open a URL. Uses Capacitor Browser on native, window.open on web. */
export async function safeOpenUrl(
  url: string,
  target = "_blank",
): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url });
      return;
    } catch {
      // If the plugin import fails, fall through
    }
  }
  window.open(url, target);
}

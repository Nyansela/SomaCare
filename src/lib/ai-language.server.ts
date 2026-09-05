/**
 * Shared language handling for AI endpoints.
 *
 * The app ships 4 UI languages (see src/i18n.ts). Every AI endpoint that
 * produces user-visible text must force the model to reply purely in the
 * language the UI is currently in. Ewe and Ga are low-resource languages,
 * so the instructions are deliberately strict: the model must not drift
 * back to English.
 */

export const AI_SUPPORTED_LANGUAGES = ["en", "tw", "ee", "ga"] as const;

/** Human name for a UI language code (used inside prompts). */
export function aiLanguageName(code: string): string {
  switch (code) {
    case "tw":
      return "Twi (Akan)";
    case "ee":
      return "Ewe (Eʋegbe)";
    case "ga":
      return "Ga (Gã)";
    default:
      return "English";
  }
}

/** True if `code` is one of the app's UI language codes. */
export function isSupportedAiLanguage(code: unknown): code is string {
  return (
    typeof code === "string" &&
    (AI_SUPPORTED_LANGUAGES as readonly string[]).includes(code)
  );
}

/**
 * Strict, mandatory instruction block to prepend to any prompt that will be
 * shown to the user. Place it right after the system/role description so the
 * model sees it before the (English) task instructions.
 */
export function aiLanguageInstruction(code: string): string {
  const name = aiLanguageName(code);
  return `LANGUAGE — MANDATORY (the user's app is set to ${name}, code "${code}"):
- Write your ENTIRE reply purely in ${name}. Every sentence, heading, bullet point, list item, label, warning and follow-up question must be in ${name}.
- Do NOT write in English, and do NOT mix English words or phrases into the reply — including greetings, connectors, "OK", "Sure", "Note:", "Important:", "Tips:", "Disclaimer:" etc.
- If the user writes to you in English or another language, still reply in ${name}. Only switch if the user explicitly asks you to reply in a different language.
- Keep drug names, brand names and technical terms that have no ${name} equivalent in their standard form, but write all surrounding text in ${name}.
- For structured/JSON output: keep field names and enum values exactly as specified, but write every human-readable string value (titles, descriptions, explanations, tips, disclaimers, summaries, notes) in ${name}.`;
}
# Implementer Prompt: Wire src/routes/_authenticated/assistant.tsx to useTranslation()

## Task
Wire `src/routes/_authenticated/assistant.tsx` to use `useTranslation()` from `react-i18next`.

- Use translation keys from `src/locales/en.json` (under `assistant` namespace, or others as appropriate).
- Replace all hardcoded English UI text in the component with `t()` calls.
- Ensure all UI text in `AssistantPage`, `EmptyChat`, `ChatWindow`, `ThinkingIndicator`, and `MessageBubble` components is translated.
- Maintain existing functionality (chat, state, thread management).
- Verify TypeScript types match after changes.

## Global Constraints
- **Strict Verification:** Run `npx tsc --noEmit` before completing.
- **Completeness:** Ensure every UI element updated uses `useTranslation()`.
- **Maintain Logic:** No logic changes, only i18n wiring.
- **AI-Translated Disclaimer:** Explicitly include the AI-translated disclaimer as specified in the plan. (Already in `en.json` under `assistant.disclaimer`).

## Context
- The `en.json` already contains:
  ```json
  "assistant": {
    "title": "Adwoa AI Assistant",
    "subtitle": "Personalized, Ghanaian-context health companion grounded in your Health Vault",
    "newChat": "Start New Chat",
    "placeholder": "Ask Adwoa anything about your health or medications...",
    "disclaimer": "Adwoa AI provides general guidance for informational purposes, not formal diagnosis. In emergencies contact local health services."
  }
  ```
- Use `useTranslation("assistant")` hook.

## Report File
`docs/superpowers/sdd/full-i18n-ewe-ga-audit/task-3-assistant-report.md`

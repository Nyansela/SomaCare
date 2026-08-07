# Design Spec: Localize Assistant Component

## Overview
Localize `src/routes/_authenticated/assistant.tsx` by replacing hardcoded English strings with translations using `react-i18next`.

## Strategy
- Use `useTranslation("assistant")` hook within `AssistantPage`.
- Expand `src/locales/en.json` `assistant` namespace to include all UI text found in the component.

## Keys to Add
The following keys will be added to `en.json` under `assistant`:
- `hideHistory`, `showHistory`, `newChat`, `recentConversations`, `noConversations`, `untitledChat`, `deleteChat`, `deleteChatDescription`, `delete`, `cancel`, `active`, `context`, `vitalsSynced`, `think`, `retry`, `copy`, `copied`, `emptyTitle`, `emptyBody`, `chatWelcomeTitle`, `chatWelcomeBody`
- `suggestions`: { `bp`, `meal`, `meds`, `clinic` }

## Implementation
1. Add new keys to `src/locales/en.json`.
2. Import `useTranslation` in `src/routes/_authenticated/assistant.tsx`.
3. Replace hardcoded strings in `AssistantPage`, `EmptyChat`, `ChatWindow`, `ThinkingIndicator`, and `MessageBubble`.
4. Run `npx tsc --noEmit` to verify type safety.

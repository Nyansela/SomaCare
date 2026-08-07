# Design Spec: Modern Split-Pane AI Assistant UI Overhaul

## 1. Overview
Redesign the AI Assistant page (`src/routes/_authenticated/assistant.tsx`) into a modern, reactive, split-pane chat interface. The new design replaces the cluttered layout with a spacious, full-height split view featuring a collapsible thread sidebar, active health context status bar, styled Ghanaian-context prompt chips, streaming text animations, and message utility tools (copying, re-generating, avatar badges).

## 2. Layout & Key Components
- **Sidebar (Thread History)**:
  - Collapsible on smaller screens, 280px fixed width on desktop.
  - "New Chat" button with primary green gradient and keyboard shortcut indicator.
  - Categorized conversation threads (Today, Yesterday, Older).
  - Delete thread trigger with confirmation modal.
- **Header Bar**:
  - Live "Adwoa AI — Connected to Health Vault" indicator badge.
  - Quick summary pill showing last updated vitals/medication count.
- **Main Chat Canvas (90%+ width)**:
  - Welcome Hero (when thread is empty) with 4 rich Ghanaian-context quick start chips.
  - Message stream with distinct styling for User vs. Adwoa AI messages.
  - Formatted Markdown rendering with syntax highlighting, bullet list spacing, and medical warning callouts.
  - Message action buttons: Copy message, speak/audio indicator, refresh response.
- **Input Area**:
  - Auto-resizing textarea with Send button and Enter-to-send support.
  - Clear medical disclaimer footer.

## 3. Data Flow & Reactivity
- Uses `@ai-sdk/react`'s `useChat` hook connected to `/api/chat`.
- Syncs message history with Supabase `ai_threads` and `ai_messages`.
- Automatically scrolls to bottom on new streaming tokens using smooth scrolling ref.

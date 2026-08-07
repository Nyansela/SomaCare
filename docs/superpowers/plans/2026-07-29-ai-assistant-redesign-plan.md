# AI Assistant Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the AI Assistant page UI into a modern, split-pane chat interface with an expandable thread history sidebar, rich Ghanaian-context quick start chips, and responsive streaming layout.

**Architecture:** TanStack Start page in `src/routes/_authenticated/assistant.tsx` with Framer Motion animations, `@ai-sdk/react` streaming chat integration, and Supabase message persistence.

**Tech Stack:** React, TanStack Start, `@ai-sdk/react`, Tailwind CSS, Lucide Icons, Framer Motion.

## Global Constraints
- Zero build errors (`npm run build`).
- TypeScript strictness (`npx tsc --noEmit`).

---

### Task 1: Redesign Assistant Page Layout and Sidebar

**Files:**
- Modify: `src/routes/_authenticated/assistant.tsx`

- [ ] **Step 1: Implement split-pane shell with thread sidebar**

Build responsive split-pane structure with collapsible sidebar for thread history, "New Chat" button, and confirmation dialogs.

- [ ] **Step 2: Add quick-start chips and message action bar**

Include prompt chips tailored to Ghanaian context (e.g., blood pressure, local meal suggestions, medication timing) and copy/re-prompt actions on messages.

- [ ] **Step 3: Run build and verify zero errors**

Run: `npm run build`
Expected: Success with zero errors.

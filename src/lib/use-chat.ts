import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import i18n from "@/i18n";
import type { Database } from "@/integrations/supabase/types";

// UIMessage type — inline to avoid importing `ai` which pulls in @ai-sdk/gateway
// (that requires `node:fs` and crashes on Cloudflare Workers).
interface UIMessagePart {
  type: string;
  text?: string;
  [key: string]: unknown;
}
export interface UIMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  parts: UIMessagePart[];
}

/**
 * Minimal drop-in replacement for `@ai-sdk/react`'s `useChat` that uses
 * plain React state + native `fetch` streaming. This avoids the `node:fs`
 * crash caused by bundling `@ai-sdk/react` on the server.
 *
 * Supports: messages, sendMessage, status, error, stop, regenerate.
 */

type ChatStatus = "ready" | "submitted" | "streaming" | "error";

interface SendMessageOptions {
  text?: string;
  files?: unknown[];
}

interface UseChatOptions {
  id?: string;
  messages?: UIMessage[];
  api?: string;
  headers?: Record<string, string>;
  onError?: (error: Error) => void;
  onFinish?: (options: { messages: UIMessage[] }) => void;
  onToolCall?: (options: { toolCallId: string; toolName: string; args: unknown }) => unknown;
  /** Called when the server rejects the request because the free AI usage
   *  limit was reached (HTTP 429, error "usage_limit_reached"). */
  onUsageLimit?: (info: { used: number; limit: number | null }) => void;
}

// ── Lightweight event emitter so useSyncExternalStore can subscribe ─────────

type Listener = () => void;

class ChatState {
  messages: UIMessage[] = [];
  status: ChatStatus = "ready";
  error: Error | null = null;
  private listeners = new Set<Listener>();

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.messages;

  getStatusSnapshot = () => this.status;

  getErrorSnapshot = () => this.error;

  private notify = () => {
    for (const l of this.listeners) l();
  };

  setMessages(updater: UIMessage[] | ((prev: UIMessage[]) => UIMessage[])) {
    this.messages = typeof updater === "function" ? updater(this.messages) : updater;
    this.notify();
  }

  setStatus(s: ChatStatus) {
    this.status = s;
    this.notify();
  }

  setError(e: Error | null) {
    this.error = e;
    this.notify();
  }
}

// ── SSE line parser for the AI SDK's `toUIMessageStreamResponse` format ────

function createId(): string {
  // Simple UUID-like ID — avoids importing `ai` which brings in @ai-sdk/gateway
  // (requires `node:fs`, crashes on Cloudflare Workers).
  return crypto.randomUUID();
}

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Parse the SSE-style streaming body returned by `toUIMessageStreamResponse`.
 * Lines starting with `:` are comments (ignored). Data lines are JSON objects
 * matching the `UIMessageChunk` schema. The stream ends with a `data: [DONE]`
 * line.
 */
async function* parseStream(response: Response): AsyncGenerator<Record<string, unknown>> {
  if (!response.body) throw new Error("Empty response body");
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;

    // Process complete lines
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // keep incomplete last line in buffer

    for (const raw of lines) {
      const line = raw.replace(/\r$/, "");
      if (!line || line.startsWith(":")) continue; // skip comments/blanks
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") return;
        try {
          yield JSON.parse(data) as Record<string, unknown>;
        } catch {
          // skip malformed lines
        }
      }
    }
  }
}

/**
 * Build a streaming UIMessage array from the SSE chunks.
 * This mirrors the internal logic of `processUiMessageStream` in the AI SDK.
 */
async function consumeStream(
  chunks: AsyncGenerator<Record<string, unknown>>,
  onChunk: (messages: UIMessage[]) => void,
  initialMessages: UIMessage[],
): Promise<UIMessage[]> {
  let messages = [...initialMessages];
  let currentMsgId = "";
  let currentText = "";
  const currentToolCalls: Record<string, { id: string; name: string; argsText: string }> = {};

  const findOrCreateAssistant = (msgId: string): UIMessage => {
    const existing = messages.find((m) => m.id === msgId);
    if (existing) return existing;
    const newMsg: UIMessage = {
      id: msgId,
      role: "assistant",
      parts: [],
    };
    messages = [...messages, newMsg];
    return newMsg;
  };

  const updateAssistantParts = (msgId: string, parts: UIMessage["parts"]) => {
    messages = messages.map((m) => (m.id === msgId ? { ...m, parts } : m));
  };

  for await (const chunk of chunks) {
    const type = chunk.type as string | undefined;

    switch (type) {
      case "text-start": {
        currentMsgId = (chunk.id as string) || currentMsgId;
        findOrCreateAssistant(currentMsgId);
        currentText = "";
        break;
      }
      case "text-delta": {
        currentMsgId = (chunk.id as string) || currentMsgId;
        currentText += (chunk.delta as string) || "";
        const msg = findOrCreateAssistant(currentMsgId);
        const textParts = msg.parts.filter((p) => p.type === "text");
        if (textParts.length === 0) {
          updateAssistantParts(currentMsgId, [
            ...msg.parts.filter((p) => p.type !== "text"),
            { type: "text", text: currentText },
          ]);
        } else {
          updateAssistantParts(currentMsgId, [
            ...msg.parts.filter((p) => p.type !== "text"),
            { type: "text", text: currentText },
          ]);
        }
        break;
      }
      case "text-end": {
        // text is complete; nothing more to do
        break;
      }
      case "tool-input-start": {
        const toolCallId = chunk.toolCallId as string;
        const toolName = chunk.toolName as string;
        currentToolCalls[toolCallId] = { id: toolCallId, name: toolName, argsText: "" };
        // Add a placeholder tool part
        const msg = findOrCreateAssistant(currentMsgId || createId());
        currentMsgId = currentMsgId || msg.id;
        updateAssistantParts(currentMsgId, [
          ...msg.parts,
          {
            type: `tool-${toolName}` as UIMessage["parts"][number]["type"],
            toolCallId,
            toolName,
            state: "call",
            args: {},
          } as unknown as UIMessage["parts"][number],
        ]);
        break;
      }
      case "tool-input-delta": {
        const toolCallId = chunk.toolCallId as string;
        if (currentToolCalls[toolCallId]) {
          currentToolCalls[toolCallId].argsText += (chunk.inputTextDelta as string) || "";
        }
        break;
      }
      case "tool-input-available": {
        const toolCallId = chunk.toolCallId as string;
        const toolName = chunk.toolName as string;
        const input = chunk.input as Record<string, unknown>;
        // Update the tool part with the final args
        const msg = findOrCreateAssistant(currentMsgId);
        const toolPartIdx = msg.parts.findIndex(
          (p) =>
            typeof p.type === "string" &&
            p.type.startsWith("tool-") &&
            (p as unknown as { toolCallId?: string }).toolCallId === toolCallId,
        );
        if (toolPartIdx >= 0) {
          const newParts = [...msg.parts];
          newParts[toolPartIdx] = {
            type: `tool-${toolName}` as UIMessage["parts"][number]["type"],
            toolCallId,
            toolName,
            state: "result",
            args: input,
          } as unknown as UIMessage["parts"][number];
          updateAssistantParts(currentMsgId, newParts);
        }
        break;
      }
      case "tool-output-available": {
        // An executed tool streams its result here (e.g. a tier_restricted
        // outcome from the plan-generation tools) — attach it to the tool
        // part so the UI can react to it.
        const toolCallId = chunk.toolCallId as string;
        const output = chunk.output as Record<string, unknown> | undefined;
        const msg = findOrCreateAssistant(currentMsgId);
        const toolPartIdx = msg.parts.findIndex(
          (p) =>
            typeof p.type === "string" &&
            p.type.startsWith("tool-") &&
            (p as unknown as { toolCallId?: string }).toolCallId === toolCallId,
        );
        if (toolPartIdx >= 0 && output !== undefined) {
          const newParts = [...msg.parts];
          newParts[toolPartIdx] = {
            ...newParts[toolPartIdx],
            output,
          } as unknown as UIMessage["parts"][number];
          updateAssistantParts(currentMsgId, newParts);
        }
        break;
      }
      case "tool-input-error": {
        // Tool call had an error — mark as error state
        const toolCallId = chunk.toolCallId as string;
        const toolName = chunk.toolName as string;
        const msg = findOrCreateAssistant(currentMsgId);
        const idx = msg.parts.findIndex(
          (p) =>
            typeof p.type === "string" &&
            p.type.startsWith("tool-") &&
            (p as unknown as { toolCallId?: string }).toolCallId === toolCallId,
        );
        if (idx >= 0) {
          const newParts = [...msg.parts];
          newParts[idx] = {
            type: `tool-${toolName}` as UIMessage["parts"][number]["type"],
            toolCallId,
            toolName,
            state: "error",
            args: (chunk.input as Record<string, unknown>) ?? {},
            errorText: chunk.errorText as string,
          } as unknown as UIMessage["parts"][number];
          updateAssistantParts(currentMsgId, newParts);
        }
        break;
      }
      case "error": {
        const err = new Error((chunk.errorText as string) || "Stream error");
        throw err;
      }
      default:
        // finish, tool-output-*, reasoning-*, custom — handle gracefully
        break;
    }

    onChunk([...messages]);
  }

  return messages;
}

// ── The hook ───────────────────────────────────────────────────────────────

export function useChat({
  id,
  messages: initialMessages = [],
  api = "/api/chat",
  headers: extraHeaders,
  onError,
  onFinish,
  onUsageLimit,
}: UseChatOptions = {}) {
  const stateRef = useRef(new ChatState());
  const abortRef = useRef<AbortController | null>(null);
  const threadIdRef = useRef(id);
  threadIdRef.current = id;

  // Id of the assistant message the CURRENT request is streaming, so we can
  // drop the partial reply if the request is aborted or superseded.
  const streamingMsgIdRef = useRef<string | null>(null);

  // Cached authenticated user id, used to persist messages client-side.
  const userIdRef = useRef<string | null>(null);

  // Maps client message ids (user uuids and stream-generated assistant ids)
  // to the uuid used as the row id in Supabase, so a regenerated reply can
  // remove its previous row instead of duplicating history.
  const dbIdRef = useRef(new Map<string, string>());

  const getUserId = useCallback(async (): Promise<string | null> => {
    if (userIdRef.current) return userIdRef.current;
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.auth.getUser();
      if (data.user) userIdRef.current = data.user.id;
    } catch {
      // Ignore — persistence is best-effort.
    }
    return userIdRef.current;
  }, []);

  // Persist a message to Supabase so the conversation survives navigation and
  // app restarts. The client is the writer because the server's onFinish does
  // not run when the stream is aborted — see src/routes/api/chat.ts.
  const persistMessage = useCallback(
    async (message: UIMessage) => {
      const threadId = threadIdRef.current;
      if (!threadId) return;
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const userId = userIdRef.current ?? (await getUserId());
        if (!userId) return;
        const dbId = dbIdRef.current.get(message.id) ?? createId();
        dbIdRef.current.set(message.id, dbId);
        await supabase.from("ai_messages").insert({
          id: dbId,
          thread_id: threadId,
          user_id: userId,
          role: message.role,
          parts:
            message.parts as unknown as Database["public"]["Tables"]["ai_messages"]["Insert"]["parts"],
        });
        // Touch the thread so it stays at the top of the sidebar list.
        await supabase
          .from("ai_threads")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", threadId);
        // Auto-title the thread from its first user message.
        if (message.role === "user") {
          const text = message.parts
            .map((p) => (p.type === "text" ? p.text : ""))
            .join(" ")
            .trim()
            .slice(0, 60);
          if (text) {
            await supabase
              .from("ai_threads")
              .update({ title: text })
              .eq("id", threadId)
              .eq("title", "New conversation");
          }
        }
      } catch (err) {
        console.error("[chat] failed to persist message:", err);
      }
    },
    [getUserId],
  );

  // Remove a previously-persisted message row (used by regenerate so the old
  // reply doesn't stay next to the new one).
  const removePersisted = useCallback(async (messageId: string) => {
    const dbId = dbIdRef.current.get(messageId) ?? (isUuid(messageId) ? messageId : null);
    if (!dbId) return;
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      await supabase.from("ai_messages").delete().eq("id", dbId);
    } catch {
      // Ignore — the new reply simply follows the old row.
    }
  }, []);

  // Claim (and clear) the id of the in-flight assistant reply so callers can
  // decide whether to persist or drop it.
  const takePartialReply = useCallback((): UIMessage | null => {
    const partialId = streamingMsgIdRef.current;
    streamingMsgIdRef.current = null;
    if (!partialId) return null;
    return stateRef.current.messages.find((m) => m.id === partialId) ?? null;
  }, []);

  // Hydrate messages from thread history. History can arrive AFTER this hook
  // first mounts (the parent loads ai_messages asynchronously), so re-apply
  // initialMessages whenever it changes — but only while the conversation is
  // still pristine (nothing added on top of the hydrated history), otherwise
  // we'd wipe an in-flight chat with a stale fetch.
  const hydratedRef = useRef<UIMessage[] | null>(null);
  useEffect(() => {
    const current = stateRef.current.messages;
    const pristine =
      hydratedRef.current === null ||
      (hydratedRef.current.length === current.length &&
        hydratedRef.current.every((m, i) => m.id === current[i]?.id));
    if (pristine) {
      stateRef.current.setMessages(initialMessages);
      hydratedRef.current = initialMessages;
    }
  }, [id, initialMessages]);

  const messages = useSyncExternalStore(
    stateRef.current.subscribe,
    stateRef.current.getSnapshot,
    stateRef.current.getSnapshot,
  );

  const status = useSyncExternalStore(
    stateRef.current.subscribe,
    stateRef.current.getStatusSnapshot,
    stateRef.current.getStatusSnapshot,
  );

  const error = useSyncExternalStore(
    stateRef.current.subscribe,
    stateRef.current.getErrorSnapshot,
    stateRef.current.getErrorSnapshot,
  );

  // Stop the in-flight request and remove the partial reply it was streaming.
  // Whatever was already streamed is persisted first so it doesn't vanish
  // from the conversation history.
  const abortActiveRequest = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    const partial = takePartialReply();
    if (partial) {
      stateRef.current.setMessages((prev) => prev.filter((m) => m.id !== partial.id));
      const text = partial.parts
        .map((p) => (p.type === "text" ? p.text : ""))
        .join("")
        .trim();
      if (text) void persistMessage(partial);
    }
  }, [persistMessage, takePartialReply]);

  // Build the message list sent to the server: drop any partial reply that is
  // still mid-stream and keep only the tail of the conversation, so the
  // model's context window never overflows on long threads (the full history
  // is persisted to the DB either way).
  const messagesForRequest = useCallback((msgs: UIMessage[]): UIMessage[] => {
    let clean = msgs;
    const partialId = streamingMsgIdRef.current;
    if (partialId) {
      clean = clean.filter((m) => m.id !== partialId);
    }
    const MAX_CONTEXT_MESSAGES = 40;
    if (clean.length > MAX_CONTEXT_MESSAGES) {
      clean = clean.slice(-MAX_CONTEXT_MESSAGES);
      // Always start the window on a user message so the model receives a
      // complete turn rather than a dangling assistant reply.
      const firstUser = clean.findIndex((m) => m.role === "user");
      if (firstUser > 0) clean = clean.slice(firstUser);
    }
    return clean;
  }, []);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const authHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...extraHeaders,
    };
    try {
      const { data: sessionData } = await (
        await import("@/integrations/supabase/client")
      ).supabase.auth.getSession();
      if (sessionData.session?.access_token) {
        authHeaders.Authorization = `Bearer ${sessionData.session.access_token}`;
      }
    } catch {
      // No session — the server will reject with 401.
    }
    return authHeaders;
  }, [extraHeaders]);

  // POST the conversation and stream the reply into the shared state.
  const runRequest = useCallback(
    async (bodyMessages: UIMessage[], controller: AbortController) => {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(api, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          messages: bodyMessages,
          threadId: threadIdRef.current,
          // Always tell the server which language the UI is currently in, so
          // the assistant replies in the language the user is actually seeing.
          language: i18n.language || "en",
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        // Surface the free-tier usage limit as its own callback so the UI can
        // show an upgrade prompt and stop sending (the raw error is thrown too).
        if (response.status === 429) {
          try {
            const parsed = JSON.parse(errorText) as {
              error?: string;
              message?: string;
              used?: number;
              limit?: number | null;
            };
            if (parsed.error === "usage_limit_reached") {
              onUsageLimit?.({
                used: parsed.used ?? 0,
                limit: parsed.limit ?? null,
              });
              throw new Error(
                parsed.message || "You've reached your free AI message limit for this month.",
              );
            }
          } catch {
            // not JSON — fall through to the generic error
          }
        }
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      // Messages present when this request started; any assistant message that
      // appears afterwards is this request's own reply.
      const requestStartIds = new Set(stateRef.current.messages.map((m) => m.id));

      const finalMessages = await consumeStream(
        parseStream(response),
        (msgs) => {
          // A newer request has taken over — never let a dying stream write
          // to state (its chunks would resurrect a dropped partial reply).
          if (abortRef.current !== controller) return;
          if (streamingMsgIdRef.current === null) {
            for (let i = msgs.length - 1; i >= 0; i--) {
              const m = msgs[i];
              if (m.role === "assistant" && !requestStartIds.has(m.id)) {
                streamingMsgIdRef.current = m.id;
                break;
              }
            }
          }
          stateRef.current.setMessages(msgs);
        },
        stateRef.current.messages,
      );

      // Superseded by a newer request while streaming — leave state alone.
      if (abortRef.current !== controller) return;

      streamingMsgIdRef.current = null;

      // Persist the completed reply so it survives navigation and app restarts.
      const finalAssistant = finalMessages[finalMessages.length - 1];
      if (finalAssistant?.role === "assistant") {
        await persistMessage(finalAssistant);
      }

      stateRef.current.setMessages(finalMessages);
      stateRef.current.setStatus("ready");
      onFinish?.({ messages: finalMessages });
    },
    [api, getAuthHeaders, onFinish, onUsageLimit, persistMessage],
  );

  const sendMessage = useCallback(
    async (message?: SendMessageOptions | string) => {
      const text = typeof message === "string" ? message : (message?.text ?? "");

      if (!text.trim()) return;

      // Never run two streams at once: stop the previous request and drop the
      // partial reply it produced, so the new question is answered on its own
      // instead of being merged with the old one.
      abortActiveRequest();

      // Append user message
      const userMsg: UIMessage = {
        id: createId(),
        role: "user",
        parts: [{ type: "text", text }],
      };
      stateRef.current.setMessages((prev) => [...prev, userMsg]);
      stateRef.current.setStatus("submitted");
      stateRef.current.setError(null);

      // Persist the user's message right away so it survives navigation even
      // if the request is interrupted.
      void persistMessage(userMsg);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        stateRef.current.setStatus("streaming");
        await runRequest(messagesForRequest(stateRef.current.messages), controller);
      } catch (err: unknown) {
        // A newer request has taken over — it owns the state from here on.
        if (abortRef.current !== controller) return;
        if (err instanceof DOMException && err.name === "AbortError") {
          stateRef.current.setStatus("ready");
          return;
        }
        // Keep whatever was streamed before the failure.
        const partial = takePartialReply();
        if (partial) {
          const text = partial.parts
            .map((p) => (p.type === "text" ? p.text : ""))
            .join("")
            .trim();
          if (text) void persistMessage(partial);
        }
        const error = err instanceof Error ? err : new Error(String(err));
        stateRef.current.setError(error);
        stateRef.current.setStatus("error");
        onError?.(error);
      }
    },
    [abortActiveRequest, onError, runRequest, messagesForRequest, persistMessage, takePartialReply],
  );

  const stop = useCallback(() => {
    abortActiveRequest();
    stateRef.current.setStatus("ready");
  }, [abortActiveRequest]);

  const regenerate = useCallback(async () => {
    // Stop any in-flight request and persist/drop its partial reply first
    abortActiveRequest();

    // Remove last assistant message, then re-send the remaining history
    const lastAssistant = stateRef.current.messages[stateRef.current.messages.length - 1];
    stateRef.current.setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === "assistant") return prev.slice(0, -1);
      return prev;
    });
    if (lastAssistant?.role === "assistant") {
      // Also remove the old reply from the database so it isn't duplicated.
      await removePersisted(lastAssistant.id);
    }

    const controller = new AbortController();
    abortRef.current = controller;

    stateRef.current.setStatus("submitted");
    stateRef.current.setError(null);

    try {
      stateRef.current.setStatus("streaming");
      await runRequest(messagesForRequest(stateRef.current.messages), controller);
    } catch (err: unknown) {
      // A newer request has taken over — it owns the state from here on.
      if (abortRef.current !== controller) return;
      if (err instanceof DOMException && err.name === "AbortError") {
        stateRef.current.setStatus("ready");
        return;
      }
      const error = err instanceof Error ? err : new Error(String(err));
      stateRef.current.setError(error);
      stateRef.current.setStatus("error");
      onError?.(error);
    }
  }, [abortActiveRequest, onError, runRequest, messagesForRequest, removePersisted]);

  return {
    messages,
    sendMessage,
    status,
    error,
    stop,
    regenerate,
  };
}

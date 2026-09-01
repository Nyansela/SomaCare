import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

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
    this.messages =
      typeof updater === "function" ? updater(this.messages) : updater;
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

/**
 * Parse the SSE-style streaming body returned by `toUIMessageStreamResponse`.
 * Lines starting with `:` are comments (ignored). Data lines are JSON objects
 * matching the `UIMessageChunk` schema. The stream ends with a `data: [DONE]`
 * line.
 */
async function* parseStream(
  response: Response,
): AsyncGenerator<Record<string, unknown>> {
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
  let currentToolCalls: Record<string, { id: string; name: string; argsText: string }> = {};

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
    messages = messages.map((m) =>
      m.id === msgId ? { ...m, parts } : m,
    );
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
          currentToolCalls[toolCallId].argsText +=
            (chunk.inputTextDelta as string) || "";
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
}: UseChatOptions = {}) {
  const stateRef = useRef(new ChatState());
  const abortRef = useRef<AbortController | null>(null);
  const threadIdRef = useRef(id);
  threadIdRef.current = id;

  // Initialise messages
  useEffect(() => {
    stateRef.current.setMessages(initialMessages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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

  const sendMessage = useCallback(
    async (message?: SendMessageOptions | string) => {
      const text =
        typeof message === "string"
          ? message
          : message?.text ?? "";

      if (!text.trim()) return;

      // Append user message
      const userMsg: UIMessage = {
        id: createId(),
        role: "user",
        parts: [{ type: "text", text }],
      };
      stateRef.current.setMessages((prev) => [...prev, userMsg]);
      stateRef.current.setStatus("submitted");
      stateRef.current.setError(null);

      // Build request
      const { data: sessionData } = await (
        await import("@/integrations/supabase/client")
      ).supabase.auth.getSession();
      const authHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        ...extraHeaders,
      };
      if (sessionData.session?.access_token) {
        authHeaders.Authorization = `Bearer ${sessionData.session.access_token}`;
      }

      const body = {
        messages: stateRef.current.messages,
        threadId: threadIdRef.current,
      };

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        stateRef.current.setStatus("streaming");

        const response = await fetch(api, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "Unknown error");
          throw new Error(errorText || `HTTP ${response.status}`);
        }

        const finalMessages = await consumeStream(
          parseStream(response),
          (msgs) => {
            stateRef.current.setMessages(msgs);
          },
          stateRef.current.messages,
        );

        stateRef.current.setMessages(finalMessages);
        stateRef.current.setStatus("ready");
        onFinish?.({ messages: finalMessages });
      } catch (err: unknown) {
        if (
          err instanceof DOMException &&
          err.name === "AbortError"
        ) {
          stateRef.current.setStatus("ready");
          return;
        }
        const error =
          err instanceof Error ? err : new Error(String(err));
        stateRef.current.setError(error);
        stateRef.current.setStatus("error");
        onError?.(error);
      }
    },
    [api, extraHeaders, onError, onFinish],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    stateRef.current.setStatus("ready");
  }, []);

  const regenerate = useCallback(async () => {
    // Remove last assistant message, then re-send
    stateRef.current.setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === "assistant") return prev.slice(0, -1);
      return prev;
    });
    // Trigger a new request with the remaining messages
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    stateRef.current.setStatus("submitted");
    stateRef.current.setError(null);

    try {
      const { data: sessionData } = await (
        await import("@/integrations/supabase/client")
      ).supabase.auth.getSession();
      const authHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        ...extraHeaders,
      };
      if (sessionData.session?.access_token) {
        authHeaders.Authorization = `Bearer ${sessionData.session.access_token}`;
      }

      stateRef.current.setStatus("streaming");

      const response = await fetch(api, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          messages: stateRef.current.messages,
          threadId: threadIdRef.current,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      const finalMessages = await consumeStream(
        parseStream(response),
        (msgs) => {
          stateRef.current.setMessages(msgs);
        },
        stateRef.current.messages,
      );

      stateRef.current.setMessages(finalMessages);
      stateRef.current.setStatus("ready");
      onFinish?.({ messages: finalMessages });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        stateRef.current.setStatus("ready");
        return;
      }
      const error = err instanceof Error ? err : new Error(String(err));
      stateRef.current.setError(error);
      stateRef.current.setStatus("error");
      onError?.(error);
    }
  }, [api, extraHeaders, onError, onFinish]);

  return {
    messages,
    sendMessage,
    status,
    error,
    stop,
    regenerate,
  };
}

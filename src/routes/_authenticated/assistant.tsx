import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown, { type Components } from "react-markdown";
import {
  Sparkles,
  Plus,
  Send,
  Trash2,
  MessageSquare,
  Loader2,
  User as UserIcon,
  Stethoscope,
  HeartPulse,
  Pill,
  CalendarDays,
  Salad,
  Copy,
  Check,
  PanelLeft,
  Activity,
  ShieldCheck,
  RotateCcw,
  Volume2,
  Square,
  ClipboardList,
  CheckCircle2,
  XCircle,
  Mic,
  PhoneOff,
  AudioLines,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Overflow-safe, app-styled markdown renderer for AI messages. Without these
 * constraints, tables, code blocks and long URLs from the model would push
 * the page wider than the viewport on mobile. The `prose` typography plugin
 * is not installed, so spacing is handled here too.
 */
const mdComponents: Components = {
  p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }) => <h1 className="mb-2 mt-4 text-lg font-bold">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-4 text-base font-bold">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1 mt-3 text-sm font-bold">{children}</h3>,
  h4: ({ children }) => <h4 className="mb-1 mt-3 text-sm font-semibold">{children}</h4>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  hr: () => <hr className="my-3 border-border" />,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-primary/40 pl-3 italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="break-all text-primary underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  ),
  img: ({ src, alt }) => <img src={src} alt={alt} className="my-2 max-w-full rounded-lg" />,
  pre: ({ children }) => (
    <pre className="my-2 max-w-full overflow-x-auto rounded-xl border border-border/60 bg-muted/60 p-3 text-[13px] leading-relaxed">
      {children}
    </pre>
  ),
  code: ({ className, children }) => {
    const isBlock = typeof className === "string" && className.includes("language-");
    return (
      <code
        className={cn(
          "rounded-md bg-muted/70 px-1.5 py-0.5 font-mono text-[0.85em]",
          isBlock && "bg-transparent p-0 text-[13px]",
        )}
      >
        {children}
      </code>
    );
  },
  table: ({ children }) => (
    <div className="my-2 max-w-full overflow-x-auto rounded-xl border border-border/60">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
};

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({
    meta: [{ title: "AI Assistant — Adwoa Health" }, { name: "robots", content: "noindex" }],
  }),
  component: AssistantPage,
});

type Thread = { id: string; title: string; updated_at: string };

const SUGGESTIONS = [
  {
    icon: HeartPulse,
    key: "assistant.suggestion1",
    fallback: "Explain my blood pressure readings in Ghana context",
    tint: "from-emerald-500/15 to-emerald-500/5",
  },
  {
    icon: Salad,
    key: "assistant.suggestion2",
    fallback: "Suggest healthy Ghanaian meals (Waakye, Kontomire, Red Red)",
    tint: "from-amber-500/15 to-amber-500/5",
  },
  {
    icon: Pill,
    key: "assistant.suggestion3",
    fallback: "Check medication interactions and side effects",
    tint: "from-violet-500/15 to-violet-500/5",
  },
  {
    icon: CalendarDays,
    key: "assistant.suggestion4",
    fallback: "Prepare questions for my upcoming clinic visit",
    tint: "from-sky-500/15 to-sky-500/5",
  },
];

/** Languages with Ghana NLP (Khaya) TTS voices — all female Ghanaian speakers */
const VOICE_LANGUAGES = ["en", "tw", "ee", "ga"] as const;
const VOICE_LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  tw: "Twi",
  ee: "Ewe",
  ga: "Ga",
};

/** App language codes → BCP-47 locales for browser speech recognition (STT) */
const STT_LANGUAGE_MAP: Record<string, string> = {
  en: "en-US",
  tw: "ak-GH",
  ee: "ee-GH",
  ga: "gaa-GH",
};

// ── Minimal Web Speech API types (not in all TS DOM libs) ──────────
type SRAlternative = { transcript: string };
type SRResult = { isFinal: boolean; length: number; [index: number]: SRAlternative };
type SRResultList = { length: number; [index: number]: SRResult };
type SREvent = { resultIndex: number; results: SRResultList };
type SRRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
type SRCtor = new () => SRRecognition;

function getSpeechRecognition(): SRCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SRCtor;
    webkitSpeechRecognition?: SRCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Tools that require explicit user confirmation before any Supabase write */
const WRITE_TOOLS = [
  "logVitalReading",
  "logMeal",
  "bookAppointment",
  "addMedication",
  "generateWorkoutPlan",
  "generateMealPlan",
];

type AnyToolPart = {
  type: string;
  toolCallId?: string;
  state?: string;
  input?: Record<string, unknown>;
};

function humanSummary(toolName: string, input: Record<string, unknown>): string {
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  switch (toolName) {
    case "logVitalReading": {
      const unit = s(input.unit) ? ` ${s(input.unit)}` : "";
      return `Log vital reading: ${s(input.type)} = ${String(input.value)}${unit}`;
    }
    case "logMeal":
      return `Log meal: ${s(input.food)}${s(input.quantity) ? ` (${s(input.quantity)})` : ""}`;
    case "bookAppointment":
      return `Book appointment with ${s(input.provider)} on ${s(input.date)} at ${s(input.time)}`;
    case "addMedication":
      return `Add medication: ${s(input.name)}${s(input.dosage) ? ` · ${s(input.dosage)}` : ""}${
        s(input.schedule) ? ` · ${s(input.schedule)}` : ""
      }`;
    case "generateWorkoutPlan": {
      const days = Array.isArray(input.days)
        ? (input.days as { day_number: number; exercises?: { name: string }[] }[])
        : [];
      const preview = days
        .find((d) => d.day_number === 1)
        ?.exercises?.slice(0, 3)
        .map((e) => e.name)
        .join(", ");
      return `${s(input.title) || "Workout plan"} — ${String(input.duration_days)}-day plan (goal: ${s(
        input.goal,
      )}, level: ${s(input.fitnessLevel)}). Day 1: ${preview || "workout"}`;
    }
    case "generateMealPlan": {
      const days = Array.isArray(input.days)
        ? (input.days as { day_number: number; meals?: { breakfast?: string } }[])
        : [];
      const preview = days.find((d) => d.day_number === 1)?.meals?.breakfast;
      return `${s(input.title) || "Meal plan"} — ${String(input.duration_days)}-day plan (goal: ${s(
        input.goal,
      )}). Day 1 breakfast: ${preview || "Ghanaian meal"}`;
    }
    default:
      return `Proposed action: ${toolName}`;
  }
}

function AssistantPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const autoSelected = useRef(false);

  // Thread list
  const threadsQuery = useQuery({
    queryKey: ["ai", "threads"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_threads")
        .select("id,title,updated_at")
        .order("updated_at", { ascending: false });
      return (data as Thread[]) ?? [];
    },
  });
  const threads = threadsQuery.data ?? [];
  const loadingThreads = threadsQuery.isLoading;

  // Auto-select the most recent thread once on first load
  useEffect(() => {
    if (autoSelected.current || !threadsQuery.data) return;
    autoSelected.current = true;
    if (threadsQuery.data.length > 0) setActiveId(threadsQuery.data[0].id);
  }, [threadsQuery.data]);

  // Messages for the active thread
  const messagesQuery = useQuery({
    queryKey: ["ai", "messages", activeId],
    enabled: !!activeId,
    staleTime: 0,
    queryFn: async () => {
      if (!activeId) return [] as UIMessage[];
      const { data } = await supabase
        .from("ai_messages")
        .select("id,role,parts,created_at")
        .eq("thread_id", activeId)
        .order("created_at", { ascending: true });
      const msgs: UIMessage[] = (data ?? []).map((m) => ({
        id: m.id as string,
        role: m.role as UIMessage["role"],
        parts: (m.parts as UIMessage["parts"]) ?? [],
      }));
      return msgs;
    },
  });
  const initialMessages = messagesQuery.data ?? [];
  const loadingMessages = !!activeId && messagesQuery.isLoading;

  const loadThreads = () => qc.invalidateQueries({ queryKey: ["ai", "threads"] });

  const newThreadMutation = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("ai_threads")
        .insert({
          user_id: u.user.id,
          title: t("assistant.newConversationTitle", "New conversation"),
        })
        .select("id,title,updated_at")
        .single();
      if (error || !data)
        throw new Error(t("assistant.errorNewConversation", "Could not start a new conversation"));
      return data as Thread;
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["ai", "threads"] });
      setActiveId(created.id);
    },
    onError: () => {
      toast.error(t("assistant.errorNewConversation", "Could not start a new conversation"));
    },
  });

  const newThread = () => newThreadMutation.mutate();

  const deleteThreadMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("ai_messages").delete().eq("thread_id", id);
      await supabase.from("ai_threads").delete().eq("id", id);
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["ai", "threads"] });
      qc.removeQueries({ queryKey: ["ai", "messages", id] });
      if (activeId === id) setActiveId(null);
    },
    onError: () => {
      toast.error(t("assistant.errorDeleteConversation"));
    },
  });

  const deleteThread = (id: string) => deleteThreadMutation.mutate(id);

  return (
    <AppShell
      title={t("assistant.title")}
      subtitle={t("assistant.subtitle")}
      action={
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:flex items-center gap-1.5"
          >
            <PanelLeft className="h-4 w-4" />
            {sidebarOpen ? t("assistant.hideHistory") : t("assistant.showHistory")}
          </Button>
          <Button
            size="sm"
            onClick={newThread}
            className="soma-gradient soma-glow border-0 text-white"
          >
            <Plus className="mr-1.5 h-4 w-4" /> {t("assistant.newChatHeader")}
          </Button>
        </div>
      }
    >
      <div className="flex h-[calc(100vh-10rem)] w-full gap-4 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {/* Thread History Sidebar */}
        {sidebarOpen && (
          <aside className="w-80 flex-col border-r border-border bg-muted/20 flex shrink-0">
            <div className="border-b border-border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-9 w-9 place-items-center rounded-xl soma-gradient soma-glow">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <div className="font-display text-sm font-bold">Adwoa AI</div>
                    <div className="flex items-center gap-1 text-[11px] text-primary">
                      <ShieldCheck className="h-3 w-3" /> Health Vault Connected
                    </div>
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                onClick={newThread}
                className="mt-3 w-full soma-gradient border-0 text-white"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" /> {t("assistant.newChat")}
              </Button>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40 bg-muted/30">
              <span className="flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" /> Recent Conversations
              </span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                {threads.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loadingThreads ? (
                <div className="flex justify-center p-6">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : threads.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No previous conversations found. Click "Start New Chat" above!
                </div>
              ) : (
                <ul className="space-y-1">
                  <AnimatePresence initial={false}>
                    {threads.map((t) => (
                      <motion.li
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        key={t.id}
                        className="group flex items-center gap-1"
                      >
                        <button
                          type="button"
                          onClick={() => setActiveId(t.id)}
                          className={cn(
                            "flex-1 truncate rounded-xl px-3 py-2.5 text-left text-xs transition",
                            activeId === t.id
                              ? "bg-primary/15 font-semibold text-primary border border-primary/20 shadow-sm"
                              : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                          )}
                        >
                          {t.title || "Untitled Chat"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(t.id)}
                          className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                          aria-label="Delete conversation"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>
          </aside>
        )}

        {/* Main Conversation Canvas (90%+ width) */}
        <main className="relative flex flex-1 flex-col overflow-hidden bg-background/50">
          {/* Top Context Status Bar */}
          <div className="flex items-center justify-between border-b border-border/60 bg-card/60 px-4 py-2.5 backdrop-blur text-xs">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-medium text-foreground">Adwoa AI Active</span>
              <span className="text-muted-foreground hidden sm:inline">
                • Context: Ghana Healthcare Baseline
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden md:inline-flex items-center gap-1 text-muted-foreground text-[11px]">
                <Activity className="h-3 w-3 text-primary" /> Vitals & Meds Synced
              </span>
            </div>
          </div>

          {activeId ? (
            <ChatWindow
              key={activeId}
              threadId={activeId}
              initialMessages={initialMessages}
              loading={loadingMessages}
              onTitleMaybeChanged={loadThreads}
            />
          ) : (
            <EmptyChat onStart={newThread} />
          )}
        </main>
      </div>

      {/* Confirmation Dialog for Deleting Thread */}
      <AlertDialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("assistant.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("assistant.deleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDelete) deleteThread(pendingDelete);
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function EmptyChat({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center p-8 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="grid h-20 w-20 place-items-center rounded-3xl soma-gradient soma-glow shadow-lg"
      >
        <Stethoscope className="h-10 w-10 text-white" />
      </motion.div>
      <h2 className="mt-5 font-display text-3xl font-bold">Meet Adwoa AI</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Your personal AI health companion — tailored for Ghana with your vitals, medications, and
        medical history.
      </p>
      <Button
        onClick={onStart}
        size="lg"
        className="mt-6 soma-gradient border-0 text-white shadow-md"
      >
        <Plus className="mr-2 h-4 w-4" /> Start a Conversation
      </Button>
    </div>
  );
}

function ChatWindow({
  threadId,
  initialMessages,
  loading,
  onTitleMaybeChanged,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  loading: boolean;
  onTitleMaybeChanged: () => void;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const qc = useQueryClient();

  // ── Voice playback (Twi TTS) ─────────────────────────────────────
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const playedRef = useRef<Set<string>>(new Set());
  const prevStatusRef = useRef<string>("ready");

  // User's preferred language — voice available in English, Twi, Ewe and Ga
  const [voiceLang, setVoiceLang] = useState<string>("en");
  const [voiceAutoPlay, setVoiceAutoPlay] = useState(true);
  const [liveOpen, setLiveOpen] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("preferences")
        .eq("id", u.user.id)
        .maybeSingle();
      if (!cancelled) {
        const prefs = (data?.preferences ?? {}) as Record<string, unknown>;
        setVoiceLang((prefs.language as string) || "en");
        setVoiceAutoPlay(prefs.voiceAutoPlay !== false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Stop any current playback so a new message can start cleanly
  const replayMessage = (messageId: string, text: string) => {
    if (!text.trim()) return;
    stopSpeaking();
    void speak(text, messageId);
  };

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setSpeakingId(null);
  };

  const speak = async (text: string, messageId: string, onDone?: () => void) => {
    if (!(VOICE_LANGUAGES as readonly string[]).includes(voiceLang)) return; // unsupported language → skip silently
    try {
      const res = await fetch("/api/voice/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language: voiceLang }),
      });
      const contentType = res.headers.get("content-type") || "";
      if (!res.ok || !contentType.includes("audio")) return; // voice_unavailable → stay silent
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      urlRef.current = url;
      setSpeakingId(messageId);
      const finish = () => {
        stopSpeaking();
        onDone?.();
      };
      audio.onended = finish;
      audio.onerror = finish;
      await audio.play();
    } catch {
      stopSpeaking(); // never break the chat flow over voice
      onDone?.();
    }
  };

  useEffect(() => () => stopSpeaking(), []);

  // ── Write-action confirmations ────────────────────────────────────
  const [resolvedActions, setResolvedActions] = useState<Record<string, "confirmed" | "declined">>(
    () => {
      try {
        return JSON.parse(localStorage.getItem("adwoa_resolved_actions") || "{}");
      } catch {
        return {};
      }
    },
  );

  const confirmAction = async (
    messageId: string,
    toolCallId: string,
    toolName: string,
    input: Record<string, unknown>,
    confirmed: boolean,
  ) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (sessionData.session?.access_token) {
        headers.Authorization = `Bearer ${sessionData.session.access_token}`;
      }
      const res = await fetch("/api/confirm-action", {
        method: "POST",
        headers,
        body: JSON.stringify({ tool: toolName, args: input, confirmed }),
      });
      if (!res.ok && confirmed) {
        toast.error("Couldn't complete that action — please try again.");
      }
    } catch {
      toast.error("Couldn't complete that action — please try again.");
    } finally {
      setResolvedActions((prev) => {
        const next = {
          ...prev,
          [`${messageId}:${toolCallId}`]: confirmed ? "confirmed" : "declined",
        } as Record<string, "confirmed" | "declined">;
        try {
          localStorage.setItem("adwoa_resolved_actions", JSON.stringify(next));
        } catch {
          // ignore storage errors
        }
        return next;
      });
      // Refresh any data a confirmed action may have changed
      void qc.invalidateQueries({ refetchType: "all" });
    }
  };

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: async ({ messages }) => {
          const { data } = await supabase.auth.getSession();
          const headers: Record<string, string> = {};
          if (data.session?.access_token) {
            headers.Authorization = `Bearer ${data.session.access_token}`;
          }
          return { body: { messages, threadId }, headers };
        },
      }),
    [threadId],
  );

  const { messages, sendMessage, status, error, stop, regenerate } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (e) => toast.error(e.message || "Assistant error"),
    onFinish: () => onTitleMaybeChanged(),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId, status]);

  const busy = status === "submitted" || status === "streaming";

  // Auto-play Adwoa's reply once streaming finishes (supported languages only)
  useEffect(() => {
    const wasBusy =
      prevStatusRef.current === "submitted" || prevStatusRef.current === "streaming";
    prevStatusRef.current = status;
    if (!wasBusy || status !== "ready") return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    if (playedRef.current.has(last.id)) return;
    playedRef.current.add(last.id);
    const replyText = last.parts.map((p) => (p.type === "text" ? p.text : "")).join("").trim();
    if (!replyText) return;
    // Respect the user's "speak replies automatically" setting
    if (!voiceAutoPlay) return;
    // Don't narrate messages containing a pending confirmation card
    if (last.parts.some((p) => typeof p.type === "string" && p.type.startsWith("tool-"))) return;
    void speak(replyText, last.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, messages]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    await sendMessage({ text: trimmed });
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div ref={scrollRef} className="relative flex-1 overflow-y-auto px-4 py-6 md:px-8">
        {messages.length === 0 && (
          <div className="mx-auto max-w-3xl py-8 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mx-auto grid h-16 w-16 place-items-center rounded-2xl soma-gradient soma-glow shadow-md"
            >
              <Sparkles className="h-8 w-8 text-white" />
            </motion.div>
            <h3 className="mt-4 font-display text-2xl font-bold">
              Akwaaba! How can Adwoa help you today?
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Grounded in your vitals, medications, and Ghanaian health context.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {SUGGESTIONS.map((s, i) => (
                <motion.button
                  key={s.key}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  type="button"
                  onClick={() => send(s.fallback)}
                  className={cn(
                    "group flex items-center gap-3 rounded-2xl border border-border bg-gradient-to-br p-3.5 text-left text-xs transition hover:border-primary/50 hover:shadow-md",
                    s.tint,
                  )}
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-card text-primary shadow-sm">
                    <s.icon className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-foreground/90">{s.fallback}</span>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                isSpeaking={speakingId === m.id}
                onInterrupt={stopSpeaking}
                canSpeak={(VOICE_LANGUAGES as readonly string[]).includes(voiceLang)}
                languageLabel={VOICE_LANGUAGE_LABELS[voiceLang] ?? voiceLang}
                onSpeak={replayMessage}
                resolvedActions={resolvedActions}
                onConfirmAction={confirmAction}
              />
            ))}
          </AnimatePresence>
          {status === "submitted" && <ThinkingIndicator />}
          {error && (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive flex items-center justify-between">
              <span>{error.message}</span>
              <Button size="sm" variant="outline" onClick={() => regenerate()} className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" /> Retry
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t border-border/60 bg-card/80 p-3 backdrop-blur md:p-4"
      >
        <div className="mx-auto max-w-4xl">
          <div className="group relative rounded-3xl border border-border bg-background p-2 shadow-sm transition focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10">
            <div className="flex items-end gap-2 px-2">
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => setLiveOpen(true)}
                disabled={busy}
                className="h-10 w-10 shrink-0 rounded-2xl"
                aria-label="Start live voice conversation"
                title="Live conversation"
              >
                <Mic className="h-4 w-4 text-primary" />
              </Button>
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="Ask Adwoa anything about your health or medications…"
                rows={2}
                className="min-h-[52px] max-h-48 resize-none border-0 bg-transparent px-1 py-3 text-[15px] shadow-none focus-visible:ring-0"
              />
              {busy ? (
                <Button
                  type="button"
                  size="icon"
                  onClick={stop}
                  variant="outline"
                  className="h-10 w-10 shrink-0 rounded-2xl"
                  aria-label="Stop"
                >
                  <span className="h-2.5 w-2.5 rounded-sm bg-foreground" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim()}
                  className="h-10 w-10 shrink-0 rounded-2xl soma-gradient soma-glow border-0 text-white"
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Adwoa AI provides general guidance for informational purposes, not formal diagnosis. In
            emergencies contact local health services.
          </p>
        </div>
      </form>
    </>
  );
}

function ThinkingIndicator() {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const steps = [
    t("assistant.thinkingSteps.vault", "Accessing your health vault..."),
    t("assistant.thinkingSteps.vitals", "Analyzing vitals & medications..."),
    t("assistant.thinkingSteps.generating", "Adwoa is crafting a response..."),
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((s) => (s + 1) % steps.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [steps.length]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3"
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl soma-gradient soma-glow">
        <Sparkles className="h-4 w-4 text-white" />
      </div>
      <div className="flex items-center gap-2 rounded-2xl bg-secondary/60 px-4 py-3">
        <span className="text-xs text-muted-foreground font-medium">{steps[step]}</span>
        <div className="flex items-center gap-1.5 ml-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-2 w-2 rounded-full bg-primary"
              animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function MessageBubble({
  message,
  isSpeaking,
  onInterrupt,
  canSpeak,
  languageLabel,
  onSpeak,
  resolvedActions,
  onConfirmAction,
}: {
  message: UIMessage;
  isSpeaking: boolean;
  onInterrupt: () => void;
  canSpeak: boolean;
  languageLabel: string;
  onSpeak: (messageId: string, text: string) => void;
  resolvedActions: Record<string, "confirmed" | "declined">;
  onConfirmAction: (
    messageId: string,
    toolCallId: string,
    toolName: string,
    input: Record<string, unknown>,
    confirmed: boolean,
  ) => void;
}) {
  const isUser = message.role === "user";
  const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
  const [copied, setCopied] = useState(false);
  const toolParts = message.parts.filter(
    (p) => typeof p.type === "string" && p.type.startsWith("tool-"),
  ) as unknown as AnyToolPart[];

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn("flex gap-3", isUser && "flex-row-reverse")}
    >
      <div
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-2xl shadow-sm",
          isUser ? "bg-secondary text-foreground" : "soma-gradient soma-glow text-white",
        )}
      >
        {isUser ? <UserIcon className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </div>
      <div className={cn("flex min-w-0 max-w-[85%] flex-col gap-1", isUser && "items-end")}>
        <div
          className={cn(
            "rounded-3xl px-4 py-3.5 text-[15px] leading-relaxed shadow-sm",
            isUser
              ? "rounded-tr-md bg-primary text-primary-foreground font-medium"
              : "rounded-tl-md border border-border/60 bg-card text-foreground",
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{text}</p>
          ) : (
            <div className="min-w-0">
              <ReactMarkdown components={mdComponents}>{text}</ReactMarkdown>
            </div>
          )}
        </div>
        {!isUser && (
          <div className="flex flex-wrap items-center gap-2">
            {text && (
              <button
                onClick={copy}
                className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-muted-foreground transition hover:text-foreground"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
            )}
            {text && canSpeak && !isSpeaking && (
              <button
                type="button"
                onClick={() => onSpeak(message.id, text)}
                aria-label={`Listen to this reply in ${languageLabel}`}
                title={`Listen (${languageLabel} voice)`}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary transition hover:bg-primary/20"
              >
                <Volume2 className="h-3 w-3" /> Listen
              </button>
            )}
            {isSpeaking && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                <motion.span
                  animate={{ scale: [1, 1.35, 1], opacity: [1, 0.55, 1] }}
                  transition={{ duration: 1.1, repeat: Infinity }}
                >
                  <Volume2 className="h-3 w-3" />
                </motion.span>
                Speaking…
              </span>
            )}
            {isSpeaking && (
              <button
                type="button"
                onClick={onInterrupt}
                aria-label="Stop voice playback"
                className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive transition hover:bg-destructive/20"
              >
                <Square className="h-3 w-3" /> Tap to interrupt
              </button>
            )}
          </div>
        )}

        {/* Pending write-action confirmation cards */}
        {!isUser &&
          toolParts.some((part) => WRITE_TOOLS.includes(part.type.slice(5))) && (
            <div className="mt-1 flex w-full flex-col gap-2">
              {toolParts
                .filter((part) => WRITE_TOOLS.includes(part.type.slice(5)))
                .map((part) => {
                  const toolName = part.type.slice(5);
                  const key = `${message.id}:${part.toolCallId}`;
                  const resolved = resolvedActions[key];
                  const input = part.input ?? {};
                  if (resolved) {
                    return (
                      <div
                        key={part.toolCallId}
                        className={cn(
                          "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs",
                          resolved === "confirmed"
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "border-border bg-muted/50 text-muted-foreground",
                        )}
                      >
                        {resolved === "confirmed" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 shrink-0" />
                        )}
                        {resolved === "confirmed"
                          ? "Confirmed ✓"
                          : "Declined — Adwoa won't make this change"}
                      </div>
                    );
                  }
                  return (
                    <div
                      key={part.toolCallId}
                      className="rounded-2xl border border-primary/30 bg-primary/5 p-3 shadow-sm"
                    >
                      <div className="flex items-start gap-2">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                          <ClipboardList className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold uppercase tracking-wide text-primary">
                            Confirm action
                          </div>
                          <p className="mt-0.5 break-words text-sm text-foreground">
                            {humanSummary(toolName, input)}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <Button
                              size="sm"
                              disabled={part.state === "input-streaming"}
                              onClick={() =>
                                onConfirmAction(
                                  message.id,
                                  String(part.toolCallId),
                                  toolName,
                                  input,
                                  true,
                                )
                              }
                              className="h-8 soma-gradient border-0 px-3 text-xs text-white"
                            >
                              Confirm
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={part.state === "input-streaming"}
                              onClick={() =>
                                onConfirmAction(
                                  message.id,
                                  String(part.toolCallId),
                                  toolName,
                                  input,
                                  false,
                                )
                              }
                              className="h-8 px-3 text-xs"
                            >
                              Decline
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
      </div>
    </motion.div>
  );
}

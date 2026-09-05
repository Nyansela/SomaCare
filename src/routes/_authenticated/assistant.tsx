import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useChat, type UIMessage } from "@/lib/use-chat";
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
  ChevronsDown,
  Crown,
} from "lucide-react";
import { AdwoaBlob } from "@/components/adwoa-blob";
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
    <pre className="my-2 max-w-full overflow-x-auto rounded-xl bg-muted/60 p-3 text-[13px] leading-relaxed">
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
    <div className="my-2 max-w-full overflow-x-auto rounded-xl">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
};

export const Route = createFileRoute("/_authenticated/assistant")({
  validateSearch: (search: Record<string, unknown>): { ask?: string } => ({
    ask:
      typeof search.ask === "string" && search.ask.trim()
        ? search.ask.slice(0, 500)
        : undefined,
  }),
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
  "logSymptom",
  "generateWorkoutPlan",
  "generateMealPlan",
  "updatePlan",
  "completePlan",
];

type AnyToolPart = {
  type: string;
  toolCallId?: string;
  state?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown> | null;
};

/** True when a write-tool's execution was refused by a tier restriction. */
function isTierRestrictedTool(part: AnyToolPart): boolean {
  return !!part.output && part.output.error === "tier_restricted";
}

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
    case "logSymptom":
      return `Log symptom: ${s(input.symptom)} (${s(input.severity)})${s(input.duration) ? ` — ${s(input.duration)}` : ""}`;
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
    case "updatePlan": {
      const dayNums = Array.isArray(input.days)
        ? (input.days as { day_number: number }[])
            .map((d) => d.day_number)
            .sort((a, b) => a - b)
            .join(", ")
        : "";
      const label = s(input.title) || s(input.goal) || "plan";
      const bits = [`Update plan: ${label}`];
      if (dayNums) bits.push(`rewrite day(s) ${dayNums}`);
      if (input.duration_days) bits.push(`extend to ${String(input.duration_days)} days`);
      return bits.join(" · ");
    }
    case "completePlan":
      return `Mark plan as completed 🎉`;
    default:
      return `Proposed action: ${toolName}`;
  }
}

function AssistantPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { ask } = Route.useSearch();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
    <AppShell title="Adwoa AI" subtitle="Your personal health assistant">
      <div className="relative flex h-[calc(100dvh-var(--layout-header)-var(--layout-pad)*2)] w-full overflow-hidden rounded-2xl bg-card/30 shadow-sm lg:bg-transparent">
        {/* ── Sidebar toggle ──────────────────────────────────── */}
        <button
          type="button"
          onClick={() => setSidebarOpen((o) => !o)}
          className="absolute left-3 top-3 z-50 grid h-10 w-10 place-items-center rounded-xl border border-border bg-card/90 shadow-md backdrop-blur"
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="h-5 w-5 text-foreground" />
        </button>

        {/* ═══════════════════════════════════════════════════════════
            Thread History Sidebar
           ═══════════════════════════════════════════════════════════ */}
        {sidebarOpen && (
          <>
            {/* Mobile drawer backdrop */}
            <div
              className="fixed inset-0 z-20 bg-black/40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-hidden
            />
            <aside
              className={cn(
                "absolute inset-y-0 left-0 z-30 flex w-72 max-w-[85vw] flex-col rounded-r-2xl bg-background/80 shadow-xl backdrop-blur-xl",
                "lg:static lg:z-auto lg:w-80 lg:max-w-none lg:shrink-0 lg:rounded-r-none lg:bg-muted/20 lg:shadow-none lg:backdrop-blur-none",
              )}
            >
              {/* ── Sidebar header ──────────────────────────────── */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-9 w-9 place-items-center rounded-[14px] soma-gradient soma-glow">
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
                <div className="mt-3">
                  <Button
                    size="sm"
                    onClick={newThread}
                    className="relative w-full soma-gradient text-white"
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> {t("assistant.newChat")}
                  </Button>
                </div>
              </div>

              {/* ── Conversations list ──────────────────────────── */}
              <div className="flex items-center justify-between px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">
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
                                ? "bg-primary/10 font-semibold text-primary border border-primary/20 shadow-sm"
                                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                            )}
                          >
                            {t.title || "Untitled Chat"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDelete(t.id)}
                            className="rounded-xl p-1.5 text-muted-foreground opacity-60 transition hover:bg-destructive/10 hover:text-destructive lg:opacity-0 lg:group-hover:opacity-100"
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
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════
            Main Conversation Canvas
           ═══════════════════════════════════════════════════════════ */}
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-background/50 lg:rounded-none">


          {activeId ? (
            <ChatWindow
              key={activeId}
              threadId={activeId}
              initialMessages={initialMessages}
              loading={loadingMessages}
              onTitleMaybeChanged={loadThreads}
              autoAsk={ask}
            />
          ) : (
            <EmptyChat onStart={newThread} />
          )}
        </main>
      </div>

      {/* ── Confirmation Dialog for Deleting Thread ─────────────── */}
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

/* ═══════════════════════════════════════════════════════════════════
   Empty State
   ═══════════════════════════════════════════════════════════════════ */
function EmptyChat({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center p-8 text-center">
      {/* Decorative background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/4 top-1/3 h-64 w-64 rounded-full bg-primary/10 blur-3xl animate-pulse" />
        <div
          className="absolute bottom-1/4 right-1/4 h-48 w-48 rounded-full bg-emerald-500/8 blur-3xl"
          style={{ animationDelay: "1s" }}
        />
      </div>
      <div className="relative z-10 max-w-lg rounded-3xl border border-border bg-card p-10 text-center shadow-lg">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mx-auto grid h-20 w-20 place-items-center rounded-3xl soma-gradient soma-glow shadow-lg"
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
          className="mt-6 soma-gradient text-white shadow-md hover:scale-105 active:scale-95 transition-transform"
        >
          <Plus className="mr-2 h-4 w-4" /> Start a Conversation
        </Button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Chat Window
   ═══════════════════════════════════════════════════════════════════ */
function ChatWindow({
  threadId,
  initialMessages,
  loading,
  onTitleMaybeChanged,
  autoAsk,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  loading: boolean;
  onTitleMaybeChanged: () => void;
  autoAsk?: string;
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
    if (!(VOICE_LANGUAGES as readonly string[]).includes(voiceLang)) return;
    try {
      const res = await fetch("/api/voice/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language: voiceLang }),
      });
      const contentType = res.headers.get("content-type") || "";
      if (!res.ok || !contentType.includes("audio")) return;
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
      stopSpeaking();
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
        let message = "Couldn't complete that action — please try again.";
        try {
          const parsed = (await res.text()) as string;
          const detail = JSON.parse(parsed) as { error?: string; message?: string };
          if (detail.error === "tier_restricted") {
            message =
              detail.message || "This feature requires SomaCare Plus or higher.";
          }
        } catch {
          // not JSON — keep the generic message
        }
        toast.error(message);
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
      void qc.invalidateQueries({ refetchType: "all" });
    }
  };

  const { messages, sendMessage, status, error, stop, regenerate } = useChat({
    id: threadId,
    messages: initialMessages,
    onError: (e) => toast.error(e.message || "Assistant error"),
    onFinish: ({ messages: finalMessages }) => {
      // Keep the react-query cache in sync with what was actually said, so
      // revisiting this thread shows the full conversation immediately
      // instead of a stale snapshot.
      qc.setQueryData(["ai", "messages", threadId], finalMessages);
      onTitleMaybeChanged();
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId, status]);

  const busy = status === "submitted" || status === "streaming";

  // Auto-play Adwoa's reply once streaming finishes
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
    if (!voiceAutoPlay) return;
    if (liveOpen) return;
    if (last.parts.some((p) => typeof p.type === "string" && p.type.startsWith("tool-"))) return;
    void speak(replyText, last.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, messages]);

  const navigate = useNavigate();

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    await sendMessage({ text: trimmed });
  };

  // Auto-send a question handed off from another page
  const autoAskSentRef = useRef(false);
  useEffect(() => {
    if (!autoAsk || autoAskSentRef.current || loading || busy) return;
    autoAskSentRef.current = true;
    void send(autoAsk);
    void navigate({ to: "/assistant", search: {}, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAsk, loading, busy]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div
        ref={scrollRef}
        className="relative min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6 md:px-8"
      >
        {messages.length === 0 && (
          <div className="mx-auto max-w-3xl py-8 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mx-auto grid h-14 w-14 place-items-center rounded-2xl soma-gradient soma-glow shadow-md"
            >
              <Sparkles className="h-7 w-7 text-white" />
            </motion.div>
            <h3 className="mt-4 font-display text-xl font-bold sm:text-2xl">
              Akwaaba! How can Adwoa help you today?
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Grounded in your vitals, medications, and Ghanaian health context.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-2 sm:mt-6 sm:grid-cols-2 sm:gap-3">
              {SUGGESTIONS.map((s, i) => (
                <motion.button
                  key={s.key}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  type="button"
                  onClick={() => send(s.fallback)}
                  className="group relative"
                >
                  <div className={cn("rounded-2xl border border-border bg-card p-3 text-left transition-all hover:scale-[1.02] hover:shadow-md active:scale-[0.98]", "bg-gradient-to-br", s.tint)}>
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-card shadow-sm">
                        <s.icon className="h-4 w-4 text-primary" />
                      </div>
                      <span className="font-medium text-foreground/90 text-xs">{s.fallback}</span>
                      </div>
                    </div>
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
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
            >
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-destructive/15">
                    <motion.div animate={{ rotate: [0, -8, 8, -4, 0] }} transition={{ duration: 0.5, delay: 0.1 }}>
                      <XCircle className="h-5 w-5 text-destructive" />
                    </motion.div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-destructive/80">Something went wrong</p>
                    <p className="mt-0.5 text-sm text-foreground/80">{error.message}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => regenerate()}
                    className="shrink-0 gap-1.5 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Retry
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Input Box ─────────────────────────────────────────────── */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="bg-card/80 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:p-4 md:pb-4"
      >
        <div className="mx-auto max-w-4xl">
          <div className="rounded-3xl border border-border bg-card shadow-md">
            <div className="flex items-end gap-2 px-2 py-2">
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => setLiveOpen(true)}
                disabled={busy}
                className="h-9 w-9 shrink-0 rounded-xl sm:h-10 sm:w-10 sm:rounded-2xl"
                aria-label="Start live voice conversation"
                title="Live conversation"
              >
                <Mic className="h-4 w-4 text-primary" />
              </Button>
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  const el = e.target;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="Ask Adwoa anything about your health or medications…"
                rows={1}
                className="min-h-[44px] max-h-40 resize-none border-0 bg-transparent px-1 py-2.5 text-base shadow-none focus-visible:ring-0 sm:text-[15px]"
              />
              {busy ? (
                <Button
                  type="button"
                  size="icon"
                  onClick={stop}
                  variant="outline"
                  className="h-9 w-9 shrink-0 rounded-xl sm:h-10 sm:w-10 sm:rounded-2xl"
                  aria-label="Stop"
                >
                  <span className="h-2.5 w-2.5 rounded-sm bg-foreground" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim()}
                  className="h-9 w-9 shrink-0 rounded-xl soma-gradient text-white sm:h-10 sm:w-10 sm:rounded-2xl hover:scale-105 active:scale-95 transition-transform"
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <p className="mt-1.5 text-center text-[10px] leading-snug text-muted-foreground sm:text-[11px]">
            Adwoa AI provides general guidance for informational purposes, not formal diagnosis. In
            emergencies contact local health services.
          </p>
        </div>
      </form>

      {/* ── Live voice conversation overlay ────────────────────────── */}
      <AnimatePresence>
        {liveOpen && (
          <LiveConversationOverlay
            key="live-conv"
            onClose={() => setLiveOpen(false)}
            messages={messages}
            status={status}
            sendMessage={sendMessage}
            speak={speak}
            stopSpeaking={stopSpeaking}
            canSpeak={(VOICE_LANGUAGES as readonly string[]).includes(voiceLang)}
            sttLanguage={STT_LANGUAGE_MAP[voiceLang] ?? "en-US"}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Thinking Indicator
   ═══════════════════════════════════════════════════════════════════ */
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
      </div>              <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-medium">{steps[step]}</span>
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-2 w-2 rounded-full bg-gradient-to-br from-primary to-primary/60 shadow-[0_0_6px_rgba(var(--primary),0.4)]"
                animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0], scale: [0.85, 1.15, 0.85] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Message Bubble
   ═══════════════════════════════════════════════════════════════════ */
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
    const { safeCopyToClipboard } = await import("@/lib/capacitor-web");
    await safeCopyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn("flex gap-2.5 sm:gap-3", isUser && "flex-row-reverse")}
    >
      <div
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-2xl shadow-sm",
          isUser ? "bg-secondary text-foreground" : "soma-gradient soma-glow text-white",
        )}
      >
        {isUser ? <UserIcon className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </div>
      <div className={cn("flex min-w-0 max-w-[88%] flex-col gap-1 sm:max-w-[82%]", isUser && "items-end")}>
        <div
          className={cn(
            "rounded-3xl px-3.5 py-3 text-sm leading-relaxed shadow-sm sm:px-4 sm:py-3.5 sm:text-[15px]",
            isUser
              ? "rounded-tr-md bg-primary text-primary-foreground font-medium"
              : "rounded-tl-md text-foreground",
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

        {/* ── Tier-restricted write actions (no confirmation card) ── */}
        {!isUser && toolParts.some((part) => isTierRestrictedTool(part)) && (
          <div className="mt-1 flex w-full flex-col gap-2">
            {toolParts
              .filter((part) => isTierRestrictedTool(part))
              .map((part) => (
                <div
                  key={part.toolCallId}
                  className="flex items-center gap-2.5 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs"
                >
                  <Crown className="h-4 w-4 shrink-0 text-primary" />
                  <span className="font-medium">
                    {(part.output?.message as string) ||
                      "This feature requires SomaCare Plus or higher."}
                  </span>
                </div>
              ))}
          </div>
        )}

        {/* ── Pending write-action confirmation cards ────────────── */}
        {!isUser &&
          toolParts.some(
            (part) =>
              WRITE_TOOLS.includes(part.type.slice(5)) &&
              !isTierRestrictedTool(part),
          ) && (
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
                      <motion.div
                        key={part.toolCallId}
                        initial={{ opacity: 0, scale: 0.95, y: 4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className={cn(
                          "relative overflow-hidden rounded-2xl border border-border px-4 py-3 text-xs",
                          resolved === "confirmed"
                            ? "bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-background shadow-lg shadow-emerald-500/5"
                            : "bg-gradient-to-r from-muted/40 via-muted/20 to-background",
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={cn(
                              "grid h-8 w-8 shrink-0 place-items-center rounded-xl",
                              resolved === "confirmed"
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {resolved === "confirmed" ? (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </motion.div>
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
                          </div>
                          <span
                            className={cn(
                              "font-medium",
                              resolved === "confirmed"
                                ? "text-emerald-700 dark:text-emerald-300"
                                : "text-muted-foreground",
                            )}
                          >
                            {resolved === "confirmed"
                              ? "Action completed successfully"
                              : "Declined — Adwoa won't make this change"}
                          </span>
                        </div>
                      </motion.div>
                    );
                  }
                  return (
                    <motion.div
                      key={part.toolCallId}
                      initial={{ opacity: 0, y: 8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    >
                      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
                        <div>
                          {/* Header row */}
                          <div className="flex items-center gap-3">
                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 shadow-inner">
                              <motion.div
                                animate={{ rotate: [0, 5, -5, 0] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                              >
                                <ClipboardList className="h-5 w-5 text-primary" />
                              </motion.div>
                            </div>
                            <div>
                              <div className="text-[11px] font-bold uppercase tracking-widest text-primary/70">
                                Action Required
                              </div>
                              <p className="mt-0.5 text-sm font-medium text-foreground">
                                {humanSummary(toolName, input)}
                              </p>
                            </div>
                          </div>

                          {/* Divider */}
                          <div className="my-3 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

                          {/* Buttons */}
                          <div className="flex items-center gap-2">
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
                              className="h-9 flex-1 soma-gradient px-4 text-xs font-semibold text-white shadow-md shadow-primary/20 transition-all hover:shadow-lg hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98]"
                            >
                              <Check className="mr-1.5 h-3.5 w-3.5" /> Confirm
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
                              className="h-9 flex-1 px-4 text-xs font-medium text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground"
                            >
                              <XCircle className="mr-1.5 h-3.5 w-3.5" /> Decline
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
            </div>
          )}
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Live Voice Conversation (ChatGPT-style hands-free mode)
   ═══════════════════════════════════════════════════════════════════ */
type LivePhase = "idle" | "listening" | "thinking" | "speaking";

function LiveConversationOverlay({
  onClose,
  messages,
  status,
  sendMessage,
  speak,
  stopSpeaking,
  canSpeak,
  sttLanguage,
}: {
  onClose: () => void;
  messages: UIMessage[];
  status: string;
  sendMessage: (message: { text: string }) => Promise<void>;
  speak: (text: string, messageId: string, onDone?: () => void) => Promise<void>;
  stopSpeaking: () => void;
  canSpeak: boolean;
  sttLanguage: string;
}) {
  const [supported] = useState<boolean>(() => !!getSpeechRecognition());
  const [micDenied, setMicDenied] = useState(false);
  const [phase, setPhase] = useState<LivePhase>("idle");
  const [transcript, setTranscript] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const recogRef = useRef<SRRecognition | null>(null);
  const manualStopRef = useRef(false);
  const awaitingReplyRef = useRef(false);
  const historyRef = useRef<HTMLDivElement>(null);

  const stopRecognition = useCallback(() => {
    const rec = recogRef.current;
    recogRef.current = null;
    if (rec) {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.abort();
      } catch {
        // ignore
      }
    }
  }, []);

  const startListening = useCallback(
    (locale?: string) => {
      if (manualStopRef.current) return;
      const Ctor = getSpeechRecognition();
      if (!Ctor) return;
      stopRecognition();
      setTranscript("");
      setMicDenied(false);
      setPhase("listening");
      let finalText = "";
      const lang = locale ?? sttLanguage;
      const rec = new Ctor();
      rec.lang = lang;
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const result = e.results[i];
          if (result.isFinal) finalText += result[0].transcript;
          else interim += result[0].transcript;
        }
        setTranscript((finalText || interim).trim());
      };
      rec.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          manualStopRef.current = true;
          setMicDenied(true);
          setPhase("idle");
        } else if (e.error === "language-not-supported" && lang !== "en-US") {
          setNotice("Voice input isn't available in your language yet — listening in English.");
          startListening("en-US");
        } else if (e.error !== "no-speech" && e.error !== "aborted") {
          setPhase("idle");
        }
      };
      rec.onend = () => {
        if (recogRef.current !== rec) return;
        recogRef.current = null;
        const said = finalText.trim();
        if (manualStopRef.current) return;
        if (said) {
          setTranscript("");
          setPhase("thinking");
          awaitingReplyRef.current = true;
          void sendMessage({ text: said });
        } else {
          startListening(locale ?? sttLanguage);
        }
      };
      recogRef.current = rec;
      try {
        rec.start();
      } catch {
        // already started
      }
    },
    [sendMessage, sttLanguage, stopRecognition],
  );

  useEffect(() => {
    manualStopRef.current = false;
    const timer = setTimeout(() => startListening(), 350);
    return () => {
      manualStopRef.current = true;
      stopRecognition();
    };
  }, [startListening, stopRecognition]);

  useEffect(() => () => stopSpeaking(), [stopSpeaking]);

  useEffect(() => {
    if (!awaitingReplyRef.current || status !== "ready") return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    awaitingReplyRef.current = false;
    const text = last.parts.map((p) => (p.type === "text" ? p.text : "")).join("").trim();
    const hasTools = last.parts.some(
      (p) => typeof p.type === "string" && p.type.startsWith("tool-"),
    );
    if (!canSpeak || !text || hasTools) {
      if (hasTools) setNotice("Please check the chat screen to confirm that action.");
      else if (!canSpeak) setNotice("Voice replies aren't available in your language yet.");
      startListening();
      return;
    }
    setPhase("speaking");
    void speak(text, `live-${last.id}`, () => {
      if (!manualStopRef.current) startListening();
    });
  }, [messages, status, canSpeak, speak, startListening]);

  useEffect(() => {
    historyRef.current?.scrollTo({ top: historyRef.current.scrollHeight });
  }, [messages]);

  const endSession = () => {
    manualStopRef.current = true;
    stopRecognition();
    stopSpeaking();
    onClose();
  };

  const toggleMic = () => {
    if (phase === "listening") {
      manualStopRef.current = true;
      stopRecognition();
      setPhase("idle");
    } else if (supported && !micDenied) {
      manualStopRef.current = false;
      startListening();
    }
  };

  const statusLabel =
    phase === "listening"
      ? "Listening…"
      : phase === "thinking" || status === "submitted" || status === "streaming"
        ? "Adwoa is thinking…"
        : phase === "speaking"
          ? "Adwoa is speaking…"
          : micDenied
            ? "Microphone access was blocked"
            : !supported
              ? "Voice input isn't supported in this browser"
              : "Tap the mic to talk";

  const recent = messages.slice(-4);

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col bg-gradient-to-b from-background via-background to-primary/10 backdrop-blur-xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          Live conversation
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={endSession}
          className="gap-1.5 text-muted-foreground"
        >
          Minimise <ChevronsDown className="h-4 w-4" />
        </Button>
      </div>

      {/* Recent conversation transcript */}
      {recent.length > 0 && (
        <div
          ref={historyRef}
          className="mx-auto w-full max-w-lg flex-1 space-y-2 overflow-y-auto px-5 pb-2 [mask-image:linear-gradient(to_bottom,transparent,black_12%)]"
        >
          {recent.map((m) => {
            const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("").trim();
            if (!text) return null;
            const isUser = m.role === "user";
            return (
              <div key={m.id} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
                <p
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed line-clamp-4",
                    isUser
                      ? "bg-primary/20 text-foreground"
                      : "bg-card/70 text-muted-foreground",
                  )}
                >
                  {text}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* 3D Blob voice orb */}
      <div className="flex flex-col items-center justify-center gap-6 px-5 pb-10">
        <div className="relative h-56 w-56">
          <AdwoaBlob phase={phase} />
        </div>

        <div className="min-h-[3.5rem] text-center">
          <p className="text-sm font-medium">{statusLabel}</p>
          {transcript && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-1 max-w-md text-sm italic text-muted-foreground"
            >
              "{transcript}"
            </motion.p>
          )}
          {!transcript && notice && (
            <p className="mt-1 max-w-md text-xs text-amber-600 dark:text-amber-400">{notice}</p>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          <Button
            size="icon"
            onClick={toggleMic}
            disabled={!supported || micDenied}
            aria-label={phase === "listening" ? "Pause microphone" : "Start talking"}
            title={phase === "listening" ? "Pause microphone" : "Start talking"}
            className={cn(
              "h-14 w-14 rounded-full shadow-lg",
              phase === "listening"
                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                : "bg-secondary text-foreground hover:bg-secondary/80",
            )}
          >
            {phase === "listening" ? <AudioLines className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </Button>
          <Button
            size="icon"
            onClick={endSession}
            aria-label="End live conversation"
            title="End conversation"
            className="h-16 w-16 rounded-full bg-destructive text-white shadow-lg hover:bg-destructive/90"
          >
            <PhoneOff className="h-7 w-7" />
          </Button>
        </div>
        <p className="max-w-sm text-center text-[11px] text-muted-foreground">
          Speak naturally — Adwoa replies out loud and keeps listening until you hang up.
        </p>
      </div>
    </motion.div>,
    document.body,
  );
}

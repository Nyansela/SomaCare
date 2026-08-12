import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
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
              <MessageBubble key={m.id} message={m} />
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

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
  const [copied, setCopied] = useState(false);

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
      <div className={cn("flex max-w-[85%] flex-col gap-1", isUser && "items-end")}>
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
            <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-ul:my-2 prose-headings:mt-3 prose-headings:mb-1 prose-strong:text-foreground prose-a:text-primary">
              <ReactMarkdown>{text}</ReactMarkdown>
            </div>
          )}
        </div>
        {!isUser && text && (
          <button
            onClick={copy}
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-muted-foreground transition hover:text-foreground"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>
    </motion.div>
  );
}

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Sparkles,
  Send,
  Loader2,
  BookOpen,
  ChevronDown,
  RotateCcw,
  AlertCircle,
  HelpCircle,
  History,
  Check,
} from "lucide-react";
import type { LearningNote, TutorMessage } from "@/types";
import api from "@/api/axios";
import { TutorMarkdown } from "./TutorMarkdown";

interface AITutorModalProps {
  note: LearningNote | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenQuiz?: (note: LearningNote) => void;
}
interface RecentChat {
  id: string;
  title: string;
  updatedAt: string;
}

export const AITutorModal: React.FC<AITutorModalProps> = ({
  note,
  isOpen,
  onClose,
  onOpenQuiz,
}) => {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSources, setExpandedSources] = useState<
    Record<string, boolean>
  >({});
  const versionRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const busy = loading || loadingHistory;
  const greeting = useCallback(
    (): TutorMessage[] => [
      {
        id: "welcome",
        role: "assistant",
        content: `Hello! I'm your AI Tutor for **${note?.title}**.\n\nAsk me to explain a concept, work through a problem, or help you prepare for an exam.`,
        createdAt: new Date().toISOString(),
      },
    ],
    [note?.title],
  );
  const quickPrompts = [
    "Explain the core concept in simple terms",
    "What are the key takeaways from these notes?",
    "Give me a practical real-world example",
    "What questions might appear on the exam?",
  ];

  // Restore conversations already persisted by the API for this student and note.
  useEffect(() => {
    if (!isOpen || !note) return;
    const version = ++versionRef.current;
    setLoadingHistory(true);
    setLoading(false);
    setError(null);
    setInputQuery("");
    setConversationId(null);
    setRecentChats([]);
    setExpandedSources({});
    setMessages(greeting());
    const initialize = async () => {
      try {
        const res = await api.get(`/notes/${note.id}/tutor/conversations`);
        if (version !== versionRef.current) return;
        const chats: RecentChat[] = res.data || [];
        setRecentChats(chats);
        if (chats.length) {
          const detail = await api.get(
            `/notes/${note.id}/tutor/conversations/${chats[0].id}`,
          );
          if (version !== versionRef.current) return;
          setConversationId(chats[0].id);
          setMessages(
            detail.data.messages?.length ? detail.data.messages : greeting(),
          );
        }
      } catch {
        if (version === versionRef.current)
          setError(
            "Could not load saved chats. Your previous conversations are still saved. Reopen the tutor to try again.",
          );
      } finally {
        if (version === versionRef.current) setLoadingHistory(false);
      }
    };
    void initialize();
    return () => {
      versionRef.current++;
    };
  }, [isOpen, note, greeting]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, loading]);

  const selectChat = async (id: string) => {
    if (!note || busy || id === conversationId) return;
    const version = ++versionRef.current;
    setLoadingHistory(true);
    setError(null);
    try {
      const res = await api.get(`/notes/${note.id}/tutor/conversations/${id}`);
      if (version !== versionRef.current) return;
      setConversationId(id);
      setMessages(res.data.messages || []);
      setInputQuery("");
      setExpandedSources({});
    } catch {
      if (version === versionRef.current)
        setError("Could not open this chat. Please try again.");
    } finally {
      if (version === versionRef.current) setLoadingHistory(false);
    }
  };

  const sendMessage = async (query?: string) => {
    const text = (query || inputQuery).trim();
    if (!text || !note || busy) return;
    const version = versionRef.current;
    setInputQuery("");
    setError(null);
    setMessages((prev) => [
      ...prev,
      {
        id: `user_${Date.now()}`,
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      },
    ]);
    setLoading(true);
    try {
      const response = await api.post(`/notes/${note.id}/tutor/ask`, {
        conversationId: conversationId || undefined,
        question: text,
      });
      if (version !== versionRef.current) return;
      const data = response.data;
      setConversationId(data.conversationId);
      setMessages((prev) => [
        ...prev,
        {
          id: data.messageId || `asst_${Date.now()}`,
          role: "assistant",
          content: data.answer,
          sources: data.sources || [],
          createdAt: data.createdAt || new Date().toISOString(),
        },
      ]);
      setRecentChats((prev) => [
        {
          id: data.conversationId,
          title:
            prev.find((chat) => chat.id === data.conversationId)?.title ||
            text.slice(0, 60),
          updatedAt: data.createdAt || new Date().toISOString(),
        },
        ...prev.filter((chat) => chat.id !== data.conversationId),
      ]);
    } catch (err: any) {
      if (version === versionRef.current) {
        setError(
          err.response?.data?.message ||
            "The AI Tutor could not respond. Please try again.",
        );
        setInputQuery(text);
      }
    } finally {
      if (version === versionRef.current) setLoading(false);
    }
  };

  const startFresh = () => {
    if (busy) return;
    versionRef.current++;
    setConversationId(null);
    setMessages(greeting());
    setInputQuery("");
    setExpandedSources({});
    setError(null);
  };
  if (!note) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100%-1rem)] max-w-5xl h-[92dvh] max-h-[92dvh] sm:h-[88dvh] flex flex-col gap-0 p-0 overflow-hidden bg-background">
        <DialogHeader className="p-3 pr-10 sm:p-5 sm:pr-12 border-b border-border flex flex-col gap-3 lg:flex-row lg:items-center justify-between shrink-0 bg-card text-left">
          <div className="flex w-full min-w-0 max-w-full items-center gap-3 lg:flex-1">
            <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <Sparkles className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-sm sm:text-base font-semibold break-words">
                  AI Tutor: {note.title}
                </DialogTitle>
                <Badge
                  variant="outline"
                  className="text-[10px] text-primary border-primary/20"
                >
                  {note.subject.code}
                </Badge>
              </div>
              <DialogDescription className="text-xs mt-1">
                Your study companion, grounded in lecture notes
              </DialogDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  className="gap-1.5 text-xs"
                >
                  <History className="size-3.5" />
                  Recent Chats{" "}
                  {recentChats.length > 0 && (
                    <span className="rounded-full bg-muted px-1.5 text-[10px]">
                      {recentChats.length}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-72 max-w-[calc(100vw-2rem)] max-h-72 overflow-y-auto"
              >
                <DropdownMenuLabel className="text-xs">
                  Saved chats for this note
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {recentChats.length === 0 && (
                  <p className="px-2 py-4 text-xs text-muted-foreground">
                    Your chats appear here after your first question.
                  </p>
                )}
                {recentChats.map((chat) => (
                  <DropdownMenuItem
                    key={chat.id}
                    onSelect={() => void selectChat(chat.id)}
                    className="items-start gap-2 py-2.5 cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">
                        {chat.title || "Study session"}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {new Date(chat.updatedAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    {chat.id === conversationId && (
                      <Check className="size-4 text-primary shrink-0" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {onOpenQuiz && note.aiReady && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => {
                  onClose();
                  onOpenQuiz(note);
                }}
              >
                <HelpCircle className="size-3.5 text-primary" />
                Practice Quiz
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              className="gap-1.5 text-xs"
              onClick={startFresh}
            >
              <RotateCcw className="size-3.5" />
              New Session
            </Button>
          </div>
        </DialogHeader>

        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-6 space-y-5 bg-muted/20"
          role="log"
          aria-label="Tutor conversation"
          aria-busy={busy}
        >
          {loadingHistory && (
            <div
              role="status"
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <Loader2 className="size-4 animate-spin" />
              Loading saved conversation...
            </div>
          )}
          {!loadingHistory &&
            messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={`flex min-w-0 gap-2 sm:gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                >
                  {!isUser && (
                    <div className="hidden sm:flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20">
                      <Sparkles className="size-4" />
                    </div>
                  )}
                  <div className="min-w-0 max-w-full sm:max-w-[85%] space-y-2">
                    <div
                      className={`rounded-2xl px-4 py-3 sm:px-5 sm:py-4 text-sm shadow-xs break-words [overflow-wrap:anywhere] ${isUser ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-card border border-border rounded-tl-sm"}`}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap leading-relaxed">
                          {msg.content}
                        </p>
                      ) : (
                        <TutorMarkdown content={msg.content} />
                      )}
                    </div>
                    {!isUser && !!msg.sources?.length && (
                      <div className="border border-border/70 rounded-xl bg-card/60 p-2 text-xs">
                        <button
                          type="button"
                          aria-expanded={!!expandedSources[msg.id]}
                          onClick={() =>
                            setExpandedSources((prev) => ({
                              ...prev,
                              [msg.id]: !prev[msg.id],
                            }))
                          }
                          className="flex items-center justify-between gap-2 w-full text-left text-muted-foreground hover:text-foreground p-1.5"
                        >
                          <span className="flex items-center gap-1.5">
                            <BookOpen className="size-3.5 text-primary shrink-0" />
                            {msg.sources.length} note citation
                            {msg.sources.length > 1 ? "s" : ""}
                          </span>
                          <ChevronDown
                            className={`size-3.5 shrink-0 transition-transform ${expandedSources[msg.id] ? "rotate-180" : ""}`}
                          />
                        </button>
                        {expandedSources[msg.id] && (
                          <div className="mt-2 space-y-2 pt-2 border-t border-border/50">
                            {msg.sources.map((src, i) => (
                              <div
                                key={src.chunkId || i}
                                className="p-3 rounded-lg bg-muted/40 text-xs leading-relaxed break-words"
                              >
                                <div className="font-semibold mb-1">
                                  Section {src.chunkIndex + 1}
                                  {src.pageNumber
                                    ? ` · Page ${src.pageNumber}`
                                    : ""}
                                </div>
                                <p className="text-muted-foreground">
                                  {src.snippet}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          {loading && (
            <div
              role="status"
              className="flex items-center gap-2 rounded-xl border bg-card p-4 text-xs text-muted-foreground w-fit"
            >
              <Loader2 className="size-4 animate-spin text-primary" />
              Reviewing your lecture notes...
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2"
            >
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {messages.length <= 1 && !busy && (
          <div className="px-3 sm:px-5 py-2 border-t bg-card flex gap-2 overflow-x-auto shrink-0">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => void sendMessage(prompt)}
                className="text-xs px-3 py-2 rounded-full bg-secondary hover:bg-primary/10 hover:text-primary whitespace-nowrap border border-border/60"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
        <div className="p-3 sm:p-4 border-t bg-card shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage();
            }}
            className="flex items-end gap-2"
          >
            <textarea
              rows={2}
              aria-label="Message AI Tutor"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Ask about your lecture notes..."
              disabled={busy}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
              className="min-w-0 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-base sm:text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            />
            <Button
              type="submit"
              aria-label="Send message"
              disabled={!inputQuery.trim() || busy}
              className="gap-2 h-11 px-3 sm:px-4 shrink-0"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              <span className="hidden sm:inline">Ask</span>
            </Button>
          </form>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Chats are saved automatically. Answers are grounded in your lecture
            notes.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

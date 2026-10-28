import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Sparkles,
  Send,
  Loader2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import type { LearningNote, TutorMessage } from '@/types';
import api from '@/api/axios';

interface AITutorModalProps {
  note: LearningNote | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenQuiz?: (note: LearningNote) => void;
}

export const AITutorModal: React.FC<AITutorModalProps> = ({
  note,
  isOpen,
  onClose,
  onOpenQuiz,
}) => {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [inputQuery, setInputQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const quickPrompts = [
    'Explain the core concept in simple terms',
    'What are the key takeaways from these notes?',
    'Give me a practical real-world example',
    'What questions might appear on the exam?',
  ];

  // Initialize or fetch latest session when modal opens
  useEffect(() => {
    if (!isOpen || !note) {
      setConversationId(null);
      setMessages([]);
      setInputQuery('');
      setError(null);
      return;
    }

    const initConversation = async () => {
      try {
        const res = await api.get(`/notes/${note.id}/tutor/conversations`);
        if (res.data && res.data.length > 0) {
          const latest = res.data[0];
          setConversationId(latest.id);
          const detailRes = await api.get(`/notes/${note.id}/tutor/conversations/${latest.id}`);
          setMessages(detailRes.data.messages || []);
        } else {
          // Default greeting
          setMessages([
            {
              id: 'welcome',
              role: 'assistant',
              content: `Hello! I'm your AI Tutor for **${note.title}** (${note.subject.name}).\n\nI have indexed the contents of these lecture notes. You can ask me to explain difficult sections, clarify terminology, or solve problems step-by-step. What would you like to explore first?`,
              createdAt: new Date().toISOString(),
            },
          ]);
        }
      } catch (err: any) {
        console.warn('Failed to load past conversation, starting fresh session');
        setMessages([
          {
            id: 'welcome',
            role: 'assistant',
            content: `Hello! I'm your AI Tutor for **${note.title}** (${note.subject.name}). Ask me anything about this lecture!`,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    };

    initConversation();
  }, [isOpen, note?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (queryToSend?: string) => {
    const text = (queryToSend || inputQuery).trim();
    if (!text || !note || loading) return;

    setInputQuery('');
    setError(null);

    // Optimistically add user message
    const tempUserMsg: TutorMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setLoading(true);

    try {
      const response = await api.post(`/notes/${note.id}/tutor/ask`, {
        conversationId: conversationId || undefined,
        question: text,
      });

      const data = response.data;
      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
      }

      const assistantMsg: TutorMessage = {
        id: data.messageId || `asst_${Date.now()}`,
        role: 'assistant',
        content: data.answer,
        sources: data.sources || [],
        createdAt: data.createdAt || new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setError(err.response?.data?.message || 'The AI Tutor could not respond. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartFresh = () => {
    setConversationId(null);
    setMessages([
      {
        id: `fresh_${Date.now()}`,
        role: 'assistant',
        content: `Fresh study session started for **${note?.title}**. How can I help you today?`,
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  const toggleSource = (msgId: string) => {
    setExpandedSources((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  if (!note) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl h-[88vh] flex flex-col p-0 overflow-hidden bg-background border-border">
        {/* Header */}
        <DialogHeader className="p-4 border-b border-border flex flex-row items-center justify-between shrink-0 bg-card">
          <div className="flex items-center gap-3 min-w-0 pr-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary/20 to-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20 shadow-xs">
              <Sparkles className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-semibold truncate text-foreground">
                  AI Tutor: {note.title}
                </DialogTitle>
                <Badge variant="outline" className="text-[10px] font-mono uppercase bg-primary/5 text-primary border-primary/20">
                  {note.subject.code}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                Personalized study assistant grounded in verified lecture notes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onOpenQuiz && note.aiReady && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs font-medium"
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
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleStartFresh}
              title="Start a new conversation"
            >
              <RotateCcw className="size-3.5" />
              New Session
            </Button>
          </div>
        </DialogHeader>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-muted/10">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const isExpanded = expandedSources[msg.id];

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <Avatar className="size-8 shrink-0 bg-primary/15 text-primary border border-primary/20">
                    <AvatarFallback className="text-xs font-bold">AI</AvatarFallback>
                  </Avatar>
                )}

                <div className={`max-w-[85%] sm:max-w-[78%] space-y-2`}>
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-xs whitespace-pre-wrap ${
                      isUser
                        ? 'bg-primary text-primary-foreground font-medium rounded-tr-xs'
                        : 'bg-card border border-border text-foreground rounded-tl-xs'
                    }`}
                  >
                    {msg.content}
                  </div>

                  {/* Grounded Source Citations Accordion */}
                  {!isUser && msg.sources && msg.sources.length > 0 && (
                    <div className="border border-border/70 rounded-xl bg-card/60 p-2 text-xs">
                      <button
                        type="button"
                        onClick={() => toggleSource(msg.id)}
                        className="flex items-center justify-between w-full text-left font-medium text-muted-foreground hover:text-foreground py-1 px-1.5 rounded-lg transition-colors"
                      >
                        <span className="flex items-center gap-1.5 text-[11px]">
                          <BookOpen className="size-3.5 text-primary" />
                          Grounded in {msg.sources.length} note citation{msg.sources.length > 1 ? 's' : ''}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="size-3.5" />
                        ) : (
                          <ChevronDown className="size-3.5" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 space-y-1.5 pt-2 border-t border-border/50">
                          {msg.sources.map((src, i) => (
                            <div
                              key={src.chunkId || i}
                              className="p-2 rounded-lg bg-muted/40 text-[11px] text-muted-foreground leading-normal"
                            >
                              <div className="font-semibold text-foreground mb-1 flex items-center gap-1.5">
                                <span>Section {src.chunkIndex + 1}</span>
                                {src.pageNumber && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                    Page {src.pageNumber}
                                  </Badge>
                                )}
                              </div>
                              <p className="italic">"{src.snippet}"</p>
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
            <div className="flex gap-3 justify-start">
              <Avatar className="size-8 shrink-0 bg-primary/15 text-primary border border-primary/20">
                <AvatarFallback className="text-xs font-bold">AI</AvatarFallback>
              </Avatar>
              <div className="bg-card border border-border rounded-2xl rounded-tl-xs px-4 py-3 shadow-xs flex items-center gap-2">
                <Loader2 className="size-4 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground font-medium">
                  Reviewing lecture notes and reasoning...
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        {messages.length <= 2 && !loading && (
          <div className="px-4 py-2 border-t border-border/50 bg-card/60 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-semibold text-muted-foreground shrink-0 flex items-center gap-1">
              <Sparkles className="size-3 text-primary" />
              Suggestions:
            </span>
            {quickPrompts.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(prompt)}
                className="text-xs px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground hover:bg-primary/10 hover:text-primary transition-all whitespace-nowrap shrink-0 border border-border/60"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <div className="p-4 border-t border-border bg-card shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder={`Ask a question about ${note.title}...`}
              className="flex-1 bg-background text-sm"
              disabled={loading}
              autoFocus
            />
            <Button
              type="submit"
              disabled={!inputQuery.trim() || loading}
              className="gap-2 bg-primary text-primary-foreground shrink-0 shadow-xs px-4"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              <span className="hidden sm:inline">Ask</span>
            </Button>
          </form>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Answers are grounded in instructor lecture notes. Untrusted file content cannot alter tutor instructions.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

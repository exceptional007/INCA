import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  HelpCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  Award,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  BookOpen,
  History,
} from "lucide-react";
import type { LearningNote, QuizQuestion, QuizResult } from "@/types";
import api from "@/api/axios";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { TutorMarkdown } from "./TutorMarkdown";
interface QuizHistoryItem {
  id: string;
  score: number;
  totalQuestions: number;
  completedAt: string;
  passed: boolean;
  quiz: { title: string; difficulty: string };
}

interface AIQuizModalProps {
  note: LearningNote | null;
  isOpen: boolean;
  onClose: () => void;
  initialView?: "CONFIG" | "HISTORY";
}

export const AIQuizModal: React.FC<AIQuizModalProps> = ({
  note,
  isOpen,
  onClose,
  initialView = "CONFIG",
}) => {
  const [mode, setMode] = useState<"CONFIG" | "TAKING" | "RESULTS" | "HISTORY">(
    "CONFIG",
  );
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<"EASY" | "MEDIUM" | "HARD">(
    "MEDIUM",
  );
  const [questionType, setQuestionType] = useState<
    "MULTIPLE_CHOICE" | "TRUE_FALSE" | "MIXED"
  >("MULTIPLE_CHOICE");
  const [topic, setTopic] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Active quiz state
  const [quizId, setQuizId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const [history, setHistory] = useState<QuizHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const versionRef = useRef(0);

  const openResult = async (attemptId: string) => {
    if (!note || loading || historyLoading) return;
    const version = versionRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/notes/${note.id}/quiz/history/${attemptId}`);
      if (version !== versionRef.current) return;
      setQuizResult(res.data);
      setMode("RESULTS");
    } catch {
      if (version === versionRef.current)
        setError("Could not open this result. Please try again.");
    } finally {
      if (version === versionRef.current) setLoading(false);
    }
  };

  // Result state
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);

  const resetQuiz = useCallback(() => {
    setMode("CONFIG");
    setQuizId(null);
    setQuestions([]);
    setCurrentIndex(0);
    setAnswers({});
    setQuizResult(null);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!note || !isOpen) return;
    const version = ++versionRef.current;
    resetQuiz();
    setMode(initialView);
    setHistory([]);
    setHistoryError(null);
    setHistoryLoading(true);
    api
      .get(`/notes/${note.id}/quiz/history`)
      .then((res) => {
        if (version === versionRef.current) setHistory(res.data || []);
      })
      .catch(() => {
        if (version === versionRef.current)
          setHistoryError(
            "Could not load recent results. Your saved attempts are preserved.",
          );
      })
      .finally(() => {
        if (version === versionRef.current) setHistoryLoading(false);
      });
    return () => {
      versionRef.current++;
    };
  }, [note, isOpen, initialView, resetQuiz]);

  const handleGenerateQuiz = async () => {
    if (!note || loading) return;
    const version = versionRef.current;
    setLoading(true);
    setError(null);

    try {
      const response = await api.post(`/notes/${note.id}/quiz/generate`, {
        questionCount,
        difficulty,
        questionType,
        topic: topic.trim() || undefined,
      });

      if (version !== versionRef.current) return;
      const data = response.data;
      setQuizId(data.id);
      setQuestions(data.questions || []);
      setCurrentIndex(0);
      setAnswers({});
      setMode("TAKING");
    } catch (err: any) {
      if (version === versionRef.current)
        setError(
          err.response?.data?.message ||
            "Failed to generate quiz. Please verify the document is ready.",
        );
    } finally {
      if (version === versionRef.current) setLoading(false);
    }
  };

  const handleSelectOption = (questionId: string, option: string) => {
    // If option is e.g. "A) text", extract key or pass full option
    setAnswers((prev) => ({
      ...prev,
      [questionId]: option,
    }));
  };

  const handleSubmitQuiz = async () => {
    if (!quizId || !note || loading) return;
    const version = versionRef.current;
    setLoading(true);
    setError(null);

    try {
      const response = await api.post(
        `/notes/${note.id}/quiz/${quizId}/submit`,
        {
          answers,
        },
      );
      if (version !== versionRef.current) return;
      setQuizResult(response.data);
      setHistory((prev) => [
        {
          id: response.data.attemptId,
          score: response.data.score,
          totalQuestions: response.data.totalQuestions,
          passed: response.data.passed,
          completedAt: response.data.completedAt,
          quiz: { title: topic.trim() || note.title, difficulty },
        },
        ...prev,
      ]);
      setMode("RESULTS");
    } catch (err: any) {
      if (version === versionRef.current)
        setError(
          err.response?.data?.message || "Failed to submit quiz attempt.",
        );
    } finally {
      if (version === versionRef.current) setLoading(false);
    }
  };

  if (!note) return null;

  const currentQ = questions[currentIndex];
  const progressPercent =
    questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;
  const answeredCount = Object.keys(answers).length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100%-1rem)] max-w-3xl max-h-[92dvh] flex flex-col gap-0 p-0 overflow-hidden bg-background border-border">
        {/* Header */}
        <DialogHeader className="p-3 pr-10 sm:p-4 sm:pr-12 border-b border-border flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between shrink-0 bg-card">
          <div className="flex w-full min-w-0 max-w-full items-center gap-3 pr-4 sm:flex-1">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <HelpCircle className="size-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-sm sm:text-base font-semibold break-words text-foreground">
                {mode === "CONFIG" && "Generate Practice Quiz"}
                {mode === "HISTORY" && "Recent Quiz Results"}
                {mode === "TAKING" && `Practice Quiz: ${note.title}`}
                {mode === "RESULTS" && "Quiz Results & Review"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {note.subject.name} • Grounded in course notes
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading || historyLoading}
                  className="gap-1.5 text-xs"
                >
                  <History className="size-3.5" />
                  {historyLoading ? "Loading results..." : "Recent Results"}
                  {history.length > 0 && (
                    <span className="rounded-full bg-muted px-1.5">
                      {history.length}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-80 max-w-[calc(100vw-2rem)] max-h-80 overflow-y-auto"
              >
                <DropdownMenuLabel className="text-xs">
                  Quiz results for this note
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {history.length === 0 && (
                  <p className="p-3 text-xs text-muted-foreground">
                    Complete a quiz to save your first result.
                  </p>
                )}
                {history.map((item) => (
                  <DropdownMenuItem
                    key={item.id}
                    onSelect={() => void openResult(item.id)}
                    className="gap-3 py-3 items-start cursor-pointer"
                  >
                    <span
                      className={`rounded-lg px-2 py-1 font-bold text-xs ${item.passed ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}
                    >
                      {item.score}%
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">
                        {item.quiz.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {item.quiz.difficulty.toLowerCase()} ·{" "}
                        {item.totalQuestions} questions
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(item.completedAt).toLocaleString()}
                      </p>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {mode !== "CONFIG" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetQuiz}
                disabled={loading}
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="size-3.5" />
                New Quiz
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-6 bg-muted/10">
          {historyError && (
            <p
              role="alert"
              className="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-700"
            >
              {historyError}
            </p>
          )}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
              {error}
            </div>
          )}

          {mode === "HISTORY" && (
            <div className="max-w-xl mx-auto space-y-3">
              <div className="mb-4">
                <h3 className="font-semibold">Your quiz journey</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Scores, response summaries, and every question from this note.
                </p>
              </div>
              {historyLoading && (
                <p role="status" className="text-xs text-muted-foreground">
                  Loading saved results...
                </p>
              )}
              {!historyLoading && history.length === 0 && !historyError && (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No results yet. Complete a practice quiz to save your first
                  attempt.
                </div>
              )}
              {history.map((item) => (
                <button
                  key={item.id}
                  disabled={loading}
                  onClick={() => void openResult(item.id)}
                  className="w-full flex items-center gap-3 text-left p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50 transition-colors"
                >
                  <span
                    className={`text-lg font-bold ${item.passed ? "text-emerald-600" : "text-amber-600"}`}
                  >
                    {item.score}%
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {item.quiz.title}
                    </span>
                    <span className="block text-xs text-muted-foreground mt-1">
                      {item.totalQuestions} questions ·{" "}
                      {item.quiz.difficulty.toLowerCase()} ·{" "}
                      {new Date(item.completedAt).toLocaleDateString()}
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
              {loading && (
                <p role="status" className="flex gap-2 items-center text-xs">
                  <Loader2 className="size-4 animate-spin" />
                  Opening result...
                </p>
              )}
            </div>
          )}
          {/* Mode 1: CONFIGURATION */}
          {mode === "CONFIG" && (
            <div className="space-y-6 max-w-lg mx-auto py-2">
              <div className="text-center space-y-1 mb-6">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-1">
                  <Sparkles className="size-3.5" />
                  AI Question Generator
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  Test Your Mastery
                </h3>
                <p className="text-xs text-muted-foreground">
                  Generate objective questions grounded strictly in "
                  {note.title}"
                </p>
              </div>

              {/* Number of Questions */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">
                  Question Count
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[5, 8, 10].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setQuestionCount(count)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        questionCount === count
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-card text-foreground border-border hover:bg-muted"
                      }`}
                    >
                      {count} Questions
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty Level */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">
                  Difficulty Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["EASY", "MEDIUM", "HARD"] as const).map((diff) => (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => setDifficulty(diff)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all capitalize ${
                        difficulty === diff
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-card text-foreground border-border hover:bg-muted"
                      }`}
                    >
                      {diff.toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question Type */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">
                  Question Format
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setQuestionType("MULTIPLE_CHOICE")}
                    className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      questionType === "MULTIPLE_CHOICE"
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-card text-foreground border-border hover:bg-muted"
                    }`}
                  >
                    Multiple Choice (4 options)
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuestionType("TRUE_FALSE")}
                    className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      questionType === "TRUE_FALSE"
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-card text-foreground border-border hover:bg-muted"
                    }`}
                  >
                    True / False
                  </button>
                </div>
              </div>

              {/* Optional Topic Focus */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">
                  Specific Topic Focus{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Backpropagation, Memory Management..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <Button
                type="button"
                onClick={handleGenerateQuiz}
                disabled={loading || historyLoading}
                className="w-full py-5 text-sm font-semibold bg-primary text-primary-foreground shadow-xs gap-2 mt-4"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Generating Questions from Notes...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    Start Practice Quiz
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Mode 2: TAKING QUIZ */}
          {mode === "TAKING" && currentQ && (
            <div className="space-y-6 max-w-xl mx-auto py-2">
              {/* Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                  <span>
                    Question {currentIndex + 1} of {questions.length}
                  </span>
                  <span>
                    {answeredCount} of {questions.length} Answered
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Question Card */}
              <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
                <div className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {currentIndex + 1}
                  </span>
                  <h4 className="text-sm font-medium text-foreground leading-relaxed">
                    {currentQ.question}
                  </h4>
                </div>

                {/* Options List */}
                <div className="space-y-2 pt-2">
                  {currentQ.options.map((option, idx) => {
                    const isSelected = answers[currentQ.id] === option;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectOption(currentQ.id, option)}
                        className={`w-full text-left p-3.5 rounded-xl border text-xs leading-relaxed transition-all flex items-center justify-between ${
                          isSelected
                            ? "bg-primary/10 border-primary text-primary font-semibold shadow-xs"
                            : "bg-background border-border/80 text-foreground hover:bg-muted/40"
                        }`}
                      >
                        <span>{option}</span>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/30"
                          }`}
                        >
                          {isSelected && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Navigation controls */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentIndex((prev) => Math.max(0, prev - 1))
                  }
                  disabled={currentIndex === 0}
                  className="gap-1.5 text-xs"
                >
                  <ArrowLeft className="size-3.5" />
                  Previous
                </Button>

                {currentIndex < questions.length - 1 ? (
                  <Button
                    size="sm"
                    onClick={() =>
                      setCurrentIndex((prev) =>
                        Math.min(questions.length - 1, prev + 1),
                      )
                    }
                    className="gap-1.5 text-xs bg-primary text-primary-foreground"
                  >
                    Next
                    <ArrowRight className="size-3.5" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleSubmitQuiz}
                    disabled={loading}
                    className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                  >
                    {loading ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-3.5" />
                    )}
                    Submit Quiz
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Mode 3: RESULTS & EXPLANATIONS */}
          {mode === "RESULTS" && quizResult && (
            <div className="space-y-6 max-w-xl mx-auto py-2">
              {/* Score Summary Card */}
              <div className="p-6 rounded-2xl bg-card border border-border shadow-xs text-center space-y-3">
                <div
                  className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center shadow-xs ${
                    quizResult.passed
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-amber-500/10 text-amber-600"
                  }`}
                >
                  <Award className="size-8" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-foreground">
                    {quizResult.score}%
                  </h3>
                  <Badge
                    variant="outline"
                    className={`mt-1 font-semibold ${
                      quizResult.passed
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                  >
                    {quizResult.passed
                      ? "Concept Mastered (Passed)"
                      : "Review Recommended"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  You scored {quizResult.correctCount} out of{" "}
                  {quizResult.totalQuestions} questions correctly.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                <h4 className="text-sm font-semibold">Response summary</h4>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">
                    {quizResult.correctCount} correct
                  </Badge>
                  <Badge variant="outline">
                    {
                      quizResult.review.filter(
                        (item) => !item.isCorrect && item.selectedAnswer,
                      ).length
                    }{" "}
                    incorrect
                  </Badge>
                  <Badge variant="outline">
                    {
                      quizResult.review.filter((item) => !item.selectedAnswer)
                        .length
                    }{" "}
                    unanswered
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Completed {new Date(quizResult.completedAt).toLocaleString()}.{" "}
                  {quizResult.passed
                    ? "Great work. Review the explanations to reinforce what you learned."
                    : "Focus on the questions below to prepare for your next attempt."}
                </p>
              </div>
              {/* Question-by-Question Review */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
                  Detailed Explanations & Citations
                </h4>

                {quizResult.review.map((item, index) => (
                  <div
                    key={item.id || index}
                    className="p-4 rounded-xl bg-card border border-border space-y-2.5 text-xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        {item.isCorrect ? (
                          <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="size-4 text-destructive shrink-0 mt-0.5" />
                        )}
                        <span className="font-semibold text-foreground">
                          {index + 1}. {item.question}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] shrink-0 ${
                          item.isCorrect
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-destructive/10 text-destructive border-destructive/20"
                        }`}
                      >
                        {item.isCorrect ? "Correct" : "Incorrect"}
                      </Badge>
                    </div>

                    <div className="pl-6 space-y-1.5 text-muted-foreground">
                      <ul className="space-y-1 pb-2">
                        {item.options.map((option) => (
                          <li
                            key={option}
                            className={`rounded-md border px-2 py-1.5 ${option === item.correctAnswer ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700" : option === item.selectedAnswer ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-border"}`}
                          >
                            {option}
                            {option === item.correctAnswer
                              ? " ✓ Correct answer"
                              : option === item.selectedAnswer
                                ? " · Your answer"
                                : ""}
                          </li>
                        ))}
                      </ul>
                      <div>
                        Your Answer:{" "}
                        <span
                          className={
                            item.isCorrect
                              ? "text-emerald-700 font-semibold"
                              : "text-destructive font-semibold"
                          }
                        >
                          {item.selectedAnswer || "Not Answered"}
                        </span>
                      </div>
                      {!item.isCorrect && (
                        <div>
                          Correct Answer:{" "}
                          <span className="text-emerald-700 font-semibold">
                            {item.correctAnswer}
                          </span>
                        </div>
                      )}
                      <div className="p-2.5 rounded-lg bg-muted/40 text-foreground leading-relaxed mt-2 border border-border/50">
                        <span className="font-semibold text-primary block mb-0.5">
                          Explanation:
                        </span>
                        <TutorMarkdown content={item.explanation} />
                        {item.sourceSnippet && (
                          <p className="text-[11px] text-muted-foreground italic mt-1.5 flex items-start gap-1">
                            <BookOpen className="size-3 text-muted-foreground shrink-0 mt-0.5" />
                            "{item.sourceSnippet}"
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={resetQuiz}
                  disabled={loading}
                  className="flex-1 gap-2 bg-primary text-primary-foreground"
                >
                  <RotateCcw className="size-4" />
                  Generate Another Quiz
                </Button>
                <Button variant="outline" onClick={onClose} className="flex-1">
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

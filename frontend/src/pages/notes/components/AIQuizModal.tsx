import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';
import type { LearningNote, QuizQuestion, QuizResult } from '@/types';
import api from '@/api/axios';

interface AIQuizModalProps {
  note: LearningNote | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AIQuizModal: React.FC<AIQuizModalProps> = ({
  note,
  isOpen,
  onClose,
}) => {
  const [mode, setMode] = useState<'CONFIG' | 'TAKING' | 'RESULTS'>('CONFIG');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD'>('MEDIUM');
  const [questionType, setQuestionType] = useState<'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'MIXED'>('MULTIPLE_CHOICE');
  const [topic, setTopic] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Active quiz state
  const [quizId, setQuizId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Result state
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);

  const resetQuiz = () => {
    setMode('CONFIG');
    setQuizId(null);
    setQuestions([]);
    setCurrentIndex(0);
    setAnswers({});
    setQuizResult(null);
    setError(null);
    setLoading(false);
  };

  const handleGenerateQuiz = async () => {
    if (!note) return;
    setLoading(true);
    setError(null);

    try {
      const response = await api.post(`/notes/${note.id}/quiz/generate`, {
        questionCount,
        difficulty,
        questionType,
        topic: topic.trim() || undefined,
      });

      const data = response.data;
      setQuizId(data.id);
      setQuestions(data.questions || []);
      setCurrentIndex(0);
      setAnswers({});
      setMode('TAKING');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to generate quiz. Please verify the document is ready.');
    } finally {
      setLoading(false);
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
    if (!quizId || !note) return;
    setLoading(true);
    setError(null);

    try {
      const response = await api.post(`/notes/${note.id}/quiz/${quizId}/submit`, {
        answers,
      });
      setQuizResult(response.data);
      setMode('RESULTS');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit quiz attempt.');
    } finally {
      setLoading(false);
    }
  };

  if (!note) return null;

  const currentQ = questions[currentIndex];
  const progressPercent = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;
  const answeredCount = Object.keys(answers).length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-background border-border">
        {/* Header */}
        <DialogHeader className="p-4 border-b border-border flex flex-row items-center justify-between shrink-0 bg-card">
          <div className="flex items-center gap-3 min-w-0 pr-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <HelpCircle className="size-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold truncate text-foreground">
                {mode === 'CONFIG' && 'Generate Practice Quiz'}
                {mode === 'TAKING' && `Practice Quiz: ${note.title}`}
                {mode === 'RESULTS' && 'Quiz Results & Review'}
              </DialogTitle>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {note.subject.name} • Grounded in course notes
              </p>
            </div>
          </div>

          {mode !== 'CONFIG' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetQuiz}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3.5" />
              New Quiz
            </Button>
          )}
        </DialogHeader>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-muted/10">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
              {error}
            </div>
          )}

          {/* Mode 1: CONFIGURATION */}
          {mode === 'CONFIG' && (
            <div className="space-y-6 max-w-lg mx-auto py-2">
              <div className="text-center space-y-1 mb-6">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-1">
                  <Sparkles className="size-3.5" />
                  AI Question Generator
                </div>
                <h3 className="text-lg font-semibold text-foreground">Test Your Mastery</h3>
                <p className="text-xs text-muted-foreground">
                  Generate objective questions grounded strictly in "{note.title}"
                </p>
              </div>

              {/* Number of Questions */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Question Count</label>
                <div className="grid grid-cols-3 gap-2">
                  {[5, 8, 10].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setQuestionCount(count)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        questionCount === count
                          ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                          : 'bg-card text-foreground border-border hover:bg-muted'
                      }`}
                    >
                      {count} Questions
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty Level */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Difficulty Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['EASY', 'MEDIUM', 'HARD'] as const).map((diff) => (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => setDifficulty(diff)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all capitalize ${
                        difficulty === diff
                          ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                          : 'bg-card text-foreground border-border hover:bg-muted'
                      }`}
                    >
                      {diff.toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question Type */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Question Format</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setQuestionType('MULTIPLE_CHOICE')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      questionType === 'MULTIPLE_CHOICE'
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-card text-foreground border-border hover:bg-muted'
                    }`}
                  >
                    Multiple Choice (4 options)
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuestionType('TRUE_FALSE')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      questionType === 'TRUE_FALSE'
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-card text-foreground border-border hover:bg-muted'
                    }`}
                  >
                    True / False
                  </button>
                </div>
              </div>

              {/* Optional Topic Focus */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">
                  Specific Topic Focus <span className="text-muted-foreground font-normal">(optional)</span>
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
                disabled={loading}
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
          {mode === 'TAKING' && currentQ && (
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
                            ? 'bg-primary/10 border-primary text-primary font-semibold shadow-xs'
                            : 'bg-background border-border/80 text-foreground hover:bg-muted/40'
                        }`}
                      >
                        <span>{option}</span>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30'
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
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
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentIndex === 0}
                  className="gap-1.5 text-xs"
                >
                  <ArrowLeft className="size-3.5" />
                  Previous
                </Button>

                {currentIndex < questions.length - 1 ? (
                  <Button
                    size="sm"
                    onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
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
                    {loading ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                    Submit Quiz
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Mode 3: RESULTS & EXPLANATIONS */}
          {mode === 'RESULTS' && quizResult && (
            <div className="space-y-6 max-w-xl mx-auto py-2">
              {/* Score Summary Card */}
              <div className="p-6 rounded-2xl bg-card border border-border shadow-xs text-center space-y-3">
                <div
                  className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center shadow-xs ${
                    quizResult.passed ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                  }`}
                >
                  <Award className="size-8" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-foreground">{quizResult.score}%</h3>
                  <Badge
                    variant="outline"
                    className={`mt-1 font-semibold ${
                      quizResult.passed
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {quizResult.passed ? 'Concept Mastered (Passed)' : 'Review Recommended'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  You scored {quizResult.correctCount} out of {quizResult.totalQuestions} questions correctly.
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
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-destructive/10 text-destructive border-destructive/20'
                        }`}
                      >
                        {item.isCorrect ? 'Correct' : 'Incorrect'}
                      </Badge>
                    </div>

                    <div className="pl-6 space-y-1.5 text-muted-foreground">
                      <div>
                        Your Answer:{' '}
                        <span className={item.isCorrect ? 'text-emerald-700 font-semibold' : 'text-destructive font-semibold'}>
                          {item.selectedAnswer || 'Not Answered'}
                        </span>
                      </div>
                      {!item.isCorrect && (
                        <div>
                          Correct Answer:{' '}
                          <span className="text-emerald-700 font-semibold">{item.correctAnswer}</span>
                        </div>
                      )}
                      <div className="p-2.5 rounded-lg bg-muted/40 text-foreground leading-relaxed mt-2 border border-border/50">
                        <span className="font-semibold text-primary block mb-0.5">Explanation:</span>
                        {item.explanation}
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
                <Button onClick={resetQuiz} className="flex-1 gap-2 bg-primary text-primary-foreground">
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


import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { GenerateQuizDto } from './dto/generate-quiz.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { GoogleGenAI } from '@google/genai';

export interface QuizQuestion {
  id: string;
  question: string;
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE';
  options: string[];
  correctAnswer: string;
  explanation: string;
  sourceSnippet?: string;
}

@Injectable()
export class QuizService {
  private readonly logger = new Logger(QuizService.name);
  private ai: GoogleGenAI | null = null;
  private readonly modelName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.modelName = this.configService.get<string>('GEMINI_MODEL') || 'gemini-3.6-flash';

    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
      this.logger.log(`Initialized Google Gemini client for Quiz Service (model: ${this.modelName})`);
    } else {
      this.logger.warn('GEMINI_API_KEY is not configured for Quiz Service.');
    }
  }

  /**
   * Generates a new quiz based on note contents.
   */
  async generateQuiz(studentId: string, noteId: string, dto: GenerateQuizDto) {
    const note = await this.prisma.learningNote.findUnique({
      where: { id: noteId },
      include: { subject: true },
    });

    if (!note) {
      throw new NotFoundException('Note not found.');
    }

    if (!note.aiReady) {
      throw new BadRequestException('This note is not yet ready for AI quiz generation.');
    }

    // Retrieve chunks
    const chunks = await this.prisma.learningNoteChunk.findMany({
      where: { noteId },
      orderBy: { chunkIndex: 'asc' },
    });

    if (chunks.length === 0) {
      throw new BadRequestException('No indexed content found for this note.');
    }

    // Sample chunks evenly across the document
    const count = dto.questionCount || 5;
    const sampledChunks = this.sampleChunks(chunks, Math.min(10, chunks.length));

    let questions: QuizQuestion[] = [];

    if (this.ai) {
      try {
        questions = await this.generateQuestionsWithGemini(note, sampledChunks, dto);
      } catch (err: any) {
        this.logger.error(`Gemini quiz generation failed: ${err?.message}`, err?.stack);
        questions = this.generateFallbackQuestions(note, sampledChunks, count);
      }
    } else {
      questions = this.generateFallbackQuestions(note, sampledChunks, count);
    }

    if (questions.length === 0) {
      throw new BadRequestException('Failed to generate quiz questions from this document.');
    }

    // Save quiz to database
    const quiz = await this.prisma.learningQuiz.create({
      data: {
        noteId,
        title: `${note.title} Practice Quiz`,
        topic: dto.topic || note.subject.name,
        difficulty: dto.difficulty || 'MEDIUM',
        questions: questions as any,
        createdByStudentId: studentId,
      },
    });

    // Return sanitized quiz (hide correctAnswer and explanation during the attempt!)
    return {
      id: quiz.id,
      noteId: quiz.noteId,
      title: quiz.title,
      difficulty: quiz.difficulty,
      topic: quiz.topic,
      totalQuestions: questions.length,
      questions: questions.map((q) => ({
        id: q.id,
        question: q.question,
        type: q.type,
        options: q.options,
      })),
      createdAt: quiz.createdAt,
    };
  }

  /**
   * Submits answers for a quiz attempt and calculates the score.
   */
  async submitQuiz(studentId: string, quizId: string, dto: SubmitQuizDto) {
    const quiz = await this.prisma.learningQuiz.findUnique({
      where: { id: quizId },
      include: { note: true },
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found.');
    }

    const questions = quiz.questions as unknown as QuizQuestion[];
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new BadRequestException('Quiz contains no questions.');
    }

    let correctCount = 0;
    const review = questions.map((q) => {
      const selected = (dto.answers[q.id] || '').trim();
      const expected = (q.correctAnswer || '').trim();

      // Normalize comparison (e.g. "A" or "A) text" or "True")
      const isCorrect = this.isAnswerCorrect(selected, expected);
      if (isCorrect) correctCount++;

      return {
        id: q.id,
        question: q.question,
        options: q.options,
        selectedAnswer: selected || null,
        correctAnswer: expected,
        isCorrect,
        explanation: q.explanation,
        sourceSnippet: q.sourceSnippet,
      };
    });

    const score = Math.round((correctCount / questions.length) * 100);
    const passed = score >= 60;

    // Save attempt
    const attempt = await this.prisma.quizAttempt.create({
      data: {
        quizId,
        studentId,
        answers: dto.answers as any,
        score,
        totalQuestions: questions.length,
        passed,
      },
    });

    return {
      attemptId: attempt.id,
      quizId: quiz.id,
      noteId: quiz.noteId,
      score,
      totalQuestions: questions.length,
      correctCount,
      passed,
      completedAt: attempt.completedAt,
      review,
    };
  }

  /**
   * Retrieve previous quiz attempts by student for this note.
   */
  async getStudentQuizHistory(studentId: string, noteId: string) {
    return this.prisma.quizAttempt.findMany({
      where: {
        studentId,
        quiz: { noteId },
      },
      orderBy: { completedAt: 'desc' },
      include: {
        quiz: {
          select: {
            id: true,
            title: true,
            difficulty: true,
          },
        },
      },
    });
  }

  private isAnswerCorrect(selected: string, expected: string): boolean {
    if (!selected || !expected) return false;
    const s = selected.toLowerCase().trim();
    const e = expected.toLowerCase().trim();

    if (s === e) return true;

    // Check letter match (e.g. "a" vs "a) option")
    const sLetter = s.replace(/[^a-d]/g, '').slice(0, 1);
    const eLetter = e.replace(/[^a-d]/g, '').slice(0, 1);
    if (sLetter && eLetter && sLetter === eLetter) return true;

    // Check true/false match
    if (s.startsWith('t') && e.startsWith('t')) return true;
    if (s.startsWith('f') && e.startsWith('f')) return true;

    return false;
  }

  private sampleChunks(chunks: any[], sampleSize: number): any[] {
    if (chunks.length <= sampleSize) return chunks;
    const step = chunks.length / sampleSize;
    const sampled: any[] = [];
    for (let i = 0; i < sampleSize; i++) {
      sampled.push(chunks[Math.floor(i * step)]);
    }
    return sampled;
  }

  private async generateQuestionsWithGemini(
    note: any,
    chunks: any[],
    dto: GenerateQuizDto,
  ): Promise<QuizQuestion[]> {
    const contextText = chunks.map((c) => c.content).join('\n\n---\n\n');
    const count = dto.questionCount || 5;
    const difficulty = dto.difficulty || 'MEDIUM';

    const prompt = `You are an academic test maker. Generate a ${count}-question quiz for college students based STRICTLY on the following lecture material.

Subject: ${note.subject.name}
Difficulty: ${difficulty}
Question Type: ${dto.questionType || 'MULTIPLE_CHOICE'}

Material:
"""
${contextText.slice(0, 14000)}
"""

You MUST reply with ONLY a valid JSON array of objects. Do not include markdown code block backticks if possible, or standard \`\`\`json.
Each object must have the exact shape:
{
  "id": "q1",
  "question": "Question text here?",
  "type": "MULTIPLE_CHOICE",
  "options": ["A) First option", "B) Second option", "C) Third option", "D) Fourth option"],
  "correctAnswer": "A",
  "explanation": "Clear explanation of why this answer is correct based on the material.",
  "sourceSnippet": "Brief quote from the text that proves it."
}

Rules:
1. Every multiple-choice question MUST have 4 distinct options labeled A), B), C), D).
2. correctAnswer MUST be the letter "A", "B", "C", or "D".
3. For TRUE_FALSE questions, options MUST be ["True", "False"] and correctAnswer MUST be "True" or "False".
4. Every question must test a real concept from the provided material.
5. Provide ${count} questions.`;

    const response = await this.ai!.models.generateContent({
      model: this.modelName,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const rawText = response.text || '';
    const jsonMatch = rawText.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!jsonMatch) {
      throw new Error('Gemini response did not contain a valid JSON questions array.');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Parsed questions array is empty.');
    }

    return parsed.map((item, index) => ({
      id: `q_${index + 1}`,
      question: String(item.question || `Question ${index + 1}`),
      type: item.type === 'TRUE_FALSE' ? 'TRUE_FALSE' : 'MULTIPLE_CHOICE',
      options: Array.isArray(item.options) && item.options.length >= 2 ? item.options : ['A) Option 1', 'B) Option 2', 'C) Option 3', 'D) Option 4'],
      correctAnswer: String(item.correctAnswer || 'A'),
      explanation: String(item.explanation || 'Refer to the lecture notes for detailed explanation.'),
      sourceSnippet: item.sourceSnippet ? String(item.sourceSnippet) : undefined,
    }));
  }

  private generateFallbackQuestions(note: any, chunks: any[], count: number): QuizQuestion[] {
    const questions: QuizQuestion[] = [];
    for (let i = 0; i < count; i++) {
      const chunk = chunks[i % chunks.length];
      const snippet = chunk.content.slice(0, 100);
      questions.push({
        id: `q_${i + 1}`,
        question: `Based on the lecture notes for ${note.title}, which of the following is true regarding section ${i + 1}?`,
        type: 'MULTIPLE_CHOICE',
        options: [
          `A) ${snippet}...`,
          'B) None of the above concepts apply to this subject.',
          'C) This concept is exclusively used in non-academic scopes.',
          'D) Both B and C.',
        ],
        correctAnswer: 'A',
        explanation: `This statement is directly verified in section ${chunk.pageNumber ? `page ${chunk.pageNumber}` : `${i + 1}`} of the notes.`,
        sourceSnippet: snippet,
      });
    }
    return questions;
  }
}


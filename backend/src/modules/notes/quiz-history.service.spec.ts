import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QuizService } from './quiz.service';

describe('saved quiz result review', () => {
  const questions = [
    { id: 'one', question: 'Which resource?', type: 'MULTIPLE_CHOICE', options: ['A) Heat', 'B) Wind'], correctAnswer: 'A) Heat', explanation: 'Heat is stored in the Earth.', sourceSnippet: 'Geothermal heat' },
    { id: 'two', question: 'True or false?', type: 'TRUE_FALSE', options: ['True', 'False'], correctAnswer: 'True', explanation: 'See the notes.' },
  ];
  it('restores questions, options, answers, explanations and the saved score', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'attempt', quizId: 'quiz', answers: { one: 'A) Heat' }, score: 50, totalQuestions: 2, passed: false, completedAt: new Date('2026-10-31'), quiz: { questions } });
    const service = new QuizService({ quizAttempt: { findFirst } } as any, { get: () => undefined } as unknown as ConfigService);
    const result = await service.getStudentQuizAttempt('student', 'note', 'attempt');
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'attempt', studentId: 'student', quiz: { noteId: 'note' } }, include: { quiz: true } });
    expect(result.score).toBe(50);
    expect(result.correctCount).toBe(1);
    expect(result.review[0]).toMatchObject({ question: 'Which resource?', options: questions[0].options, selectedAnswer: 'A) Heat', isCorrect: true, explanation: questions[0].explanation, sourceSnippet: 'Geothermal heat' });
    expect(result.review[1]).toMatchObject({ selectedAnswer: null, isCorrect: false });
  });
  it('does not expose an attempt belonging to another student or note', async () => {
    const service = new QuizService({ quizAttempt: { findFirst: jest.fn().mockResolvedValue(null) } } as any, { get: () => undefined } as unknown as ConfigService);
    await expect(service.getStudentQuizAttempt('other-student', 'other-note', 'attempt')).rejects.toBeInstanceOf(NotFoundException);
  });
});

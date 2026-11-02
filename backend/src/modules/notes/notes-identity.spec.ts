import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';

describe('Notes and tutor identities belong to the caller', () => {
  const db = {
    student: { findUnique: jest.fn(), findFirst: jest.fn() },
    faculty: { findUnique: jest.fn(), findFirst: jest.fn() },
    learningNote: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  };
  const tutor = {
    askTutor: jest.fn(),
    listConversations: jest.fn(),
    getConversation: jest.fn(),
  };
  const quiz = {
    generateQuiz: jest.fn(),
    submitQuiz: jest.fn(),
    getStudentQuizHistory: jest.fn(),
    getStudentQuizAttempt: jest.fn(),
  };
  let notes: NotesService, controller: NotesController;
  beforeEach(() => {
    jest.resetAllMocks();
    db.student.findUnique.mockResolvedValue(null);
    db.faculty.findUnique.mockResolvedValue(null);
    db.student.findFirst.mockResolvedValue({ id: 'unrelated-student' });
    db.faculty.findFirst.mockResolvedValue({ id: 'unrelated-faculty' });
    notes = new NotesService(db as any, {} as any, {} as any);
    controller = new NotesController(notes, tutor as any, quiz as any);
  });
  const actions = [
    (c: NotesController) =>
      c.askTutor({ user: { id: 'caller' } }, 'note', {} as any),
    (c: NotesController) =>
      c.listTutorConversations({ user: { id: 'caller' } }, 'note'),
    (c: NotesController) =>
      c.getTutorConversation({ user: { id: 'caller' } }, 'conversation'),
    (c: NotesController) =>
      c.generateQuiz({ user: { id: 'caller' } }, 'note', {} as any),
    (c: NotesController) =>
      c.submitQuiz({ user: { id: 'caller' } }, 'quiz', {} as any),
    (c: NotesController) =>
      c.getQuizHistory({ user: { id: 'caller' } }, 'note'),
    (c: NotesController) =>
      c.getQuizAttempt({ user: { id: 'caller' } }, 'note', 'attempt'),
  ];
  it.each(actions.map((action, index) => ({ action, index })))(
    'blocks identity fallback on endpoint $index',
    async ({ action }) => {
      await expect(action(controller)).rejects.toMatchObject({ status: 403 });
      expect(db.student.findUnique).toHaveBeenCalledWith({
        where: { userId: 'caller' },
      });
      expect(db.student.findFirst).not.toHaveBeenCalled();
      for (const service of [tutor, quiz])
        for (const method of Object.values(service))
          expect(method).not.toHaveBeenCalled();
    },
  );
  it('uses the actual student profile when it exists', async () => {
    db.student.findUnique.mockResolvedValue({ id: 'own-student' });
    await controller.getQuizHistory({ user: { id: 'caller' } }, 'note');
    expect(quiz.getStudentQuizHistory).toHaveBeenCalledWith(
      'own-student',
      'note',
    );
  });
  it.each(['ADMIN', 'SUPER_ADMIN', 'FACULTY'])(
    'requires the actual faculty profile for %s note creation',
    async (role) => {
      await expect(
        notes.createNote('caller', role, undefined, {} as any),
      ).rejects.toMatchObject({ status: 403 });
      expect(db.faculty.findFirst).not.toHaveBeenCalled();
      expect(db.learningNote.create).not.toHaveBeenCalled();
    },
  );
  it('requires an actual faculty profile for creation context', async () => {
    await expect(
      notes.getFacultyContext('caller', 'ADMIN'),
    ).rejects.toMatchObject({ status: 403 });
    expect(db.faculty.findFirst).not.toHaveBeenCalled();
  });
  it('retains admin library management without impersonating faculty', async () => {
    db.learningNote.findMany.mockResolvedValue([]);
    db.learningNote.count.mockResolvedValue(0);
    db.learningNote.groupBy.mockResolvedValue([]);
    const result = await notes.listFacultyNotes('caller', 'ADMIN', {});
    expect(result.items).toEqual([]);
    expect(db.faculty.findFirst).not.toHaveBeenCalled();
    expect(db.learningNote.findMany.mock.calls[0][0].where).toEqual({});
  });
});

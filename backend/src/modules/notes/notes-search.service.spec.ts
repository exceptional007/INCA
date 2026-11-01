import { NotesService } from './notes.service';

describe('notes subject-code search', () => {
  it.each(['BOE074', '  boe 074  ', 'BoE-074', '074', 'boe'])(
    'finds subject code BOE 074 for query %s in both libraries', async (search) => {
      const findMany = jest.fn().mockImplementation(({ where }) => Promise.resolve(
        where.OR.some((filter: any) => {
          const code = filter.subject?.code;
          return code?.mode === 'insensitive' && 'boe 074'.includes(code.contains.toLowerCase());
        }) ? [{ id: 'matching-note' }] : [],
      ));
      const count = jest.fn().mockResolvedValue(1);
      const db = {
        faculty: { findUnique: jest.fn().mockResolvedValue({ id: 'faculty' }) },
        student: { findUnique: jest.fn().mockResolvedValue({ section: { semester: { programId: 'program' } } }) },
        learningNote: { findMany, count, groupBy: jest.fn().mockResolvedValue([]) },
      };
      const service = new NotesService(db as any, {} as any, {} as any);
      const faculty = await service.listFacultyNotes('user', 'FACULTY', { search });
      expect(faculty.items).toEqual([{ id: 'matching-note' }]);
      expect(findMany.mock.calls[0][0].where.facultyId).toBe('faculty');
      expect(count.mock.calls[0][0].where).toEqual(findMany.mock.calls[0][0].where);
      const student = await service.listPublishedNotesForStudent('user', 'STUDENT', { search });
      expect(student.items).toEqual([{ id: 'matching-note' }]);
      expect(findMany.mock.calls[1][0].where).toMatchObject({
        status: 'PUBLISHED', programs: { some: { programId: { in: ['program'] } } },
      });
      expect(count.mock.calls[1][0].where).toEqual(findMany.mock.calls[1][0].where);
    },
  );
});

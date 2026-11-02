import { RecordRepository } from './record.repository';

describe('Attendance record audit-user privacy', () => {
  const storedUser = {
    id: 'editor-id',
    email: 'editor@bit.ac.in',
    isActive: true,
    password: 'private-password-hash',
    mustChangePassword: true,
    lastLoginAt: new Date('2026-10-31T00:00:00Z'),
    roleId: 'private-role-id',
  };

  it.each(['findBySession', 'findById'] as const)(
    '%s requests only public editor fields while retaining attendance details',
    async (method) => {
      // Simulate Prisma projection against a stored user containing private fields.
      // An unrestricted editedBy include deliberately returns the complete user.
      const loadRecord = (query: any) => {
        const editorQuery = query.include.audits.include.editedBy;
        const editedBy =
          editorQuery === true
            ? storedUser
            : Object.fromEntries(
                Object.keys(editorQuery.select)
                  .filter((key) => editorQuery.select[key])
                  .map((key) => [
                    key,
                    storedUser[key as keyof typeof storedUser],
                  ]),
              );
        return {
          id: 'record-id',
          status: 'PRESENT',
          student: { id: 'student-id', firstName: 'Student' },
          audits: [
            {
              id: 'audit-id',
              oldStatus: 'ABSENT',
              newStatus: 'PRESENT',
              reason: 'Correction',
              editedBy,
            },
          ],
        };
      };
      const prisma = {
        attendanceRecord: {
          findMany: jest.fn(async (query) => [loadRecord(query)]),
          findUnique: jest.fn(async (query) => loadRecord(query)),
        },
      };
      const repository = new RecordRepository(prisma as any);
      const result = await repository[method]('requested-id');
      const record = Array.isArray(result) ? result[0] : result;
      const query =
        method === 'findBySession'
          ? prisma.attendanceRecord.findMany.mock.calls[0][0]
          : prisma.attendanceRecord.findUnique.mock.calls[0][0];

      expect(query.include.audits.include.editedBy).toEqual({
        select: { id: true, email: true, isActive: true },
      });
      expect(record).toMatchObject({
        id: 'record-id',
        status: 'PRESENT',
        student: { id: 'student-id' },
        audits: [
          { oldStatus: 'ABSENT', newStatus: 'PRESENT', reason: 'Correction' },
        ],
      });
      expect(record.audits[0].editedBy).toEqual({
        id: storedUser.id,
        email: storedUser.email,
        isActive: true,
      });
      expect(JSON.stringify(result)).not.toContain(storedUser.password);
      expect(record.audits[0].editedBy).not.toHaveProperty(
        'mustChangePassword',
      );
      expect(record.audits[0].editedBy).not.toHaveProperty('lastLoginAt');
      expect(record.audits[0].editedBy).not.toHaveProperty('roleId');
    },
  );
});

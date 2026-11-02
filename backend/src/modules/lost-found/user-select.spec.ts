import { Prisma } from '@prisma/client';
import { USER_SAFE_SELECT } from './lost-found.service';
import { LostFoundContributionService } from './lost-found-contribution.service';

describe('Lost & Found user selection', () => {
  it('selects only fields and relations supported by the generated Prisma schema', () => {
    const models = new Map(Prisma.dmmf.datamodel.models.map(model => [model.name, model]));
    const validate = (modelName: string, select: Record<string, any>) => {
      const model = models.get(modelName)!;
      for (const [name, selection] of Object.entries(select)) {
        const field = model.fields.find(field => field.name === name);
        expect(field).toBeDefined();
        if (selection?.select) validate(field!.type, selection.select);
      }
    };
    validate('User', USER_SAFE_SELECT);
  });

  it('resolves the leaderboard program through section and semester', async () => {
    const prisma = {
      lostFoundContribution: { groupBy: jest.fn().mockResolvedValue([{ userId: 'student', _sum: { points: 10 } }]) },
      user: { findMany: jest.fn().mockResolvedValue([{
        id: 'student', email: 'student@example.com', role: { code: 'STUDENT' },
        student: { firstName: 'Test', lastName: 'Student', section: { semester: { program: { code: 'DS', name: 'Data Science' } } } },
      }]) },
    };
    const service = new LostFoundContributionService(prisma as any);
    const result = await service.getLeaderboard();
    expect(result[0]).toMatchObject({ name: 'Test Student', department: 'DS', points: 10 });
  });
});

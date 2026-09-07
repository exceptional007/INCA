import { PrismaClient } from '@prisma/client';
import { ScheduleRepository } from './src/modules/scheduling/schedules/repositories/schedule.repository';
import { SchedulesService } from './src/modules/scheduling/schedules/schedules.service';
import { TemplateRepository } from './src/modules/scheduling/templates/repositories/template.repository';

const prisma = new PrismaClient();

async function test() {
  const schedRepo = new ScheduleRepository(prisma as any);
  const tempRepo = new TemplateRepository(prisma as any);
  const schedService = new SchedulesService(schedRepo, tempRepo);

  const students = await prisma.student.findMany({ include: { user: true } });
  for (const st of students) {
    console.log('=== Student:', st.firstName, st.user?.email, '===');
    const res = await schedService.getTodaySchedules(st.userId, 'STUDENT');
    console.log('Schedules count returned:', res.data.length);
    for (const s of res.data) {
      console.log('  -', s.template?.startTime, '-', s.template?.endTime, '|', s.template?.subject?.name, '| Sec:', s.template?.section?.name);
    }
  }
}

test().finally(() => prisma.$disconnect());

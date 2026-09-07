import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  // Find all sections starting with C
  const cSections = await prisma.section.findMany({
    where: { name: { startsWith: 'C' } }
  });
  const cSectionIds = cSections.map(s => s.id);
  console.log('C section IDs:', cSectionIds, cSections.map(s => s.name));

  const schedules = await prisma.schedule.findMany({
    where: {
      lectureDate: new Date('2026-09-06'),
      template: {
        sectionId: { in: cSectionIds }
      }
    },
    include: {
      template: {
        include: { subject: true, faculty: true, room: true, section: true }
      }
    }
  });

  console.log('Total schedules for C sections on 2026-09-06:', schedules.length);
  for (const s of schedules) {
    console.log(`- ${s.template?.startTime} - ${s.template?.endTime} | ${s.template?.subject?.name} (${s.template?.subject?.code}) | Sec: ${s.template?.section?.name} | Room: ${s.template?.room?.name} | Faculty: ${s.template?.faculty?.firstName}`);
  }
}

check().finally(() => prisma.$disconnect());

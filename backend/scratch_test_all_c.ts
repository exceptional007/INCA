import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  const cSections = await prisma.section.findMany({
    where: {
      OR: [
        { name: { equals: 'C', mode: 'insensitive' } },
        { name: { startsWith: 'C', mode: 'insensitive' } },
        { name: { contains: 'C', mode: 'insensitive' } },
      ],
      isActive: true,
    }
  });
  const secIds = cSections.map(s => s.id);
  console.log('Matched sections:', cSections.map(s => s.name));

  const schedules = await prisma.schedule.findMany({
    where: {
      lectureDate: new Date('2026-09-06'),
      template: {
        sectionId: { in: secIds }
      }
    },
    include: {
      template: {
        include: { subject: true, faculty: true, room: true, section: true }
      }
    }
  });

  console.log('Total schedules:', schedules.length);
  for (const s of schedules) {
    console.log(`- ${s.template?.startTime} - ${s.template?.endTime} | ${s.template?.subject?.name} (${s.template?.subject?.code}) | Sec: ${s.template?.section?.name} | Room: ${s.template?.room?.name} | Faculty: ${s.template?.faculty?.firstName} ${s.template?.faculty?.lastName || ''}`);
  }
}

test().finally(() => prisma.$disconnect());

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const dates = await prisma.schedule.groupBy({
    by: ['lectureDate'],
    _count: true,
    orderBy: { lectureDate: 'asc' }
  });
  console.log('Unique lectureDates in Schedule table:');
  for (const d of dates) {
    console.log(d.lectureDate.toISOString(), 'Count:', d._count);
  }
}

check().finally(() => prisma.$disconnect());

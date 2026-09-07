import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const templates = await prisma.scheduleTemplate.findMany({
    include: { section: true, subject: true }
  });
  console.log('Total templates:', templates.length);
  for (const t of templates) {
    console.log('Template:', t.id, 'DayOfWeek:', t.dayOfWeek, 'Start:', t.startTime, 'End:', t.endTime, 'Sec:', t.section.name, 'Sub:', t.subject.name);
  }

  // Check what getStudentSectionIdForUser returned for all students
  const students = await prisma.student.findMany({ include: { user: true } });
  for (const st of students) {
    console.log('Student:', st.firstName, st.user?.email, 'collegeId:', st.collegeId);
  }
}

check().finally(() => prisma.$disconnect());

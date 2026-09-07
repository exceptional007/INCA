import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const schedules = await prisma.schedule.findMany({
    include: {
      template: {
        include: { subject: true, faculty: true, room: true, section: true }
      }
    }
  });
  console.log('Total schedules in Schedule table:', schedules.length);
  for (const s of schedules) {
    console.log('Schedule:', s.id, 'Date:', s.lectureDate, 'Subject:', s.template?.subject?.name, 'Section:', s.template?.section?.name, 'SectionId:', s.template?.sectionId, 'Faculty:', s.template?.faculty?.firstName);
  }

  const versions = await prisma.timetableVersion.findMany({
    include: {
      section: true,
      slots: {
        include: { subject: true, faculty: true, room: true }
      }
    }
  });
  console.log('Total timetable versions:', versions.length);
  for (const v of versions) {
    console.log('Version:', v.id, 'Section:', v.section?.name, 'SectionId:', v.sectionId, 'Active:', v.isActive, 'Slots count:', v.slots.length);
    for (const slot of v.slots) {
      console.log('  Slot:', slot.day, slot.timeSlotStart, slot.timeSlotEnd, slot.subject?.name, slot.faculty?.firstName, slot.room?.name);
    }
  }

  // Also check students and their sections
  const students = await prisma.student.findMany({
    include: { user: true }
  });
  console.log('Total students:', students.length);
  for (const st of students) {
    console.log('Student:', st.id, st.collegeId, st.rollNumber, st.firstName, st.user?.email);
  }
}

main().finally(() => prisma.$disconnect());

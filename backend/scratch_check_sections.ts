import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const sections = await prisma.section.findMany({
    include: { semester: { include: { program: true } } }
  });
  console.log('Sections:');
  for (const s of sections) {
    console.log(`- ID: ${s.id} | Name: "${s.name}" | Semester: ${s.semester?.name}`);
  }
}

check().finally(() => prisma.$disconnect());

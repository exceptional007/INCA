import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const roles = [
    {
      code: 'SUPER_ADMIN',
      name: 'Super Administrator',
      description: 'System Super Administrator',
    },
    {
      code: 'ADMIN',
      name: 'Administrator',
      description: 'College Administrator',
    },
    {
      code: 'HOD',
      name: 'Head of Department',
      description: 'Department Head',
    },
    {
      code: 'FACULTY',
      name: 'Faculty',
      description: 'Teaching Faculty',
    },
    {
      code: 'COORDINATOR',
      name: 'Coordinator',
      description: 'Academic Coordinator',
    },
    {
      code: 'STUDENT',
      name: 'Student',
      description: 'Student',
    },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: {
        code: role.code,
      },
      update: {},
      create: role,
    });
  }

  const superAdminRole = await prisma.role.findUnique({
    where: {
      code: 'SUPER_ADMIN',
    },
  });

  if (!superAdminRole) {
    throw new Error('SUPER_ADMIN role not found.');
  }

  const hashedPassword = await bcrypt.hash('Admin@123', 10);

  await prisma.user.upsert({
    where: {
      email: 'admin@bit.ac.in',
    },
    update: {},
    create: {
      email: 'admin@bit.ac.in',
      password: hashedPassword,
      roleId: superAdminRole.id,
      mustChangePassword: true,
    },
  });

  console.log('Roles seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

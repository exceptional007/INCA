const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'nilam.devi@bit.ac.in' },
    include: { role: true, adminProfile: true }
  });
  console.log('Nilam Devi user role code:', user.role.code);
  console.log('Admin profile:', user.adminProfile);
}
main().catch(console.error).finally(() => prisma.$disconnect());

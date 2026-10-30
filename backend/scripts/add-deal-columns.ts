import { PrismaClient } from '../node_modules/@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log('Adding columns to marketplace_transactions if not existing...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE marketplace_transactions 
      ADD COLUMN IF NOT EXISTS "handoverLocation" text,
      ADD COLUMN IF NOT EXISTS "handoverDate" text,
      ADD COLUMN IF NOT EXISTS "handoverTime" text,
      ADD COLUMN IF NOT EXISTS "offerId" text;
    `);
    console.log('Columns successfully added or already exist!');

    const cols = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'marketplace_transactions' AND column_name IN ('handoverLocation', 'handoverDate', 'handoverTime', 'offerId');
    `);
    console.log('Verified columns in DB:', cols);
  } catch (e) {
    console.error('Migration error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();


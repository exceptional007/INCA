import { PrismaClient } from '../node_modules/@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const cols = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'marketplace_transactions'
      ORDER BY ordinal_position;
    `);
    console.log('marketplace_transactions columns:', cols);

    const offerCols = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'marketplace_offers'
      ORDER BY ordinal_position;
    `);
    console.log('marketplace_offers columns:', offerCols);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();


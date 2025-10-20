const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('admin', 10);
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@example.com',
      password,
      role: 'ADMIN',
      portfolio: { create: { cashBalance: 10000, totalValue: 0 } },
    },
  });

  const companies = [
    { name: 'TechNova', symbol: 'TNV', sector: 'Tech', basePrice: 100, currentPrice: 100, actionsTotal: 100000 },
    { name: 'GreenFoods', symbol: 'GFD', sector: 'Consumer', basePrice: 50, currentPrice: 50, actionsTotal: 120000 },
    { name: 'AeroLift', symbol: 'AEL', sector: 'Industrial', basePrice: 75, currentPrice: 75, actionsTotal: 90000 },
  ];

  for (const c of companies) {
    await prisma.company.upsert({
      where: { symbol: c.symbol },
      update: {},
      create: c,
    });
  }

  console.log('Seed completed. Admin: admin@example.com / admin');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

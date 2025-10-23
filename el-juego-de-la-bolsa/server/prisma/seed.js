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
    { name: 'MichiHotel', symbol: 'MHT', sector: 'Turismo', basePrice: 100, currentPrice: 100, actionsTotal: 120000 },
    { name: 'MichiPapeles', symbol: 'MPA', sector: 'Papelería', basePrice: 80, currentPrice: 80, actionsTotal: 100000 },
    { name: 'MichiTech', symbol: 'MTC', sector: 'Tecnología', basePrice: 90, currentPrice: 90, actionsTotal: 110000 },
    { name: 'MichiAgro', symbol: 'MAG', sector: 'Agricultura', basePrice: 70, currentPrice: 70, actionsTotal: 90000 },
    { name: 'MichiFuel', symbol: 'MFL', sector: 'Energía', basePrice: 110, currentPrice: 110, actionsTotal: 95000 },
    { name: 'MichiHealth', symbol: 'MHL', sector: 'Salud', basePrice: 85, currentPrice: 85, actionsTotal: 105000 },
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

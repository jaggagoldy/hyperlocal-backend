import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'superadmin@nearbybazar.in';
  const password = 'Test1234Admin!';
  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash: hashedPassword,
      role: 'admin',
      isBanned: false,
    },
    create: {
      email,
      phoneNumber: '9999900000',
      passwordHash: hashedPassword,
      role: 'admin',
      name: 'Super Admin',
      isBanned: false,
    },
  });

  console.log('Superadmin created/updated:', admin.email);
  console.log('Password:', password);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

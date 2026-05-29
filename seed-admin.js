import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};

async function main() {
  const existingAdmin = await prisma.user.findUnique({
    where: { email: 'admin@hyperlocal.com' }
  });

  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        email: 'admin@hyperlocal.com',
        phoneNumber: '9999999999',
        passwordHash: hashPassword('admin123'),
        name: 'Super Admin',
        role: 'admin',
      }
    });
    console.log('Superadmin created: admin@hyperlocal.com / admin123');
  } else {
    console.log('Superadmin already exists: admin@hyperlocal.com / admin123');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

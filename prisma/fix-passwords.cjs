const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};

async function main() {
  const newHash = hashPassword('Test@123');
  
  const result = await prisma.user.updateMany({
    data: {
      passwordHash: newHash
    }
  });

  console.log(`Updated ${result.count} users to use pbkdf2 password hash.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

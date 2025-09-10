const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  errorFormat: 'pretty'
});

// Connection event handlers
prisma.$on('beforeExit', () => {
  console.log('Prisma is disconnecting');
});

module.exports = prisma;
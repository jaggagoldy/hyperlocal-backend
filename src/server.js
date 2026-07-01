import app from './app.js';
import env from './config/env.js';
import logger from './config/logger.js';
import prisma from './config/prisma.js';
import { dbMode, dbHost, isLocalDb } from './config/dbMode.js';
import { syncCategories } from './utils/syncCategories.js';

let server;

prisma.$connect().then(async () => {
  logger.info('Connected to PostgreSQL database via Prisma');
  
  // Sync categories with verticals configuration
  try {
    await syncCategories();
    logger.info('Categories and subcategories synchronized with verticals config');
  } catch (error) {
    logger.error(error, 'Failed to synchronize categories on startup');
  }

  server = app.listen(env.PORT, () => {
    logger.info(`Server listening to port ${env.PORT}`);
    // Make it obvious which database this process is talking to.
    const dbBanner = `DB MODE: ${dbMode.toUpperCase()} (${dbHost})`;
    if (isLocalDb) {
      logger.warn(`🧪 ${dbBanner} — LOCAL dev database (test data, NOT production)`);
    } else {
      logger.info(`🌐 ${dbBanner} — remote database`);
    }
    // Keep event loop alive (workaround for Node 24 clean exit issue)
    setInterval(() => {}, 1000 * 60 * 60);
  });
}).catch((error) => {
  logger.fatal(error, 'Failed to connect to database');
  process.exit(1);
});

const exitHandler = () => {
  if (server) {
    server.close(() => {
      logger.info('Server closed');
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

const unexpectedErrorHandler = (error) => {
  logger.error(error);
  exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  if (server) {
    server.close();
  }
});

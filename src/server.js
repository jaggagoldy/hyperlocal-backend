import app from './app.js';
import env from './config/env.js';
import logger from './config/logger.js';
import prisma from './config/prisma.js';
import { dbMode, dbHost, isLocalDb } from './config/dbMode.js';
import { syncCategories } from './utils/syncCategories.js';
import { startBackgroundJobs } from './utils/backgroundJobs.js';
import { sendAlert } from './services/alert.service.js';

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
    // Start periodic background tasks
    startBackgroundJobs();

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

const unexpectedErrorHandler = async (error) => {
  logger.error(error);
  // Best-effort operational alert (RG-001 item 7) before the process exits. Bounded
  // so a slow/unreachable alert channel can never block shutdown, and never throws.
  try {
    await Promise.race([
      sendAlert('Application crash (unhandled error)', error?.stack || String(error)),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
  } catch {
    // alerting must never itself block or crash shutdown
  }
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

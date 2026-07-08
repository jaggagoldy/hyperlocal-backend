import prisma from '../config/prisma.js';
import logger from '../config/logger.js';

export const startBackgroundJobs = () => {
  // Run immediately on startup, then every 5 minutes
  const runAutoCancel = async () => {
    try {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      
      const result = await prisma.orderEnquiry.updateMany({
        where: {
          status: 'PENDING',
          createdAt: {
            lt: twoHoursAgo
          }
        },
        data: {
          status: 'CANCELLED'
        }
      });
      
      if (result.count > 0) {
        logger.info(`[Auto-Cancel Job] Automatically cancelled ${result.count} unconfirmed pending order(s) older than 2 hours.`);
      }
    } catch (err) {
      logger.error(err, '[Background Jobs] Error running auto-cancel job');
    }
  };

  runAutoCancel();
  setInterval(runAutoCancel, 5 * 60 * 1000);
};

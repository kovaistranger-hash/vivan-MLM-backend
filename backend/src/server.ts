import cron from 'node-cron';
import { app } from './app.js';
import { env } from './config/env.js';
import { initDB } from './db/mysql.js';
import { dispatchBinaryCronJob } from './queue/commission.dispatch.js';
import { runBinaryDaily } from './modules/mlm/cron.service.js';
import { initCloudinaryFromEnv } from './modules/upload/cloudinary.service.js';
import { logger } from './utils/logger.js';

async function bootstrap() {
  initCloudinaryFromEnv();
  /** DB must be up and schema ensured before accepting traffic (`initDB` MUST run before `app.listen`). */
  await initDB();

  if (env.bullmqEnabled) {
    const { startCommissionWorker } = await import('./queue/commission.worker.js');
    startCommissionWorker();
  }

  app.listen(env.port, () => {
    logger.info(`Server listening`, { port: env.port, nodeEnv: env.nodeEnv });
  });

  cron.schedule('0 1 * * *', async () => {
    logger.info('Scheduled daily binary payout (01:00 server TZ)');
    try {
      if (env.bullmqEnabled) {
        const r = await dispatchBinaryCronJob();
        logger.info('Binary cron dispatched via BullMQ', { result: r });
      } else {
        const summary = await runBinaryDaily();
        logger.info('Binary cron summary (inline)', summary);
      }
    } catch (e) {
      logger.error('Binary cron failed', { err: e });
    }
  });
}

bootstrap().catch((error) => {
  logger.error('Failed to start server', { err: error });
  process.exit(1);
});

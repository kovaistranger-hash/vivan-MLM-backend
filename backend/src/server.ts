import "dotenv/config";

import cron from 'node-cron';
import { app } from './app.js';
import { env } from './config/env.js';
import { initDB } from './db/mysql.js';
import { dispatchBinaryCronJob } from './queue/commission.dispatch.js';
import { runBinaryDaily } from './modules/mlm/cron.service.js';
import { initCloudinaryFromEnv } from './modules/upload/cloudinary.service.js';
import { logger } from './utils/logger.js';
import {
  markReady,
  markStartupFailed,
  setHttpListening,
  setStartupPhase
} from './utils/runtimeHealth.js';

async function startServer() {
  try {
    initCloudinaryFromEnv();

    setStartupPhase('connecting_database');
    await initDB();

    if (env.bullmqEnabled) {
      const { startCommissionWorker } = await import('./queue/commission.worker.js');
      startCommissionWorker();
    }

    setStartupPhase('starting_http');
    app.listen(env.port, env.host, () => {
      setHttpListening(env.port);
      markReady();
      console.log(`Server running on ${env.host}:${env.port}`);
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
  } catch (error) {
    markStartupFailed(error);
    console.error("Startup failed:", error);
    process.exit(1);
  }
}

startServer();

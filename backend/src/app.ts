import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import fs from 'node:fs';
import router from './routes/index.js';
import { env } from './config/env.js';
import { globalApiLimiter } from './middleware/apiLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { asyncHandler } from './utils/asyncHandler.js';
import { razorpayWebhook } from './modules/payments/razorpay.webhook.js';
import { logger } from './utils/logger.js';
import { requestIdMiddleware } from './middleware/requestId.js';

export const app = express();

const uploadPath = path.resolve(process.cwd(), env.uploadDir);
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

app.use(requestIdMiddleware);
app.use(helmet());
app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.post('/api/payments/razorpay/webhook', express.raw({ type: 'application/json' }), asyncHandler(razorpayWebhook));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({ status: 'OK' });
});

if (!env.isProduction) {
  app.use(morgan('dev'));
} else {
  app.use(
    morgan('combined', {
      stream: {
        write: (line: string) => {
          logger.info(line.trim());
        }
      }
    })
  );
}

app.use(globalApiLimiter);
app.use('/uploads', express.static(uploadPath));

app.use('/api', router);
app.use(notFoundHandler);
app.use(errorHandler);

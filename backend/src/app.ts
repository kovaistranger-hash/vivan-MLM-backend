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
import { validateQuery } from './middleware/zodValidate.js';
import authRoutes from './modules/auth/auth.routes.js';
import { getProduct, getProducts, productAutocomplete } from './modules/products/product.controller.js';
import { productListQuerySchema } from './modules/products/product.schemas.js';
import { getRuntimeHealth } from './utils/runtimeHealth.js';

export const app = express();

const uploadPath = path.resolve(process.cwd(), env.uploadDir);
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

const allowedOrigins = new Set(env.frontendUrls);

app.use(requestIdMiddleware);
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true
  })
);
app.post('/api/payments/razorpay/webhook', express.raw({ type: 'application/json' }), asyncHandler(razorpayWebhook));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health/live', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ status: 'alive' });
});

app.get('/health/ready', (_req, res) => {
  const health = getRuntimeHealth();
  res.setHeader('Cache-Control', 'no-store');
  if (!health.ready) {
    return res.status(503).json({
      status: 'starting',
      ready: false,
      phase: health.phase,
      database: health.database,
      startupError: health.startupError
    });
  }

  return res.json({
    status: 'ready',
    ready: true,
    phase: health.phase,
    database: health.database,
    uptimeSeconds: health.uptimeSeconds
  });
});

app.get('/health', (_req, res) => {
  const health = getRuntimeHealth();
  res.setHeader('Cache-Control', 'no-store');
  const status = health.ready ? 'ok' : health.phase === 'failed' ? 'failed' : 'starting';
  const httpStatus = health.ready ? 200 : health.phase === 'failed' ? 503 : 200;
  res.status(httpStatus).json({
    status,
    ...health
  });
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

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: "Backend is running 🚀"
  });
});

app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: "API is running 🚀"
  });
});

app.use('/api/auth', authRoutes);
app.get('/api/products', validateQuery(productListQuerySchema), asyncHandler(getProducts));
app.get('/api/products/autocomplete', asyncHandler(productAutocomplete));
app.get('/api/products/:slug', asyncHandler(getProduct));
app.use('/api', router);
app.use(notFoundHandler);
app.use(errorHandler);

import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    /** Correlation id for logs and error responses (set by `requestIdMiddleware`). */
    id?: string;
  }
}

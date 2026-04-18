# Deployment Guide

## Railway MySQL setup

### Backend service env

Set these on the Railway backend service:

```env
NODE_ENV=production
STRICT_ENV=true
PORT=${{PORT}}
HOST=::
APP_URL=https://your-api-domain.railway.app
FRONTEND_URL=https://your-frontend-domain.com

JWT_ACCESS_SECRET=<long-random-secret>
JWT_REFRESH_SECRET=<different-long-random-secret>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

# Prefer Railway private networking when available.
DATABASE_URL=${{MySQL.DATABASE_URL}}
# If Railway exposes MYSQL_PRIVATE_URL instead, that also works.
```

Optional but commonly needed:

```env
DB_CONNECT_MAX_ATTEMPTS=12
DB_CONNECT_BASE_DELAY_MS=1000

RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

### Notes

- The backend now accepts `DATABASE_URL`, `MYSQL_URL`, `MYSQL_PRIVATE_URL`, `MYSQL_PUBLIC_URL`, or Railway raw vars such as `MYSQLHOST`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`.
- Private Railway MySQL URLs are preferred over public URLs.
- Set `HOST=::` on Railway so Node listens on all interfaces in both dual-stack and legacy IPv6-only environments.
- `/health/live` only checks that the process is up.
- `/health/ready` returns `503` until MySQL is reachable and schema bootstrap finishes.

## First-time database bootstrap

Run these from `backend/` against the same Railway MySQL env:

```bash
npm run db:migrate:plan -- --include-baseline
npm run db:bootstrap
npm run seed
```

What each step does:

- `db:migrate:plan -- --include-baseline` shows the exact SQL files that would run.
- `db:bootstrap` applies `database/schema.sql` only when the database is empty, then applies pending numbered migrations and records them in `schema_migrations`.
- `seed` upserts admin/member users, storefront categories, brands, and demo products into the canonical schema.

## Ongoing admin-safe migrations

For an existing production database:

```bash
npm run db:migrate:plan
npm run db:migrate:adopt
npm run db:migrate
```

Safety behavior:

- Migration history is stored in `schema_migrations`.
- `db:migrate:adopt` is for databases that were already created manually or by older startup code; it records the current SQL files in the ledger without executing them again.
- Files are tracked by full filename, so duplicate numeric prefixes such as `015_*` and `016_*` are still handled safely.
- Files with destructive SQL like `DROP TABLE` or `TRUNCATE` are blocked unless `--allow-destructive` is passed explicitly.
- The one-off `database/manual_railway_temp_drop.sql` file is ignored by the migration runner.

## Startup behavior

On backend boot the app now:

1. Resolves Railway/MySQL env config.
2. Waits for MySQL with retry/backoff.
3. Bootstraps the runtime schema needed by auth, catalog, checkout, wallet, payout, settings, and MLM modules.
4. Starts HTTP only after schema bootstrap succeeds.

This means a fresh or partially initialized MySQL database can recover missing tables like:

- `roles`
- `compensation_settings`
- `withdrawal_settings`
- `categories`
- `brands`
- `products`
- `settings`
- `serviceable_pincodes`

## VPS fallback

If you are deploying outside Railway:

1. Install Node.js 20+, MySQL 8+, and a process manager such as PM2.
2. Set the same backend env vars from `backend/.env.example`.
3. Run:

```bash
cd backend
npm install
npm run build
npm run db:migrate:plan -- --include-baseline
npm run db:bootstrap
npm run seed
pm2 start dist/server.js --name meb-api
```

4. Serve the frontend build with Nginx or another static host and proxy `/api` and `/uploads` to the backend.

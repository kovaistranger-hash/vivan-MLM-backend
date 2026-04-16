# Vivan — ecommerce + admin + Razorpay

Vivan is a full-stack starter for ecommerce (and future member-network features). **Implemented today:** Phase 1 commerce (auth, catalog, cart, checkout, orders), **Phase 2 admin** (dashboard, products, categories, orders, banners), **Phase 4 Razorpay** (server-side order creation, signature verification, webhooks), and **Phase 5** (Cloudinary image uploads, invoice PDFs, pincode-based delivery and COD rules, checkout preview, richer admin catalog tools).

## Stack

- **Frontend:** React 18, Vite, TypeScript, Tailwind, Zustand, Sonner, React Router, Axios  
- **Backend:** Node.js, Express, TypeScript, MySQL (`mysql2`), Zod, Helmet, CORS, rate limiting, bcrypt, **Razorpay** SDK  
- **Database:** MySQL 8 — `database/schema.sql` (greenfield) and numbered migrations under `database/migrations/` (upgrades)

## Prerequisites

- Node.js 20+  
- MySQL 8+

## 1. Database

**New database:**

```bash
mysql -u root -p < database/schema.sql
```

**Existing `vivan` DB (already on Phase 1 schema):** apply migration once for `deleted_at`, `banners`, and `payments`:

```bash
mysql -u root -p vivan < database/migrations/002_phase2_phase4.sql
```

If `deleted_at` already exists, skip the `ALTER TABLE products` line in the migration file and run the rest.

**Phase 5 (invoices, pincodes, Cloudinary):**

```bash
mysql -u root -p vivan < database/migrations/003_phase5.sql
```

If `orders.invoice_number` already exists, comment out or skip the matching `ALTER TABLE` line in `003_phase5.sql` before running.

**Phase 6 (wallets, ledger, checkout wallet):**

```bash
mysql -u root -p vivan < database/migrations/004_wallet.sql
```

Creates `wallets`, `wallet_transactions`, and adds `orders.wallet_amount`. If `wallet_amount` already exists, skip the `ALTER TABLE` line in `004_wallet.sql`.

**Phase 7 (referral + binary commissions):**

```bash
mysql -u root -p vivan < database/migrations/005_referral_binary.sql
```

Creates `referral_users`, `referral_closure`, `binary_carry`, `commission_transactions`, `binary_daily_summary`, and extends `orders` with `profit_amount`, `commission_processed_at`, `commission_status`, and `commission_audit_json` (used for safe admin reversal when recalculating). If any `ALTER TABLE orders` column already exists, comment out that line before running.

**Phase 8 (compensation admin + manual audit):**

```bash
mysql -u root -p vivan < database/migrations/006_compensation_settings.sql
```

Creates `compensation_settings` (singleton row `id=1`), `commission_manual_adjustments`, extends `commission_transactions` with `manual_adjustment` type and `settings_snapshot_json` (JSON snapshot of settings **at posting time** — changing settings later does not alter historical rows). If `commission_type` or `settings_snapshot_json` already exists, comment out the matching `ALTER` line.

**Phase 9 (withdrawals, bank accounts, wallet holds):**

```bash
mysql -u root -p vivan < database/migrations/007_withdrawal.sql
```

Adds `wallets.held_balance`, `withdrawal_settings`, `bank_accounts`, `withdrawal_requests`, and extends `wallet_transactions.type` with `withdrawal_hold`, `withdrawal_paid`, `withdrawal_reversed`, `withdrawal_cancelled`. If `held_balance` already exists on `wallets`, skip the matching `ALTER` line in `007_withdrawal.sql` before running.

**KYC column (only if your `users` table does not yet have `kyc_verified`):**

```bash
mysql -u root -p vivan < database/migrations/008_user_kyc.sql
```

If you use a **fresh** `database/schema.sql` that already includes `kyc_verified`, skip `008_user_kyc.sql`.

**Storefront categories (five canonical departments):**

```bash
mysql -u root -p vivan < database/migrations/009_storefront_categories.sql
```

Upserts **Beauty**, **Fashion**, **Electronics**, **Home Care**, **Personal Care**, deactivates other categories, and reassigns products that pointed at legacy categories. After this, run **`npm run seed`** (from `backend/`) so demo products map to the new tree (seed also normalizes `products.category_id`).

## 2. Backend (port 5000)

```bash
cd backend
cp .env.example .env
```

Set at minimum: `DB_*`, JWT secrets (`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` or legacy `JWT_SECRET`), `FRONTEND_URL`.

**Cloudinary (Phase 5, optional but required for admin uploads):** set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in `backend/.env`. Without them, `POST /api/admin/upload/image` returns 503.

**Razorpay (test mode):** set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` from the Razorpay Dashboard (Test mode). Webhook URL (local tunnel such as ngrok): `https://<your-host>/api/payments/razorpay/webhook`

```bash
npm install
npm run seed
npm run dev
```

### Seed accounts (after `npm run seed`)

| Role   | Email               | Password    |
|--------|---------------------|------------|
| Admin  | `admin@vivan.local` | `Admin123!` |
| Member | `member@vivan.local`| `Member123!`|

## 3. Frontend (port 5173)

```bash
cd frontend
cp .env.example .env
```

- `VITE_API_URL=http://localhost:5000/api`  
- `VITE_RAZORPAY_KEY_ID=rzp_test_...` (**public** key only — never put `RAZORPAY_KEY_SECRET` in the frontend)

```bash
npm install
npm run dev
```

## URLs

| Area        | URL |
|------------|-----|
| Storefront | `http://localhost:5173/` |
| Admin      | `http://localhost:5173/admin` |
| Admin login| `http://localhost:5173/admin/login` |

Admin uses the same JWT auth as the store. Only users with `role === 'admin'` can access `/admin/*` and `/api/admin/*`.

## Razorpay checkout flow

1. Customer chooses **Pay online**, submits checkout → `POST /api/orders` creates a local order (`payment_status: pending`, stock deducted).  
2. Frontend calls `POST /api/payments/razorpay/order` with `{ orderId }` → backend creates a Razorpay Order and a `payments` row.  
3. Razorpay Checkout opens with `key` = `VITE_RAZORPAY_KEY_ID` and `order_id` from the API.  
4. On success, frontend calls `POST /api/payments/razorpay/verify` with `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`.  
5. Backend verifies HMAC with **server secret**; on success sets `payment_status`/`status` to `paid` and stores payment details. If **compensation trigger** is set to **`paid`**, the server then attempts the **order commission pipeline** (idempotent via `orders.commission_processed_at`).  
6. **Webhook** `POST /api/payments/razorpay/webhook` (raw body) validates `X-Razorpay-Signature` with `RAZORPAY_WEBHOOK_SECRET`, handles `payment.captured` / `payment.failed` (failure restocks inventory).

If the order **payable total** is **₹0** (fully covered by wallet), the storefront skips Razorpay and the server marks the order **paid** immediately.

## Wallet (Phase 6)

**Customer (auth):**

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/wallet` | Balance, checkout intent, recent tx |
| GET | `/api/wallet/transactions` | `?page=&pageSize=` |
| POST | `/api/wallet/use` | `{ amount, pincode }` — caps to balance & gross payable |
| POST | `/api/wallet/remove` | Clears checkout intent |
| GET | `/api/wallet/withdrawal-rules` | Min/max, fee type/value, method flags (for withdrawal UI) |
| GET | `/api/wallet/bank-accounts` | Saved payout profiles |
| POST | `/api/wallet/bank-accounts` | Create (Zod: IFSC/account or UPI) |
| PUT | `/api/wallet/bank-accounts/:id` | Update |
| DELETE | `/api/wallet/bank-accounts/:id` | Delete (blocked if linked to open withdrawal) |
| GET | `/api/wallet/withdrawals` | `?page=&pageSize=` — request history |
| POST | `/api/wallet/withdrawals` | `{ bankAccountId, amount, notes? }` — moves gross from `balance` → `held_balance`, ledger `withdrawal_hold` |
| POST | `/api/wallet/withdrawals/:id/cancel` | Pending only; restores balance, ledger `withdrawal_cancelled` |

**Checkout:** `GET /api/checkout/preview?pincode=&walletAmount=` returns `grossTotal`, `walletApplied`, `payableTotal`, `walletBalance`. `POST /api/orders` accepts optional `walletAmount` (revalidated server-side with row lock + ledger debit).

**Admin (auth + admin role):**

| Method | Path |
|--------|------|
| GET | `/api/admin/wallets` | `?search=&page=` |
| GET | `/api/admin/wallets/:userId` | Detail + tx list |
| POST | `/api/admin/wallets/:userId/credit` | `{ amount, description }` |
| POST | `/api/admin/wallets/:userId/debit` | `{ amount, description }` |
| POST | `/api/admin/wallets/:userId/refund` | `{ amount, description, reference_type, reference_id }` |
| GET | `/api/admin/withdrawals` | `?status=&userId=&from=&to=&page=&pageSize=` |
| GET | `/api/admin/withdrawals/:id` | Withdrawal + linked wallet snapshot |
| POST | `/api/admin/withdrawals/:id/approve` | Body `{ remarks? }` — pending → approved (no wallet move) |
| POST | `/api/admin/withdrawals/:id/reject` | Body `{ remarks? }` — pending/approved → rejected; restores gross from hold |
| POST | `/api/admin/withdrawals/:id/mark-paid` | Body `{ remarks? }` — approved → paid; releases hold, ledger `withdrawal_paid` |
| GET | `/api/admin/withdrawal-settings` | Singleton withdrawal rules |
| PUT | `/api/admin/withdrawal-settings` | Replace rules (Zod validated) |

**Order refund to wallet:** `PATCH /api/admin/orders/:id/status` body may include `refundToWallet: true` when `status` is `cancelled` or `returned`. Credits wallet (wallet portion + paid remainder if `payment_status` was `paid`), idempotent per order for `order_refund` rows.

**Dashboard:** `GET /api/admin/dashboard` includes `wallet`: total balance held, lifetime credit/debit sums, recent activity.

### Sample wallet test flow

1. Sign in as **admin**, open **Admin → Wallets**, pick **member@vivan.local** (or search), **Credit** `500` with description `Test credit`.  
2. Sign in as **member**, open **Wallet** — balance shows **₹500**.  
3. Add a product to cart, go to **Checkout**, enter PIN, enter wallet **200**, confirm preview shows wallet −200 and reduced payable.  
4. Place order (COD or online for remainder). **Wallet** balance becomes **₹300**; **Wallet history** shows `order_payment`.  
5. As admin, open the order → set status to **cancelled**, check **Refund to customer wallet**, save. Balance returns appropriately; history shows `order_refund` once (repeat refund blocked).

### Sample withdrawal test flow

1. Apply DB migrations **007** (and **008** if `users.kyc_verified` is missing). Turn **KYC required** off in **Admin → Withdrawal settings** unless you set `kyc_verified = 1` for the test user in MySQL.  
2. As **admin**, **Admin → Wallets** → member → **Credit** `1000` (description e.g. `Test credit`).  
3. As **member**, open **Wallet → Bank accounts**, add a valid bank profile (IFSC + account or UPI per settings).  
4. **Wallet → Withdraw**, choose the account, request **500**. Available balance becomes **500**, **Held** shows **500**; ledger shows `withdrawal_hold`.  
5. As **admin**, **Withdrawals** → open the request → **Approve** (status `approved`, balances unchanged).  
6. **Mark paid**: held returns to **0**; ledger adds `withdrawal_paid` (net amount on the row).  
7. **Reject path:** create another withdrawal, then **Reject** from admin; balance is restored and ledger shows `withdrawal_reversed`.  
8. **Cancel path:** create a pending request as member, use **Cancel** on **Wallet → Withdraw**; ledger shows `withdrawal_cancelled`.

**Storefront UI:** `/wallet`, `/wallet/history`, `/wallet/withdraw`, `/wallet/bank-accounts`. **Admin UI:** `/admin/withdrawals`, `/admin/withdrawals/:id`, `/admin/withdrawal-settings`.

## Referral & binary commissions (Phase 7 + Phase 8 settings)

**Profit basis:** order `subtotal` (merchandise before shipping/tax) is stored as `orders.profit_amount` when commissions run.

**Configurable rules:** Admin manages defaults in **`compensation_settings`** (`GET/PUT /api/admin/compensation-settings` and **Admin → Compensation**). The engine reads a **row-locked** snapshot during each commission run; every automated `commission_transactions` row stores **`settings_snapshot_json`** so reports stay faithful to the rules in force at posting time.

**Triggers:** `compensation_settings.trigger_stage` is either **`delivered`** (pipeline runs when admin sets status to delivered, same transaction + `SELECT … FOR UPDATE` on the order) or **`paid`** (pipeline also runs after successful **Razorpay verify** when the order becomes `paid`). Eligibility still requires a **paid** online payment or **COD after delivery** (COD is not treated as “paid” until the order is delivered).

**Welcome bonus:** Amount and on/off flag come from settings (default ₹250 once per customer at registration), idempotent via `referral_users.welcome_bonus_at`.

**Direct referral:** Uses `direct_income_type` / `direct_income_value`, optional `max_direct_income_per_order`, and `direct_income_enabled`.

**Binary:** Respects `binary_income_enabled`, `carry_forward_enabled`, per-leg percentages (`binary_left_percentage` + `binary_right_percentage` apply to **matched** merchandise profit), `daily_binary_ceiling` (IST day), and `binary_ceiling_behavior` (`hold_unpaid` vs `discard_unpaid` for overflow above the daily cap).

**Refund safeguard:** When `refund_reversal_enabled` is on, cancelling or returning an order reverses prior automated commission payouts for that order (wallet debits + carry restoration using `commission_audit_json`) before status is saved.

**Minimum order profit:** Orders below `minimum_order_profit` are marked completed with `skipped_below_min_profit` and do not pay commissions.

**Customer (auth):**

| Method | Path |
|--------|------|
| GET | `/api/referral/me` |
| GET | `/api/referral/tree` | `?depth=` (1–6) |
| GET | `/api/referral/directs` |
| GET | `/api/referral/commissions` | `?page=&pageSize=` |
| GET | `/api/referral/binary-summary` |

**Registration (optional):** `POST /api/auth/register` accepts `sponsorReferralCode`, `placementParentReferralCode` (defaults to sponsor), and `placementSide` (`left` \| `right`).

**Admin (auth + admin role):**

| Method | Path |
|--------|------|
| GET | `/api/admin/referrals/users` | `?q=&page=&pageSize=` |
| GET | `/api/admin/referrals/:userId` | `?treeDepth=` |
| GET | `/api/admin/commissions` | `?userId=&type=&page=&pageSize=` |
| GET | `/api/admin/binary-daily` | `?userId=&from=&to=&page=&pageSize=` |
| POST | `/api/admin/commissions/recalculate/:orderId` | body `{ "force": true }` optional — reverses prior payouts for that order using `commission_audit_json` + ledger rows, then re-runs |
| GET | `/api/admin/compensation-settings` | Current `compensation_settings` row |
| PUT | `/api/admin/compensation-settings` | Replace settings (validated body) |
| POST | `/api/admin/commissions/manual-adjustment` | Wallet/carry-safe manual adjustment (audit row + optional ledger) |
| GET | `/api/admin/commissions/manual-adjustments` | `?userId=&page=&pageSize=` |
| GET | `/api/admin/binary-carry` | Customer binary carry + IST-day stats |
| POST | `/api/admin/binary-carry/:userId/adjust` | `{ side, delta?, reason }` — carry audit |
| POST | `/api/admin/binary-carry/:userId/recalculate` | Runs binary “standstill” settlement for that user from current carries |

**Storefront UI:** `/referral` (nav **Referral** when signed in). **Admin UI:** `/admin/referrals`, `/admin/referrals/:userId`, `/admin/commissions`, `/admin/binary-daily`, `/admin/compensation-settings`, `/admin/commissions/manual-adjustment`, `/admin/binary-carry`, plus commission block on order detail.

### Sample binary test (A sponsors B and C; B left, C right)

1. Register **A** (no sponsor). Note **A**’s referral code.  
2. Register **B** with sponsor = A, placement side **left** (parent defaults to A).  
3. Register **C** with sponsor = A, placement side **right**.  
4. As **B**, place a small order (subtotal **₹100**); as **C**, place subtotal **₹200**. Use **COD** or mark **paid** as appropriate.  
5. As **admin**, mark **B**’s order **delivered** first: **A** earns direct **₹30**; **A** left carry += **100**.  
6. Mark **C**’s order **delivered**: **A** direct **₹60**; right carry += **200**; binary matched **100** → **A** binary wallet **₹30**; carries become left **0**, right **100**.  
7. Confirm on **Admin → Referrals → A** (carry) and **Admin → Commissions** (ledger rows).

## Admin API (all require `Authorization: Bearer` + admin role)

| Method | Path |
|--------|------|
| GET | `/api/admin/dashboard` |
| GET | `/api/admin/brands` |
| GET | `/api/admin/products` |
| POST | `/api/admin/products` |
| GET | `/api/admin/products/:id` |
| PUT | `/api/admin/products/:id` |
| DELETE | `/api/admin/products/:id` (soft delete) |
| GET | `/api/admin/categories` |
| POST | `/api/admin/categories` |
| PUT | `/api/admin/categories/:id` |
| GET | `/api/admin/orders` |
| GET | `/api/admin/orders/:id` |
| PATCH | `/api/admin/orders/:id/status` (`refundToWallet` optional) |
| GET | `/api/admin/compensation-settings` |
| PUT | `/api/admin/compensation-settings` |
| POST | `/api/admin/commissions/manual-adjustment` |
| GET | `/api/admin/commissions/manual-adjustments` |
| GET | `/api/admin/binary-carry` |
| POST | `/api/admin/binary-carry/:userId/adjust` |
| POST | `/api/admin/binary-carry/:userId/recalculate` |
| GET | `/api/admin/referrals/users` |
| GET | `/api/admin/referrals/:userId` |
| GET | `/api/admin/commissions` |
| GET | `/api/admin/binary-daily` |
| POST | `/api/admin/commissions/recalculate/:orderId` |
| GET | `/api/admin/wallets` |
| GET | `/api/admin/wallets/:userId` |
| POST | `/api/admin/wallets/:userId/credit` |
| POST | `/api/admin/wallets/:userId/debit` |
| POST | `/api/admin/wallets/:userId/refund` |
| GET | `/api/admin/withdrawals` |
| GET | `/api/admin/withdrawals/:id` |
| POST | `/api/admin/withdrawals/:id/approve` |
| POST | `/api/admin/withdrawals/:id/reject` |
| POST | `/api/admin/withdrawals/:id/mark-paid` |
| GET | `/api/admin/withdrawal-settings` |
| PUT | `/api/admin/withdrawal-settings` |
| GET | `/api/admin/banners` |
| POST | `/api/admin/banners` |
| PUT | `/api/admin/banners/:id` |
| DELETE | `/api/admin/banners/:id` |
| POST | `/api/admin/upload/image` (multipart field `file`) |
| GET | `/api/admin/pincodes` |
| POST | `/api/admin/pincodes` |
| PUT | `/api/admin/pincodes/:id` |
| DELETE | `/api/admin/pincodes/:id` |
| PATCH | `/api/admin/products/:id/flags` (partial booleans: `is_active`, `is_featured`, `is_new_arrival`, `is_bestseller`) |

## Payments API

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/payments/razorpay/order` | Customer (order owner) |
| POST | `/api/payments/razorpay/verify` | Customer |
| POST | `/api/payments/razorpay/webhook` | Razorpay (signature); **no** JWT |

## Public extras

- `GET /api/banners` — active banners for the home page carousel.
- `GET /api/delivery/pincode/:pincode` — pincode lookup (returns `configured`, `serviceable`, shipping hints from `settings`, and zone fields when a row exists in `serviceable_pincodes`).

## Customer orders & checkout (Phase 5)

- `GET /api/checkout/preview?pincode=&walletAmount=` (auth) — returns merchandise subtotal, GST, shipping, **grossTotal**, **walletApplied**, **payableTotal**, COD flags, and delivery metadata aligned with `POST /api/orders`.
- `GET /api/orders/:id/invoice` (auth) — PDF invoice for the order owner or an admin (includes wallet line when used).

**Pincode delivery:** when there is at least one **active** row in `serviceable_pincodes`, checkout requires a serviceable PIN, applies per-zone `shipping_charge` (still respects `free_shipping_above` from settings), and honours per-zone `cod_available` together with global `cod_enabled`. With **no** active rows, legacy behaviour applies (default shipping fee from settings).

**Invoices:** after each successful `POST /api/orders`, the server assigns a unique `invoice_number` (format `INV-YYYY-000001`) used by the PDF and download endpoints.

## Uploads

Admin image uploads use **Cloudinary** (`POST /api/admin/upload/image`). Products store `image_url` and optional `gallery_json` (array of HTTPS URLs).

## Production notes

- Use Razorpay **Live** keys in production and a live webhook URL.  
- Keep `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` only on the server.  
- Consider HTTP-only cookies for refresh tokens.  
- Tune Helmet / CSP if third-party checkout scripts are blocked.

## Roadmap (remaining from original spec)

- **Phase 3+:** BV/PV product-driven volume (beyond subtotal profit), richer genealogy exports, email/SMS notifications, OTP abstraction, Nginx + PM2 samples.

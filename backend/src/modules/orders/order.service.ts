import { pool, query } from '../../db/mysql.js';
import { ApiError } from '../../utils/ApiError.js';
import { writeAuditLog } from '../compliance/auditLog.service.js';
import { persistOrderInvoiceToDisk } from './invoice.service.js';
import { getCart } from '../cart/cart.service.js';
import { getSettingsMap, parseBool, parseNumber } from '../settings/settings.service.js';
import { countActiveZones, getActiveZoneByPincode } from '../delivery/pincode.service.js';
import {
  clearCheckoutIntentConn,
  debitWalletForOrder,
  getOrCreateWallet,
  getWalletBalance
} from '../wallet/wallet.service.js';

function round2(n: number) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function orderNumber() {
  const rand = Math.floor(Math.random() * 900 + 100);
  return `VVN-${Date.now()}${rand}`;
}

function buildCartLines(cartItems: Awaited<ReturnType<typeof getCart>>['items']) {
  return cartItems.map((item) => {
    const qty = Number(item.quantity);
    const unit = Number(item.sale_price);
    const lineSubtotal = unit * qty;
    const gstRate = Number(item.gst_rate ?? 18);
    const lineGst = (lineSubtotal * gstRate) / 100;
    return { ...item, qty, unit, lineSubtotal, gstRate, lineGst };
  });
}

export type PricedCartLine = ReturnType<typeof buildCartLines>[number];

export async function computeOrderPricing(
  userId: number,
  shippingPincode: string,
  wallet?: { walletApplyAmount?: number; balanceOverride?: number }
) {
  const cart = await getCart(userId);
  if (!cart.items.length) return { ok: false as const, message: 'Cart is empty' };

  const settings = await getSettingsMap();
  const codEnabled = parseBool(settings.cod_enabled ?? 'true', true);
  const defaultShipping = parseNumber(settings.default_shipping_fee ?? '49', 49);
  const freeAbove = parseNumber(settings.free_shipping_above ?? '999', 999);

  const lines = buildCartLines(cart.items);
  const merchandiseSubtotal = lines.reduce((s, l) => s + l.lineSubtotal, 0);
  const gstTotal = lines.reduce((s, l) => s + l.lineGst, 0);

  const zonesConfigured = (await countActiveZones()) > 0;
  const zoneRow = await getActiveZoneByPincode(shippingPincode);
  let shippingAmount: number;
  let codAllowedForPin = true;
  let zone: {
    pincode: string;
    city: string;
    state: string;
    estimated_days: number;
    shipping_charge: number;
    cod_available: boolean;
  } | null = null;

  if (zonesConfigured) {
    if (!zoneRow) return { ok: false as const, message: 'We do not deliver to this PIN code.' };
    shippingAmount = merchandiseSubtotal >= freeAbove ? 0 : Number(zoneRow.shipping_charge);
    codAllowedForPin = parseBool(String(zoneRow.cod_available), true);
    zone = {
      pincode: String(zoneRow.pincode),
      city: String(zoneRow.city),
      state: String(zoneRow.state),
      estimated_days: Number(zoneRow.estimated_days),
      shipping_charge: Number(zoneRow.shipping_charge),
      cod_available: codAllowedForPin
    };
  } else {
    shippingAmount = merchandiseSubtotal >= freeAbove ? 0 : defaultShipping;
  }

  const discountAmount = 0;
  const grossTotal = round2(merchandiseSubtotal + gstTotal + shippingAmount - discountAmount);
  let walletApplied = 0;
  if (wallet?.walletApplyAmount != null && wallet.walletApplyAmount > 0) {
    const bal = wallet.balanceOverride != null ? round2(wallet.balanceOverride) : await getWalletBalance(userId);
    walletApplied = round2(Math.min(wallet.walletApplyAmount, bal, grossTotal));
  }
  const payableTotal = round2(Math.max(0, grossTotal - walletApplied));

  return {
    ok: true as const,
    cart,
    lines,
    merchandiseSubtotal,
    gstTotal,
    shippingAmount,
    discountAmount,
    /** Gross order total (merchandise + GST + shipping) before wallet. */
    grossTotal,
    walletApplied,
    payableTotal,
    /** @deprecated Use grossTotal; kept for older clients (equals grossTotal). */
    totalAmount: grossTotal,
    codEnabled,
    codAllowedForPin,
    zonesConfigured,
    zone,
    freeShippingAbove: freeAbove,
    defaultShippingFee: defaultShipping
  };
}

export async function createOrder(
  userId: number,
  input: {
    shippingName: string;
    shippingPhone: string;
    shippingAddress1: string;
    shippingAddress2?: string;
    shippingCity: string;
    shippingState: string;
    shippingPincode: string;
    paymentMethod: 'cod' | 'online';
    customerGstin?: string;
    walletAmount?: number;
  }
) {
  const lockName = `vivan_co_${userId}`;
  const conn = await pool.getConnection();
  let inTx = false;
  try {
    const [[lockRow]]: any = await conn.query(`SELECT GET_LOCK(?, 10) AS got`, [lockName]);
    if (!lockRow || Number(lockRow.got) !== 1) {
      throw new ApiError(503, 'Checkout is busy. Please try again.');
    }

    await conn.beginTransaction();
    inTx = true;

    await getOrCreateWallet(userId, conn);
    const [wRows]: any = await conn.query(
      'SELECT balance, checkout_intent_amount FROM wallets WHERE user_id = ? FOR UPDATE',
      [userId]
    );
    const balance = round2(Number(wRows[0]?.balance ?? 0));
    const intent = round2(Number(wRows[0]?.checkout_intent_amount ?? 0));
    const bodyWallet = round2(Number(input.walletAmount ?? 0));
    const walletTarget = round2(Math.max(bodyWallet, intent));

    const priced = await computeOrderPricing(userId, input.shippingPincode, {
      walletApplyAmount: walletTarget,
      balanceOverride: balance
    });
    if (!priced.ok) throw new ApiError(400, priced.message);

    const {
      lines,
      merchandiseSubtotal,
      gstTotal,
      shippingAmount,
      discountAmount,
      walletApplied,
      payableTotal,
      codEnabled,
      codAllowedForPin,
      zonesConfigured
    } = priced;

    if (input.paymentMethod === 'cod' && (!codEnabled || !codAllowedForPin)) {
      if (!codAllowedForPin && zonesConfigured) {
        throw new ApiError(400, 'Cash on delivery is not available for this PIN code.');
      }
      throw new ApiError(400, 'Cash on delivery is not available right now');
    }

    const cgst = gstTotal / 2;
    const sgst = gstTotal / 2;

    let paymentStatus = 'pending';
    let orderStatus = 'pending';
    if (payableTotal <= 0 && walletApplied > 0) {
      paymentStatus = 'paid';
      orderStatus = 'paid';
    }

    const on = orderNumber();
    const [orderResult]: any = await conn.query(
      `INSERT INTO orders (
        user_id, order_number, status, payment_status, payment_method,
        subtotal, discount_amount, wallet_amount, shipping_amount, gst_amount,
        cgst_amount, sgst_amount, igst_amount, total_amount, customer_gstin,
        shipping_name, shipping_phone, shipping_address1, shipping_address2,
        shipping_city, shipping_state, shipping_pincode
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        userId,
        on,
        orderStatus,
        paymentStatus,
        input.paymentMethod,
        merchandiseSubtotal,
        discountAmount,
        walletApplied,
        shippingAmount,
        gstTotal,
        cgst,
        sgst,
        0,
        payableTotal,
        input.customerGstin || null,
        input.shippingName,
        input.shippingPhone,
        input.shippingAddress1,
        input.shippingAddress2 || null,
        input.shippingCity,
        input.shippingState,
        input.shippingPincode
      ]
    );

    const orderId = orderResult.insertId as number;

    if (walletApplied > 0) {
      await debitWalletForOrder(conn, userId, orderId, walletApplied, `Wallet payment for order ${on}`);
    }

    for (const line of lines) {
      const [upd]: any = await conn.query(
        'UPDATE products SET stock_qty = stock_qty - ? WHERE id = ? AND deleted_at IS NULL AND stock_qty >= ?',
        [line.qty, line.product_id, line.qty]
      );
      if (!upd.affectedRows) {
        throw new ApiError(400, `Insufficient stock for ${line.name}`);
      }

      await conn.query(
        `INSERT INTO order_items (order_id, product_id, product_name, product_slug, unit_price, gst_rate, line_gst, quantity, line_total)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          orderId,
          line.product_id,
          line.name,
          line.slug,
          line.unit,
          line.gstRate,
          line.lineGst,
          line.qty,
          line.lineSubtotal + line.lineGst
        ]
      );
    }

    await conn.query('DELETE FROM cart_items WHERE user_id = ?', [userId]);

    const year = new Date().getFullYear();
    const invoiceNumber = `INV-${year}-${String(orderId).padStart(6, '0')}`;
    await conn.query('UPDATE orders SET invoice_number = ? WHERE id = ?', [invoiceNumber, orderId]);

    await clearCheckoutIntentConn(conn, userId);

    await conn.commit();

    void persistOrderInvoiceToDisk(orderId).catch((err) => console.error('[orderInvoice]', err));
    void writeAuditLog(`order_created:${orderId}`, userId).catch(() => undefined);

    const orders = await query<any[]>('SELECT * FROM orders WHERE id = :id LIMIT 1', { id: orderId });
    return orders[0];
  } catch (error) {
    if (inTx) await conn.rollback();
    throw error;
  } finally {
    await conn.query(`SELECT RELEASE_LOCK(?)`, [lockName]).catch(() => undefined);
    conn.release();
  }
}

export async function listMyOrders(userId: number) {
  return query<any[]>('SELECT * FROM orders WHERE user_id = :userId ORDER BY id DESC', { userId });
}

export async function getOrderByNumber(orderNumber: string) {
  const orders = await query<any[]>('SELECT * FROM orders WHERE order_number = :orderNumber LIMIT 1', { orderNumber });
  if (!orders[0]) return null;
  const items = await query<any[]>(
    `SELECT id, product_id, product_name, product_slug, unit_price, gst_rate, line_gst, quantity, line_total
     FROM order_items WHERE order_id = :orderId`,
    { orderId: orders[0].id }
  );
  return { ...orders[0], items };
}

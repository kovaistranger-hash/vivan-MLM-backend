import { computeOrderPricing } from './order.service.js';
import { getWalletBalance } from '../wallet/wallet.service.js';
export async function checkoutPreview(req, res) {
    const q = req.validatedQuery;
    const r = await computeOrderPricing(req.user.id, q.pincode, {
        walletApplyAmount: q.walletAmount
    });
    if (!r.ok)
        return res.status(400).json({ success: false, message: r.message });
    const walletBalance = await getWalletBalance(req.user.id);
    res.json({
        success: true,
        merchandiseSubtotal: r.merchandiseSubtotal,
        gstTotal: r.gstTotal,
        shippingAmount: r.shippingAmount,
        totalAmount: r.totalAmount,
        grossTotal: r.grossTotal,
        walletApplied: r.walletApplied,
        payableTotal: r.payableTotal,
        walletBalance,
        zonesConfigured: r.zonesConfigured,
        codGloballyEnabled: r.codEnabled,
        codAvailableForPin: r.codAllowedForPin,
        freeShippingAbove: r.freeShippingAbove,
        defaultShippingFee: r.defaultShippingFee,
        delivery: r.zone
    });
}

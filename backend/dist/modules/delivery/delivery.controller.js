import { countActiveZones, getActiveZoneByPincode } from './pincode.service.js';
import { getSettingsMap, parseBool, parseNumber } from '../settings/settings.service.js';
async function shippingHints() {
    const settings = await getSettingsMap();
    return {
        free_shipping_above: parseNumber(settings.free_shipping_above ?? '999', 999),
        default_shipping_fee: parseNumber(settings.default_shipping_fee ?? '49', 49),
        cod_enabled: parseBool(settings.cod_enabled ?? 'true', true)
    };
}
export async function lookupPincode(req, res) {
    const pincode = String(req.params.pincode || '');
    const hints = await shippingHints();
    const zone = await getActiveZoneByPincode(pincode);
    const zonesConfigured = (await countActiveZones()) > 0;
    if (!zone) {
        if (!zonesConfigured) {
            return res.json({
                success: true,
                configured: false,
                serviceable: true,
                message: 'Pincode zones not configured — default shipping rules apply at checkout.',
                ...hints
            });
        }
        return res.status(404).json({
            success: false,
            serviceable: false,
            message: 'Delivery not available for this PIN code.',
            ...hints
        });
    }
    res.json({
        success: true,
        configured: true,
        serviceable: true,
        pincode: zone.pincode,
        city: zone.city,
        state: zone.state,
        shipping_charge: Number(zone.shipping_charge),
        cod_available: Boolean(zone.cod_available),
        estimated_days: Number(zone.estimated_days),
        ...hints
    });
}

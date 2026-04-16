import { useState, type ReactNode } from 'react';
import { CheckCircle2, Loader2, MapPin, Truck } from 'lucide-react';
import { api } from '../../services/api';
import { toast } from 'sonner';

type PinResult = {
  success?: boolean;
  serviceable?: boolean;
  configured?: boolean;
  message?: string;
  pincode?: string;
  city?: string;
  state?: string;
  shipping_charge?: number;
  cod_available?: boolean;
  estimated_days?: number;
  free_shipping_above?: number;
  default_shipping_fee?: number;
  cod_enabled?: boolean;
};

function estimatedDeliveryBy(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + Math.max(0, Math.round(days)));
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function Row({ ok, label, value, hint }: { ok: boolean; label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/90 px-4 py-3 transition hover:border-emerald-200/60">
      <CheckCircle2 className={`mt-0.5 h-5 w-5 shrink-0 ${ok ? 'text-emerald-600' : 'text-slate-300'}`} strokeWidth={2.2} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-0.5 text-sm font-bold text-slate-900">{value}</p>
        {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
      </div>
    </div>
  );
}

export default function PincodeDeliveryCheck() {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PinResult | null>(null);

  async function check(e?: React.FormEvent) {
    e?.preventDefault();
    const p = pin.replace(/\D/g, '').slice(0, 10);
    if (p.length < 6) {
      toast.message('Enter a valid PIN code (at least 6 digits)');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.get<PinResult>(`/delivery/pincode/${p}`);
      setResult(data);
    } catch (err: unknown) {
      const ax = err as { response?: { status?: number; data?: PinResult } };
      if (ax.response?.status === 404 && ax.response.data) {
        setResult(ax.response.data);
      } else {
        toast.error('Could not check delivery right now');
        setResult(null);
      }
    } finally {
      setLoading(false);
    }
  }

  const ship =
    typeof result?.shipping_charge === 'number'
      ? result.shipping_charge === 0
        ? 'FREE'
        : `₹${result.shipping_charge}`
      : typeof result?.default_shipping_fee === 'number'
        ? `₹${result.default_shipping_fee}`
        : null;

  const etaDays = typeof result?.estimated_days === 'number' ? result.estimated_days : null;
  const deliveryBy = etaDays != null ? estimatedDeliveryBy(etaDays) : null;

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-md shadow-brand-900/20">
          <Truck className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-900">Check delivery to your PIN code</h3>
          <p className="mt-0.5 text-xs text-slate-500">Delivery date, shipping cost, and COD for your area.</p>
        </div>
      </div>
      <form onSubmit={check} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <div className="relative flex-1">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="Enter 6-digit PIN code"
            value={pin}
            maxLength={10}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm font-medium text-slate-900 outline-none ring-brand-400/0 transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-slate-800 active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Check
        </button>
      </form>

      {result ? (
        <div className="mt-4 space-y-3 rounded-2xl border border-emerald-100 bg-gradient-to-b from-emerald-50/40 to-white p-4 shadow-inner animate-fadeIn">
          {result.serviceable === false ? (
            <div className="flex gap-3 rounded-xl border border-rose-100 bg-rose-50/80 px-4 py-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" strokeWidth={2.2} />
              <p className="text-sm font-semibold text-rose-800">{result.message || 'Delivery not available for this PIN code.'}</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-emerald-100/80 pb-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" strokeWidth={2.2} />
                <p className="text-base font-extrabold text-emerald-900">Delivery available</p>
                {result.city && result.state ? (
                  <span className="text-sm font-medium text-slate-600">
                    to <span className="font-bold text-slate-900">{result.city}</span>, {result.state}
                    {result.pincode ? ` · ${result.pincode}` : ''}
                  </span>
                ) : null}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Row
                  ok
                  label="Est. delivery by"
                  value={deliveryBy ?? (etaDays != null ? `${etaDays} business days` : '—')}
                  hint={etaDays != null ? `Based on ${etaDays} business day${etaDays === 1 ? '' : 's'} transit` : undefined}
                />
                <Row
                  ok={!!ship}
                  label="Shipping cost"
                  value={ship ?? '—'}
                  hint={
                    typeof result.free_shipping_above === 'number'
                      ? `Free shipping on orders above ₹${result.free_shipping_above}`
                      : undefined
                  }
                />
                <Row
                  ok={result.cod_available === true}
                  label="Cash on delivery"
                  value={
                    result.cod_available === true ? 'Available for this PIN' : result.cod_available === false ? 'Not available' : '—'
                  }
                  hint={result.cod_enabled === false ? 'COD is turned off store-wide.' : undefined}
                />
                <Row ok label="Service status" value="Dispatch-ready" hint="Final date confirmed at checkout." />
              </div>
              {result.configured === false && result.message ? (
                <p className="text-xs text-slate-500">{result.message}</p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { toast } from 'sonner';

function parseNonNegative(n: string): number {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return 0;
  return v;
}

function parseRate(n: string): number {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return 0;
  if (v > 100) return 100;
  return v;
}

type BinaryStatsResponse = {
  success?: boolean;
  leftBV?: number;
  rightBV?: number;
  todayBinaryIncome?: number;
  totalBinaryIncome?: number;
  weakLeg?: 'left' | 'right';
};

export default function BinaryCalculator() {
  const accessToken = useAuthStore((s) => s.accessToken);

  const [left, setLeft] = useState(0);
  const [right, setRight] = useState(0);
  const [rate, setRate] = useState(10);
  const [todayBinaryIncome, setTodayBinaryIncome] = useState<number | null>(null);
  const [totalBinaryIncome, setTotalBinaryIncome] = useState<number | null>(null);
  const [weakLeg, setWeakLeg] = useState<'left' | 'right' | null>(null);

  const [loading, setLoading] = useState(false);
  const [liveLoaded, setLiveLoaded] = useState(false);

  const [result, setResult] = useState({
    match: 0,
    income: 0,
    leftCarry: 0,
    rightCarry: 0
  });

  const fetchBinaryStats = useCallback(async () => {
    if (!accessToken) {
      setLiveLoaded(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get<BinaryStatsResponse>('/binary/stats');
      setLeft(Number(data.leftBV ?? 0));
      setRight(Number(data.rightBV ?? 0));
      setTodayBinaryIncome(data.todayBinaryIncome != null ? Number(data.todayBinaryIncome) : null);
      setTotalBinaryIncome(data.totalBinaryIncome != null ? Number(data.totalBinaryIncome) : null);
      setWeakLeg(data.weakLeg === 'right' ? 'right' : data.weakLeg === 'left' ? 'left' : null);
      setLiveLoaded(true);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Could not load binary carry');
      setLiveLoaded(false);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void fetchBinaryStats();
  }, [fetchBinaryStats]);

  useEffect(() => {
    const match = Math.min(left, right);
    const income = Math.floor(match * (rate / 100));

    setResult({
      match,
      income,
      leftCarry: left - match,
      rightCarry: right - match
    });
  }, [left, right, rate]);

  const totalLeg = left + right;
  const leftPct = totalLeg > 0 ? Math.round((left / totalLeg) * 100) : 50;
  const rightPct = 100 - leftPct;

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center bg-gradient-to-br from-brand-700 via-violet-700 to-slate-900 p-6">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-slate-900">Binary income calculator</h2>
          <button
            type="button"
            disabled={!accessToken || loading}
            onClick={() => void fetchBinaryStats()}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            Refresh
          </button>
        </div>

        {!accessToken ? (
          <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            <Link to="/login" className="font-semibold text-brand-800 underline">
              Sign in
            </Link>{' '}
            to load your live left/right carry from the server. You can still type values below manually.
          </p>
        ) : liveLoaded ? (
          <p className="mb-4 text-xs text-slate-500">
            Carry values loaded from <span className="font-mono">GET /api/binary/stats</span>. Edit fields to model scenarios;
            use Refresh to reset from the database.
          </p>
        ) : null}

        {todayBinaryIncome != null || totalBinaryIncome != null ? (
          <div className="mb-6 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-2 text-center">
              <p className="text-[11px] font-medium text-emerald-900">Today (binary, IST)</p>
              <p className="text-lg font-bold text-emerald-800">₹{todayBinaryIncome?.toFixed(2) ?? '—'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
              <p className="text-[11px] font-medium text-slate-600">Lifetime binary (wallet)</p>
              <p className="text-lg font-bold text-slate-900">₹{totalBinaryIncome?.toFixed(2) ?? '—'}</p>
            </div>
            {weakLeg ? (
              <div className="col-span-2 rounded-xl border border-violet-100 bg-violet-50/80 px-3 py-2 text-center text-sm text-violet-950">
                Weak leg (smaller carry): <strong className="capitalize">{weakLeg}</strong>
              </div>
            ) : null}
          </div>
        ) : null}

        {totalLeg > 0 ? (
          <div className="mb-6">
            <p className="mb-1 text-xs font-medium text-slate-600">Leg balance (visual)</p>
            <div className="flex h-3 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-sky-500 transition-all" style={{ width: `${leftPct}%` }} title={`Left ${leftPct}%`} />
              <div className="h-full bg-violet-500 transition-all" style={{ width: `${rightPct}%` }} title={`Right ${rightPct}%`} />
            </div>
            <p className="mt-1 text-[10px] text-slate-500">
              Left {leftPct}% · Right {rightPct}%
            </p>
          </div>
        ) : null}

        <div className="space-y-4">
          <div>
            <label htmlFor="binary-calc-left" className="text-sm font-medium text-slate-700">
              Left BV
            </label>
            <input
              id="binary-calc-left"
              type="number"
              min={0}
              value={left}
              onChange={(e) => setLeft(parseNonNegative(e.target.value))}
              className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-slate-900 outline-none ring-brand-200 focus:ring"
              placeholder="Enter left BV"
              title="Left leg business volume (carry)"
            />
          </div>

          <div>
            <label htmlFor="binary-calc-right" className="text-sm font-medium text-slate-700">
              Right BV
            </label>
            <input
              id="binary-calc-right"
              type="number"
              min={0}
              value={right}
              onChange={(e) => setRight(parseNonNegative(e.target.value))}
              className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-slate-900 outline-none ring-brand-200 focus:ring"
              placeholder="Enter right BV"
              title="Right leg business volume (carry)"
            />
          </div>

          <div>
            <label htmlFor="binary-calc-rate" className="text-sm font-medium text-slate-700">
              Binary %
            </label>
            <input
              id="binary-calc-rate"
              type="number"
              min={0}
              max={100}
              value={rate}
              onChange={(e) => setRate(parseRate(e.target.value))}
              className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-slate-900 outline-none ring-brand-200 focus:ring"
              placeholder="e.g. 10"
              title="Binary match percentage (estimate)"
            />
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-slate-100 p-4 text-center">
            <p className="text-sm text-slate-600">Matched BV</p>
            <p className="text-lg font-bold text-slate-900">{result.match}</p>
          </div>

          <div className="rounded-xl bg-emerald-50 p-4 text-center ring-1 ring-emerald-100">
            <p className="text-sm text-emerald-800">Estimated income</p>
            <p className="text-lg font-bold text-emerald-700">₹{result.income}</p>
          </div>

          <div className="rounded-xl bg-sky-50 p-4 text-center ring-1 ring-sky-100">
            <p className="text-sm text-sky-800">Left carry</p>
            <p className="text-lg font-bold text-sky-700">{result.leftCarry}</p>
          </div>

          <div className="rounded-xl bg-violet-50 p-4 text-center ring-1 ring-violet-100">
            <p className="text-sm text-violet-800">Right carry</p>
            <p className="text-lg font-bold text-violet-700">{result.rightCarry}</p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Estimated income = min(left BV, right BV) × percentage. Platform applies caps, TDS, admin fees, and daily cron rules —
          this is not a payout guarantee.
        </p>

        <p className="mt-4 text-center text-sm">
          <Link to="/referral" className="font-semibold text-brand-700 hover:underline">
            Back to referrals
          </Link>
        </p>
      </div>
    </div>
  );
}

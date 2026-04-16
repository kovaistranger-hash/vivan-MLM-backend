import { memo } from 'react';

type Props = {
  summary: Record<string, unknown> | null;
};

function Stat({ label, value, hint }: { label: string; value: number | undefined; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-bold tabular-nums text-slate-900">₹{Number(value ?? 0).toFixed(2)}</p>
      {hint ? <p className="mt-1 text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

function BinarySummaryPanelInner({ summary }: Props) {
  const s = (summary as { summary?: Record<string, unknown> })?.summary;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md sm:p-6">
      <h2 className="text-lg font-bold text-slate-900">Binary wallet snapshot</h2>
      <p className="mt-1 text-sm text-slate-600">Carry, caps, and lifetime commission totals.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Left carry (profit ₹)" value={s?.leftCarry as number | undefined} />
        <Stat label="Right carry (profit ₹)" value={s?.rightCarry as number | undefined} />
        <Stat
          label="Matched payout today (binary)"
          value={s?.todayBinaryPaid as number | undefined}
          hint={`IST date ${String(s?.summaryDate || '')}`}
        />
        <Stat label="Blocked by daily ceiling (today)" value={s?.todayCeilingBlocked as number | undefined} />
        <Stat label="Lifetime direct referral" value={s?.lifetimeDirectReferralInr as number | undefined} />
        <Stat label="Lifetime binary match" value={s?.lifetimeBinaryMatchInr as number | undefined} />
        <Stat label="Lifetime ceiling holds" value={s?.lifetimeCeilingBlockedInr as number | undefined} />
      </div>
    </div>
  );
}

export default memo(BinarySummaryPanelInner);

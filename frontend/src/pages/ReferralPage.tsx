import { memo, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
import FadeInSection from '@/components/motion/FadeInSection';
import GenealogyTree from '@/components/referral/GenealogyTree';
import BinaryPlacementModal, { type PlacementModalState } from '@/components/referral/BinaryPlacementModal';
import HeroEarningsBanner from '@/components/dashboard/HeroEarningsBanner';
import NetworkStatsGrid from '@/components/dashboard/NetworkStatsGrid';
import BinarySummaryPanel from '@/components/dashboard/BinarySummaryPanel';
import { useMlmStore } from '@/stores/mlmStore';
import { registrationReferralCode } from '@/utils/referralCode';
function ReferralPageInner() {
  const {
    loading,
    me,
    authMeUser,
    mlmStats,
    summary,
    directs,
    commissions,
    tree,
    compliance,
    loadReferralPage
  } = useMlmStore(
    useShallow((s) => ({
      loading: s.loading,
      me: s.me,
      authMeUser: s.authMeUser,
      mlmStats: s.mlmStats,
      summary: s.summary,
      directs: s.directs,
      commissions: s.commissions,
      tree: s.tree,
      compliance: s.compliance,
      loadReferralPage: s.loadReferralPage
    }))
  );

  const [placementOpen, setPlacementOpen] = useState(false);
  const [placementState, setPlacementState] = useState<PlacementModalState | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void loadReferralPage();
  }, [loadReferralPage]);

  const openPlacement = useCallback((payload: PlacementModalState) => {
    setPlacementState(payload);
    setPlacementOpen(true);
  }, []);

  const closePlacement = useCallback(() => {
    setPlacementOpen(false);
    setPlacementState(null);
  }, []);

  const copyRegistrationCode = useCallback(async () => {
    const code = registrationReferralCode(me, authMeUser);
    if (!code) {
      toast.message('Referral code not loaded yet');
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('Code copied — share it to invite earners');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy');
    }
  }, [me, authMeUser]);

  if (loading) {
    return <p className="mx-auto max-w-4xl p-6 text-sm text-slate-500">Loading your dashboard…</p>;
  }

  const unplacedDirects = directs.filter((d) => d.placement_parent_user_id == null);
  const myRegistrationCode = registrationReferralCode(me, authMeUser);
  const displayRegistrationCode = myRegistrationCode || 'Generating…';

  return (
    <FadeInSection className="mx-auto max-w-5xl space-y-8 p-4 sm:p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Earn &amp; grow</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your referral code is for <strong>registration</strong>. Binary legs are placed from the tree below.{' '}
          <Link to="/referral/binary-calculator" className="font-semibold text-brand-700 hover:underline">
            Binary calculator
          </Link>
        </p>
      </div>

      <HeroEarningsBanner
        totalIncome={mlmStats.totalIncome}
        todayIncome={mlmStats.todayIncome}
        teamSize={directs.length}
        loading={false}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-md">
          <h3 className="text-sm font-bold text-slate-900">Trust score</h3>
          {compliance.userScore ? (
            <>
              <p className="mt-2 text-3xl font-bold text-violet-700">{compliance.userScore.score}</p>
              <p className="text-sm text-slate-600">Level: {compliance.userScore.level}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Score not available yet.</p>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-md">
          <h3 className="text-sm font-bold text-slate-900">KYC</h3>
          {compliance.kyc ? (
            <p className="mt-2 text-sm text-slate-700">
              Verified:{' '}
              <strong>{(compliance.kyc.userKycVerified as boolean) ? 'Yes' : 'No'}</strong> · Level{' '}
              <strong>{String(compliance.kyc.userKycLevel ?? 0)}</strong>
              {compliance.kyc.latest && typeof compliance.kyc.latest === 'object' ? (
                <span className="block text-xs text-slate-500">
                  Last app: {(compliance.kyc.latest as { status?: string }).status}
                </span>
              ) : null}
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-500">KYC status loading…</p>
          )}
          <Link to="/kyc" className="mt-3 inline-block text-sm font-semibold text-brand-800 hover:underline">
            Complete KYC →
          </Link>
        </div>
      </div>

      <NetworkStatsGrid stats={mlmStats} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md">
          <h2 className="text-sm font-bold text-slate-900">Invite with your code</h2>
          <p className="mt-3 font-mono text-2xl font-bold tracking-widest text-brand-900 sm:text-3xl">
            {displayRegistrationCode}
          </p>
          <p className="mt-2 text-xs text-slate-600">
            Friends enter this in <strong>Register</strong> as sponsor code. It does not place the binary leg — you do
            that in the tree.
          </p>
          <button
            type="button"
            disabled={!myRegistrationCode}
            onClick={() => void copyRegistrationCode()}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-100 disabled:opacity-40"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copied ? 'Copied' : 'Copy & invite'}
          </button>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md">
          <h2 className="text-sm font-bold text-slate-900">Your sponsor</h2>
          {me?.sponsor_user_id ? (
            <p className="mt-3 text-sm text-slate-700">
              {me.sponsor_name || '-'} <span className="text-slate-500">({me.sponsor_email})</span>
            </p>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No sponsor on file.</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-md sm:p-6">
        <h2 className="text-lg font-bold text-slate-900">Genealogy tree</h2>
        <p className="mt-1 text-xs text-slate-500 sm:text-sm">
          You are at the root. Tap <strong>Available</strong> to place a sponsored member who is not yet on the binary
          tree — only under you or your binary downline.
        </p>
        {unplacedDirects.length > 0 ? (
          <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50/90 px-3 py-2 text-xs text-rose-950">
            <span className="font-semibold">Needs placement ({unplacedDirects.length}):</span>{' '}
            {unplacedDirects.map((d) => (
              <span key={d.id} className="ml-1 font-mono">
                {d.referral_code}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/80 p-3 sm:p-5">
          <GenealogyTree node={tree} onOpenPlacement={openPlacement} />
        </div>
      </div>

      <BinarySummaryPanel summary={summary} />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md">
        <h2 className="text-lg font-bold text-slate-900">Direct referrals</h2>
        {directs.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No directs yet — share your code to grow your team.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {directs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <span className="font-medium text-slate-800">{d.name}</span>
                  <span className="ml-2 text-slate-500">{d.email}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-brand-800">{d.referral_code}</span>
                  {d.placement_parent_user_id == null ? (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-900">
                      Binary pending
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-900">
                      Binary {d.placement_side === 'right' ? 'R' : 'L'}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md">
        <h2 className="text-lg font-bold text-slate-900">Wallet impact (commissions)</h2>
        {(summary as { walletImpact?: Record<string, unknown>[] })?.walletImpact?.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-slate-500">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {(summary as { walletImpact: Record<string, unknown>[] }).walletImpact.map((w) => (
                  <tr key={String(w.id)} className="border-b border-slate-50">
                    <td className="py-2 pr-4 text-slate-600">{new Date(String(w.created_at)).toLocaleString()}</td>
                    <td className="py-2 pr-4">{String(w.type)}</td>
                    <td className="py-2 pr-4 font-medium text-emerald-700">+₹{Number(w.amount).toFixed(2)}</td>
                    <td className="py-2 text-slate-600">{String(w.description ?? '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No commission wallet credits yet.</p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md">
        <h2 className="text-lg font-bold text-slate-900">Commission history</h2>
        {commissions.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No commission rows yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-slate-500">
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Order</th>
                  <th className="py-2 pr-4">Gross basis</th>
                  <th className="py-2 pr-4">Wallet</th>
                  <th className="py-2">Ceiling hold</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((c) => (
                  <tr key={String(c.id)} className="border-b border-slate-50">
                    <td className="py-2 pr-4 text-slate-600">{new Date(String(c.created_at)).toLocaleString()}</td>
                    <td className="py-2 pr-4">{String(c.commission_type)}</td>
                    <td className="py-2 pr-4">{String(c.order_number || '—')}</td>
                    <td className="py-2 pr-4">₹{Number(c.gross_amount).toFixed(2)}</td>
                    <td className="py-2 pr-4">₹{Number(c.wallet_amount).toFixed(2)}</td>
                    <td className="py-2">₹{Number(c.ceiling_blocked_amount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <BinaryPlacementModal
        open={placementOpen}
        state={placementState}
        onClose={closePlacement}
        onPlaced={() => void useMlmStore.getState().loadReferralPage()}
      />
    </FadeInSection>
  );
}

export default memo(ReferralPageInner);

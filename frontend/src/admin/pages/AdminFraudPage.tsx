import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/services/api';
import { toast } from 'sonner';

type FraudLog = {
  id: number;
  user_id: number;
  type: string;
  risk_score: number;
  message: string;
  created_at: string;
  email: string;
  name: string;
};

type HighRisk = {
  user_id: number;
  max_score: number;
  email: string;
  name: string;
  last_at: string;
};

type Overview = {
  success: boolean;
  recentLogs: FraudLog[];
  highRiskUsers: HighRisk[];
};

export default function AdminFraudPage() {
  const [data, setData] = useState<Overview | null>(null);

  const load = useCallback(() => {
    api
      .get<Overview>('/admin/fraud/overview')
      .then((r) => setData(r.data))
      .catch(() => toast.error('Could not load fraud overview'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const scan = (userId: number) => {
    api
      .post<{ success: boolean; riskScore: number; issues: { code: string; message: string }[] }>(
        `/admin/fraud/scan/${userId}`
      )
      .then((r) => {
        toast.message(`User #${userId} risk ${r.data.riskScore}`, {
          description: r.data.issues?.map((i) => i.message).join(' · ') || 'No issues'
        });
        load();
      })
      .catch(() => toast.error('Scan failed'));
  };

  if (!data?.success) {
    return <p className="p-6 text-sm text-slate-500">Loading...</p>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-600/90">Compliance</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Fraud detection</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          High scores trigger audit logs; scores at or above 70 block withdrawals and may auto-lock the wallet when{' '}
          <code className="rounded bg-slate-100 px-1 text-xs">FRAUD_AUTO_FREEZE</code> is enabled.
        </p>
      </div>

      <section className="rounded-2xl border border-rose-200/80 bg-rose-50/50 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-rose-900">High-risk members (14 days)</h2>
        <p className="mt-1 text-xs text-rose-800/80">Latest aggregate score from fraud logs.</p>
        {data.highRiskUsers.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No elevated scores in this window.</p>
        ) : (
          <ul className="mt-4 divide-y divide-rose-200/60">
            {data.highRiskUsers.map((u) => (
              <li key={u.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-slate-900">
                    {u.name}{' '}
                    <span className="font-mono text-xs text-slate-500">#{u.user_id}</span>
                  </p>
                  <p className="text-xs text-slate-600">{u.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-rose-600 px-3 py-1 text-xs font-bold text-white">
                    score {u.max_score}
                  </span>
                  <Link
                    to={`/admin/referrals/${u.user_id}`}
                    className="text-xs font-medium text-violet-700 hover:underline"
                  >
                    Profile
                  </Link>
                  <button
                    type="button"
                    onClick={() => scan(u.user_id)}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Re-scan
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await api.post(`/admin/wallets/${u.user_id}/unlock-fraud`);
                        toast.success(`Fraud lock cleared for #${u.user_id}`);
                        load();
                      } catch {
                        toast.error('Unlock failed');
                      }
                    }}
                    className="rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                  >
                    Unlock wallet
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Recent fraud logs</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Time</th>
                <th className="py-2 pr-3">User</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Score</th>
                <th className="py-2">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.recentLogs.map((row) => (
                <tr key={row.id} className="text-slate-700">
                  <td className="py-2 pr-3 font-mono text-xs text-slate-500">{String(row.created_at).slice(0, 19)}</td>
                  <td className="py-2 pr-3">
                    <span className="font-medium">{row.name}</span>
                    <span className="ml-1 font-mono text-xs text-slate-500">#{row.user_id}</span>
                  </td>
                  <td className="py-2 pr-3">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium">{row.type}</span>
                  </td>
                  <td className="py-2 pr-3 font-semibold text-rose-700">{row.risk_score}</td>
                  <td className="max-w-md py-2 text-xs leading-snug text-slate-600">{row.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

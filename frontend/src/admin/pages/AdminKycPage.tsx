import { useCallback, useEffect, useState } from 'react';
import { api } from '@/services/api';
import { toast } from 'sonner';

type Row = {
  id: number;
  user_id: number;
  tier: string;
  pan_number: string;
  aadhaar_number: string | null;
  document_url: string;
  selfie_url: string | null;
  status: string;
  created_at: string;
  email: string;
  name: string;
};

export default function AdminKycPage() {
  const [items, setItems] = useState<Row[]>([]);

  const load = useCallback(() => {
    api
      .get<{ success: boolean; items: Row[] }>('/admin/kyc/pending')
      .then((r) => setItems(r.data.items || []))
      .catch(() => toast.error('Could not load pending KYC'));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(row: Row, status: 'verified' | 'rejected') {
    let rejectionReason: string | null = null;
    if (status === 'rejected') {
      const r = window.prompt('Rejection reason (required):')?.trim();
      if (!r) {
        toast.error('A rejection reason is required');
        return;
      }
      rejectionReason = r;
    }
    try {
      await api.post(`/admin/kyc/records/${row.id}/decision`, {
        status,
        rejectionReason
      });
      toast.success('KYC updated');
      void load();
    } catch {
      toast.error('Update failed');
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-600/90">Compliance</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">KYC queue</h1>
        <p className="mt-2 text-sm text-slate-600">Verify PAN submissions and assign L1 / L2 from the application tier.</p>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-slate-500">No pending applications.</p>
      ) : (
        <div className="space-y-4">
          {items.map((row) => (
            <div
              key={row.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">
                    {row.name} <span className="font-mono text-xs text-slate-500">#{row.user_id}</span>
                  </p>
                  <p className="text-xs text-slate-600">{row.email}</p>
                  <p className="mt-2 font-mono text-sm">
                    PAN {row.pan_number} · Aadhaar ref {row.aadhaar_number || '—'} · {row.tier}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Submitted {String(row.created_at).slice(0, 19)}</p>
                  <a
                    href={row.document_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-xs font-medium text-violet-700 hover:underline"
                  >
                    PAN document
                  </a>
                  {row.selfie_url ? (
                    <a
                      href={row.selfie_url}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-3 inline-block text-xs font-medium text-violet-700 hover:underline"
                    >
                      Selfie
                    </a>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void decide(row, 'verified')}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    Verify
                  </button>
                  <button
                    type="button"
                    onClick={() => void decide(row, 'rejected')}
                    className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/services/api';
import { toast } from 'sonner';

type KycStatus = {
  userKycVerified: boolean;
  userKycLevel: number;
  latest: {
    id: number;
    tier: string;
    status: string;
    rejectionReason: string | null;
    verifiedAt: string | null;
    createdAt: string;
  } | null;
};

export default function KycPage() {
  const [status, setStatus] = useState<KycStatus | null>(null);
  const [pan, setPan] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [tier, setTier] = useState<'L1' | 'L2'>('L1');
  const [panFile, setPanFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    api
      .get<{ success: boolean; kyc: KycStatus }>('/kyc/status')
      .then((r) => setStatus(r.data.kyc))
      .catch(() => toast.error('Could not load KYC status'));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!panFile) {
      toast.error('Upload a clear photo of your PAN card');
      return;
    }
    if (tier === 'L2' && !selfieFile) {
      toast.error('L2 requires a selfie holding your ID');
      return;
    }
    const fd = new FormData();
    fd.append('pan', pan.trim().toUpperCase());
    fd.append('aadhaar', aadhaar.replace(/\D/g, ''));
    fd.append('tier', tier);
    fd.append('panDocument', panFile);
    if (selfieFile) fd.append('selfie', selfieFile);
    setSubmitting(true);
    try {
      await api.post('/kyc/submit', fd);
      toast.success('KYC submitted for review');
      setPan('');
      setAadhaar('');
      setPanFile(null);
      setSelfieFile(null);
      void load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <Link to="/dashboard" className="text-sm text-brand-700 hover:underline">
        Back to dashboard
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">KYC verification</h1>
        <p className="mt-2 text-sm text-slate-600">
          L1: PAN + PAN card image. L2: also a selfie. Aadhaar number is stored masked (last 4 digits). Documents upload to
          Cloudinary when configured, otherwise to server <code className="text-xs">uploads/kyc</code>.
        </p>
      </div>

      {status ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
          <p>
            <span className="font-medium">Account KYC:</span>{' '}
            {status.userKycVerified ? (
              <span className="text-emerald-700">Verified (level {status.userKycLevel})</span>
            ) : (
              <span className="text-amber-700">Not verified</span>
            )}
          </p>
          {status.latest ? (
            <p className="mt-2">
              Latest application: <strong>{status.latest.status}</strong> ({status.latest.tier}) — submitted{' '}
              {String(status.latest.createdAt).slice(0, 10)}
              {status.latest.rejectionReason ? (
                <span className="mt-1 block text-rose-700">Reason: {status.latest.rejectionReason}</span>
              ) : null}
            </p>
          ) : (
            <p className="mt-2 text-slate-500">No applications yet.</p>
          )}
        </div>
      ) : null}

      <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-slate-600">Tier</label>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={tier}
            onChange={(e) => setTier(e.target.value as 'L1' | 'L2')}
          >
            <option value="L1">L1 — PAN + document</option>
            <option value="L2">L2 — PAN + Aadhaar + document + selfie</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">PAN (10 characters)</label>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm uppercase"
            value={pan}
            onChange={(e) => setPan(e.target.value)}
            maxLength={10}
            autoComplete="off"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Aadhaar (12 digits)</label>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
            value={aadhaar}
            onChange={(e) => setAadhaar(e.target.value)}
            maxLength={14}
            inputMode="numeric"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">PAN card image</label>
          <input
            type="file"
            accept="image/*"
            className="mt-1 w-full text-sm"
            onChange={(e) => setPanFile(e.target.files?.[0] || null)}
          />
        </div>
        {tier === 'L2' ? (
          <div>
            <label className="block text-xs font-medium text-slate-600">Selfie</label>
            <input
              type="file"
              accept="image/*"
              className="mt-1 w-full text-sm"
              onChange={(e) => setSelfieFile(e.target.files?.[0] || null)}
            />
          </div>
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-800 py-2.5 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-60"
        >
          {submitting ? 'Submitting...' : 'Submit for review'}
        </button>
      </form>
    </div>
  );
}

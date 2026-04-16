import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { api } from '../../services/api';
import { toast } from 'sonner';
import { durations, easings } from '../motion/motionTokens';

export type PlacementModalState = {
  parentReferralCode: string;
  parentDisplayName: string;
  side: 'left' | 'right';
};

type Props = {
  open: boolean;
  state: PlacementModalState | null;
  onClose: () => void;
  onPlaced: () => void;
};

export default function BinaryPlacementModal({ open, state, onClose, onPlaced }: Props) {
  const [memberCode, setMemberCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setMemberCode('');
  }, [open, state?.parentReferralCode, state?.side]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  async function confirm() {
    if (!state) return;
    const c = memberCode.trim().toUpperCase();
    if (c.length < 4) {
      toast.error('Enter the member’s referral code');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/referral/place-binary', {
        childReferralCode: c,
        parentReferralCode: state.parentReferralCode.trim().toUpperCase(),
        side: state.side
      });
      toast.success('Placement saved');
      onPlaced();
      onClose();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Placement failed');
    } finally {
      setSubmitting(false);
    }
  }

  const modal =
    open &&
    state &&
    createPortal(
      <AnimatePresence>
        <div className="fixed inset-0 z-[120] flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="placement-modal-title">
          <motion.button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: durations.fast }}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: durations.base, ease: easings.smooth }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 id="placement-modal-title" className="text-lg font-semibold text-slate-900">
                  Binary placement
                </h2>
                <p className="mt-1 text-xs text-slate-500">Place a sponsored member who is not yet on your binary tree.</p>
              </div>
              <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <p>
                  <span className="font-medium text-slate-900">Under:</span> {state.parentDisplayName}
                </p>
                <p className="mt-0.5 font-mono text-xs text-slate-600">{state.parentReferralCode}</p>
                <p className="mt-2">
                  <span className="font-medium text-slate-900">Side:</span>{' '}
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-900">
                    {state.side === 'left' ? 'Left leg' : 'Right leg'}
                  </span>
                </p>
              </div>
              <label className="block text-sm font-medium text-slate-700">
                Member referral code
                <input
                  value={memberCode}
                  onChange={(e) => setMemberCode(e.target.value.toUpperCase())}
                  placeholder="e.g. ABCD12EF"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-sm uppercase outline-none ring-brand-200 focus:ring-2"
                  autoComplete="off"
                />
              </label>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={confirm}
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {submitting ? 'Saving…' : 'Confirm placement'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>,
      document.body
    );

  return <>{modal}</>;
}

import { memo, useEffect, useState } from 'react';
import { api } from '@/services/api';

export type NotificationItem = {
  id: number;
  message: string;
  is_read: boolean;
  created_at: string;
};

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '';
  }
}

function NotificationsInner() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<{ success?: boolean; notifications?: NotificationItem[] }>('/notifications');
        if (cancelled) return;
        const list = res.data?.notifications;
        setItems(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setError('Could not load notifications');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md sm:p-6">
      <h2 className="text-lg font-bold text-slate-900">Notifications</h2>
      <p className="mt-1 text-sm text-slate-600">Income, team joins, and withdrawal updates.</p>

      {loading ? (
        <p className="mt-6 text-sm text-slate-500">Loading…</p>
      ) : error ? (
        <p className="mt-6 text-sm text-rose-600">{error}</p>
      ) : items.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">You&apos;re all caught up — no notifications yet.</p>
      ) : (
        <ul className="mt-5 max-h-[320px] space-y-2 overflow-y-auto pr-1">
          {items.map((n) => (
            <li
              key={n.id}
              className={`rounded-xl border px-3 py-2.5 text-sm leading-snug shadow-sm ${
                n.is_read ? 'border-slate-100 bg-slate-50/80 text-slate-700' : 'border-brand-100 bg-brand-50/40 text-slate-900'
              }`}
            >
              <p>{n.message}</p>
              {n.created_at ? (
                <p className="mt-1 text-[11px] font-medium text-slate-400">{formatTime(String(n.created_at))}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default memo(NotificationsInner);

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { RawNodeDatum } from 'react-d3-tree/lib/types/types/common.js';
import BinaryNetworkTree from '@/components/admin/BinaryNetworkTree';
import { api } from '../../services/api';
import { toast } from 'sonner';

function TreeNode({ n, depth = 0 }: { n: any; depth?: number }) {
  if (!n) return null;
  const pad = depth * 12;
  return (
    <div style={{ marginLeft: pad }} className="mt-2 border-l border-slate-200 pl-3 text-sm">
      <div className="font-medium text-slate-900">
        #{n.id} {n.name}{' '}
        <span className="font-mono text-xs text-brand-800">{n.referral_code}</span>
      </div>
      {n.childrenTruncated ? <p className="text-xs text-amber-600">Max depth reached.</p> : null}
      {n.left ? (
        <div className="mt-1">
          <span className="text-xs font-semibold text-slate-500">L</span> <TreeNode n={n.left} depth={depth + 1} />
        </div>
      ) : null}
      {n.right ? (
        <div className="mt-1">
          <span className="text-xs font-semibold text-slate-500">R</span> <TreeNode n={n.right} depth={depth + 1} />
        </div>
      ) : null}
    </div>
  );
}

export default function AdminReferralUserPage() {
  const { userId } = useParams();
  const [data, setData] = useState<any>(null);
  const [treeDepth, setTreeDepth] = useState(5);
  const [treeD3, setTreeD3] = useState<RawNodeDatum | null>(null);

  useEffect(() => {
    if (!userId) return;
    api
      .get(`/admin/referrals/${userId}`)
      .then((r) => setData(r.data))
      .catch((e) => toast.error(e.response?.data?.message || 'Load failed'));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    api
      .get<{ success: boolean; tree: RawNodeDatum | null }>(
        `/admin/referrals/${userId}/binary-tree-d3`,
        { params: { depth: treeDepth } }
      )
      .then((r) => setTreeD3(r.data.success ? r.data.tree : null))
      .catch(() => toast.error('Could not load binary network tree'));
  }, [userId, treeDepth]);

  if (!data) return <p className="p-6 text-sm text-slate-500">Loading...</p>;

  const p = data.profile;
  const carry = data.binaryCarry;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <Link to="/admin/referrals" className="text-sm text-brand-700 hover:underline">
        ← Referrals
      </Link>
      <h1 className="text-2xl font-semibold text-slate-900">
        Referral · {p?.name} <span className="text-base font-normal text-slate-500">#{userId}</span>
      </h1>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-sm">
          <h2 className="font-semibold text-slate-900">Profile</h2>
          <dl className="mt-2 space-y-1 text-slate-600">
            <div>
              <dt className="text-xs text-slate-400">Code</dt>
              <dd className="font-mono">{p?.referral_code}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Sponsor</dt>
              <dd>{p?.sponsor_email || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Placement</dt>
              <dd>
                {p?.placement_parent_user_id
                  ? `#${p.placement_parent_user_id} (${p.placement_parent_email}) · ${p.placement_side}`
                  : '—'}
              </dd>
            </div>
          </dl>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-sm">
          <h2 className="font-semibold text-slate-900">Binary carry</h2>
          {carry ? (
            <dl className="mt-2 space-y-1 text-slate-600">
              <div>
                Left profit carry: <strong>₹{Number(carry.left_profit_carry).toFixed(2)}</strong>
              </div>
              <div>
                Right profit carry: <strong>₹{Number(carry.right_profit_carry).toFixed(2)}</strong>
              </div>
            </dl>
          ) : (
            <p className="mt-2 text-slate-500">No carry row (zeros).</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-slate-900">Direct referrals</h2>
        <ul className="mt-2 divide-y text-sm">
          {(data.directs || []).map((d: any) => (
            <li key={d.id} className="flex justify-between py-2">
              <span>{d.name}</span>
              <span className="text-slate-500">{d.email}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-900">Binary network</h2>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            Depth
            <select
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800"
              value={treeDepth}
              onChange={(e) => setTreeDepth(Number(e.target.value))}
            >
              {[3, 4, 5, 6, 7, 8].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Drag to pan, scroll to zoom. Weak leg is highlighted on nodes. Click a node to expand or collapse.
        </p>
        <div className="mt-3">
          <BinaryNetworkTree data={treeD3} />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-slate-900">Binary tree (text preview)</h2>
        <div className="mt-2 max-h-[320px] overflow-auto rounded-lg bg-slate-50 p-3">
          <TreeNode n={data.binaryTree} />
        </div>
      </div>
    </div>
  );
}

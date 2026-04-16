import { motion } from 'framer-motion';
import { UserPlus } from 'lucide-react';
import type { PlacementModalState } from './BinaryPlacementModal';

export type BinaryTreeNode = {
  id: number;
  name: string;
  email?: string;
  referral_code: string;
  left?: BinaryTreeNode | null;
  right?: BinaryTreeNode | null;
  childrenTruncated?: boolean;
};

type Props = {
  node: BinaryTreeNode | null;
  onOpenPlacement: (payload: PlacementModalState) => void;
  depth?: number;
};

function NodeCard({ node }: { node: BinaryTreeNode }) {
  return (
    <div className="min-w-[10rem] max-w-[14rem] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center shadow-sm">
      <p className="truncate text-sm font-semibold text-slate-900" title={node.name}>
        {node.name || 'Member'}
      </p>
      <p className="mt-0.5 text-[11px] text-slate-500">#{node.id}</p>
      {node.referral_code ? (
        <p className="mt-1 truncate font-mono text-[11px] font-medium text-brand-800" title={node.referral_code}>
          {node.referral_code}
        </p>
      ) : (
        <p className="mt-1 text-[11px] text-slate-400">No code</p>
      )}
    </div>
  );
}

function LegColumn({
  label,
  side,
  child,
  parent,
  depth,
  onOpenPlacement
}: {
  label: string;
  side: 'left' | 'right';
  child: BinaryTreeNode | null | undefined;
  parent: BinaryTreeNode;
  depth: number;
  onOpenPlacement: (payload: PlacementModalState) => void;
}) {
  const filled = child != null;

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      {filled ? (
        <GenealogyTreeInner node={child} onOpenPlacement={onOpenPlacement} depth={depth + 1} />
      ) : (
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          onClick={() =>
            onOpenPlacement({
              parentReferralCode: parent.referral_code,
              parentDisplayName: parent.name || `Member #${parent.id}`,
              side
            })
          }
          className="flex min-h-[5.5rem] min-w-[10rem] max-w-[14rem] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-emerald-300/80 bg-emerald-50/50 px-3 py-3 text-center transition hover:border-emerald-400 hover:bg-emerald-50"
        >
          <UserPlus className="h-5 w-5 text-emerald-700" aria-hidden />
          <span className="text-xs font-semibold text-emerald-900">Available</span>
          <span className="text-[10px] text-emerald-800/90">Tap to place</span>
        </motion.button>
      )}
    </div>
  );
}

function GenealogyTreeInner({ node, onOpenPlacement, depth = 0 }: Props) {
  if (!node) {
    return <p className="text-sm text-slate-400">No tree data.</p>;
  }

  const hasKids = node.left != null || node.right != null;
  const truncatedLeaf = node.childrenTruncated && !hasKids;

  return (
    <div className="flex flex-col items-center gap-3">
      <NodeCard node={node} />
      {truncatedLeaf ? (
        <p className="max-w-xs text-center text-[11px] text-slate-400">More levels exist — tree preview is limited by depth.</p>
      ) : (
        <div className="flex w-full max-w-full flex-col items-stretch gap-4 sm:flex-row sm:justify-center sm:gap-8">
          <LegColumn label="Left" side="left" child={node.left} parent={node} depth={depth} onOpenPlacement={onOpenPlacement} />
          <LegColumn label="Right" side="right" child={node.right} parent={node} depth={depth} onOpenPlacement={onOpenPlacement} />
        </div>
      )}
    </div>
  );
}

export default function GenealogyTree(props: Props) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="mx-auto flex min-w-[min(100%,20rem)] justify-center px-1">
        <GenealogyTreeInner {...props} depth={props.depth ?? 0} />
      </div>
    </div>
  );
}

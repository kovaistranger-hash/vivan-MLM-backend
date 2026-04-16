import type { Dispatch, SetStateAction } from 'react';
import { createContext, useContext, useId, useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Tree from 'react-d3-tree';
import type { CustomNodeElementProps, RawNodeDatum } from 'react-d3-tree/lib/types/types/common.js';

type TipState = { x: number; y: number; title: string; lines: string[] } | null;

function noopSetTip(_action: SetStateAction<TipState>) {}

const TooltipCtx = createContext<Dispatch<SetStateAction<TipState>>>(noopSetTip);

function fmtInr(n: number) {
  return `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function NodeCard({ nodeDatum, toggleNode, shadowFilterId }: CustomNodeElementProps & { shadowFilterId: string }) {
  const setTip = useContext(TooltipCtx);
  const leg = String(nodeDatum.attributes?.leg ?? '');
  const weak = String(nodeDatum.attributes?.weakLeg ?? '');
  const weakLeft = weak.includes('left');
  const weakRight = weak.includes('right');
  const isWeak = (weakLeft && leg === 'left') || (weakRight && leg === 'right');
  const stroke = isWeak
    ? weakLeft
      ? '#ef4444'
      : '#10b981'
    : leg === 'root'
      ? '#a78bfa'
      : '#cbd5e1';
  const a = nodeDatum.attributes || {};
  const total = Number(a.totalInr ?? Number(a.binaryInr ?? 0) + Number(a.directInr ?? 0));
  const team = Number(a.teamSize ?? 0);
  const rank = Number(a.rankLevel ?? 1);

  const tipLines = [
    `Total income (wallet): ${fmtInr(total)}`,
    `Team size (L+R): ${team}`,
    `Network level: ${rank}`,
    `BV L / R: ${a.leftBV} / ${a.rightBV}`,
    `Carry L / R: ${a.carryL} / ${a.carryR}`
  ];

  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      onClick={() => toggleNode()}
      onPointerEnter={(e) => {
        e.stopPropagation();
        setTip({
          x: e.clientX + 14,
          y: e.clientY + 14,
          title: String(nodeDatum.name || 'Member'),
          lines: tipLines
        });
      }}
      onPointerMove={(e) => {
        e.stopPropagation();
        setTip((prev) =>
          prev
            ? { ...prev, x: e.clientX + 14, y: e.clientY + 14 }
            : {
                x: e.clientX + 14,
                y: e.clientY + 14,
                title: String(nodeDatum.name || 'Member'),
                lines: tipLines
              }
        );
      }}
      onPointerLeave={() => setTip(null)}
      className="cursor-pointer"
    >
      <title>{tipLines.join('\n')}</title>
      <rect
        x={-108}
        y={-52}
        width={216}
        height={104}
        rx={16}
        fill="white"
        stroke={stroke}
        strokeWidth={isWeak ? 2.4 : 1.25}
        filter={`url(#${shadowFilterId})`}
      />
      <rect x={-32} y={-40} width={64} height={18} rx={6} fill="#ede9fe" stroke="#ddd6fe" strokeWidth={0.6} />
      <text x={0} y={-27} textAnchor="middle" className="fill-violet-700 text-[9px] font-bold">
        {fmtInr(total)}
      </text>
      <text x={0} y={-8} textAnchor="middle" className="fill-slate-900 text-[11px] font-semibold">
        {String(nodeDatum.name || '').slice(0, 26)}
      </text>
      <text x={0} y={10} textAnchor="middle" className="fill-slate-500 text-[9px]">
        {String(a.code || '').slice(0, 16)}
      </text>
      <text x={0} y={28} textAnchor="middle" className="fill-slate-500 text-[9px]">
        L {a.leftBV} | R {a.rightBV}
      </text>
      <text x={0} y={44} textAnchor="middle" className="fill-emerald-700 text-[9px] font-medium">
        bin {fmtInr(Number(a.binaryInr ?? 0))} | dir {fmtInr(Number(a.directInr ?? 0))}
      </text>
    </motion.g>
  );
}

type BinaryNetworkTreeProps = {
  data: RawNodeDatum | null;
};

export default function BinaryNetworkTree({ data }: BinaryNetworkTreeProps) {
  const shadowId = `bn-sh-${useId().replace(/:/g, '')}`;
  const wrap = useRef<HTMLDivElement>(null);
  const [dim, setDim] = useState({ w: 960, h: 560, tx: 480, ty: 56 });
  const [tip, setTip] = useState<TipState>(null);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => {
      const w = Math.max(320, el.clientWidth);
      const h = Math.max(440, Math.min(720, el.clientHeight || 560));
      setDim({ w, h, tx: w / 2, ty: 64 });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!data) {
    return <p className="text-sm text-slate-500">No placement tree for this member.</p>;
  }

  return (
    <TooltipCtx.Provider value={setTip}>
      <div
        ref={wrap}
        className="relative w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-b from-slate-50 via-white to-violet-50/40 shadow-inner"
        style={{ height: 'min(72vh, 640px)' }}
        onPointerLeave={() => setTip(null)}
      >
        <svg width={0} height={0} className="absolute" aria-hidden>
          <defs>
            <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.12" />
            </filter>
          </defs>
        </svg>
        <Tree
          data={data}
          orientation="vertical"
          pathFunc="step"
          translate={{ x: dim.tx, y: dim.ty }}
          scaleExtent={{ min: 0.22, max: 1.45 }}
          zoomable
          draggable
          nodeSize={{ x: 240, y: 140 }}
          separation={{ siblings: 1.22, nonSiblings: 1.42 }}
          collapsible
          initialDepth={3}
          renderCustomNodeElement={(rd3tProps) => <NodeCard {...rd3tProps} shadowFilterId={shadowId} />}
        />
        <AnimatePresence>
          {tip ? (
            <motion.div
              key="tip"
              role="tooltip"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              className="pointer-events-none fixed z-[100] max-w-xs rounded-xl border border-slate-200/90 bg-white/95 px-3 py-2 text-left text-xs text-slate-700 shadow-xl shadow-slate-400/25 backdrop-blur-sm"
              style={{ left: tip.x, top: tip.y }}
            >
              <p className="font-semibold text-slate-900">{tip.title}</p>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[11px] leading-snug text-slate-600">
                {tip.lines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </TooltipCtx.Provider>
  );
}

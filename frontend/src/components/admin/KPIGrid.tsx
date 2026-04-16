import { motion } from 'framer-motion';
import PremiumCard from '@/components/admin/PremiumCard';

export type KPIStats = {
  revenue: number;
  payout: number;
  profit: number;
  margin: number | null;
};

type KPIGridProps = {
  stats: KPIStats;
  formatInr: (n: number) => string;
};

const stagger = { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const };

export default function KPIGrid({ stats, formatInr }: KPIGridProps) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...stagger, delay: 0 }}>
        <PremiumCard title="Revenue" value={formatInr(stats.revenue)} accent="violet" />
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...stagger, delay: 0.05 }}>
        <PremiumCard title="Payout" value={formatInr(stats.payout)} accent="amber" />
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...stagger, delay: 0.1 }}>
        <PremiumCard title="Profit" value={formatInr(stats.profit)} accent="emerald" />
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...stagger, delay: 0.15 }}>
        <PremiumCard
          title="Margin"
          value={stats.margin != null ? `${stats.margin.toFixed(2)}%` : '—'}
          accent="slate"
        />
      </motion.div>
    </div>
  );
}

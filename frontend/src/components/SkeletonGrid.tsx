import { motion } from 'framer-motion';

export default function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0.55 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <div
            className="aspect-square bg-[length:220%_100%] bg-gradient-to-r from-slate-200 via-slate-50 to-slate-200 animate-shimmer motion-reduce:!animate-none"
            style={{ animationDelay: `${i * 70}ms` }}
          />
          <div className="space-y-3 p-4">
            <div className="h-4 w-[75%] rounded bg-slate-200/90" />
            <div className="h-3 w-full rounded bg-slate-100" />
            <div className="h-3 w-1/2 rounded bg-slate-100" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

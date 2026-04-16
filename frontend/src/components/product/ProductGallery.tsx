import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react';
import MotionImageSwap from '../motion/MotionImageSwap';

type Props = {
  images: string[];
  alt: string;
  discountPct?: number;
};

export default function ProductGallery({ images, alt, discountPct }: Props) {
  const list = images.length ? images : ['https://placehold.co/900x900/1e1b4b/ffffff/png?text=Vivan'];
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [lbIndex, setLbIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const main = list[Math.min(active, list.length - 1)];
  const lbSrc = list[Math.min(lbIndex, list.length - 1)];

  const go = useCallback(
    (dir: -1 | 1) => {
      setLbIndex((i) => {
        const n = (i + dir + list.length) % list.length;
        return n;
      });
      setZoomed(false);
    },
    [list.length]
  );

  const openLightbox = (index: number) => {
    setLbIndex(index);
    setLightbox(true);
    setZoomed(false);
  };

  const closeLightbox = () => {
    setLightbox(false);
    setZoomed(false);
  };

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [lightbox, go]);

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart == null) return;
    const x = e.changedTouches[0]?.clientX ?? touchStart;
    const dx = x - touchStart;
    setTouchStart(null);
    if (Math.abs(dx) < 48) return;
    if (dx < 0) go(1);
    else go(-1);
  };

  const modal =
    lightbox &&
    createPortal(
      <div
        className="fixed inset-0 z-[220] flex flex-col bg-slate-950/97 backdrop-blur-md animate-fadeIn"
        role="dialog"
        aria-modal="true"
        aria-label="Product image gallery"
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <p className="text-sm font-semibold text-white/90">
            {lbIndex + 1} / {list.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setZoomed((z) => !z)}
              className="rounded-full border border-white/20 p-2.5 text-white transition hover:bg-white/10"
              aria-label={zoomed ? 'Zoom out' : 'Zoom in'}
            >
              {zoomed ? <ZoomOut className="h-5 w-5" /> : <ZoomIn className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={closeLightbox}
              className="rounded-full border border-white/20 p-2.5 text-white transition hover:bg-white/10"
              aria-label="Close gallery"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div
          className="relative flex flex-1 touch-pan-y items-center justify-center overflow-hidden px-2 py-4 sm:px-10"
          onTouchStart={(e) => setTouchStart(e.touches[0]?.clientX ?? null)}
          onTouchEnd={onTouchEnd}
        >
          {list.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                className="absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-white/20 bg-black/40 p-3 text-white shadow-lg transition hover:bg-black/60 sm:flex"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-white/20 bg-black/40 p-3 text-white shadow-lg transition hover:bg-black/60 sm:flex"
                aria-label="Next image"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          ) : null}

          <div
            key={lbIndex}
            className="relative flex max-h-[min(85dvh,900px)] w-full max-w-4xl items-center justify-center transition-opacity duration-300 ease-out animate-fadeIn"
          >
            <img
              src={lbSrc}
              alt={alt}
              className={`max-h-[min(85dvh,900px)] w-auto max-w-full rounded-lg object-contain shadow-2xl transition-transform duration-500 ease-out will-change-transform ${
                zoomed ? 'scale-[1.65] cursor-zoom-out' : 'scale-100 cursor-zoom-in'
              }`}
              onClick={() => setZoomed((z) => !z)}
              draggable={false}
            />
          </div>
        </div>

        {list.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto border-t border-white/10 px-4 py-3 sm:justify-center">
            {list.map((src, i) => (
              <button
                key={`lb-${src}-${i}`}
                type="button"
                onClick={() => {
                  setLbIndex(i);
                  setZoomed(false);
                }}
                className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 transition duration-200 sm:h-16 sm:w-16 ${
                  i === lbIndex ? 'border-white shadow-lg shadow-white/20' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        ) : null}

        <p className="pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-xs text-white/50">Swipe or use arrow keys · Tap image to zoom</p>
      </div>,
      document.body
    );

  return (
    <>
      <div className="space-y-4">
        <div
          className="group relative cursor-zoom-in overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_20px_50px_-24px_rgba(15,23,42,0.18)] ring-1 ring-slate-900/[0.04] transition-shadow duration-300 hover:shadow-[0_24px_60px_-20px_rgba(30,27,75,0.22)]"
          role="button"
          tabIndex={0}
          onClick={() => openLightbox(active)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openLightbox(active);
            }
          }}
          aria-label="Open full screen gallery"
        >
          {typeof discountPct === 'number' && discountPct > 0 ? (
            <span className="absolute left-4 top-4 z-10 rounded-xl bg-gradient-to-r from-rose-600 to-orange-500 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow-lg">
              {discountPct}% off
            </span>
          ) : null}
          <div className="aspect-square w-full overflow-hidden bg-slate-50">
            <MotionImageSwap
              src={main}
              alt={alt}
              className="block h-full w-full"
              imgClassName="h-full w-full object-cover transition duration-500 ease-out will-change-transform group-hover:scale-[1.03]"
            />
          </div>
          <span className="pointer-events-none absolute bottom-4 right-4 rounded-full bg-black/50 px-3 py-1 text-[11px] font-semibold text-white/95 backdrop-blur-sm">
            Tap to expand
          </span>
        </div>

        {list.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:thin] sm:grid sm:grid-cols-5 sm:overflow-visible sm:pb-0">
            {list.map((src, i) => (
              <button
                key={`${src}-${i}`}
                type="button"
                onClick={() => setActive(i)}
                className={`relative shrink-0 overflow-hidden rounded-2xl border-2 bg-white shadow-sm transition duration-200 sm:aspect-square sm:w-full ${
                  i === active
                    ? 'border-brand-600 ring-2 ring-brand-400/30'
                    : 'border-slate-200 opacity-90 hover:border-brand-300 hover:opacity-100'
                }`}
                aria-label={`View image ${i + 1}`}
              >
                <img src={src} alt="" className="aspect-square h-16 w-16 object-cover transition duration-200 hover:scale-105 sm:h-full sm:w-full" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {modal}
    </>
  );
}

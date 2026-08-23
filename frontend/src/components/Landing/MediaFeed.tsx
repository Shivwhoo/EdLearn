import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Headphones,
  Mic2,
  MonitorPlay,
  Play,
  X,
} from 'lucide-react';
import { MediaItem, fetchContent, formatDuration, trackSpotlight, youtubeId } from '@/lib/content';

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'business', label: 'Business' },
  { key: 'science', label: 'Science' },
  { key: 'history', label: 'History' },
  { key: 'health', label: 'Health' },
  { key: 'tech', label: 'Tech' },
  { key: 'culture', label: 'Culture' },
];

/** Detail modal with an embedded player */
function PlayerModal({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  const ytId = item.contentType === 'video' ? youtubeId(item.contentUrl) : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  useEffect(() => {
    try {
      const historyJson = localStorage.getItem('media_history');
      const history = historyJson ? JSON.parse(historyJson) : [];
      const filtered = history.filter((h: any) => h.id !== item.id);
      const entry = {
        id: item.id,
        title: item.title,
        description: item.description,
        contentType: item.contentType,
        thumbnailUrl: item.thumbnailUrl,
        contentUrl: item.contentUrl,
        channelName: item.channelName,
        duration: item.duration,
        publishedAt: item.publishedAt,
        watchedAt: new Date().toISOString(),
      };
      const updated = [entry, ...filtered].slice(0, 10);
      localStorage.setItem('media_history', JSON.stringify(updated));
      window.dispatchEvent(new Event('mediaHistoryUpdate'));
    } catch (err) {
      console.error('Failed to save media history:', err);
    }
  }, [item]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Player */}
        {ytId ? (
          <div className="aspect-video bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
              title={item.title}
              className="h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.thumbnailUrl} alt="" className="w-full h-56 object-cover opacity-70" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <audio controls autoPlay src={item.contentUrl} className="w-full" />
            </div>
          </div>
        )}

        {/* Meta */}
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/10 text-white mb-3">
                {item.contentType === 'video' ? (
                  <MonitorPlay className="h-3 w-3 text-red-400" />
                ) : (
                  <Headphones className="h-3 w-3 text-cyan-300" />
                )}
                {item.contentType === 'video' ? 'Video' : 'Podcast'} · {item.channelName}
              </span>
              <h3 className="text-lg font-bold text-white leading-snug">{item.title}</h3>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              suppressHydrationWarning
              className="flex-shrink-0 h-9 w-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-slate-300 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MediaFeed() {
  const [category, setCategory] = useState('all');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchContent<MediaItem>('media', { category, limit: 12 })
      .then((res) => {
        if (!cancelled) setItems(res.data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [category]);

  const scrollRail = (dir: 1 | -1) => {
    railRef.current?.scrollBy({ left: dir * 660, behavior: 'smooth' });
  };

  if (!loading && (error || items.length === 0) && category === 'all') return null;

  return (
    <div className="relative rounded-[2rem] bg-slate-950 overflow-hidden px-6 sm:px-10 py-12 sm:py-16">
      {/* Decorative backdrop */}
      <div className="absolute inset-0 dot-grid-dark opacity-60" />
      <div className="blob-drift absolute -top-24 -right-16 w-96 h-96 bg-blue-600/20 rounded-full blur-[110px]" />
      <div className="blob-drift absolute -bottom-32 -left-20 w-96 h-96 bg-indigo-500/15 rounded-full blur-[120px]" style={{ animationDelay: '-4.5s' }} />

      <div className="relative z-10">
        {/* Section header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-blue-300 text-xs font-semibold mb-4">
              <Mic2 className="h-3.5 w-3.5" />
              <span>Listen &amp; Watch</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.01em] text-white">
              Talks &amp;{' '}
              <span className="italic font-normal bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent" style={{ fontFamily: "'Instrument Serif', serif" }}>
                Podcasts
              </span>
            </h2>
            <p className="text-slate-400 mt-3 max-w-xl leading-relaxed">
              Hand-picked ideas from TED, Huberman Lab, Hardcore History, and more — zero noise, zero politics.
            </p>
          </div>

          {/* Category pills */}
          <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-white/5 backdrop-blur border border-white/10 rounded-2xl w-fit">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                suppressHydrationWarning
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  category === c.key
                    ? 'bg-white text-slate-900 shadow-md scale-[1.03]'
                    : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Card rail */}
        <div className="relative group/rail">
          <div ref={railRef} className="rail-scroll rail-mask flex gap-5 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-[320px] rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                    <div className="h-44 bg-white/10 animate-pulse" />
                    <div className="p-4 space-y-2.5">
                      <div className="h-3.5 bg-white/10 rounded animate-pulse" />
                      <div className="h-3 w-1/2 bg-white/10 rounded animate-pulse" />
                    </div>
                  </div>
                ))
              : items.map((item, i) => {
                  const isVideo = item.contentType === 'video';
                  const ytId = isVideo ? youtubeId(item.contentUrl) : null;

                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelected(item)}
                      onMouseMove={trackSpotlight}
                      suppressHydrationWarning
                      className="spotlight-card fade-up flex-shrink-0 w-[320px] snap-start rounded-2xl bg-white/[0.06] border border-white/10 hover:border-blue-400/40 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-blue-950/50 transition-all duration-300 overflow-hidden backdrop-blur-sm text-left cursor-pointer"
                      style={{ animationDelay: `${Math.min(i, 8) * 60}ms`, ['--spot-color' as string]: 'rgba(96,165,250,0.10)' }}
                    >
                      {/* Thumbnail / player */}
                      <div className="shine-parent relative h-44 bg-slate-900">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.thumbnailUrl || (ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : '')}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover opacity-90"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />

                        <span className="absolute inset-0 z-[2] flex items-center justify-center">
                          <span className="flex items-center justify-center h-14 w-14 rounded-full bg-white/15 backdrop-blur border border-white/30 group-hover/play:bg-blue-600 group-hover/play:scale-110 group-hover/play:border-blue-500 transition-all">
                            <Play className="h-6 w-6 text-white ml-0.5" fill="currentColor" />
                          </span>
                        </span>

                        {/* Type badge */}
                        <span className="absolute top-3 left-3 z-[2] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-950/70 backdrop-blur border border-white/15 text-white">
                          {isVideo ? <MonitorPlay className="h-3 w-3 text-red-400" /> : <Headphones className="h-3 w-3 text-cyan-300" />}
                          {isVideo ? 'Video' : 'Podcast'}
                        </span>

                        {item.duration ? (
                          <span className="absolute bottom-3 right-3 z-[2] px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-950/80 text-slate-200">
                            {formatDuration(item.duration)}
                          </span>
                        ) : null}
                      </div>

                      {/* Body */}
                      <div className="relative z-[2] p-4">
                        <h3 className="clamp-2 text-sm font-semibold text-white leading-snug mb-2.5 min-h-[2.6em]">
                          {item.title}
                        </h3>
                        <p className="text-xs text-slate-400 font-medium truncate">{item.channelName}</p>
                      </div>
                    </button>
                  );
                })}

            {!loading && items.length === 0 && (
              <div className="w-full py-12 text-center text-sm text-slate-400">
                Nothing in this category yet — check back soon.
              </div>
            )}
          </div>

          {/* Rail arrows */}
          <button
            aria-label="Scroll left"
            onClick={() => scrollRail(-1)}
            suppressHydrationWarning
            className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 h-10 w-10 items-center justify-center rounded-full bg-slate-800 border border-white/15 shadow-lg text-slate-200 hover:text-white hover:bg-blue-600 hover:scale-110 transition-all opacity-0 group-hover/rail:opacity-100 cursor-pointer z-[3]"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            aria-label="Scroll right"
            onClick={() => scrollRail(1)}
            suppressHydrationWarning
            className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 h-10 w-10 items-center justify-center rounded-full bg-slate-800 border border-white/15 shadow-lg text-slate-200 hover:text-white hover:bg-blue-600 hover:scale-110 transition-all opacity-0 group-hover/rail:opacity-100 cursor-pointer z-[3]"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* See more */}
        <div className="flex justify-end mt-6">
          <Link
            href="/media"
            className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/20 hover:border-blue-400 bg-white/5 hover:bg-blue-600 text-sm font-bold text-white transition-all cursor-pointer"
          >
            <span>See More</span>
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>

      {/* Embedded Player Modal */}
      {selected && <PlayerModal item={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}


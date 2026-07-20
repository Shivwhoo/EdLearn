'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  FilterX,
  Headphones,
  Loader2,
  Mic2,
  MonitorPlay,
  Play,
  Search,
  X,
} from 'lucide-react';
import Link from 'next/link';
import Footer from '@/components/Layout/Footer';
import { MediaItem, fetchContent, formatDuration, timeAgo, trackSpotlight, youtubeId } from '@/lib/content';

const CATEGORIES = ['all', 'business', 'science', 'history', 'health', 'tech', 'culture'];

const TYPES = [
  { key: '', label: 'All' },
  { key: 'video', label: 'Videos' },
  { key: 'audio', label: 'Podcasts' },
];

const LIMIT = 20;

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
              className="h-full w-full"
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
              className="flex-shrink-0 h-9 w-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="clamp-3 text-sm text-slate-400 leading-relaxed mt-3">{item.description}</p>
          <div className="flex items-center gap-3 text-xs text-slate-500 mt-4">
            <span>{timeAgo(item.publishedAt)}</span>
            {item.duration ? <span>· {formatDuration(item.duration)}</span> : null}
            <span className="capitalize">· {item.category}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MediaPageInner() {
  const router = useRouter();
  const params = useSearchParams();

  const category = params.get('category') || 'all';
  const type = params.get('type') || '';
  const search = params.get('search') || '';

  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchInput, setSearchInput] = useState(search);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setSearchInput(search), [search]);

  const setParam = useCallback(
    (updates: Record<string, string>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (!v || v === 'all') next.delete(k);
        else next.set(k, v);
      }
      next.delete('page');
      router.replace(`/media${next.toString() ? `?${next.toString()}` : ''}`, { scroll: false });
    },
    [params, router]
  );

  const load = useCallback(
    async (pageNum: number, append: boolean) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      try {
        const res = await fetchContent<MediaItem>('media', {
          category,
          type,
          search,
          page: pageNum,
          limit: LIMIT,
        });
        setItems((prev) => (append ? [...prev, ...res.data] : res.data));
        setTotal(res.total);
        setPage(pageNum);
      } catch {
        if (!append) {
          setItems([]);
          setTotal(0);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [category, type, search]
  );

  useEffect(() => {
    load(1, false);
  }, [load]);

  const onSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => setParam({ search: value }), 450);
  };

  const hasFilters = category !== 'all' || !!type || !!search;
  const hasMore = items.length < total;

  return (
    <main className="bg-slate-950 text-white min-h-screen">
      {/* Page header */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 dot-grid-dark opacity-50" />
        <div className="blob-drift absolute -top-24 right-[10%] w-96 h-96 bg-blue-600/20 rounded-full blur-[110px]" />
        <div className="max-w-7xl mx-auto px-6 pt-12 pb-10 relative z-10">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-blue-400 transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Link>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-blue-300 text-xs font-semibold mb-4 ml-4">
            <Mic2 className="h-3.5 w-3.5" />
            <span>Media Library</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            Talks &amp;{' '}
            <span className="italic font-normal bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent" style={{ fontFamily: "'Instrument Serif', serif" }}>
              Podcasts
            </span>
          </h1>
          <p className="text-slate-400 mt-3 max-w-2xl">
            Ideas worth your commute — talks and episodes from the world&rsquo;s best channels and shows.
          </p>
        </div>
      </section>

      {/* Sticky filter bar */}
      <div className="sticky top-0 z-30 bg-slate-950/85 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex flex-col lg:flex-row gap-3 lg:items-center">
          {/* Search */}
          <div className="relative flex-shrink-0 w-full lg:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              value={searchInput}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search titles, channels, speakers…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400/50 transition-all"
            />
          </div>

          {/* Category pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setParam({ category: c })}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize transition-all cursor-pointer ${
                  category === c ? 'bg-white text-slate-900 shadow-md' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {c === 'all' ? 'All' : c}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 lg:ml-auto">
            {/* Type toggle */}
            <div className="flex items-center p-1 bg-white/5 border border-white/10 rounded-xl">
              {TYPES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setParam({ type: t.key })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    type === t.key ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* No Filter reset */}
            <button
              onClick={() => {
                setSearchInput('');
                router.replace('/media', { scroll: false });
              }}
              disabled={!hasFilters}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                hasFilters
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20'
                  : 'bg-white/5 text-slate-600 border border-white/5 cursor-not-allowed'
              }`}
            >
              <FilterX className="h-3.5 w-3.5" />
              No Filter
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      <section className="max-w-7xl mx-auto px-6 py-10">
        {!loading && (
          <p className="text-sm text-slate-500 mb-6">
            {total} item{total === 1 ? '' : 's'} found
          </p>
        )}

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="h-40 bg-white/10 animate-pulse" />
                <div className="p-4 space-y-2.5">
                  <div className="h-3.5 bg-white/10 rounded animate-pulse" />
                  <div className="h-3 w-1/2 bg-white/10 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="py-24 text-center">
            <Headphones className="h-12 w-12 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-300 font-semibold">Nothing matches your filters</p>
            <p className="text-sm text-slate-500 mt-1">Try another category or clear the search.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {items.map((item, i) => {
              const isVideo = item.contentType === 'video';
              return (
                <button
                  key={item.id}
                  onClick={() => setSelected(item)}
                  onMouseMove={trackSpotlight}
                  className="spotlight-card fade-up text-left rounded-2xl bg-white/[0.05] border border-white/10 hover:border-blue-400/40 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-blue-950/50 transition-all duration-300 overflow-hidden cursor-pointer"
                  style={{ animationDelay: `${(i % 8) * 50}ms`, ['--spot-color' as string]: 'rgba(96,165,250,0.10)' }}
                >
                  <div className="shine-parent relative h-40 bg-slate-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover opacity-90" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                    <span className="absolute inset-0 z-[2] flex items-center justify-center">
                      <span className="flex items-center justify-center h-12 w-12 rounded-full bg-white/15 backdrop-blur border border-white/30 opacity-0 group-hover:opacity-100 hover:bg-blue-600 transition-all">
                        <Play className="h-5 w-5 text-white ml-0.5" fill="currentColor" />
                      </span>
                    </span>
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
                  <div className="relative z-[2] p-4">
                    <h3 className="clamp-2 text-sm font-semibold text-white leading-snug mb-2 min-h-[2.6em]">{item.title}</h3>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-medium text-slate-400 truncate max-w-[65%]">{item.channelName}</span>
                      <span>{timeAgo(item.publishedAt)}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Load more */}
        {hasMore && !loading && (
          <div className="flex justify-center mt-12">
            <button
              onClick={() => load(page + 1, true)}
              disabled={loadingMore}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-bold text-white shadow-lg shadow-blue-950/50 transition-all cursor-pointer disabled:opacity-60"
            >
              {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
              {loadingMore ? 'Loading…' : 'Load More'}
            </button>
          </div>
        )}
      </section>

      {selected && <PlayerModal item={selected} onClose={() => setSelected(null)} />}

      <Footer />
    </main>
  );
}

export default function MediaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <MediaPageInner />
    </Suspense>
  );
}

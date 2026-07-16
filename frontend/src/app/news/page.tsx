'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Clock,
  FilterX,
  Globe2,
  Loader2,
  Newspaper,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import Footer from '@/components/Layout/Footer';
import { NewsArticle, fetchContent, timeAgo, trackSpotlight } from '@/lib/content';

const CATEGORIES = ['all', 'tech', 'finance', 'world', 'medical', 'science', 'education'];

const TIMEFRAMES = [
  { key: 'week', label: 'Past Week' },
  { key: 'month', label: 'Past Month' },
  { key: '3months', label: 'Past 3 Months' },
  { key: 'year', label: 'Past Year' },
];

const CATEGORY_COLORS: Record<string, string> = {
  tech: 'bg-blue-100 text-blue-700',
  finance: 'bg-emerald-100 text-emerald-700',
  world: 'bg-amber-100 text-amber-700',
  medical: 'bg-rose-100 text-rose-700',
  science: 'bg-violet-100 text-violet-700',
  education: 'bg-cyan-100 text-cyan-700',
};

const LIMIT = 20;

function NewsPageInner() {
  const router = useRouter();
  const params = useSearchParams();

  const category = params.get('category') || 'all';
  const timeframe = params.get('timeframe') || '';
  const search = params.get('search') || '';

  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchInput, setSearchInput] = useState(search);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the input in sync when the URL changes externally (back button etc.)
  useEffect(() => setSearchInput(search), [search]);

  const setParam = useCallback(
    (updates: Record<string, string>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (!v || v === 'all') next.delete(k);
        else next.set(k, v);
      }
      next.delete('page'); // filters reset pagination
      router.replace(`/news${next.toString() ? `?${next.toString()}` : ''}`, { scroll: false });
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
        const res = await fetchContent<NewsArticle>('news', {
          category,
          timeframe,
          search,
          page: pageNum,
          limit: LIMIT,
        });
        setArticles((prev) => (append ? [...prev, ...res.data] : res.data));
        setTotal(res.total);
        setPage(pageNum);
      } catch {
        if (!append) {
          setArticles([]);
          setTotal(0);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [category, timeframe, search]
  );

  useEffect(() => {
    load(1, false);
  }, [load]);

  const onSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => setParam({ search: value }), 450);
  };

  const hasFilters = category !== 'all' || !!timeframe || !!search;
  const hasMore = articles.length < total;

  return (
    <main className="bg-white text-slate-900 min-h-screen">
      {/* Page header */}
      <section className="relative bg-gradient-to-b from-blue-50 via-white to-white overflow-hidden">
        <div className="absolute top-[-30%] right-[-10%] w-[45%] h-[80%] bg-blue-200/30 rounded-full blur-[100px]" />
        <div className="max-w-7xl mx-auto px-6 pt-12 pb-10 relative z-10">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-blue-600 transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Link>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-full text-blue-700 text-xs font-semibold mb-4 ml-4">
            <Globe2 className="h-3.5 w-3.5" />
            <span>News Explorer</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            World &amp; Market{' '}
            <span className="italic font-normal bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent" style={{ fontFamily: "'Instrument Serif', serif" }}>
              Briefing
            </span>
          </h1>
          <p className="text-slate-600 mt-3 max-w-2xl">
            Search and filter curated stories across tech, finance, science, medicine, education, and world affairs.
          </p>
        </div>
      </section>

      {/* Sticky filter bar */}
      <div className="sticky top-0 z-30 bg-white/85 backdrop-blur-lg border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex flex-col lg:flex-row gap-3 lg:items-center">
          {/* Search */}
          <div className="relative flex-shrink-0 w-full lg:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={searchInput}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search headlines…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
            />
          </div>

          {/* Category pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setParam({ category: c })}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize transition-all cursor-pointer ${
                  category === c
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {c === 'all' ? 'All' : c}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 lg:ml-auto">
            {/* Timeframe */}
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <select
                value={timeframe}
                onChange={(e) => setParam({ timeframe: e.target.value })}
                className="pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer appearance-none"
              >
                <option value="">Any time</option>
                {TIMEFRAMES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* No Filter reset */}
            <button
              onClick={() => {
                setSearchInput('');
                router.replace('/news', { scroll: false });
              }}
              disabled={!hasFilters}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                hasFilters
                  ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100'
                  : 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed'
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
            {total} article{total === 1 ? '' : 's'} found
          </p>
        )}

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-100 overflow-hidden">
                <div className="h-40 bg-slate-100 animate-pulse" />
                <div className="p-4 space-y-2.5">
                  <div className="h-3.5 bg-slate-100 rounded animate-pulse" />
                  <div className="h-3.5 w-2/3 bg-slate-100 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="py-24 text-center">
            <Newspaper className="h-12 w-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-600 font-semibold">No articles match your filters</p>
            <p className="text-sm text-slate-400 mt-1">Try widening the time range or clearing the search.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {articles.map((a, i) => (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                onMouseMove={trackSpotlight}
                className="spotlight-card star-border fade-up rounded-2xl bg-white shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 overflow-hidden"
                style={{ animationDelay: `${(i % LIMIT % 8) * 50}ms` }}
              >
                <div className="shine-parent relative h-40 bg-slate-100">
                  {a.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                      <Newspaper className="h-10 w-10 text-blue-300" />
                    </div>
                  )}
                  <span
                    className={`absolute top-3 left-3 z-[2] px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      CATEGORY_COLORS[a.category] || 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {a.category}
                  </span>
                </div>
                <div className="relative z-[2] p-4">
                  <h3 className="clamp-2 text-sm font-semibold text-slate-900 leading-snug mb-2">{a.title}</h3>
                  <p className="clamp-2 text-xs text-slate-500 leading-relaxed mb-3">{a.description}</p>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-medium truncate max-w-[60%]">{a.source}</span>
                    <span>{timeAgo(a.publishedAt)}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* Load more */}
        {hasMore && !loading && (
          <div className="flex justify-center mt-12">
            <button
              onClick={() => load(page + 1, true)}
              disabled={loadingMore}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-slate-900 hover:bg-blue-600 text-sm font-bold text-white shadow-lg hover:shadow-blue-600/25 transition-all cursor-pointer disabled:opacity-60"
            >
              {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
              {loadingMore ? 'Loading…' : 'Load More'}
            </button>
          </div>
        )}
      </section>

      <Footer />
    </main>
  );
}

export default function NewsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <NewsPageInner />
    </Suspense>
  );
}

'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowUpDown,
  BookOpen,
  ExternalLink,
  FilterX,
  Loader2,
  Search,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import Link from 'next/link';
import Footer from '@/components/Layout/Footer';
import { Book, fetchContent, trackSpotlight } from '@/lib/content';

const GENRES = ['all', 'business', 'tech', 'science', 'self-improvement', 'history', 'health'];

const SORTS = [
  { key: 'popularity', label: 'Popularity' },
  { key: 'newest', label: 'Newest' },
  { key: 'relevance', label: 'Relevance' },
];

const GENRE_COLORS: Record<string, string> = {
  business: 'bg-emerald-100 text-emerald-700',
  tech: 'bg-blue-100 text-blue-700',
  science: 'bg-violet-100 text-violet-700',
  'self-improvement': 'bg-amber-100 text-amber-700',
  history: 'bg-rose-100 text-rose-700',
  health: 'bg-cyan-100 text-cyan-700',
};

const LIMIT = 20;

/** Book detail modal */
function BookModal({ book, onClose }: { book: Book; onClose: () => void }) {
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-white rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col sm:flex-row gap-6 p-6">
          {/* Cover */}
          <div className="flex-shrink-0 mx-auto sm:mx-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={book.coverImage}
              alt={book.title}
              className="w-40 h-56 object-cover rounded-xl shadow-lg"
            />
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span
                  className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-2 ${
                    GENRE_COLORS[book.genre] || 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {book.genre}
                </span>
                <h3 className="text-xl font-bold text-slate-900 leading-snug">{book.title}</h3>
                <p className="text-sm text-slate-500 mt-1">by {book.author}</p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="flex-shrink-0 h-9 w-9 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {book.rating ? (
              <div className="flex items-center gap-1.5 mt-3">
                <div className="flex items-center">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${i < Math.round(book.rating || 0) ? 'text-amber-400' : 'text-slate-200'}`}
                      fill="currentColor"
                    />
                  ))}
                </div>
                <span className="text-sm font-semibold text-slate-700">{book.rating.toFixed(1)}</span>
              </div>
            ) : null}

            {/* Takeaway */}
            <div className="mt-4 p-4 rounded-xl bg-blue-50 border border-blue-100">
              <p className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 uppercase tracking-wider mb-2">
                <Sparkles className="h-3.5 w-3.5" /> Key Takeaway
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">{book.threeSentenceTakeaway}</p>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed mt-4">{book.description}</p>

            {book.buyLink && (
              <a
                href={book.buyLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-blue-600 text-sm font-bold text-white transition-all cursor-pointer"
              >
                Get the Book <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BooksPageInner() {
  const router = useRouter();
  const params = useSearchParams();

  const category = params.get('category') || 'all';
  const sort = params.get('sort') || 'popularity';
  const search = params.get('search') || '';

  const [books, setBooks] = useState<Book[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchInput, setSearchInput] = useState(search);
  const [selected, setSelected] = useState<Book | null>(null);
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
      router.replace(`/books${next.toString() ? `?${next.toString()}` : ''}`, { scroll: false });
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
        const res = await fetchContent<Book>('books', {
          category,
          sort,
          search,
          page: pageNum,
          limit: LIMIT,
        });
        setBooks((prev) => (append ? [...prev, ...res.data] : res.data));
        setTotal(res.total);
        setPage(pageNum);
      } catch {
        if (!append) {
          setBooks([]);
          setTotal(0);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [category, sort, search]
  );

  useEffect(() => {
    load(1, false);
  }, [load]);

  const onSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => setParam({ search: value }), 450);
  };

  const hasFilters = category !== 'all' || sort !== 'popularity' || !!search;
  const hasMore = books.length < total;

  return (
    <main className="bg-white text-slate-900 min-h-screen">
      {/* Page header */}
      <section className="relative bg-gradient-to-b from-blue-50 via-white to-white overflow-hidden">
        <div className="absolute top-[-30%] left-[-10%] w-[45%] h-[80%] bg-indigo-200/30 rounded-full blur-[100px]" />
        <div className="max-w-7xl mx-auto px-6 pt-12 pb-10 relative z-10">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-blue-600 transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Link>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-full text-blue-700 text-xs font-semibold mb-4 ml-4">
            <BookOpen className="h-3.5 w-3.5" />
            <span>The Library</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            Trending{' '}
            <span className="italic font-normal bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent" style={{ fontFamily: "'Instrument Serif', serif" }}>
              Books
            </span>
          </h1>
          <p className="text-slate-600 mt-3 max-w-2xl">
            Browse, search, and sort the ideas shaping business, science, and personal growth.
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
              placeholder="Search titles, authors…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
            />
          </div>

          {/* Genre pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {GENRES.map((g) => (
              <button
                key={g}
                onClick={() => setParam({ category: g })}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize transition-all cursor-pointer ${
                  category === g ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {g === 'all' ? 'All' : g === 'self-improvement' ? 'Self-Improvement' : g}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 lg:ml-auto">
            {/* Sort */}
            <div className="relative">
              <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <select
                value={sort}
                onChange={(e) => setParam({ sort: e.target.value })}
                className="pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer appearance-none"
              >
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* No Filter reset */}
            <button
              onClick={() => {
                setSearchInput('');
                router.replace('/books', { scroll: false });
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
            {total} book{total === 1 ? '' : 's'} found
          </p>
        )}

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i}>
                <div className="aspect-[2/3] rounded-2xl bg-slate-100 animate-pulse" />
                <div className="h-3.5 mt-3 bg-slate-100 rounded animate-pulse" />
                <div className="h-3 w-1/2 mt-2 bg-slate-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : books.length === 0 ? (
          <div className="py-24 text-center">
            <BookOpen className="h-12 w-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-600 font-semibold">No books match your filters</p>
            <p className="text-sm text-slate-400 mt-1">Try another genre or clear the search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {books.map((book, i) => (
              <button
                key={book.id}
                onClick={() => setSelected(book)}
                onMouseMove={trackSpotlight}
                className="group text-left fade-up cursor-pointer [perspective:900px]"
                style={{ animationDelay: `${(i % 10) * 40}ms` }}
              >
                <div className="relative aspect-[2/3] rounded-2xl overflow-hidden shadow-md group-hover:shadow-2xl transition-all duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(-6deg)_rotateX(2deg)_translateY(-6px)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={book.coverImage} alt={book.title} loading="lazy" className="h-full w-full object-cover" />
                  <div className="absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-black/25 to-transparent" />

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-4 flex flex-col justify-end">
                    <Sparkles className="h-4 w-4 text-amber-300 mb-2" />
                    <p className="text-[11px] leading-relaxed text-slate-200 line-clamp-6">
                      {book.threeSentenceTakeaway}
                    </p>
                  </div>

                  <span
                    className={`absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                      GENRE_COLORS[book.genre] || 'bg-slate-100 text-slate-700'
                    } group-hover:opacity-0 transition-opacity`}
                  >
                    {book.genre}
                  </span>
                </div>

                <div className="mt-3 px-0.5">
                  <h3 className="clamp-2 text-[13px] font-semibold text-slate-900 leading-snug">{book.title}</h3>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[11px] text-slate-500 truncate max-w-[70%]">{book.author}</p>
                    {book.rating ? (
                      <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-amber-500">
                        <Star className="h-3 w-3" fill="currentColor" />
                        {book.rating.toFixed(1)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
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

      {selected && <BookModal book={selected} onClose={() => setSelected(null)} />}

      <Footer />
    </main>
  );
}

export default function BooksPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <BooksPageInner />
    </Suspense>
  );
}

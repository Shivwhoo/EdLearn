'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, Sparkles, Star } from 'lucide-react';
import { Book, fetchContent } from '@/lib/content';

const GENRE_COLORS: Record<string, string> = {
  business: 'bg-emerald-100 text-emerald-700',
  tech: 'bg-blue-100 text-blue-700',
  science: 'bg-violet-100 text-violet-700',
  'self-improvement': 'bg-amber-100 text-amber-700',
  history: 'bg-rose-100 text-rose-700',
  health: 'bg-cyan-100 text-cyan-700',
};

function BookCard({ book }: { book: Book }) {
  return (
    <Link
      href={`/books?search=${encodeURIComponent(book.title)}`}
      className="group relative flex-shrink-0 w-[190px] mx-2.5 [perspective:900px]"
    >
      <div className="relative rounded-2xl overflow-hidden shadow-md group-hover:shadow-2xl transition-all duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(-7deg)_rotateX(3deg)_translateY(-8px)]">
        {/* Cover */}
        <div className="relative h-[270px] bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={book.coverImage} alt={book.title} loading="lazy" className="h-full w-full object-cover" />
          {/* Spine highlight */}
          <div className="absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-black/25 to-transparent" />

          {/* Hover overlay with takeaway */}
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-4 flex flex-col justify-end">
            <Sparkles className="h-4 w-4 text-amber-300 mb-2" />
            <p className="text-[11px] leading-relaxed text-slate-200 line-clamp-6">
              {book.threeSentenceTakeaway}
            </p>
          </div>

          {/* Genre badge */}
          <span
            className={`absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
              GENRE_COLORS[book.genre] || 'bg-slate-100 text-slate-700'
            } group-hover:opacity-0 transition-opacity`}
          >
            {book.genre}
          </span>
        </div>
      </div>

      {/* Meta */}
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
    </Link>
  );
}

export default function BookCarousel() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchContent<Book>('books', { limit: 14, sort: 'popularity' })
      .then((res) => {
        if (!cancelled) setBooks(res.data);
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
  }, []);

  if (!loading && (error || books.length === 0)) return null;

  return (
    <div>
      {/* Section header */}
      <div className="text-center max-w-2xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-full text-blue-700 text-xs font-semibold mb-4">
          <BookOpen className="h-3.5 w-3.5" />
          <span>Read Smarter</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.01em] text-slate-900">
          Trending{' '}
          <span className="italic font-normal bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent" style={{ fontFamily: "'Instrument Serif', serif" }}>
            Books
          </span>
          , distilled
        </h2>
        <p className="text-slate-600 mt-3 leading-relaxed">
          The ideas worth your time from business, science, and self-improvement — hover any cover for the takeaway.
        </p>
      </div>

      {/* Marquee rail */}
      {loading ? (
        <div className="flex gap-5 justify-center overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[190px]">
              <div className="h-[270px] rounded-2xl bg-slate-100 animate-pulse" />
              <div className="h-3.5 mt-3 bg-slate-100 rounded animate-pulse" />
              <div className="h-3 w-1/2 mt-2 bg-slate-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="marquee-paused rail-mask overflow-hidden" style={{ ['--marquee-duration' as string]: `${Math.max(35, books.length * 5)}s` }}>
          <div className="marquee-track py-2">
            {/* Duplicated for a seamless loop */}
            {[...books, ...books].map((book, i) => (
              <BookCard key={`${book.id}-${i}`} book={book} />
            ))}
          </div>
        </div>
      )}

      {/* See more */}
      <div className="flex justify-center mt-10">
        <Link
          href="/books"
          className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 hover:bg-blue-600 text-sm font-bold text-white shadow-lg hover:shadow-blue-600/25 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
        >
          <span>Explore the Library</span>
          <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
}

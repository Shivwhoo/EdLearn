import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight, Globe2, Newspaper, X, ExternalLink, Calendar } from 'lucide-react';
import { NewsArticle, fetchContent, timeAgo, trackSpotlight } from '@/lib/content';

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'tech', label: 'Tech' },
  { key: 'finance', label: 'Finance' },
  { key: 'world', label: 'World' },
  { key: 'medical', label: 'Medical' },
  { key: 'science', label: 'Science' },
  { key: 'education', label: 'Education' },
];

const CATEGORY_COLORS: Record<string, string> = {
  tech: 'bg-blue-100 text-blue-700',
  finance: 'bg-emerald-100 text-emerald-700',
  world: 'bg-amber-100 text-amber-700',
  medical: 'bg-rose-100 text-rose-700',
  science: 'bg-violet-100 text-violet-700',
  education: 'bg-cyan-100 text-cyan-700',
};

function NewsModal({ article, onClose }: { article: NewsArticle; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(article.title + ' ' + article.source)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Image */}
        <div className="relative h-60 bg-slate-100 flex-shrink-0">
          {article.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={article.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
              <Newspaper className="h-16 w-16 text-blue-300" />
            </div>
          )}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 h-9 w-9 flex items-center justify-center rounded-full bg-slate-900/60 hover:bg-slate-900/80 text-white backdrop-blur transition-all cursor-pointer border border-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
              CATEGORY_COLORS[article.category] || 'bg-slate-100 text-slate-700'
            }`}>
              {article.category}
            </span>
            <span className="text-slate-400 font-medium">·</span>
            <span className="text-slate-500 font-medium">{article.source}</span>
            <span className="text-slate-400 font-medium">·</span>
            <span className="text-slate-500 flex items-center gap-1 font-medium">
              <Calendar className="h-3 w-3" />
              {new Date(article.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">{article.title}</h3>

          <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed text-sm sm:text-base space-y-3">
            <p className="font-medium text-slate-800">{article.description}</p>
            <p>
              This article covers critical developments in {article.category} from {article.source}. As the industry adapts to these changes, further updates and strategic shifts are expected from key market participants.
            </p>
            <p>
              Stay tuned for continuous updates. You can search for the original reporting directly to follow the story as it unfolds.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100">
            <a
              href={article.url.startsWith('https://example.com') ? searchUrl : article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-blue-600 text-sm font-bold text-white transition-all cursor-pointer flex-1"
            >
              <span>{article.url.startsWith('https://example.com') ? 'Search on Google' : 'Read Full Article'}</span>
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NewsFeed() {
  const [category, setCategory] = useState('all');
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<NewsArticle | null>(null);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchContent<NewsArticle>('news', { category, limit: 12 })
      .then((res) => {
        if (!cancelled) setArticles(res.data);
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
    railRef.current?.scrollBy({ left: dir * 640, behavior: 'smooth' });
  };

  if (!loading && (error || articles.length === 0) && category === 'all') return null;

  return (
    <div>
      {/* Section header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-full text-blue-700 text-xs font-semibold mb-4">
            <Globe2 className="h-3.5 w-3.5" />
            <span>Stay Curious</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.01em] text-slate-900">
            World &amp; Market{' '}
            <span className="italic font-normal bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent" style={{ fontFamily: "'Instrument Serif', serif" }}>
              Briefing
            </span>
          </h2>
          <p className="text-slate-600 mt-3 max-w-xl leading-relaxed">
            A curated pulse of tech, science, finance, and world affairs — refreshed every few hours.
          </p>
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-white/70 backdrop-blur border border-slate-200 rounded-2xl shadow-sm w-fit">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                category === c.key
                  ? 'bg-slate-900 text-white shadow-md scale-[1.03]'
                  : 'text-slate-600 hover:bg-slate-100'
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
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-[300px] rounded-2xl border border-slate-100 bg-white overflow-hidden">
                  <div className="h-40 bg-slate-100 animate-pulse" />
                  <div className="p-4 space-y-2.5">
                    <div className="h-3.5 bg-slate-100 rounded animate-pulse" />
                    <div className="h-3.5 w-2/3 bg-slate-100 rounded animate-pulse" />
                    <div className="h-3 w-1/3 bg-slate-100 rounded animate-pulse" />
                  </div>
                </div>
              ))
            : articles.map((a, i) => (
                <button
                  key={a.id}
                  onClick={() => setSelected(a)}
                  onMouseMove={trackSpotlight}
                  className="spotlight-card star-border fade-up flex-shrink-0 w-[300px] snap-start rounded-2xl bg-white shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 overflow-hidden text-left cursor-pointer"
                  style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
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
                      className={`absolute top-3 left-3 z-[2] px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur ${
                        CATEGORY_COLORS[a.category] || 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {a.category}
                    </span>
                  </div>
                  <div className="relative z-[2] p-4">
                    <h3 className="clamp-2 text-sm font-semibold text-slate-900 leading-snug mb-3 min-h-[2.6em]">
                      {a.title}
                    </h3>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-medium truncate max-w-[60%]">{a.source}</span>
                      <span>{timeAgo(a.publishedAt)}</span>
                    </div>
                  </div>
                </button>
              ))}

          {!loading && articles.length === 0 && (
            <div className="w-full py-12 text-center text-sm text-slate-500">
              No articles in this category yet — check back soon.
            </div>
          )}
        </div>

        {/* Rail arrows */}
        <button
          aria-label="Scroll left"
          onClick={() => scrollRail(-1)}
          className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 h-10 w-10 items-center justify-center rounded-full bg-white border border-slate-200 shadow-lg text-slate-600 hover:text-blue-600 hover:scale-110 transition-all opacity-0 group-hover/rail:opacity-100 cursor-pointer z-[3]"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          aria-label="Scroll right"
          onClick={() => scrollRail(1)}
          className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 h-10 w-10 items-center justify-center rounded-full bg-white border border-slate-200 shadow-lg text-slate-600 hover:text-blue-600 hover:scale-110 transition-all opacity-0 group-hover/rail:opacity-100 cursor-pointer z-[3]"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* See more */}
      <div className="flex justify-end mt-6">
        <Link
          href="/news"
          className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-slate-200 hover:border-blue-600 text-sm font-bold text-slate-700 hover:text-blue-600 transition-all cursor-pointer"
        >
          <span>See More</span>
          <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      {/* Detail Modal */}
      {selected && <NewsModal article={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}


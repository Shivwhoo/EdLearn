'use client';

import React, { useEffect, useState } from 'react';
import { Search, X, BookOpen, MonitorPlay, Newspaper, GraduationCap, ArrowRight, Loader2 } from 'lucide-react';
import axios from 'axios';
import { useRouter } from 'next/navigation';

interface SearchResultItem {
  id: string;
  type: 'book' | 'video' | 'audio' | 'news' | 'topic';
  title: string;
  subtitle: string;
  genre?: string;
  category?: string;
  coverImage?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  rating?: number;
  description?: string;
  link: string;
}

interface UniversalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UniversalSearchModal({ isOpen, onClose }: UniversalSearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{
    books: SearchResultItem[];
    media: SearchResultItem[];
    news: SearchResultItem[];
    topics: SearchResultItem[];
  }>({
    books: [],
    media: [],
    news: [],
    topics: [],
  });
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults({ books: [], media: [], news: [], topics: [] });
      setTotalCount(0);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('edlearn_token') : null;
        const res = await axios.get(`/api/search/universal?q=${encodeURIComponent(query)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.data?.success) {
          setResults(res.data.results);
          setTotalCount(res.data.totalCount);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const handleSelect = (link: string) => {
    onClose();
    router.push(link);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-24 bg-slate-950/70 backdrop-blur-sm transition-all"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-100 bg-slate-50/50">
          <Search className="h-5 w-5 text-slate-400 mr-3 shrink-0" />
          <input
            type="text"
            placeholder="Search across books, videos, podcasts, news, and roadmaps..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full bg-transparent text-slate-900 placeholder-slate-400 text-sm focus:outline-none"
          />
          {isLoading ? (
            <Loader2 className="h-5 w-5 text-blue-600 animate-spin mr-2 shrink-0" />
          ) : query ? (
            <button
              onClick={() => setQuery('')}
              className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 mr-2"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-white border border-slate-200 rounded shadow-xs">
            ESC
          </kbd>
        </div>

        {/* Results container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {totalCount === 0 && query.length >= 2 && !isLoading && (
            <div className="text-center py-12 text-slate-500 text-sm">
              No educational resources found for &quot;{query}&quot;. Try different keywords.
            </div>
          )}

          {query.length < 2 && (
            <div className="text-center py-10 text-slate-400 text-xs">
              Type at least 2 characters to search across books, media, news, and your study topics.
            </div>
          )}

          {/* Topics */}
          {results.topics.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5 text-blue-600" />
                <span>Your Study Topics</span>
              </div>
              <div className="space-y-1.5">
                {results.topics.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.link)}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-blue-50/70 border border-transparent hover:border-blue-100 text-left transition-colors cursor-pointer group"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-900 group-hover:text-blue-700">
                        {item.title}
                      </div>
                      <div className="text-xs text-slate-500">{item.subtitle}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-blue-600 transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Books */}
          {results.books.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-emerald-600" />
                <span>Books</span>
              </div>
              <div className="space-y-1.5">
                {results.books.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.link)}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-emerald-50/70 border border-transparent hover:border-emerald-100 text-left transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      {item.coverImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.coverImage} alt="" className="h-10 w-7 object-cover rounded shadow-xs shrink-0" />
                      ) : null}
                      <div>
                        <div className="text-sm font-semibold text-slate-900 group-hover:text-emerald-700">
                          {item.title}
                        </div>
                        <div className="text-xs text-slate-500">{item.subtitle}</div>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-emerald-600 transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Media */}
          {results.media.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <MonitorPlay className="h-3.5 w-3.5 text-red-500" />
                <span>Media & Podcasts</span>
              </div>
              <div className="space-y-1.5">
                {results.media.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.link)}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-red-50/50 border border-transparent hover:border-red-100 text-left transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      {item.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.thumbnailUrl} alt="" className="h-9 w-14 object-cover rounded shadow-xs shrink-0" />
                      ) : null}
                      <div>
                        <div className="text-sm font-semibold text-slate-900 group-hover:text-red-700">
                          {item.title}
                        </div>
                        <div className="text-xs text-slate-500">{item.subtitle}</div>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-red-600 transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* News */}
          {results.news.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Newspaper className="h-3.5 w-3.5 text-amber-600" />
                <span>News & Articles</span>
              </div>
              <div className="space-y-1.5">
                {results.news.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.link)}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-amber-50/50 border border-transparent hover:border-amber-100 text-left transition-colors cursor-pointer group"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-900 group-hover:text-amber-700">
                        {item.title}
                      </div>
                      <div className="text-xs text-slate-500">{item.subtitle}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-amber-600 transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

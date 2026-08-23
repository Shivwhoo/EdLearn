'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bookmark as BookmarkIcon,
  BookOpen,
  MonitorPlay,
  Newspaper,
  GraduationCap,
  Trash2,
  ExternalLink,
  RefreshCw,
  Search,
  FilterX,
} from 'lucide-react';
import axios from 'axios';
import Sidebar from '@/components/Layout/Sidebar';

interface BookmarkItem {
  id: string;
  itemType: 'book' | 'media' | 'news' | 'topic';
  itemId: string;
  title: string;
  metadata?: any;
  createdAt: string;
}

export default function BookmarksPage() {
  const router = useRouter();
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isMounted, setIsMounted] = useState(false);

  const fetchBookmarks = async () => {
    setIsLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('edlearn_token') : null;
      if (!token) {
        router.push('/login');
        return;
      }
      const res = await axios.get('/api/bookmarks', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success) {
        setBookmarks(res.data.bookmarks || []);
      }
    } catch (err: any) {
      console.error('Failed to load bookmarks:', err);
      if (err.response?.status === 401) {
        router.push('/login');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    fetchBookmarks();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('edlearn_token') : null;
      const res = await axios.delete(`/api/bookmarks/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success) {
        setBookmarks((prev) => prev.filter((b) => b.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete bookmark:', err);
    }
  };

  const handleNavigate = (bookmark: BookmarkItem) => {
    switch (bookmark.itemType) {
      case 'book':
        router.push(`/books?search=${encodeURIComponent(bookmark.title)}`);
        break;
      case 'media':
        router.push(`/media?search=${encodeURIComponent(bookmark.title)}`);
        break;
      case 'news':
        router.push(`/news?search=${encodeURIComponent(bookmark.title)}`);
        break;
      case 'topic':
        router.push('/workspace');
        break;
      default:
        break;
    }
  };

  const filteredBookmarks = bookmarks.filter((b) => {
    const matchesType = selectedType === 'all' || b.itemType === selectedType;
    const matchesSearch =
      !searchQuery.trim() ||
      b.title.toLowerCase().includes(searchQuery.toLowerCase().trim());
    return matchesType && matchesSearch;
  });

  if (!isMounted) return null;

  return (
    <>
      <Sidebar />
      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/60 md:ml-60 p-6 md:p-12 pt-24 md:pt-12">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-6">
            <div>
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <BookmarkIcon className="h-5 w-5 fill-blue-600" />
                <span className="text-xs font-bold uppercase tracking-wider">Saved Resources</span>
              </div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Your Bookmarks</h1>
              <p className="text-sm text-slate-500 mt-1">
                Curate and revisit your favorite books, videos, podcasts, news, and topic study notes.
              </p>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: 'all', label: 'All Resources' },
                { key: 'book', label: 'Books', icon: BookOpen },
                { key: 'media', label: 'Media', icon: MonitorPlay },
                { key: 'news', label: 'News', icon: Newspaper },
                { key: 'topic', label: 'Topics', icon: GraduationCap },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setSelectedType(tab.key)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedType === tab.key
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {tab.icon && <tab.icon className="h-3.5 w-3.5" />}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter saved items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          {/* Content list */}
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
              <span className="text-xs font-medium">Loading your bookmarks...</span>
            </div>
          ) : filteredBookmarks.length === 0 ? (
            <div className="py-16 text-center bg-white border border-slate-200 rounded-2xl p-8">
              <FilterX className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">No bookmarks found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                {bookmarks.length === 0
                  ? "You haven't saved any resources yet. Browse books, media, and news to add them to your collection."
                  : 'No bookmarks match your selected filters.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBookmarks.map((b) => (
                <div
                  key={b.id}
                  onClick={() => handleNavigate(b)}
                  className="bg-white border border-slate-200 hover:border-blue-300 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          b.itemType === 'book'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : b.itemType === 'media'
                            ? 'bg-red-50 text-red-700 border border-red-100'
                            : b.itemType === 'news'
                            ? 'bg-amber-50 text-amber-700 border border-amber-100'
                            : 'bg-blue-50 text-blue-700 border border-blue-100'
                        }`}
                      >
                        {b.itemType === 'book' && <BookOpen className="h-3 w-3" />}
                        {b.itemType === 'media' && <MonitorPlay className="h-3 w-3" />}
                        {b.itemType === 'news' && <Newspaper className="h-3 w-3" />}
                        {b.itemType === 'topic' && <GraduationCap className="h-3 w-3" />}
                        {b.itemType}
                      </span>
                      <button
                        onClick={(e) => handleDelete(b.id, e)}
                        title="Remove bookmark"
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug">
                      {b.title}
                    </h3>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Saved {new Date(b.createdAt).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1 text-blue-600 font-semibold group-hover:translate-x-0.5 transition-transform">
                      <span>View</span>
                      <ExternalLink className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

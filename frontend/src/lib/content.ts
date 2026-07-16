/**
 * Shared types + helpers for the dynamic content sections
 * (news / media / books). All requests go through the Next.js
 * "/api/:path*" rewrite proxy to the backend.
 */

export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  source: string;
  url: string;
  imageUrl: string | null;
  category: string;
  publishedAt: string;
}

export interface MediaItem {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  contentUrl: string;
  contentType: 'video' | 'audio';
  platform: string;
  channelName: string;
  duration: number | null;
  publishedAt: string;
  category: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  coverImage: string;
  description: string;
  threeSentenceTakeaway: string;
  genre: string;
  buyLink: string | null;
  rating: number | null;
  publishedAt: string;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export async function fetchContent<T>(
  endpoint: 'news' | 'media' | 'books',
  params: Record<string, string | number | undefined>
): Promise<Paginated<T>> {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '' && v !== 'all')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');

  const res = await fetch(`/api/${endpoint}${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error(`Failed to load ${endpoint} (${res.status})`);
  return res.json();
}

/** "3h ago" / "2d ago" / "Mar 2026" style relative timestamps */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

/** Seconds -> "1h 24m" / "18m" / "45s" */
export function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '';
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Extract a YouTube video ID from a watch/share URL */
export function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);
  return m ? m[1] : null;
}

/** Spotlight mouse-tracking handler — sets --spot-x/--spot-y CSS vars */
export function trackSpotlight(e: React.MouseEvent<HTMLElement>): void {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  el.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
  el.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
}

/**
 * Media fetcher — pulls videos from the YouTube Data API v3 (curated
 * channels) and episodes from the PodcastIndex API (curated shows),
 * normalizes both into the MediaContent table.
 *
 * Scheduled by contentCrons.ts to run every 6 hours.
 * Each source skips gracefully (with a log) when its keys are missing.
 */
import axios from 'axios';
import crypto from 'crypto';
import db from '../lib/db';

// ------------------------------------------------------------------ config

// Curated YouTube channels -> our category
const YOUTUBE_CHANNELS: Array<{ id: string; name: string; category: string }> = [
  { id: 'UCAuUUnT6oDeKwE6v1NGQxug', name: 'TED', category: 'culture' },
  { id: 'UCvQECJukTDE2i6aCoMnS-Vg', name: 'Big Think', category: 'science' },
  { id: 'UC2D2CMWXMOVWx7giW1n3LIg', name: 'Huberman Lab', category: 'health' },
  { id: 'UCyaN6mg5u8Cjy2ZI4ikWaug', name: '100x Entrepreneur', category: 'business' },
];

// Curated PodcastIndex shows (by feed search term) -> our category
const PODCAST_SHOWS: Array<{ term: string; category: string }> = [
  { term: 'How I Built This', category: 'business' },
  { term: 'Hardcore History', category: 'history' },
  { term: 'Science Friday', category: 'science' },
  { term: '99% Invisible', category: 'culture' },
  { term: 'Creative Mornings', category: 'culture' },
  { term: 'PechaKucha', category: 'culture' },
];

// No politics / entertainment / sports / celebrity content
const EXCLUDE_PATTERN =
  /\b(politic|election|senat|congress|parliament|partisan|democrat|republican|celebrit|gossip|red carpet|box office|comedy|stand-up|sitcom|football|soccer|basketball|baseball|cricket|tennis|olympic|nfl|nba|mlb|fifa)\b/i;

// ------------------------------------------------------------------ youtube

/** ISO8601 duration (PT1H2M3S) -> seconds */
function parseIsoDuration(iso: string): number | null {
  const m = iso?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return null;
  return (parseInt(m[1] || '0', 10) * 3600) + (parseInt(m[2] || '0', 10) * 60) + parseInt(m[3] || '0', 10);
}

async function fetchYouTube(): Promise<number> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey || apiKey.startsWith('your_')) {
    console.warn('[mediaCron] YOUTUBE_API_KEY not configured — skipping YouTube.');
    return 0;
  }

  let stored = 0;
  for (const channel of YOUTUBE_CHANNELS) {
    try {
      // 1. Latest uploads for the channel
      const search = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          key: apiKey,
          channelId: channel.id,
          part: 'snippet',
          order: 'date',
          type: 'video',
          maxResults: 10,
        },
        timeout: 20_000,
      });

      const items = search.data?.items || [];
      const videoIds = items.map((i: any) => i.id?.videoId).filter(Boolean);
      if (!videoIds.length) continue;

      // 2. Durations for those videos
      const details = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
        params: { key: apiKey, id: videoIds.join(','), part: 'contentDetails,snippet' },
        timeout: 20_000,
      });

      for (const v of details.data?.items || []) {
        const sn = v.snippet;
        if (!sn?.title) continue;
        if (EXCLUDE_PATTERN.test(`${sn.title} ${sn.description || ''}`)) continue;

        const contentUrl = `https://www.youtube.com/watch?v=${v.id}`;
        await db.mediaContent.upsert({
          where: { contentUrl },
          create: {
            title: sn.title.slice(0, 300),
            description: (sn.description || '').slice(0, 2000),
            thumbnailUrl: sn.thumbnails?.high?.url || sn.thumbnails?.default?.url || '',
            contentUrl,
            contentType: 'video',
            platform: 'youtube',
            channelName: channel.name,
            duration: parseIsoDuration(v.contentDetails?.duration),
            publishedAt: new Date(sn.publishedAt),
            category: channel.category,
          },
          update: { title: sn.title.slice(0, 300) },
        });
        stored++;
      }
    } catch (err: any) {
      console.error(`[mediaCron] YouTube fetch failed for "${channel.name}":`, err?.message || err);
    }
  }
  return stored;
}

// ------------------------------------------------------------- podcastindex

function podcastIndexHeaders(): Record<string, string> | null {
  const key = process.env.PODCAST_INDEX_KEY;
  const secret = process.env.PODCAST_INDEX_SECRET;
  if (!key || !secret || key.startsWith('your_')) return null;

  const authDate = Math.floor(Date.now() / 1000).toString();
  const hash = crypto.createHash('sha1').update(key + secret + authDate).digest('hex');
  return {
    'X-Auth-Key': key,
    'X-Auth-Date': authDate,
    Authorization: hash,
    'User-Agent': 'EdLearn/1.0',
  };
}

async function fetchPodcasts(): Promise<number> {
  const headers = podcastIndexHeaders();
  if (!headers) {
    console.warn('[mediaCron] PodcastIndex keys not configured — skipping podcasts.');
    return 0;
  }

  const base = 'https://api.podcastindex.org/api/1.0';
  let stored = 0;

  for (const show of PODCAST_SHOWS) {
    try {
      // 1. Resolve the feed
      const feedRes = await axios.get(`${base}/search/byterm`, {
        params: { q: show.term, max: 1 },
        headers,
        timeout: 20_000,
      });
      const feed = feedRes.data?.feeds?.[0];
      if (!feed?.id) continue;

      // 2. Recent episodes from that feed
      const epRes = await axios.get(`${base}/episodes/byfeedid`, {
        params: { id: feed.id, max: 8 },
        headers,
        timeout: 20_000,
      });

      for (const ep of epRes.data?.items || []) {
        if (!ep.title || !ep.enclosureUrl) continue;
        if (EXCLUDE_PATTERN.test(`${ep.title} ${ep.description || ''}`)) continue;

        await db.mediaContent.upsert({
          where: { contentUrl: ep.enclosureUrl },
          create: {
            title: String(ep.title).slice(0, 300),
            description: String(ep.description || '').replace(/<[^>]+>/g, '').slice(0, 2000),
            thumbnailUrl: ep.image || ep.feedImage || feed.image || '',
            contentUrl: ep.enclosureUrl,
            contentType: 'audio',
            platform: 'podcastindex',
            channelName: feed.title || show.term,
            duration: ep.duration || null,
            publishedAt: new Date((ep.datePublished || 0) * 1000),
            category: show.category,
          },
          update: { title: String(ep.title).slice(0, 300) },
        });
        stored++;
      }
    } catch (err: any) {
      console.error(`[mediaCron] PodcastIndex fetch failed for "${show.term}":`, err?.message || err);
    }
  }
  return stored;
}

// ------------------------------------------------------------------- runner

export async function runMediaFetch(): Promise<void> {
  const [yt, pods] = await Promise.all([fetchYouTube(), fetchPodcasts()]);
  console.log(`[mediaCron] Done — upserted ${yt} videos, ${pods} podcast episodes.`);
}

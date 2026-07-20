/**
 * Books fetcher — pulls popular/trending titles per genre from the
 * Google Books API and upserts them into the BookSummary table.
 *
 * Scheduled by contentCrons.ts to run every 24 hours.
 * Skips gracefully (with a log) when BOOKS_API_KEY is not configured.
 */
import axios from 'axios';
import db from '../lib/db';

// Our genre -> Google Books subject query
const GENRE_QUERIES: Record<string, string> = {
  business: 'subject:business',
  tech: 'subject:computers',
  science: 'subject:science',
  'self-improvement': 'subject:"self-help"',
  history: 'subject:history',
  health: 'subject:"health & fitness"',
};

export async function runBooksFetch(): Promise<void> {
  const apiKey = process.env.BOOKS_API_KEY;
  if (!apiKey || apiKey.startsWith('your_')) {
    console.warn('[booksCron] BOOKS_API_KEY not configured — skipping fetch.');
    return;
  }

  let stored = 0;
  for (const [genre, q] of Object.entries(GENRE_QUERIES)) {
    try {
      const { data } = await axios.get('https://www.googleapis.com/books/v1/volumes', {
        params: {
          q,
          orderBy: 'relevance',
          printType: 'books',
          langRestrict: 'en',
          maxResults: 15,
          key: apiKey,
        },
        timeout: 20_000,
      });

      for (const item of data?.items || []) {
        const v = item.volumeInfo;
        if (!v?.title || !v?.authors?.length || !v?.description) continue;
        if (v.description.length < 120) continue; // skip stub entries

        const description: string = String(v.description).replace(/<[^>]+>/g, '');
        // First ~3 sentences of the description as the takeaway
        const takeaway = description.split(/(?<=[.!?])\s+/).slice(0, 3).join(' ').slice(0, 600);
        const cover: string | undefined =
          v.imageLinks?.thumbnail?.replace(/^http:/, 'https:') ||
          v.imageLinks?.smallThumbnail?.replace(/^http:/, 'https:');
        if (!cover) continue;

        await db.bookSummary.upsert({
          where: { title_author: { title: v.title.slice(0, 300), author: v.authors[0].slice(0, 200) } },
          create: {
            title: v.title.slice(0, 300),
            author: v.authors[0].slice(0, 200),
            coverImage: cover,
            description: description.slice(0, 3000),
            threeSentenceTakeaway: takeaway,
            genre,
            buyLink: item.saleInfo?.buyLink || v.infoLink || null,
            rating: typeof v.averageRating === 'number' ? v.averageRating : null,
            publishedAt: v.publishedDate ? new Date(v.publishedDate) : new Date(),
          },
          update: {
            rating: typeof v.averageRating === 'number' ? v.averageRating : undefined,
            coverImage: cover,
          },
        });
        stored++;
      }
    } catch (err: any) {
      console.error(`[booksCron] Fetch failed for genre "${genre}":`, err?.message || err);
    }
  }

  console.log(`[booksCron] Done — upserted ${stored} books.`);
}

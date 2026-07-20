/**
 * News fetcher — pulls articles from NewsAPI (https://newsapi.org),
 * filters to allowed categories, excludes politics/entertainment/sports,
 * and upserts into the NewsArticle table.
 *
 * Scheduled by contentCrons.ts to run every 3 hours.
 * Skips gracefully (with a log) when NEWS_API_KEY is not configured.
 */
import axios from 'axios';
import db from '../lib/db';

const NEWS_API_URL = process.env.NEWS_API_URL || 'https://newsapi.org/v2';

// Our app category -> NewsAPI query mapping
const CATEGORY_QUERIES: Record<string, string> = {
  tech: 'technology OR software OR "artificial intelligence"',
  finance: 'finance OR markets OR economy OR investing',
  world: 'world OR global OR international',
  medical: 'medicine OR healthcare OR "clinical trial" OR disease',
  science: 'science OR research OR physics OR biology OR space',
  education: 'education OR university OR learning OR students',
};

// Politics / entertainment / sports / celebrity exclusion filter
const EXCLUDE_PATTERN =
  /\b(politic|election|senat|congress|parliament|president(ial)? race|campaign trail|partisan|democrat|republican|celebrit|gossip|red carpet|box office|movie premiere|sitcom|reality tv|football|soccer|basketball|baseball|cricket|tennis|olympic|premier league|nfl|nba|mlb|fifa|comedy special|stand-up)\b/i;

interface NewsApiArticle {
  title: string | null;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  source: { name: string | null };
}

export async function runNewsFetch(): Promise<void> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey || apiKey.startsWith('your_')) {
    console.warn('[newsCron] NEWS_API_KEY not configured — skipping fetch.');
    return;
  }

  let stored = 0;
  for (const [category, query] of Object.entries(CATEGORY_QUERIES)) {
    try {
      const { data } = await axios.get(`${NEWS_API_URL}/everything`, {
        params: {
          q: query,
          language: 'en',
          sortBy: 'publishedAt',
          pageSize: 20,
          apiKey,
        },
        timeout: 20_000,
      });

      const articles: NewsApiArticle[] = data?.articles || [];
      for (const a of articles) {
        if (!a.title || !a.url || !a.description) continue;
        if (EXCLUDE_PATTERN.test(`${a.title} ${a.description}`)) continue;

        await db.newsArticle.upsert({
          where: { url: a.url },
          create: {
            title: a.title.slice(0, 300),
            description: a.description.slice(0, 2000),
            source: a.source?.name || 'Unknown',
            url: a.url,
            imageUrl: a.urlToImage || null,
            category,
            publishedAt: new Date(a.publishedAt),
          },
          update: {
            title: a.title.slice(0, 300),
            description: a.description.slice(0, 2000),
            imageUrl: a.urlToImage || null,
          },
        });
        stored++;
      }
    } catch (err: any) {
      console.error(`[newsCron] Fetch failed for category "${category}":`, err?.message || err);
    }
  }

  // Prune articles older than a year to keep the table lean
  await db.newsArticle.deleteMany({
    where: { publishedAt: { lt: new Date(Date.now() - 366 * 24 * 60 * 60 * 1000) } },
  });

  console.log(`[newsCron] Done — upserted ${stored} articles.`);
}

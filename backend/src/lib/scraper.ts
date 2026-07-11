import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ScrapedContext {
  title: string;
  content: string;
  sourceUrl: string;
}

const WIKI_HEADERS = {
  headers: {
    'User-Agent': 'EdLearn/1.0 (contact@edlearn.edu; Academic RAG Research Engine)',
  }
};

/**
 * Searches Wikipedia and returns the page text context.
 * H1 Fix: Fetches both pages in parallel with Promise.all (saves ~1.5s vs. serial)
 */
async function searchWikipedia(query: string): Promise<ScrapedContext[]> {
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query
    )}&format=json&origin=*`;
    const searchResponse = await axios.get(searchUrl, WIKI_HEADERS);
    const searchResults = searchResponse.data.query?.search || [];

    if (searchResults.length === 0) return [];

    // H1: Fetch top 2 article extracts in PARALLEL instead of sequential
    const topResults = searchResults.slice(0, 2);
    const contentFetches = topResults.map(async (result: any) => {
      const pageId = result.pageid;
      const contentUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&pageids=${pageId}&format=json&origin=*`;
      try {
        const contentResponse = await axios.get(contentUrl, WIKI_HEADERS);
        const pageData = contentResponse.data.query?.pages[pageId];
        if (pageData && pageData.extract) {
          return {
            title: pageData.title,
            content: pageData.extract,
            sourceUrl: `https://en.wikipedia.org/?curid=${pageId}`,
          } as ScrapedContext;
        }
      } catch {
        // Skip failed individual page fetch
      }
      return null;
    });

    const results = await Promise.all(contentFetches);
    return results.filter((r): r is ScrapedContext => r !== null);
  } catch (error) {
    console.error('Wikipedia search error:', error);
    return [];
  }
}

/**
 * Scrapes clean textual contents from a specific web URL.
 */
async function scrapeUrl(url: string): Promise<ScrapedContext> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
      },
      timeout: 8000,
    });
    const $ = cheerio.load(response.data);

    // Eliminate layout overhead elements
    $('script, style, nav, footer, header, iframe, noscript').remove();

    const title = $('title').text().trim() || 'External Web Resource';
    const content = $('p')
      .map((_, el) => $(el).text())
      .get()
      .join('\n')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 10000); // Restrict token length

    return { title, content, sourceUrl: url };
  } catch (error) {
    console.error(`Scrape URL error for ${url}:`, error);
    throw new Error(`Failed to scrape content from ${url}`);
  }
}

/**
 * High-level router to retrieve ground-truth context based on input params.
 */
export async function getReferenceContext(query: string, url?: string): Promise<ScrapedContext[]> {
  if (url && url.startsWith('http')) {
    const context = await scrapeUrl(url);
    return [context];
  }
  return searchWikipedia(query);
}

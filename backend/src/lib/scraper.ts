import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ScrapedContext {
  title: string;
  content: string;
  sourceUrl: string;
}

/**
 * Searches Wikipedia and returns the page text context.
 */
async function searchWikipedia(query: string): Promise<ScrapedContext[]> {
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query
    )}&format=json&origin=*`;
    const searchResponse = await axios.get(searchUrl);
    const searchResults = searchResponse.data.query?.search || [];
    
    if (searchResults.length === 0) return [];

    const results: ScrapedContext[] = [];
    // Retrieve intro content for the top 2 matching articles
    for (const result of searchResults.slice(0, 2)) {
      const pageId = result.pageid;
      const contentUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&pageids=${pageId}&format=json&origin=*`;
      const contentResponse = await axios.get(contentUrl);
      const pageData = contentResponse.data.query?.pages[pageId];
      if (pageData && pageData.extract) {
        results.push({
          title: pageData.title,
          content: pageData.extract,
          sourceUrl: `https://en.wikipedia.org/?curid=${pageId}`,
        });
      }
    }
    return results;
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

    return {
      title,
      content,
      sourceUrl: url,
    };
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

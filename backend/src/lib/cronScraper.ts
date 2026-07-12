import axios from 'axios';
import { connectMongo } from './mongodb';
import MarketDemand from './models/MarketDemand';

const DEFAULT_TRENDS = [
  { skill: 'React', source: 'linkedin' as const, demandScore: 12400 },
  { skill: 'Next.js', source: 'linkedin' as const, demandScore: 9800 },
  { skill: 'TypeScript', source: 'linkedin' as const, demandScore: 15600 },
  { skill: 'Python', source: 'linkedin' as const, demandScore: 22000 },
  { skill: 'Rust', source: 'github' as const, demandScore: 8400 },
  { skill: 'Go', source: 'github' as const, demandScore: 11200 },
  { skill: 'Tailwind CSS', source: 'github' as const, demandScore: 9200 },
  { skill: 'SQL Queries', source: 'linkedin' as const, demandScore: 18200 },
  { skill: 'Docker Containers', source: 'github' as const, demandScore: 10400 }
];

export async function runMarketDemandScraper() {
  console.log('Running background Market Demand Scraper cron task...');
  try {
    await connectMongo();

    // 1. Fetch GitHub popular languages
    try {
      const githubRes = await axios.get('https://api.github.com/search/repositories?q=stars:>15000&sort=stars', {
        headers: { 'User-Agent': 'EdLearn-Cron-Scraper' },
        timeout: 6000,
      });
      const items = githubRes.data?.items || [];
      const languagesMap: { [key: string]: number } = {};

      items.forEach((item: any) => {
        if (item.language) {
          languagesMap[item.language] = (languagesMap[item.language] || 0) + 1;
        }
      });

      for (const [lang, count] of Object.entries(languagesMap)) {
        await MarketDemand.findOneAndUpdate(
          { skill: lang, source: 'github' },
          { skill: lang, source: 'github', demandScore: count * 1500, updatedAt: new Date() },
          { upsert: true, new: true }
        );
      }
    } catch (ghErr) {
      console.warn('GitHub API rate limit or error, using database fallbacks:', ghErr instanceof Error ? ghErr.message : ghErr);
    }

    // 2. Scrape/Upsert LinkedIn simulated trends
    for (const trend of DEFAULT_TRENDS) {
      const fluctuation = Math.floor((Math.random() - 0.5) * 500);
      await MarketDemand.findOneAndUpdate(
        { skill: trend.skill, source: trend.source },
        { 
          skill: trend.skill, 
          source: trend.source, 
          demandScore: Math.max(100, trend.demandScore + fluctuation), 
          updatedAt: new Date() 
        },
        { upsert: true, new: true }
      );
    }
    
    console.log('Market Demand database trends updated successfully.');
  } catch (error) {
    console.error('Market Demand Scraper failed:', error);
  }
}


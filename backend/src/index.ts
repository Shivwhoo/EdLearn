import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

const localEnv = path.resolve(process.cwd(), '.env');
const parentEnv = path.resolve(process.cwd(), '../.env');

if (fs.existsSync(localEnv)) {
  dotenv.config({ path: localEnv });
} else if (fs.existsSync(parentEnv)) {
  dotenv.config({ path: parentEnv });
} else {
  dotenv.config();
}

import express from 'express';
import cors from 'cors';
import { aiService } from './lib/ai/aiService';
import { getReferenceContext } from './lib/scraper';
import { getPedagogicalModeConfig } from './lib/ai/pedagogicalEngine';
import db from './lib/db';
import { connectMongo } from './lib/mongodb';
import Thread from './lib/models/Thread';
import { v4 as uuidv4 } from 'uuid';
import MarketDemand from './lib/models/MarketDemand';
import { startMarketDemandCron } from './lib/cronScraper';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: '*' }));
app.use(express.json());

// 1. Health Probe
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', provider: aiService.getActiveProviderName() });
});

// 2. Generate Content (6 Modes + RAG)
app.post('/api/generate', async (req: express.Request, res: express.Response): Promise<any> => {
  try {
    const { topic, mode, difficulty, url, dayId } = req.body;

    if (!topic || !mode || !difficulty) {
      return res.status(400).json({ error: 'Missing required parameters: topic, mode, difficulty' });
    }

    const modeNumber = parseInt(mode, 10);

    // Perform RAG scrape
    const contextList = await getReferenceContext(topic, url);

    // Format RAG contexts into clean numbered blocks
    const contextStringForPrompt = contextList.length > 0
      ? contextList.map((ctx, idx) => `[Source ${idx + 1}]: Title: ${ctx.title}\nURL: ${ctx.sourceUrl}\nContent excerpt: ${ctx.content}\n---`).join('\n')
      : "No external context available. Rely on standard verified knowledge.";

    const systemPrompt = `You are an elite academic professor and subject-matter expert. Your task is to generate comprehensive, highly detailed, and extremely professional educational study notes to help a student master the requested topic.
Do NOT use oversimplified physical analogies or childish tone. Focus on clean structural formatting, rich explanations, and depth of knowledge.
Include code examples with language identifiers (like javascript, typescript, python, css, html, sql, etc.) if applicable to the topic. Otherwise leave them empty.

You must return your output strictly in JSON format matching the schema below.
Schema:
{
  "title": "string (the main topic title)",
  "difficulty": "string (difficulty level)",
  "introduction": "string (a thorough, detailed introduction to the topic, setting up context and core motivations)",
  "outline": ["string (key concept 1)", "string (key concept 2)", "string (key concept 3)"],
  "contentBlocks": [
    {
      "heading": "string (sub-topic or concept heading)",
      "content": "string (highly descriptive, clean, multi-paragraph content explaining the concept thoroughly)",
      "codeExample": "string (code snippet showing execution/implementation, empty if not applicable)",
      "language": "string (e.g. javascript, typescript, python, empty if not applicable)"
    }
  ],
  "summary": "string (a comprehensive summary concluding the study guide and outlining key takeaways)",
  "sources": [{"label": "string", "url": "string"}]
}

Reference Context from Web Search Scrapes:
${contextStringForPrompt}

Important Citation Instructions:
- Support explanations with references from the search scrapes context where available.
- For every fact or statement you write, you MUST cite which source it came from using the index suffix format like this: "[1]" (referring to Source 1) or "[2]" (referring to Source 2).
- Ensure all properties in the JSON structure are filled out. Do not wrap output in markdown code blocks. Return only valid JSON.`;

    const userPrompt = `Generate premium, comprehensive educational study notes for "${topic}" at the "${difficulty}" level. If it involves programming, include detailed code examples.`;

    // Generate output (First Pass)
    const firstPassResponse = await aiService.generate(userPrompt, {
      systemPrompt: systemPrompt,
      jsonMode: true,
      temperature: 0.5,
    });

    // Double-Pass Review (Second Pass)
    const contextString = contextList.length > 0
      ? contextList.map((ctx, idx) => `[Source ${idx + 1}]: Title: ${ctx.title}\nContent: ${ctx.content}`).join('\n')
      : "No external context.";

    const reviewSystemPrompt = `You are a strict educational content reviewer.
Your task is to audit the lesson JSON content below for:
1. Inaccuracies compared to reference source contexts.
2. Unexplained technical jargon.
3. Logical leaps or gaps.
4. Correct placement of citation numbers (e.g. [1], [2]).
If any issues are found, rewrite and correct them. Ensure the output is strictly valid JSON matching the exact original structure.
Do not wrap your output in markdown formatting or add extra text. Provide only the clean JSON.`;

    const reviewPrompt = `Reference Contexts:
${contextString}

Original Generated Lesson JSON:
${firstPassResponse}`;

    const responseText = await aiService.generate(reviewPrompt, {
      systemPrompt: reviewSystemPrompt,
      jsonMode: true,
      temperature: 0.3, // Lower temperature for correction precision
    });

    let parsedContent;
    try {
      parsedContent = JSON.parse(responseText);
    } catch (e) {
      const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      try {
        parsedContent = JSON.parse(cleaned);
      } catch (innerErr) {
        console.error('Failed to parse AI output as JSON. Raw:', responseText);
        return res.status(500).json({ error: 'Failed to format AI response as JSON', raw: responseText });
      }
    }

    // Persist in relational database if dayId link exists
    let dbTopic = null;
    if (dayId) {
      try {
        dbTopic = await db.topic.create({
          data: {
            dayId: dayId,
            title: topic,
            mode: modeNumber,
            notesHtml: responseText,
            citations: {
              create: (parsedContent.sources || []).map((s: any) => ({
                label: s.label || 'Web Reference',
                rawText: `Citation mapping references verification from scraper: ${s.label}`,
                sourceUrl: s.url,
              })),
            },
          },
          include: {
            citations: true,
          },
        });
      } catch (dbErr) {
        console.error('Prisma saving failed:', dbErr);
      }
    }

    res.json({
      success: true,
      mode: modeNumber,
      data: parsedContent,
      dbTopic,
    });
  } catch (error) {
    console.error('Generate Route Error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal Server Error' });
  }
});

// 3. Roadmap Creation
app.post('/api/roadmap', async (req: express.Request, res: express.Response): Promise<any> => {
  try {
    const { goal, deadline, availableTime, difficulty, userId } = req.body;

    if (!goal || !deadline || !availableTime || !difficulty) {
      return res.status(400).json({ error: 'Missing parameters: goal, deadline, availableTime, difficulty' });
    }

    // Call Mode 4 (Roadmap Generator)
    const config = getPedagogicalModeConfig(4, goal, difficulty, []);

    const responseText = await aiService.generate(config.userPrompt, {
      systemPrompt: config.systemPrompt,
      jsonMode: true,
      temperature: 0.5,
    });

    let roadmapData;
    try {
      roadmapData = JSON.parse(responseText);
    } catch (e) {
      const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      try {
        roadmapData = JSON.parse(cleaned);
      } catch (innerErr) {
        console.error('Roadmap JSON parsing failed. Raw:', responseText);
        return res.status(500).json({ error: 'Failed to format AI response as JSON', raw: responseText });
      }
    }

    // Identify/Create active user
    let activeUserId = userId;
    if (!activeUserId) {
      const defaultUser = await db.user.findFirst();
      if (defaultUser) {
        activeUserId = defaultUser.id;
      } else {
        const newUser = await db.user.create({
          data: {
            email: 'student@edlearn.com',
            passwordHash: 'dummy_hash_for_testing',
            profile: {
              create: {
                fullName: 'Default Learner',
                careerGoal: goal,
                currentSkills: [],
                availableTime: parseInt(availableTime, 10),
                difficulty,
              },
            },
          },
        });
        activeUserId = newUser.id;
      }
    }

    // Save Roadmap
    const createdRoadmap = await db.roadmap.create({
      data: {
        userId: activeUserId,
        title: roadmapData.title || `Roadmap: ${goal}`,
        deadline: new Date(deadline),
        isAchievable: roadmapData.isAchievable ?? true,
        days: {
          create: (roadmapData.days || []).map((day: any) => ({
            dayNumber: day.dayNumber,
            title: day.title,
            duration: day.durationMinutes || parseInt(availableTime, 10),
          })),
        },
      },
      include: {
        days: true,
      },
    });

    res.json({
      success: true,
      roadmap: createdRoadmap,
      feasibility: roadmapData.feasibilityNote,
    });
  } catch (error) {
    console.error('Roadmap API Error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal Server Error' });
  }
});

// 4. Doubt Forum API Routes (Mongoose)
// Helper to dynamically calculate user badges and ranks in the community Doubt Forum
async function calculateUserRankAndBadges(userId: string): Promise<{ rank: string; badges: string[] }> {
  try {
    const userThreads = await Thread.find({ 'author.userId': userId });
    let totalUpvotes = 0;
    userThreads.forEach((t) => {
      totalUpvotes += t.upvotes?.length || 0;
    });

    const threadsWithComments = await Thread.find({ 'comments.author.userId': userId });
    threadsWithComments.forEach((t) => {
      t.comments.forEach((c) => {
        if (c.author.userId === userId) {
          totalUpvotes += c.upvotes?.length || 0;
        }
      });
    });

    let rank = 'Learner';
    const badges: string[] = [];

    if (totalUpvotes >= 20) {
      rank = 'Expert Mentor';
      badges.push('Top Responder', 'Subject Authority');
    } else if (totalUpvotes >= 10) {
      rank = 'Helper';
      badges.push('Active Contributor');
    } else if (totalUpvotes >= 5) {
      rank = 'Scholar';
      badges.push('Curious Mind');
    }

    return { rank, badges };
  } catch (err) {
    console.error('Error calculating badges:', err);
    return { rank: 'Learner', badges: [] };
  }
}

app.get('/api/doubt', async (req: express.Request, res: express.Response): Promise<any> => {
  try {
    await connectMongo();
    const topicId = req.query.topicId as string;

    if (!topicId) {
      return res.status(400).json({ error: 'Missing topicId query parameter' });
    }

    const threads = await Thread.find({ topicId }).sort({ createdAt: -1 });

    const enrichedThreads = await Promise.all(threads.map(async (t) => {
      const authorMetadata = await calculateUserRankAndBadges(t.author.userId);
      
      const enrichedComments = await Promise.all(t.comments.map(async (c) => {
        const commentAuthorMetadata = await calculateUserRankAndBadges(c.author.userId);
        return {
          commentId: c.commentId,
          content: c.content,
          upvotes: c.upvotes,
          replies: c.replies,
          createdAt: c.createdAt,
          author: {
            userId: c.author.userId,
            name: c.author.name,
            rank: commentAuthorMetadata.rank,
            badges: commentAuthorMetadata.badges
          }
        };
      }));

      return {
        _id: t._id,
        topicId: t.topicId,
        title: t.title,
        content: t.content,
        upvotes: t.upvotes,
        resolved: t.resolved,
        bestAnswerId: t.bestAnswerId,
        createdAt: t.createdAt,
        author: {
          userId: t.author.userId,
          name: t.author.name,
          avatar: t.author.avatar,
          rank: authorMetadata.rank,
          badges: authorMetadata.badges
        },
        comments: enrichedComments
      };
    }));

    res.json({ success: true, threads: enrichedThreads });
  } catch (error) {
    console.error('Doubt GET error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal Server Error' });
  }
});

app.post('/api/doubt', async (req: express.Request, res: express.Response): Promise<any> => {
  try {
    await connectMongo();
    const { action, topicId, title, content, authorName, userId, threadId } = req.body;

    if (action === 'createThread') {
      if (!topicId || !title || !content || !authorName || !userId) {
        return res.status(400).json({ error: 'Missing thread parameters' });
      }

      const newThread = await Thread.create({
        topicId,
        title,
        content,
        author: { userId, name: authorName },
        upvotes: [],
        resolved: false,
        comments: [],
      });

      return res.json({ success: true, thread: newThread });
    }

    if (action === 'createComment') {
      if (!threadId || !content || !authorName || !userId) {
        return res.status(400).json({ error: 'Missing comment parameters' });
      }

      const newComment = {
        commentId: uuidv4(),
        author: { userId, name: authorName },
        content,
        upvotes: [],
        replies: [],
        createdAt: new Date(),
      };

      const updatedThread = await Thread.findByIdAndUpdate(
        threadId,
        { $push: { comments: newComment } },
        { new: true }
      );

      return res.json({ success: true, thread: updatedThread });
    }

    if (action === 'upvoteThread') {
      if (!threadId || !userId) {
        return res.status(400).json({ error: 'Missing upvote parameters' });
      }

      const thread = await Thread.findById(threadId);
      if (!thread) {
        return res.status(404).json({ error: 'Thread not found' });
      }

      const hasUpvoted = thread.upvotes.includes(userId);
      const update = hasUpvoted
        ? { $pull: { upvotes: userId } }
        : { $addToSet: { upvotes: userId } };

      const updated = await Thread.findByIdAndUpdate(threadId, update, { new: true });
      return res.json({ success: true, thread: updated });
    }

    res.status(400).json({ error: 'Invalid action specified' });
  } catch (error) {
    console.error('Doubt POST error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal Server Error' });
  }
});

// 5. Market Demand trends API
app.get('/api/market-demand', async (req: express.Request, res: express.Response): Promise<any> => {
  try {
    await connectMongo();
    const trends = await MarketDemand.find().sort({ demandScore: -1 });
    return res.json({ success: true, trends });
  } catch (error) {
    console.error('Market demand fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch market demand indicators' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server successfully listening on port ${PORT}`);
  // Start the background cron updater
  startMarketDemandCron();
});

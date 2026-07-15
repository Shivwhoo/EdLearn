import './loadEnv';

import path from 'path';
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
import { startMarketWorker } from './lib/queues/marketQueue';
import { hashPassword, verifyPassword, generateToken } from './lib/auth';
import { authenticate, AuthenticatedRequest } from './middleware/auth';
import { redisCache } from './lib/redis';
import { generateHandoffToken, buildHandoffUrl, SsoApp } from './lib/sso';
import { generateSpeechFile, generatePodcastAudio } from './lib/tts';

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;

// C3: Restrict CORS to configured frontend origin(s) only.
// FRONTEND_URL may be a comma-separated list (e.g. a deployed URL plus
// localhost during development). Trailing slashes are trimmed so
// "http://localhost:3000/" and "http://localhost:3000" both match.
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

console.log(`[CORS] Allowed origin(s): ${allowedOrigins.join(', ')}`);

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// M3: Limit request body to 1mb to prevent DoS via oversized payloads
app.use(express.json({ limit: '1mb' }));

// Serve generated TTS audio files. Mounted under /api so the existing
// frontend rewrite ("/api/:path*" -> backend) already proxies it — see
// frontend/next.config.ts.
app.use('/api/tts/audio', express.static(path.join(__dirname, '../tts-audio')));

// 1. Health Probe
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', provider: aiService.getActiveProviderName() });
});

// --- Authentication Endpoints ---

// Signup Route
app.post('/api/auth/signup', async (req: express.Request, res: express.Response): Promise<any> => {
  try {
    const { email, password, fullName } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Missing required signup parameters: email, password, fullName' });
    }

    const emailLower = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: emailLower }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'A user with this email address already exists.' });
    }

    // Hash password and store
    const hashedPassword = hashPassword(password);
    const user = await db.user.create({
      data: {
        email: emailLower,
        passwordHash: hashedPassword,
        profile: {
          create: {
            fullName,
            careerGoal: '',
            currentSkills: [],
            availableTime: 45,
            difficulty: 'Intermediate'
          }
        }
      },
      include: {
        profile: true
      }
    });

    const token = generateToken({ id: user.id, email: user.email });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.profile?.fullName || fullName
      }
    });
  } catch (error) {
    console.error('Signup Error:', error);
    res.status(500).json({ error: 'Internal Server Error during registration.' });
  }
});

// Login Route
app.post('/api/auth/login', async (req: express.Request, res: express.Response): Promise<any> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing login credentials.' });
    }

    const emailLower = email.toLowerCase().trim();

    const user = await db.user.findUnique({
      where: { email: emailLower },
      include: { profile: true }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const isMatch = verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const token = generateToken({ id: user.id, email: user.email });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.profile?.fullName || 'Student'
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Internal Server Error during login.' });
  }
});

// Fetch current user
app.get('/api/auth/me', authenticate, async (req: express.Request, res: express.Response): Promise<any> => {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Retrieve active roadmap (optimized via Redis)
    let activeRoadmap = null;
    try {
      const cachedRoadmapId = await redisCache.getCache(`active_roadmap:${userId}`);
      if (cachedRoadmapId) {
        activeRoadmap = await db.roadmap.findUnique({
          where: { id: cachedRoadmapId },
          include: { days: { include: { topics: true } } }
        });
      }

      if (!activeRoadmap) {
        // Fall back to most recent roadmap created by this user
        activeRoadmap = await db.roadmap.findFirst({
          where: { userId },
          include: { days: { include: { topics: true } } },
          orderBy: { createdAt: 'desc' }
        });

        if (activeRoadmap) {
          // Cache selection for 30 days
          await redisCache.setCache(`active_roadmap:${userId}`, activeRoadmap.id, 2592000);
        }
      }
    } catch (cacheErr) {
      console.warn('Redis active roadmap fetch warning:', cacheErr);
    }

    // Build a synthetic profile fallback from roadmap data when DB profile is missing
    // This ensures users who have roadmaps can always access their workspace
    const resolvedProfile = user.profile
      ? {
        fullName: user.profile.fullName || 'Student',
        careerGoal: user.profile.careerGoal || activeRoadmap?.title || 'Learning',
        currentSkills: user.profile.currentSkills || [],
        availableTime: user.profile.availableTime || 60,
        difficulty: user.profile.difficulty || 'Intermediate',
      }
      : activeRoadmap
        ? {
          // Synthesize a minimal profile from the roadmap so the workspace gate passes
          fullName: user.email.split('@')[0],
          careerGoal: activeRoadmap.title,
          currentSkills: [],
          availableTime: 60,
          difficulty: 'Intermediate',
        }
        : null;

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.profile?.fullName || user.email.split('@')[0],
        profile: resolvedProfile,
        activeRoadmap
      }
    });
  } catch (error) {
    console.error('Fetch Current User Error:', error);
    res.status(500).json({ error: 'Internal Server Error.' });
  }
});

// Set user's active roadmap selection in Redis cache
app.post('/api/user/active-roadmap', authenticate, async (req: express.Request, res: express.Response): Promise<any> => {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    const { roadmapId } = req.body;

    if (!roadmapId) {
      return res.status(400).json({ error: 'Missing roadmapId parameter.' });
    }

    // Verify roadmap ownership
    const roadmap = await db.roadmap.findUnique({
      where: { id: roadmapId }
    });

    if (!roadmap || roadmap.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden. Roadmap does not exist or access denied.' });
    }

    // Cache the active roadmap selection in Redis (30 days TTL)
    await redisCache.setCache(`active_roadmap:${userId}`, roadmapId, 2592000);

    return res.json({ success: true, message: 'Active study roadmap updated in cache.' });
  } catch (error) {
    console.error('Set active roadmap error:', error);
    return res.status(500).json({ error: 'Failed to update active roadmap selection.' });
  }
});

// H6: PATCH /api/profile — Persist user profile data to DB (called from onboarding on submit)
app.patch('/api/profile', authenticate, async (req: express.Request, res: express.Response): Promise<any> => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;
    const { fullName, careerGoal, currentSkills, availableTime, difficulty } = req.body;

    const updatedProfile = await db.userProfile.upsert({
      where: { userId },
      update: {
        ...(fullName !== undefined && { fullName }),
        ...(careerGoal !== undefined && { careerGoal }),
        ...(currentSkills !== undefined && { currentSkills }),
        ...(availableTime !== undefined && { availableTime: parseInt(availableTime, 10) }),
        ...(difficulty !== undefined && { difficulty }),
      },
      create: {
        userId,
        fullName: fullName || '',
        careerGoal: careerGoal || '',
        currentSkills: currentSkills || [],
        availableTime: parseInt(availableTime, 10) || 45,
        difficulty: difficulty || 'Intermediate',
      },
    });

    // Invalidate dashboard cache so next fetch reflects updated profile
    await redisCache.deleteCache(`dashboard:${userId}`);

    return res.json({ success: true, profile: updatedProfile });
  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(500).json({ error: 'Failed to update user profile.' });
  }
});



// Change Password Route
app.post('/api/auth/change-password', authenticate, async (req: express.Request, res: express.Response): Promise<any> => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = (req as AuthenticatedRequest).user?.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Missing current or new password.' });
    }

    const user = await db.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const isMatch = verifyPassword(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect current password.' });
    }

    const hashedNewPassword = hashPassword(newPassword);
    await db.user.update({
      where: { id: userId },
      data: { passwordHash: hashedNewPassword }
    });

    res.json({
      success: true,
      message: 'Password updated successfully.'
    });
  } catch (error) {
    console.error('Change Password Error:', error);
    res.status(500).json({ error: 'Internal Server Error updating password.' });
  }
});

// 1.5. GET /api/topic - Get topic history for a day
app.get('/api/topic', authenticate, async (req: express.Request, res: express.Response): Promise<any> => {
  try {
    const { dayId } = req.query;
    if (!dayId) {
      return res.status(400).json({ error: 'Missing required query parameter: dayId' });
    }

    const topics = await db.topic.findMany({
      where: {
        dayId: dayId as string,
      },
      include: {
        citations: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.json({ success: true, topics });
  } catch (error) {
    console.error('Fetch topics error:', error);
    return res.status(500).json({ error: 'Failed to fetch topic version history' });
  }
});

// 1.8. GET /api/dashboard/summary - Get roadmaps and topics history for dashboard overview
app.get('/api/dashboard/summary', authenticate, async (req: express.Request, res: express.Response): Promise<any> => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;

    // M5: Try Redis cache first (5 min TTL) — invalidated on new roadmap/topic creation
    const cacheKey = `dashboard:${userId}`;
    const cached = await redisCache.getCache(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // H4: Single query — topics are nested inside days, no second db.topic.findMany needed
    const roadmaps = await db.roadmap.findMany({
      where: { userId },
      include: {
        days: {
          include: {
            topics: {
              select: { id: true, title: true, mode: true, createdAt: true },
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { dayNumber: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // H4: Extract flat topic history from nested roadmap data instead of second query
    const topics = roadmaps.flatMap((r) =>
      r.days.flatMap((d) =>
        d.topics.map((t) => ({
          id: t.id,
          title: t.title,
          mode: t.mode,
          createdAt: t.createdAt,
          day: {
            id: d.id,
            dayNumber: d.dayNumber,
            roadmap: { id: r.id, title: r.title },
          },
        }))
      )
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const payload = { success: true, roadmaps, topics };

    // M5: Cache for 5 minutes
    await redisCache.setCache(cacheKey, JSON.stringify(payload), 300);

    return res.json(payload);
  } catch (error) {
    console.error('Fetch dashboard summary error:', error);
    return res.status(500).json({ error: 'Failed to compile user activity logs summary' });
  }
});

// 2. Generate Content (6 Modes + RAG)
app.post('/api/generate', authenticate, async (req: express.Request, res: express.Response): Promise<any> => {
  try {
    const { topic, mode, difficulty, url, dayId } = req.body;

    if (!topic || !mode || !difficulty) {
      return res.status(400).json({ error: 'Missing required parameters: topic, mode, difficulty' });
    }

    const modeNumber = parseInt(mode, 10);

    // M2: Cache key must include mode — Socratic vs. Accelerator notes are different content
    const cacheKey = `notes:${topic.toLowerCase().trim()}:${difficulty.toLowerCase().trim()}:${modeNumber}`;
    const cachedNotes = await redisCache.getCache(cacheKey);

    if (cachedNotes) {
      console.log(`Cache HIT for key: ${cacheKey}`);
      try {
        const parsedContent = JSON.parse(cachedNotes);

        // C5: Only write to DB if no topic record exists for this dayId yet (prevents duplicate writes)
        if (dayId) {
          try {
            const existingTopic = await db.topic.findFirst({ where: { dayId, mode: modeNumber } });
            if (!existingTopic) {
              await db.topic.create({
                data: {
                  dayId,
                  title: topic,
                  mode: modeNumber,
                  notesHtml: cachedNotes,
                  citations: {
                    create: (parsedContent.sources || []).map((s: any) => ({
                      label: s.label || 'Web Reference',
                      rawText: `Citation source: ${s.label}`,
                      sourceUrl: s.url,
                    })),
                  },
                },
              });
            }
          } catch (dbErr) {
            console.error('Failed to persist cached topic notes to DB:', dbErr);
          }
        }

        return res.json(parsedContent);
      } catch (parseErr) {
        console.warn('Failed to parse cached JSON notes, generating fresh notes...');
      }
    }

    // Perform RAG scrape
    const contextList = await getReferenceContext(topic, url);

    // Format RAG contexts into clean numbered blocks
    const contextStringForPrompt = contextList.length > 0
      ? contextList.map((ctx, idx) => `[Source ${idx + 1}]: Title: ${ctx.title}\nURL: ${ctx.sourceUrl}\nContent excerpt: ${ctx.content}\n---`).join('\n')
      : "No external context available. Rely on standard verified knowledge.";

    const systemPrompt = `You are an elite academic professor and subject-matter expert. Your task is to generate comprehensive, highly detailed, and textbook-quality study notes to help a student master the requested topic.
Do NOT write short, generic summaries. Every concept must be explained in depth with academic precision, using clear explanations and precise definitions.
Include code examples with language identifiers (like javascript, typescript, python, css, html, sql, etc.) if applicable to the topic. Otherwise leave them empty.

You must return your output strictly in JSON format matching the schema below.
Schema:
{
  "title": "string (the main topic title)",
  "difficulty": "string (difficulty level)",
  "introduction": "string (a thorough, detailed introduction to the topic, setting up context and core motivations)",
  "outline": ["string (key concept 1)", "string (key concept 2)", "string (key concept 3)"],
  "visualDiagram": "string (a valid Mermaid.js flowchart code, using TD/top-down or LR/left-to-right syntax, mapping out the relationships or logical flow of the concepts. DO NOT include double quotes or backticks inside the labels or nodes to avoid syntax errors; use simple labels. Empty string if not applicable)",
  "contentBlocks": [
    {
      "heading": "string (sub-topic or concept heading)",
      "content": "string (highly detailed, exhaustive, multi-paragraph content explaining the sub-topic thoroughly)",
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

    // Generate output (First Pass) — H2: cap maxTokens to prevent Groq JSON validation failures
    const firstPassResponse = await aiService.generate(userPrompt, {
      systemPrompt: systemPrompt,
      jsonMode: true,
      temperature: 0.5,
      maxTokens: 4096,
    });

    // Double-Pass Review (Second Pass)
    const contextString = contextList.length > 0
      ? contextList.map((ctx, idx) => `[Source ${idx + 1}]: Title: ${ctx.title}\nContent: ${ctx.content}`).join('\n')
      : "No external context.";

    const reviewSystemPrompt = `You are a strict educational content reviewer.
Your task is to audit the lesson JSON content below for:
1. Inaccuracies compared to reference source contexts.
2. Unexplained technical jargon or shallow explanations (ensure notes are highly detailed and thorough).
3. Correct placement of citation numbers (e.g. [1], [2]).
4. Valid Mermaid.js syntax in "visualDiagram" (ensure there are no double quotes, brackets, or backticks inside node labels, and the syntax is correct, e.g. "graph TD" or "graph LR"). Node connection links must not contain arrows inside label blocks (e.g. DO NOT use "-->|label|>", use "-->|label|").
If any issues are found, rewrite and correct them. Ensure the output is strictly valid JSON matching the exact original structure.
Do not wrap your output in markdown formatting or add extra text. Provide only the clean JSON.`;

    const reviewPrompt = `Reference Contexts:
${contextString}

Original Generated Lesson JSON:
${firstPassResponse}`;

    const responseText = await aiService.generate(reviewPrompt, {
      systemPrompt: reviewSystemPrompt,
      jsonMode: true,
      temperature: 0.3,
      maxTokens: 4096,
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

    // Cache the verified responseText in Redis (24 hours TTL)
    await redisCache.setCache(cacheKey, responseText, 86400);

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
app.post('/api/roadmap', authenticate, async (req: express.Request, res: express.Response): Promise<any> => {
  try {
    const { goal, deadline, availableTime, difficulty, userId } = req.body;

    if (!goal || !deadline || !availableTime || !difficulty) {
      return res.status(400).json({ error: 'Missing parameters: goal, deadline, availableTime, difficulty' });
    }

    // Call Mode 4 (Roadmap Generator)
    const config = getPedagogicalModeConfig(4, goal, difficulty, []);

    // M4: Add maxTokens to roadmap call to prevent Groq JSON truncation errors
    const responseText = await aiService.generate(config.userPrompt, {
      systemPrompt: config.systemPrompt,
      jsonMode: true,
      temperature: 0.5,
      maxTokens: 2048,
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

    // C4: The authenticate middleware guarantees req.user.id — no ghost user creation needed
    const activeUserId = (req as AuthenticatedRequest).user!.id;

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

    // Auto-set this new roadmap as active in Redis + invalidate dashboard cache
    await redisCache.setCache(`active_roadmap:${activeUserId}`, createdRoadmap.id, 2592000);
    await redisCache.deleteCache(`dashboard:${activeUserId}`);

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

app.get('/api/doubt', authenticate, async (req: express.Request, res: express.Response): Promise<any> => {
  try {
    const topicId = req.query.topicId as string;
    if (!topicId) {
      return res.status(400).json({ error: 'Missing topicId query parameter' });
    }

    const threads = await Thread.find({ topicId }).sort({ createdAt: -1 });

    // H3: Collect all unique user IDs upfront to avoid N+1 badge queries
    const uniqueUserIds = [...new Set([
      ...threads.map((t) => t.author.userId),
      ...threads.flatMap((t) => t.comments.map((c: any) => c.author.userId)),
    ])];

    // Fetch badge data for all unique users in parallel (2 queries per user instead of 2 per thread/comment)
    const badgeMap = new Map<string, { rank: string; badges: string[] }>();
    await Promise.all(uniqueUserIds.map(async (uid) => {
      badgeMap.set(uid, await calculateUserRankAndBadges(uid));
    }));

    const enrichedThreads = threads.map((t) => {
      const authorMeta = badgeMap.get(t.author.userId) || { rank: 'Learner', badges: [] };
      const enrichedComments = t.comments.map((c: any) => {
        const commentMeta = badgeMap.get(c.author.userId) || { rank: 'Learner', badges: [] };
        return {
          commentId: c.commentId,
          content: c.content,
          upvotes: c.upvotes,
          replies: c.replies,
          createdAt: c.createdAt,
          author: { userId: c.author.userId, name: c.author.name, rank: commentMeta.rank, badges: commentMeta.badges },
        };
      });
      return {
        _id: t._id,
        topicId: t.topicId,
        title: t.title,
        content: t.content,
        upvotes: t.upvotes,
        resolved: t.resolved,
        bestAnswerId: t.bestAnswerId,
        createdAt: t.createdAt,
        author: { userId: t.author.userId, name: t.author.name, avatar: t.author.avatar, rank: authorMeta.rank, badges: authorMeta.badges },
        comments: enrichedComments,
      };
    });

    res.json({ success: true, threads: enrichedThreads });
  } catch (error) {
    console.error('Doubt GET error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal Server Error' });
  }
});

app.post('/api/doubt', authenticate, async (req: express.Request, res: express.Response): Promise<any> => {
  try {
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
app.get('/api/market-demand', authenticate, async (req: express.Request, res: express.Response): Promise<any> => {
  try {
    const trends = await MarketDemand.find().sort({ demandScore: -1 });
    return res.json({ success: true, trends });
  } catch (error) {
    console.error('Market demand fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch market demand indicators' });
  }
});

// 6. SSO Handoff — mints a short-lived signed token so a user already logged
// into EdLearn isn't asked to log in again on EdMentor / EdCompass / EdQuiz.
// The receiving app must independently verify this token and establish its
// own session; that half of the work does not live in this repo.
app.post('/api/sso/handoff', authenticate, async (req: express.Request, res: express.Response): Promise<any> => {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    const { app: targetApp, topic } = req.body;

    const validApps: SsoApp[] = ['edmentor', 'edcompass', 'edquiz'];
    if (!targetApp || !validApps.includes(targetApp)) {
      return res.status(400).json({ error: `Invalid or missing "app". Must be one of: ${validApps.join(', ')}` });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const name = user.profile?.fullName || user.email.split('@')[0];
    const safeTopic = typeof topic === 'string' && topic.trim() ? topic.trim().slice(0, 200) : undefined;

    const token = generateHandoffToken({
      email: user.email,
      name,
      app: targetApp as SsoApp,
      topic: safeTopic,
    });

    const url = buildHandoffUrl(targetApp as SsoApp, token, safeTopic);

    res.json({ success: true, url });
  } catch (error) {
    console.error('SSO Handoff Error:', error);
    res.status(500).json({ error: 'Internal Server Error generating handoff token.' });
  }
});

// 7. Personalized Facts Feed — short "did you know" facts tied to whatever
// the user is currently learning, for the scrolling mini-facts widget on the
// dashboard. Reuses the same aiService + JSON-schema prompting pattern as
// /api/generate, and Redis-caches a batch the same way /api/generate caches
// notes, so repeat dashboard visits don't regenerate a batch every time.
// Pass ?fresh=true to force a brand-new batch (used by "Load more").
app.get('/api/facts', authenticate, async (req: express.Request, res: express.Response): Promise<any> => {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    const forceFresh = req.query.fresh === 'true';
    const cacheKey = `facts:${userId}`;

    if (!forceFresh) {
      const cached = await redisCache.getCache(cacheKey);
      if (cached) {
        try {
          return res.json({ success: true, facts: JSON.parse(cached) });
        } catch {
          // Fall through and regenerate a fresh batch if the cached value is corrupt.
        }
      }
    }

    const user = await db.user.findUnique({ where: { id: userId }, include: { profile: true } });

    const activeRoadmap = await db.roadmap.findFirst({
      where: { userId },
      include: { days: { include: { topics: true } } },
      orderBy: { createdAt: 'desc' }
    });

    const topicTitles = activeRoadmap
      ? Array.from(new Set(
        activeRoadmap.days.flatMap((d) => [d.title, ...d.topics.map((t) => t.title)])
      )).slice(0, 6)
      : [];

    const subjectLine = topicTitles.length > 0
      ? topicTitles.join(', ')
      : (user?.profile?.careerGoal || 'general computer science and technology');

    const systemPrompt = `You generate short, genuinely interesting "did you know" facts for a micro-learning feed.
Facts must be factually accurate, specific (not vague truisms), and directly tied to one of the given subjects.
You must return your output strictly in JSON format matching the schema below.
Schema:
{
  "facts": [
    {
      "fact": "string (one short punchy sentence, no more)",
      "relatedTopic": "string (which subject this fact relates to)",
      "detail": "string (2-4 sentences expanding on the fact with brief 'why'/'how' context — this is only shown after the user clicks to expand the fact, so it should add real explanation, not repeat the fact verbatim)"
    }
  ]
}
Return exactly 8 facts. Do not wrap output in markdown code blocks. Return only valid JSON.`;

    const userPrompt = `Generate 8 short, interesting facts related to these subjects: ${subjectLine}.`;

    const responseText = await aiService.generate(userPrompt, {
      systemPrompt,
      jsonMode: true,
      temperature: 0.8,
      maxTokens: 1024,
    });

    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    }

    const facts = Array.isArray(parsed?.facts) ? parsed.facts : [];

    // 6 hours — long enough to avoid regenerating on every dashboard visit,
    // short enough that facts stay reasonably fresh as the user's roadmap changes.
    await redisCache.setCache(cacheKey, JSON.stringify(facts), 21600);

    res.json({ success: true, facts });
  } catch (error) {
    console.error('Facts Feed Error:', error);
    res.status(500).json({ error: 'Internal Server Error generating facts feed.' });
  }
});

// 8. Server-side Text-to-Speech — generates and saves one real MP3 file per
// topic via google-tts-api. This is additive: the existing browser-voice
// playback in AudioPlayerDock.tsx (with its sentence-highlight sync) still
// works exactly as before and is untouched — this fills in the Topic.audioUrl
// field, which already existed in the schema but nothing wrote to it yet.
app.post('/api/tts/generate', authenticate, async (req: express.Request, res: express.Response): Promise<any> => {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    const { topicId } = req.body;

    if (!topicId) {
      return res.status(400).json({ error: 'Missing required parameter: topicId' });
    }

    // Ownership check: a topic belongs to a day, which belongs to a roadmap,
    // which belongs to a user. Never generate or serve audio for someone
    // else's topic just because they know its ID.
    const topic = await db.topic.findUnique({
      where: { id: topicId },
      include: { day: { include: { roadmap: true } } },
    });

    if (!topic || topic.day.roadmap.userId !== userId) {
      return res.status(404).json({ error: 'Topic not found.' });
    }

    if (topic.audioUrl) {
      return res.json({ success: true, audioUrl: topic.audioUrl, cached: true });
    }

    let parsedContent: any;
    try {
      parsedContent = JSON.parse(topic.notesHtml);
    } catch {
      return res.status(500).json({ error: "Could not parse this topic's notes content." });
    }

    const textToSpeak = [
      parsedContent.title,
      parsedContent.introduction,
      ...(parsedContent.contentBlocks || []).flatMap((b: any) => [b.heading, b.content]),
      parsedContent.summary,
    ].filter(Boolean).join('. ');

    const audioUrl = await generateSpeechFile(textToSpeak, topic.id);

    await db.topic.update({ where: { id: topic.id }, data: { audioUrl } });

    res.json({ success: true, audioUrl, cached: false });
  } catch (error) {
    console.error('TTS Generate Error:', error);
    res.status(500).json({ error: 'Internal Server Error generating audio.' });
  }
});

app.post('/api/tts/podcast', authenticate, async (req: express.Request, res: express.Response): Promise<any> => {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    const { topicId, script } = req.body;

    if (!topicId || !Array.isArray(script)) {
      return res.status(400).json({ error: 'Missing required parameters: topicId or script array' });
    }

    const topic = await db.topic.findUnique({
      where: { id: topicId },
      include: { day: { include: { roadmap: true } } },
    });

    if (!topic || topic.day.roadmap.userId !== userId) {
      return res.status(404).json({ error: 'Topic not found.' });
    }

    if (topic.audioUrl && topic.audioUrl.includes('_podcast')) {
      return res.json({ success: true, audioUrl: topic.audioUrl, cached: true });
    }

    const audioUrl = await generatePodcastAudio(script, topic.id);

    await db.topic.update({ where: { id: topic.id }, data: { audioUrl } });

    res.json({ success: true, audioUrl, cached: false });
  } catch (error) {
    console.error('TTS Podcast Error:', error);
    res.status(500).json({ error: 'Internal Server Error generating podcast audio.' });
  }
});

// 9. Assistant Intent Classification — the AI Tutor chat box in
// InteractiveAssistant.tsx sends every message here first. If the message is
// really about mentorship, career guidance, or taking a quiz (not core
// learning content), the frontend skips /api/generate entirely and instead
// calls Person 1's /api/sso/handoff to send the user to EdMentor / EdCompass /
// EdQuiz, already logged in. Reuses the same aiService.generate() pattern as
// /api/facts: one short, constrained prompt, strict output, safe fallback.
const VALID_INTENT_LABELS = ['learn', 'mentor', 'career', 'quiz'] as const;
type IntentLabel = typeof VALID_INTENT_LABELS[number];

app.post('/api/assistant/classify', authenticate, async (req: express.Request, res: express.Response): Promise<any> => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Missing required parameter: message' });
    }

    const systemPrompt = `You classify a student's chat message into exactly ONE of these four labels:
- "learn": a question about the subject matter itself (concepts, code, how something works)
- "mentor": the student wants human mentorship, guidance from a mentor, or 1:1 help finding a mentor
- "career": the student is asking about career paths, job readiness, resumes, or career counseling
- "quiz": the student wants to be quizzed, tested, or asked practice questions on the topic

Respond with ONLY the single label word — no punctuation, no explanation, no JSON. Just one of: learn, mentor, career, quiz`;

    const responseText = await aiService.generate(message, {
      systemPrompt,
      jsonMode: false,
      temperature: 0.1,
      maxTokens: 10,
    });

    const cleaned = responseText.trim().toLowerCase().replace(/[^a-z]/g, '');
    const label: IntentLabel = (VALID_INTENT_LABELS as readonly string[]).includes(cleaned)
      ? (cleaned as IntentLabel)
      : 'learn'; // Safe fallback: an ambiguous/unexpected model response never blocks the core tutor chat.

    res.json({ success: true, label });
  } catch (error) {
    console.error('Assistant Classify Error:', error);
    // On any failure, fall back to "learn" rather than surfacing an error —
    // the chat box should always keep working even if classification breaks.
    res.json({ success: true, label: 'learn' });
  }
});

// --- Fallback handlers (must be registered after every route above) ---

// Any /api/* path that didn't match a route above (typo, wrong method, a
// route that only exists on the frontend's Next.js side, etc.) gets a JSON
// 404 instead of Express's default HTML "Cannot POST /api/..." page — so
// the frontend's `err.response?.data?.error` handling always has something
// useful to show instead of falling back to a generic message.
app.use('/api', (req: express.Request, res: express.Response) => {
  res.status(404).json({ error: `No API route matches ${req.method} ${req.originalUrl}` });
});

// Catch-all error handler. Anything thrown synchronously in a route, passed
// to next(err), or produced by the CORS origin callback above lands here —
// guaranteeing a JSON body instead of Express's default HTML error page
// (which is what makes axios's `err.response?.data?.error` come back
// undefined and fall through to a generic "failed to authenticate" string).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err?.message === 'Not allowed by CORS') {
    console.warn(`[CORS] Rejected request from origin: ${req.headers.origin}`);
    return res.status(403).json({ error: 'This origin is not permitted to access the API.' });
  }
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal Server Error.' });
});

async function connectMongoWithRetry(retries = 3, delayMs = 3000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await connectMongo();
      console.log('MongoDB connected at startup');
      return;
    } catch (err: any) {
      if (attempt < retries) {
        console.warn(`MongoDB connection attempt ${attempt}/${retries} failed, retrying in ${delayMs}ms:`, err?.message);
        await new Promise((res) => setTimeout(res, delayMs));
      } else {
        // Non-fatal: server starts without MongoDB; Mongoose routes return 503
        console.error('MongoDB unavailable after all retries — server starting without it. Doubt Forum routes will fail until MongoDB is reachable.', err?.message);
      }
    }
  }
}

async function startServer() {
  // Retry MongoDB connection up to 3 times before giving up (non-fatal)
  await connectMongoWithRetry();

  app.listen(PORT, () => {
    console.log(`Backend server successfully listening on port ${PORT}`);
    // Fire-and-forget: BullMQ worker is optional; Redis unavailability must not crash startup
    startMarketWorker().catch((err) => {
      console.warn('[BullMQ] Worker startup error (non-fatal):', err?.message || err);
    });
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});


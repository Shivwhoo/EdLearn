import './loadEnv';

import path from 'path';
import express from 'express';
import cors from 'cors';
import { aiService } from './lib/ai/aiService';
import { getReferenceContext } from './lib/scraper';
import { getPedagogicalModeConfig } from './lib/ai/pedagogicalEngine';
import db from './lib/db';
import { connectMongo } from './lib/mongodb';
import MarketDemand from './lib/models/MarketDemand';
import { startMarketWorker } from './lib/queues/marketQueue';
import { hashPassword, verifyPassword, generateToken } from './lib/auth';
import { authenticate, AuthenticatedRequest } from './middleware/auth';
import { validate } from './middleware/validate';
import { redisCache } from './lib/redis';
import { generateHandoffToken, buildHandoffUrl, SsoApp } from './lib/sso';
import { generateSpeechFile, generatePodcastAudio } from './lib/tts';
import passport from './auth/google';
import { logger, httpLogger } from './lib/logger';
import { initSentry, sentryErrorHandler, captureException } from './lib/sentry';
import { metricsMiddleware, metricsHandler, ttsGenerationDurationSeconds } from './lib/metrics';

// M2: Sentry must be initialized before routes/middleware are registered so
// it can instrument them. No-ops entirely if SENTRY_DSN is unset.
initSentry();

import newsRouter from './routes/news';
import mediaRouter from './routes/media';
import booksRouter from './routes/books';
import visionBoardRouter from './routes/visionBoard';
import visionMilestonesRouter from './routes/visionMilestones';
import authRouter from './routes/auth.router';
import gdprRouter from './routes/gdpr.router';
import { GenerateSchema } from './schemas/generate.schemas';
import { RoadmapCreateSchema } from './schemas/roadmap.schemas';
import { startContentCrons } from './services/contentCrons';
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
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(passport.initialize());

// M2: Structured request logging (method, path, status, duration, request id)
app.use(httpLogger);

// M2: Prometheus request-count/latency instrumentation for every route below.
app.use(metricsMiddleware);

// M3: Limit request body to 1mb to prevent DoS via oversized payloads
app.use(express.json({ limit: '1mb' }));

// M2: Prometheus scrape endpoint. Deliberately unauthenticated (that's how
// Prometheus expects to reach it) but exposes only aggregate request/latency
// counters — no request bodies, headers, or user data.
app.get('/metrics', metricsHandler);

// Serve generated TTS audio files. Mounted under /api so the existing
// frontend rewrite ("/api/:path*" -> backend) already proxies it — see
// frontend/next.config.ts.
app.use('/api/tts/audio', express.static(path.join(__dirname, '../tts-audio')));

// Google OAuth Routes
app.get('/api/auth/google', (req, res, next) => {
  // Must match the exact condition in auth/google.ts that gates strategy
  // registration (clientID && clientSecret && callbackURL). This route used
  // to only check CLIENT_ID/CLIENT_SECRET, so a missing GOOGLE_CALLBACK_URL
  // would leave the 'google' strategy unregistered and passport.authenticate
  // would throw synchronously ("Unknown authentication strategy \"google\""),
  // crashing to Express's generic Internal Server Error instead of a clean
  // diagnostic response.
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_CALLBACK_URL) {
    console.error(
      '❌ Google OAuth is not configured — missing env var(s):',
      !process.env.GOOGLE_CLIENT_ID ? 'GOOGLE_CLIENT_ID' : '',
      !process.env.GOOGLE_CLIENT_SECRET ? 'GOOGLE_CLIENT_SECRET' : '',
      !process.env.GOOGLE_CALLBACK_URL ? 'GOOGLE_CALLBACK_URL' : ''
    );
    return res.status(500).json({ error: 'Google OAuth is not configured' });
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

app.get('/api/auth/google/callback', (req, res, next) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  passport.authenticate('google', { session: false }, (err: any, user: any, info: any) => {
    if (err) {
      // Strategy-level errors: DB/Prisma failures during user lookup/create,
      // or an InternalOAuthError from passport-oauth2 when Google's token
      // endpoint itself rejects the exchange (invalid_client, redirect_uri
      // mismatch, etc.). Break these apart instead of a bare err.message so
      // the real cause is visible instead of collapsing into one bucket.
      // Never logs secrets, codes, or tokens — only error classification.
      const diag: Record<string, unknown> = { name: err.name, message: err.message };
      if (err.code) diag.prismaErrorCode = err.code; // e.g. P1001, P2002, P2025
      if (err.oauthError) {
        const oe: any = err.oauthError;
        diag.googleHttpStatus = oe.statusCode;
        const raw = typeof oe.data === 'string' ? oe.data : undefined;
        if (raw) {
          try {
            const body = JSON.parse(raw);
            diag.googleError = body.error; // e.g. "invalid_client", "redirect_uri_mismatch"
            diag.googleErrorDescription = body.error_description;
          } catch {
            // Non-JSON body from Google — skip rather than log raw content.
          }
        }
      }
      console.error('❌ Google OAuth strategy error:', diag);
      return res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
    }
    if (!user) {
      // Authentication failed without a hard error — e.g. user denied
      // consent (access_denied) or Passport rejected the callback params.
      console.error('❌ Google OAuth failed — no user returned. info:', {
        message: info?.message,
        name: info?.name,
      });
      return res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
    }

    try {
      const { token } = user;
      console.log('✅ Token generated:', token ? 'Yes' : 'No');

      const redirectUrl = `${frontendUrl}/auth/callback?token=${token}`;
      console.log('🔀 Redirecting to:', redirectUrl);

      res.redirect(redirectUrl);
    } catch (callbackError) {
      console.error('❌ Callback error:', callbackError);
      res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
    }
  })(req, res, next);
});

// 1. Health Probe
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', provider: aiService.getActiveProviderName() });
});

// --- Public dynamic-content endpoints (landing page + deep-dive pages) ---
app.use('/api/news', newsRouter);
app.use('/api/media', mediaRouter);
app.use('/api/books', booksRouter);

// --- Private per-student endpoints ---
// `authenticate` is applied at the mount point, so every route inside the
// Vision Board router is guaranteed a verified req.user and can scope its
// queries to that id. Unauthenticated requests never reach the handlers.
app.use('/api/vision-board', authenticate, visionBoardRouter);
app.use('/api/vision-milestones', authenticate, visionMilestonesRouter);

// --- Auth router (signup, login, refresh, 2FA, forgot/reset-password) ---
// This router supersedes the inline /api/auth/* handlers below for new features.
// The inline handlers remain for backward-compat with existing 7-day tokens.
app.use('/api/auth', authRouter);

// --- GDPR endpoints (data export, account deletion) ---
app.use('/api/gdpr', gdprRouter);

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

    // Completed-day IDs + earned badges, so the client restores real progress
    // from the database (not just localStorage) on every session load.
    const [completedProgress, userBadges] = await Promise.all([
      db.progress.findMany({ where: { userId }, distinct: ['dayId'], select: { dayId: true } }),
      db.badge.findMany({ where: { userId }, orderBy: { earnedAt: 'desc' } }),
    ]);

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.profile?.fullName || user.email.split('@')[0],
        profile: resolvedProfile,
        activeRoadmap,
        completedDayIds: completedProgress.map((p) => p.dayId),
        badges: userBadges,
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

    // Real completion state (Progress table) + earned badges for the dashboard.
    const [completedProgress, userBadges] = await Promise.all([
      db.progress.findMany({ where: { userId }, distinct: ['dayId'], select: { dayId: true } }),
      db.badge.findMany({ where: { userId }, orderBy: { earnedAt: 'desc' } }),
    ]);

    const payload = {
      success: true,
      roadmaps,
      topics,
      completedDayIds: completedProgress.map((p) => p.dayId),
      badges: userBadges,
    };

    // M5: Cache for 5 minutes
    await redisCache.setCache(cacheKey, JSON.stringify(payload), 300);

    return res.json(payload);
  } catch (error) {
    console.error('Fetch dashboard summary error:', error);
    return res.status(500).json({ error: 'Failed to compile user activity logs summary' });
  }
});

// 2. Generate Content (6 Modes + RAG)
app.post('/api/generate', authenticate, validate(GenerateSchema), async (req: express.Request, res: express.Response): Promise<any> => {
  try {
    const { topic, mode, difficulty, url, dayId, forceRefresh } = req.body;

    console.log("========== GENERATE ==========");
    console.log("Request Body:", req.body);
    console.log("mode =", mode);
    console.log("typeof mode =", typeof mode);
    console.log("==============================");

    if (
      !topic ||
      mode === undefined ||
      mode === null ||
      !difficulty
    ) {
      return res.status(400).json({
        error: 'Missing required parameters: topic, mode, difficulty',
      });
    }

    let modeNumber: number;

    if (typeof mode === "number") {
      modeNumber = mode;
    } else {
      const modeMap: Record<string, number> = {
        learn: 1,
        socratic: 2,
        accelerator: 3,
        interview: 4,
        revision: 5,
        quiz: 6,
      };

      modeNumber = modeMap[String(mode).toLowerCase()] ?? 1;
    }

    console.log("Resolved mode =", modeNumber);

    // ----------------------------------------------------------------------
    // Mode 7 — Duo Podcast (conversational two-host script).
    //
    // The study-notes pipeline below assumes a notes JSON schema and runs a
    // double-pass review that would mangle a podcast script, so mode 7 gets
    // its own short pipeline: RAG → podcast prompt (pedagogicalEngine case 7)
    // → parse → normalise the { speaker, line } script → persist → return.
    // Without this branch the generic notes prompt runs and no `script` is
    // ever produced, which is why the Duo Podcast never appeared.
    // ----------------------------------------------------------------------
    if (modeNumber === 7) {
      const podcastCacheKey = `podcast:${String(topic).toLowerCase().trim()}:${String(difficulty).toLowerCase().trim()}`;

      let podcastData: any = null;
      const cachedPodcast = forceRefresh ? null : await redisCache.getCache(podcastCacheKey);
      if (cachedPodcast) {
        try { podcastData = JSON.parse(cachedPodcast); } catch { podcastData = null; }
      }

      if (!podcastData) {
        const podcastContext = await getReferenceContext(topic, url);
        const cfg = getPedagogicalModeConfig(7, topic, difficulty, podcastContext);

        const rawScriptResponse = await aiService.generate(cfg.userPrompt, {
          systemPrompt: cfg.systemPrompt,
          jsonMode: true,
          temperature: 0.6,
          maxTokens: 4096,
        });

        try {
          podcastData = JSON.parse(rawScriptResponse);
        } catch {
          const cleaned = rawScriptResponse.replace(/```json/g, '').replace(/```/g, '').trim();
          podcastData = JSON.parse(cleaned); // a hard failure bubbles to the outer catch → 500
        }
      }

      // Normalise the script: force speaker to exactly "Host" | "Expert" and
      // drop any empty lines so the TTS + transcript stay well-formed.
      const rawScript = Array.isArray(podcastData?.script) ? podcastData.script : [];
      const script = rawScript
        .map((t: any) => ({
          speaker: String(t?.speaker || '').toLowerCase() === 'expert' ? 'Expert' : 'Host',
          line: String(t?.line || '').trim(),
        }))
        .filter((t: any) => t.line.length > 0);

      if (script.length === 0) {
        return res.status(502).json({ error: 'The AI did not return a valid podcast script. Please try again.' });
      }
      podcastData.script = script;

      // Cache the clean script (without any per-request topicId embedded).
      await redisCache.setCache(podcastCacheKey, JSON.stringify(podcastData), 86400);

      // Persist as a Topic (one podcast row per day+mode) so it shows up in
      // version history and, crucially, gives the player a real Topic id to
      // request TTS against. Re-generating updates the same row and clears the
      // stale audio URL so fresh audio is synthesised on next play.
      let dbTopic: any = null;
      if (dayId) {
        try {
          const existing = await db.topic.findFirst({
            where: { dayId, mode: 7 },
            orderBy: { createdAt: 'desc' },
          });
          if (existing) {
            dbTopic = await db.topic.update({
              where: { id: existing.id },
              data: { notesHtml: JSON.stringify(podcastData), audioUrl: null },
            });
          } else {
            dbTopic = await db.topic.create({
              data: {
                dayId,
                title: topic,
                mode: 7,
                notesHtml: JSON.stringify(podcastData),
                citations: {
                  create: (podcastData.sources || []).map((s: any) => ({
                    label: s.label || 'Web Reference',
                    rawText: `Podcast source: ${s.label}`,
                    sourceUrl: s.url,
                  })),
                },
              },
            });
          }
        } catch (dbErr) {
          console.error('Failed to persist podcast topic:', dbErr);
        }
      }

      // Surface the real Topic id to the client (embedded only in the response,
      // never in the cached script) so PodcastPlayer requests TTS correctly.
      const responseData = { ...podcastData, ...(dbTopic?.id ? { topicId: dbTopic.id } : {}) };
      return res.json({ success: true, mode: 7, data: responseData, dbTopic });
    }

    // M2: Cache key must include mode — Socratic vs. Accelerator notes are different content
    const cacheKey = `notes:${topic.toLowerCase().trim()}:${difficulty.toLowerCase().trim()}:${modeNumber}`;
    const cachedNotes = forceRefresh ? null : await redisCache.getCache(cacheKey);

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

        return res.json({
          success: true,
          mode: modeNumber,
          data: parsedContent,
          fromCache: true,
        });
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
app.post('/api/roadmap', authenticate, validate(RoadmapCreateSchema), async (req: express.Request, res: express.Response): Promise<any> => {
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

// 3.5. Day Completion + Course Badge
// Persists a single day's completion to PostgreSQL (the Progress table — which
// existed in the schema but nothing wrote to before). Completion was previously
// tracked only in the browser's localStorage, so it was lost across devices and
// logins. This route makes the database the source of truth. When the final day
// of a roadmap is completed, it awards a one-time "course completion" Badge.
//
// Idempotent by design: completing an already-completed day is a safe no-op, and
// a roadmap's badge is only ever created once (guarded by a per-roadmap badgeType).
app.post('/api/progress/complete', authenticate, async (req: express.Request, res: express.Response): Promise<any> => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;
    const { dayId } = req.body;

    if (!dayId) {
      return res.status(400).json({ error: 'Missing required parameter: dayId' });
    }

    // Ownership check: a day belongs to a roadmap, which belongs to a user.
    // Never let a user mark someone else's day complete just by knowing its ID.
    const day = await db.day.findUnique({
      where: { id: dayId },
      include: { roadmap: { include: { days: { select: { id: true } } } } },
    });

    if (!day || day.roadmap.userId !== userId) {
      return res.status(404).json({ error: 'Day not found.' });
    }

    const roadmap = day.roadmap;

    // Record completion once per (user, day) — no duplicate Progress rows.
    const existing = await db.progress.findFirst({ where: { userId, dayId } });
    if (!existing) {
      await db.progress.create({
        data: { userId, roadmapId: roadmap.id, dayId },
      });
    }

    // Mirror the flag onto this day's topic versions for convenience.
    await db.topic.updateMany({ where: { dayId }, data: { completed: true } });

    // How many distinct days of THIS roadmap has the user now completed?
    const completedForRoadmap = await db.progress.findMany({
      where: { userId, roadmapId: roadmap.id },
      distinct: ['dayId'],
      select: { dayId: true },
    });
    const completedDayIdsForRoadmap = completedForRoadmap.map((p) => p.dayId);
    const totalDays = roadmap.days.length;
    const allComplete = totalDays > 0 && completedDayIdsForRoadmap.length >= totalDays;

    // Award a one-time course-completion badge. badgeType encodes the roadmap id
    // so the same course can never mint two badges, without needing a schema change.
    const badgeType = `course_completion:${roadmap.id}`;
    let newlyEarnedBadge = null;
    if (allComplete) {
      const alreadyAwarded = await db.badge.findFirst({ where: { userId, badgeType } });
      if (!alreadyAwarded) {
        newlyEarnedBadge = await db.badge.create({
          data: {
            userId,
            title: `Course Champion: ${roadmap.title}`,
            description: `Completed all ${totalDays} days of "${roadmap.title}".`,
            badgeType,
          },
        });
      }
    }

    // Progress affects the dashboard summary — drop its cache so it recomputes.
    await redisCache.deleteCache(`dashboard:${userId}`);

    // Return the full, authoritative set of completed day IDs across ALL the
    // user's roadmaps so the client can reconcile its local state in one shot.
    const allCompleted = await db.progress.findMany({
      where: { userId },
      distinct: ['dayId'],
      select: { dayId: true },
    });

    return res.json({
      success: true,
      completedDayIds: allCompleted.map((p) => p.dayId),
      roadmapCompletedDayIds: completedDayIdsForRoadmap,
      allComplete,
      newlyEarnedBadge,
    });
  } catch (error) {
    console.error('Day completion error:', error);
    return res.status(500).json({ error: 'Failed to record day completion.' });
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

    const endTtsTimer = ttsGenerationDurationSeconds.startTimer({ route: '/api/tts/generate' });
    let audioUrl: string;
    try {
      audioUrl = await generateSpeechFile(textToSpeak, topic.id);
      endTtsTimer({ outcome: 'success' });
    } catch (ttsErr) {
      endTtsTimer({ outcome: 'error' });
      throw ttsErr;
    }

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

    // The script itself is what we synthesise, and it is provided by the
    // (authenticated) client — so audio generation must NOT depend on a valid
    // Topic id. Previously this route 404'd whenever `topicId` wasn't a real
    // Topic (e.g. a Day id was passed), which broke playback entirely.
    if (!Array.isArray(script) || script.length === 0) {
      return res.status(400).json({ error: 'Missing or empty podcast script.' });
    }

    // Synthesise (or reuse a cached, content-hashed) MP3 from the script.
    // generatePodcastAudio() is self-caching by script hash and DB-independent.
    const endTtsTimer = ttsGenerationDurationSeconds.startTimer({ route: '/api/tts/podcast' });
    let audioUrl: string;
    try {
      audioUrl = await generatePodcastAudio(script);
      endTtsTimer({ outcome: 'success' });
    } catch (ttsErr) {
      endTtsTimer({ outcome: 'error' });
      throw ttsErr;
    }

    // Best-effort only: if topicId refers to a real Topic the user owns, cache
    // the audio URL on it for history. A non-Topic id is simply ignored — the
    // audio is already generated and returned, so playback works regardless.
    if (topicId) {
      try {
        const topic = await db.topic.findUnique({
          where: { id: topicId },
          include: { day: { include: { roadmap: true } } },
        });
        if (topic && topic.day.roadmap.userId === userId) {
          await db.topic.update({ where: { id: topic.id }, data: { audioUrl } });
        }
      } catch (dbErr) {
        console.error('Podcast audioUrl persistence skipped (non-fatal):', dbErr);
      }
    }

    res.json({ success: true, audioUrl });
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

// M2: Sentry's Express error handler must be registered after all routes but
// before any other error-handling middleware, so it can capture the error
// and forward it to our own handler below. No-ops if Sentry isn't configured.
sentryErrorHandler(app);

// Catch-all error handler. Anything thrown synchronously in a route, passed
// to next(err), or produced by the CORS origin callback above lands here —
// guaranteeing a JSON body instead of Express's default HTML error page
// (which is what makes axios's `err.response?.data?.error` come back
// undefined and fall through to a generic "failed to authenticate" string).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err?.message === 'Not allowed by CORS') {
    logger.warn({ origin: req.headers.origin }, '[CORS] Rejected request');
    return res.status(403).json({ error: 'This origin is not permitted to access the API.' });
  }
  logger.error({ err, reqId: (req as any).id }, 'Unhandled server error');
  res.status(500).json({ error: 'Internal Server Error.' });
});

async function connectMongoWithRetry(retries = 3, delayMs = 3000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await connectMongo();
      logger.info('MongoDB connected at startup');
      return;
    } catch (err: any) {
      if (attempt < retries) {
        logger.warn({ attempt, retries, delayMs, err: err?.message }, 'MongoDB connection attempt failed, retrying');
        await new Promise((res) => setTimeout(res, delayMs));
      } else {
        // Non-fatal: server starts without MongoDB; Mongoose routes return 503
        logger.error({ err: err?.message }, 'MongoDB unavailable after all retries — server starting without it. Market-demand trends will be empty until MongoDB is reachable.');
        captureException(err);
      }
    }
  }
}

async function startServer() {
  // Retry MongoDB connection up to 3 times before giving up (non-fatal)
  await connectMongoWithRetry();

  app.listen(PORT, () => {
    logger.info({ port: PORT }, 'Backend server successfully listening');
    // Fire-and-forget: BullMQ worker is optional; Redis unavailability must not crash startup
    startMarketWorker().catch((err) => {
      logger.warn({ err: err?.message || err }, '[BullMQ] Worker startup error (non-fatal)');
    });
    // Fire-and-forget: content crons (news/media/books) are optional too
    startContentCrons().catch((err) => {
      logger.warn({ err: err?.message || err }, '[ContentCrons] Startup error (non-fatal)');
    });
  });
}

startServer().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  captureException(err);
  process.exit(1);
});
// (content sections: news/media/books routers + crons wired above)

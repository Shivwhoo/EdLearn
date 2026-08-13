/**
 * Content query-parameter schemas.
 *
 * All values from `req.query` arrive as strings, so we use z.coerce
 * where a numeric type is expected. Optional fields default to undefined
 * (the route handlers already have sensible fallbacks).
 */

import { z } from 'zod';

// ─── Books ────────────────────────────────────────────────────────────────────

const BOOK_GENRES = ['business', 'tech', 'science', 'self-improvement', 'history', 'health', 'all'] as const;
const BOOK_SORT_VALUES = ['popularity', 'newest', 'relevance'] as const;

export const BooksQuerySchema = z.object({
  category: z.enum(BOOK_GENRES).optional(),
  sort: z.enum(BOOK_SORT_VALUES).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  search: z.string().max(200, 'Search query is too long.').optional(),
});

export type BooksQueryInput = z.infer<typeof BooksQuerySchema>;

// ─── Media ────────────────────────────────────────────────────────────────────

const MEDIA_CATEGORIES = ['business', 'science', 'history', 'health', 'tech', 'culture', 'all'] as const;
const MEDIA_TYPES = ['video', 'audio'] as const;

export const MediaQuerySchema = z.object({
  category: z.enum(MEDIA_CATEGORIES).optional(),
  type: z.enum(MEDIA_TYPES).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  search: z.string().max(200, 'Search query is too long.').optional(),
});

export type MediaQueryInput = z.infer<typeof MediaQuerySchema>;

// ─── News ─────────────────────────────────────────────────────────────────────

const NEWS_CATEGORIES = ['tech', 'finance', 'world', 'medical', 'science', 'education', 'all'] as const;
const NEWS_TIMEFRAMES = ['week', 'month', '3months', 'year'] as const;

export const NewsQuerySchema = z.object({
  category: z.enum(NEWS_CATEGORIES).optional(),
  timeframe: z.enum(NEWS_TIMEFRAMES).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  search: z.string().max(200, 'Search query is too long.').optional(),
});

export type NewsQueryInput = z.infer<typeof NewsQuerySchema>;

// ─── Vision Board (query params for future list filtering) ───────────────────

const VISION_CATEGORIES = ['education', 'career', 'skills', 'achievements', 'growth', 'projects', 'other'] as const;
const VISION_STATUSES = ['not_started', 'in_progress', 'achieved'] as const;

export const VisionBoardQuerySchema = z.object({
  category: z.enum(VISION_CATEGORIES).optional(),
  status: z.enum(VISION_STATUSES).optional(),
});

export type VisionBoardQueryInput = z.infer<typeof VisionBoardQuerySchema>;

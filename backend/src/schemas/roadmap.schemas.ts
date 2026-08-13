import { z } from 'zod';

const DIFFICULTY_VALUES = ['Beginner', 'Intermediate', 'Advanced'] as const;

export const RoadmapCreateSchema = z.object({
  goal: z
    .string()
    .min(3, 'Learning goal must be at least 3 characters.')
    .max(300, 'Learning goal is too long.'),
  deadline: z
    .string()
    .datetime({ message: 'Deadline must be a valid ISO 8601 date string.' })
    .refine((d) => new Date(d) > new Date(), {
      message: 'Deadline must be in the future.',
    }),
  availableTime: z
    .union([z.number(), z.string()])
    .transform((v) => parseInt(String(v), 10))
    .refine((v) => !isNaN(v) && v >= 15 && v <= 480, {
      message: 'Available time must be between 15 and 480 minutes.',
    }),
  difficulty: z.enum(DIFFICULTY_VALUES, {
    error: () => ({
      message: `Difficulty must be one of: ${DIFFICULTY_VALUES.join(', ')}.`,
    }),
  }),
  // userId from body is ignored — we always use authenticated user's id
  userId: z.string().optional(),
});

export type RoadmapCreateInput = z.infer<typeof RoadmapCreateSchema>;

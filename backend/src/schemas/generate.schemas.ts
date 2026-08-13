import { z } from 'zod';

const MODE_NAMES = ['learn', 'socratic', 'accelerator', 'interview', 'revision', 'quiz', 'podcast'] as const;
const DIFFICULTY_VALUES = ['Beginner', 'Intermediate', 'Advanced'] as const;

export const GenerateSchema = z.object({
  topic: z
    .string()
    .min(2, 'Topic must be at least 2 characters.')
    .max(300, 'Topic is too long.'),
  mode: z.union([
    z.number().int().min(1).max(7),
    z.enum(MODE_NAMES),
  ], {
    error: () => ({ message: 'mode must be a number (1-7) or one of: learn, socratic, accelerator, interview, revision, quiz, podcast.' }),
  }),
  difficulty: z.enum(DIFFICULTY_VALUES, {
    error: () => ({
      message: `difficulty must be one of: ${DIFFICULTY_VALUES.join(', ')}.`,
    }),
  }),
  url: z.string().url('url must be a valid URL.').optional().or(z.literal('')),
  dayId: z.string().uuid('dayId must be a valid UUID.').optional(),
  forceRefresh: z.boolean().optional().default(false),
});

export type GenerateInput = z.infer<typeof GenerateSchema>;

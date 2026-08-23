import db from '../lib/db';

export interface SM2Result {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReview: Date;
}

/**
 * SuperMemo-2 Spaced Repetition Algorithm
 *
 * @param quality 0-5 user quality rating (0=blackout, 5=perfect)
 * @param easeFactor Current ease factor (default 2.5)
 * @param interval Current interval in days
 * @param repetitions Current number of consecutive successful repetitions
 * @returns SM2Result
 */
export function calculateSM2(
  quality: number,
  easeFactor: number = 2.5,
  interval: number = 0,
  repetitions: number = 0
): SM2Result {
  let nextRepetitions = repetitions;
  let nextInterval = interval;
  let nextEaseFactor = easeFactor;

  if (quality >= 3) {
    if (repetitions === 0) {
      nextInterval = 1;
    } else if (repetitions === 1) {
      nextInterval = 6;
    } else {
      nextInterval = Math.round(interval * easeFactor);
    }
    nextRepetitions++;
  } else {
    nextRepetitions = 0;
    nextInterval = 1;
  }

  // Calculate new ease factor: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  nextEaseFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

  if (nextEaseFactor < 1.3) {
    nextEaseFactor = 1.3;
  }

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + nextInterval);

  return {
    easeFactor: nextEaseFactor,
    interval: nextInterval,
    repetitions: nextRepetitions,
    nextReview
  };
}

/**
 * Process an SM-2 review for a flashcard and persist the result on
 * FlashcardProgress (SM-2 state no longer lives on Flashcard itself).
 *
 * Scoped to `userId` — will not read or update another user's flashcard.
 * If no FlashcardProgress row exists yet for this flashcard (e.g. it was
 * never reviewed before), one is created using the SM-2 defaults.
 *
 * @returns the updated FlashcardProgress row, or `null` if the flashcard
 *          doesn't exist or doesn't belong to `userId`.
 */
export async function reviewFlashcard(userId: string, flashcardId: string, quality: number) {
  const flashcard = await db.flashcard.findFirst({
    where: { id: flashcardId, userId },
    include: { progress: true }
  });

  if (!flashcard) {
    return null;
  }

  const current = flashcard.progress;

  const result = calculateSM2(
    quality,
    current?.easeFactor,
    current?.interval,
    current?.repetitions
  );

  const progress = await db.flashcardProgress.upsert({
    where: { flashcardId },
    create: {
      flashcardId,
      userId,
      easeFactor: result.easeFactor,
      interval: result.interval,
      repetitions: result.repetitions,
      nextReview: result.nextReview
    },
    update: {
      easeFactor: result.easeFactor,
      interval: result.interval,
      repetitions: result.repetitions,
      nextReview: result.nextReview
    }
  });

  return progress;
}

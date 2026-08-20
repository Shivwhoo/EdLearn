export interface SM2Result {
  easeFactor: number;
  interval: number;
  repetitions: number;
  dueDate: Date;
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

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + nextInterval);

  return {
    easeFactor: nextEaseFactor,
    interval: nextInterval,
    repetitions: nextRepetitions,
    dueDate
  };
}

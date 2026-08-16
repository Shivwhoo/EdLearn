import db from './db';

export async function canGenerateAIContent(userId: string, currentTopicId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { subscription: true }
  });

  if (user?.subscription?.tier === 'PRO') {
    return true; // PRO users have unlimited access
  }

  // FREE tier limits: 1 topic per day
  const startOfUTCDay = new Date();
  startOfUTCDay.setUTCHours(0, 0, 0, 0);

  // Get topics generated today
  const quizzes = await db.quiz.findMany({
    where: { userId, createdAt: { gte: startOfUTCDay } },
    select: { topicId: true }
  });

  const flashcards = await db.flashcard.groupBy({
    by: ['topicId'],
    where: { userId, createdAt: { gte: startOfUTCDay } }
  });

  const generatedTopicIds = new Set([
    ...quizzes.map(q => q.topicId),
    ...flashcards.map(f => f.topicId)
  ]);

  // If the user already generated content for this specific topic today, allow it
  // (though idempotency handles identical requests, this handles the case where they generate a quiz for Topic X, then generate flashcards for Topic X on the same day - that counts as 1 topic)
  if (generatedTopicIds.has(currentTopicId)) {
    return true;
  }

  // If they are generating for a NEW topic today, check the quota
  if (generatedTopicIds.size >= 1) {
    return false; // Limit exceeded
  }

  return true;
}

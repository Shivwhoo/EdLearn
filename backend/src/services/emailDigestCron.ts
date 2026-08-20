import db from '../lib/db';
import { sendWeeklyDigestEmail } from '../lib/email';
import { calculateUserStreaks } from './streakService';

export async function runEmailDigest(): Promise<void> {
  console.log('[EmailDigest] Starting weekly email digest job...');

  try {
    // Get all users who want to receive emails (for now, assume all users, could filter by preferences later)
    const users = await db.user.findMany({
      include: {
        profile: true,
      },
    });

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    for (const user of users) {
      // Get streaks
      const streakAnalytics = await calculateUserStreaks(user.id);

      // Get completed topics this week
      const completedTopicsCount = await db.progress.count({
        where: {
          userId: user.id,
          completedAt: {
            gte: oneWeekAgo,
          },
        },
      });

      // Get next topics from active roadmaps
      const activeRoadmaps = await db.roadmap.findMany({
        where: { userId: user.id },
        include: {
          days: {
            orderBy: { dayNumber: 'asc' },
            include: {
              topics: {
                where: { completed: false },
                orderBy: { createdAt: 'asc' },
                take: 1,
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const nextTopics: string[] = [];
      for (const roadmap of activeRoadmaps) {
        for (const day of roadmap.days) {
          if (day.topics.length > 0) {
            nextTopics.push(`[${roadmap.title}] ${day.topics[0].title}`);
            break; // Just one next topic per roadmap
          }
        }
        if (nextTopics.length >= 3) break; // Limit to 3 recommendations
      }

      await sendWeeklyDigestEmail(user.email, {
        name: user.profile?.fullName || user.email.split('@')[0],
        activeStreak: streakAnalytics.currentStreak,
        topicsCompleted: completedTopicsCount,
        nextTopics,
      });
    }

    console.log(`[EmailDigest] Successfully processed ${users.length} users.`);
  } catch (error) {
    console.error('[EmailDigest] Failed to run weekly digest job:', error);
  }
}

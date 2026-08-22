import db from '../lib/db';

class GamificationService {
  async recordActivity(userId: string, activityType: string, metadata: any = {}): Promise<{ xpEarned: number; newTotalXp: number; newStreak: number }> {
    return await db.$transaction(async (tx) => {
      // 1. Read user inside the transaction to avoid races
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error('User not found');

      // 2. Compute XP
      let xpAwarded = 0;
      if (activityType === 'QUIZ_COMPLETED') {
        const score = metadata.score || 0;
        xpAwarded = 20 + (score * 5);
      } else if (activityType === 'FLASHCARD_REVIEWED') {
        xpAwarded = 5;
      }

      // 3. Compute Streak
      let newStreak = user.streakCount;
      const now = new Date();
      const lastDate = user.lastActivityDate;
      
      if (lastDate) {
        const nowUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const lastUTC = new Date(Date.UTC(lastDate.getUTCFullYear(), lastDate.getUTCMonth(), lastDate.getUTCDate()));
        
        const diffMs = nowUTC.getTime() - lastUTC.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          // Last activity was yesterday (UTC) -> increment streak
          newStreak += 1;
        } else if (diffDays > 1) {
          // Gap of > 1 day -> reset streak
          newStreak = 1;
        }
        // If diffDays === 0 (same day), streak remains unchanged
      } else {
        // First activity ever
        newStreak = 1;
      }

      // 4. Create Activity Record
      await tx.studyActivity.create({
        data: {
          userId,
          activityType,
          xpAwarded,
          metadata
        }
      });

      // 5. Update User
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          xp: { increment: xpAwarded },
          streakCount: newStreak,
          lastActivityDate: now
        }
      });

      return {
        xpEarned: xpAwarded,
        newTotalXp: updatedUser.xp,
        newStreak: updatedUser.streakCount
      };
    });
  }
}

export default new GamificationService();

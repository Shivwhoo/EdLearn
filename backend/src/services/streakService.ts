import db from '../lib/db';

export interface StreakAnalytics {
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
  totalCompletions: number;
  weeklyCompletedDays: number;
  weeklyTarget: number;
  activityHeatmap: Array<{ date: string; count: number; level: number }>;
  lastActiveDate: string | null;
}

function formatDateKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

export async function calculateUserStreaks(userId: string): Promise<StreakAnalytics> {
  const [progressRecords, milestoneRecords, userProfile] = await Promise.all([
    db.progress.findMany({
      where: { userId },
      select: { completedAt: true },
      orderBy: { completedAt: 'asc' },
    }),
    db.visionMilestone.findMany({
      where: { userId, completed: true },
      select: { updatedAt: true },
      orderBy: { updatedAt: 'asc' },
    }),
    db.userProfile.findUnique({
      where: { userId },
      select: { availableTime: true },
    }),
  ]);

  // Aggregate completion timestamps into date keys
  const dateCounts: Record<string, number> = {};

  for (const p of progressRecords) {
    const key = formatDateKey(new Date(p.completedAt));
    dateCounts[key] = (dateCounts[key] || 0) + 1;
  }

  for (const m of milestoneRecords) {
    const key = formatDateKey(new Date(m.updatedAt));
    dateCounts[key] = (dateCounts[key] || 0) + 1;
  }

  const uniqueDateKeys = Object.keys(dateCounts).sort();
  const totalActiveDays = uniqueDateKeys.length;
  const totalCompletions = progressRecords.length + milestoneRecords.length;

  // Streak calculation
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  const today = new Date();
  const todayKey = formatDateKey(today);
  const yesterday = new Date(Date.now() - 86400 * 1000);
  const yesterdayKey = formatDateKey(yesterday);

  // Longest streak calculation
  if (uniqueDateKeys.length > 0) {
    tempStreak = 1;
    longestStreak = 1;

    for (let i = 1; i < uniqueDateKeys.length; i++) {
      const prev = new Date(uniqueDateKeys[i - 1]);
      const curr = new Date(uniqueDateKeys[i]);
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / (86400 * 1000));

      if (diffDays === 1) {
        tempStreak++;
        if (tempStreak > longestStreak) {
          longestStreak = tempStreak;
        }
      } else if (diffDays > 1) {
        tempStreak = 1;
      }
    }

    // Current streak calculation: check backwards from today / yesterday
    const dateSet = new Set(uniqueDateKeys);
    let checkDate = dateSet.has(todayKey) ? new Date(today) : dateSet.has(yesterdayKey) ? new Date(yesterday) : null;

    if (checkDate) {
      while (dateSet.has(formatDateKey(checkDate))) {
        currentStreak++;
        checkDate = new Date(checkDate.getTime() - 86400 * 1000);
      }
    }
  }

  // 365-day Heatmap generation
  const activityHeatmap: Array<{ date: string; count: number; level: number }> = [];
  const oneYearAgo = new Date();
  oneYearAgo.setDate(oneYearAgo.getDate() - 364);

  for (let i = 0; i < 365; i++) {
    const day = new Date(oneYearAgo);
    day.setDate(day.getDate() + i);
    const key = formatDateKey(day);
    const count = dateCounts[key] || 0;

    let level = 0;
    if (count >= 4) level = 4;
    else if (count >= 2) level = 3;
    else if (count === 1) level = 2;

    activityHeatmap.push({ date: key, count, level });
  }

  // Weekly progress (Current Monday -> Sunday)
  const currDayOfWeek = today.getDay(); // 0 is Sunday
  const distanceToMonday = currDayOfWeek === 0 ? 6 : currDayOfWeek - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - distanceToMonday);
  monday.setHours(0, 0, 0, 0);

  let weeklyCompletedDays = 0;
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const key = formatDateKey(day);
    if (dateCounts[key] && dateCounts[key] > 0) {
      weeklyCompletedDays++;
    }
  }

  return {
    currentStreak,
    longestStreak,
    totalActiveDays,
    totalCompletions,
    weeklyCompletedDays,
    weeklyTarget: 5, // 5 days per week standard target
    activityHeatmap,
    lastActiveDate: uniqueDateKeys.length > 0 ? uniqueDateKeys[uniqueDateKeys.length - 1] : null,
  };
}

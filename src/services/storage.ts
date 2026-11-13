import type { AchievementDef, SavedGame, UserProgress } from '../types/chess';

const STORAGE_KEY = 'checkmate_academy_progress_v1';

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_lesson',
    title: 'First Step',
    description: 'Complete your first Academy lesson.',
    xpReward: 50,
    category: 'academy',
  },
  {
    id: 'beginner_graduate',
    title: 'Foundation Builder',
    description: 'Complete all Level 1 Beginner lessons.',
    xpReward: 150,
    category: 'academy',
  },
  {
    id: 'first_victory',
    title: 'First Victory',
    description: 'Defeat the AI computer in a full game.',
    xpReward: 100,
    category: 'play',
  },
  {
    id: 'defeated_medium',
    title: 'Club Contender',
    description: 'Defeat the AI on Medium difficulty or higher.',
    xpReward: 200,
    category: 'play',
  },
  {
    id: 'defeated_hard',
    title: 'Master Slayer',
    description: 'Defeat the AI on Hard or Expert difficulty.',
    xpReward: 350,
    category: 'play',
  },
  {
    id: 'tactician_5',
    title: 'Sharp Eye',
    description: 'Solve 5 tactical or mate puzzles.',
    xpReward: 100,
    category: 'puzzles',
  },
  {
    id: 'daily_challenger',
    title: 'Daily Discipline',
    description: 'Complete a Daily Chess Challenge.',
    xpReward: 75,
    category: 'puzzles',
  },
  {
    id: 'streak_3',
    title: 'Three-Day Momentum',
    description: 'Maintain a 3-day learning streak.',
    xpReward: 120,
    category: 'special',
  },
  {
    id: 'opening_scholar',
    title: 'Opening Repertoire',
    description: 'Study 3 openings in the Opening Library.',
    xpReward: 100,
    category: 'academy',
  },
  {
    id: 'endgame_specialist',
    title: 'Endgame Specialist',
    description: 'Master 3 interactive endgame exercises.',
    xpReward: 150,
    category: 'special',
  },
  {
    id: 'blindfold_vision',
    title: 'Mind’s Eye',
    description: 'Reach a streak of 5 in Blindfold Training.',
    xpReward: 125,
    category: 'special',
  },
  {
    id: 'rating_1000',
    title: 'Four-Digit Club',
    description: 'Reach an estimated chess rating of 1000.',
    xpReward: 250,
    category: 'play',
  },
];

export function getTodayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDefaultProgress(): UserProgress {
  return {
    xp: 0,
    streak: 1,
    lastActiveDate: getTodayKey(),
    ratingEstimate: 600,
    completedLessons: [],
    completedOpenings: [],
    completedEndgames: [],
    solvedPuzzles: [],
    dailyPuzzlesCompleted: {},
    unlockedAchievements: [],
    savedGames: [],
    stats: {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      puzzlesSolved: 0,
      puzzleAttempts: 0,
      guessBestMoveSolved: 0,
      blindfoldBestStreak: 0,
      endgamesCompleted: 0,
    },
    settings: {
      boardTheme: 'obsidian',
      soundEnabled: true,
      showLegalMoves: true,
      showCoordinates: true,
    },
  };
}

export function getLevelFromXp(xp: number): {
  level: number;
  title: string;
  currentLevelXp: number;
  nextLevelXp: number;
  percent: number;
} {
  const thresholds = [0, 150, 400, 750, 1200, 1800, 2600, 3600, 5000, 7000];
  const titles = [
    'Novice Pawn',
    'Board Explorer',
    'Tactical Apprentice',
    'Club Player',
    'Positional Thinker',
    'Tournament Contender',
    'Candidate Strategist',
    'Academy Master',
    'Grand Tactician',
    'Grandmaster',
  ];
  let idx = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (xp >= thresholds[i]) idx = i;
  }
  const currentBase = thresholds[idx];
  const nextBase = thresholds[idx + 1] ?? currentBase + 2500;
  const span = nextBase - currentBase;
  const percent = Math.min(100, Math.round(((xp - currentBase) / span) * 100));
  return {
    level: idx + 1,
    title: titles[idx],
    currentLevelXp: xp - currentBase,
    nextLevelXp: span,
    percent,
  };
}

export function loadProgress(): UserProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultProgress();
    const parsed = JSON.parse(raw) as Partial<UserProgress>;
    const base = getDefaultProgress();
    const merged: UserProgress = {
      ...base,
      ...parsed,
      stats: { ...base.stats, ...(parsed.stats ?? {}) },
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
      completedLessons: Array.isArray(parsed.completedLessons) ? parsed.completedLessons : [],
      completedOpenings: Array.isArray(parsed.completedOpenings) ? parsed.completedOpenings : [],
      completedEndgames: Array.isArray(parsed.completedEndgames) ? parsed.completedEndgames : [],
      solvedPuzzles: Array.isArray(parsed.solvedPuzzles) ? parsed.solvedPuzzles : [],
      unlockedAchievements: Array.isArray(parsed.unlockedAchievements)
        ? parsed.unlockedAchievements
        : [],
      savedGames: Array.isArray(parsed.savedGames) ? parsed.savedGames : [],
      dailyPuzzlesCompleted: parsed.dailyPuzzlesCompleted ?? {},
    };
    return updateDailyStreak(merged);
  } catch {
    return getDefaultProgress();
  }
}

export function updateDailyStreak(progress: UserProgress): UserProgress {
  const today = getTodayKey();
  if (progress.lastActiveDate === today) return progress;

  const prev = new Date(progress.lastActiveDate + 'T00:00:00');
  const curr = new Date(today + 'T00:00:00');
  const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));

  const nextStreak = diffDays === 1 ? progress.streak + 1 : 1;
  return {
    ...progress,
    streak: nextStreak,
    lastActiveDate: today,
  };
}

export function saveProgress(progress: UserProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Handle storage quota gracefully by trimming old saved games if needed
    try {
      const trimmed: UserProgress = {
        ...progress,
        savedGames: progress.savedGames.slice(0, 12),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Ignore if storage completely blocked
    }
  }
}

export function evaluateAchievements(
  progress: UserProgress,
  level1LessonIds: string[]
): { updated: UserProgress; newlyUnlocked: AchievementDef[] } {
  const unlocked = new Set(progress.unlockedAchievements);
  const newlyUnlocked: AchievementDef[] = [];
  let bonusXp = 0;

  const grant = (id: string) => {
    if (unlocked.has(id)) return;
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (!def) return;
    unlocked.add(id);
    newlyUnlocked.push(def);
    bonusXp += def.xpReward;
  };

  if (progress.completedLessons.length >= 1) grant('first_lesson');
  if (
    level1LessonIds.length > 0 &&
    level1LessonIds.every((id) => progress.completedLessons.includes(id))
  ) {
    grant('beginner_graduate');
  }
  if (progress.stats.wins >= 1) grant('first_victory');
  if (
    progress.savedGames.some(
      (g) => g.result === 'win' && ['medium', 'hard', 'expert'].includes(g.difficulty)
    )
  ) {
    grant('defeated_medium');
  }
  if (
    progress.savedGames.some(
      (g) => g.result === 'win' && ['hard', 'expert'].includes(g.difficulty)
    )
  ) {
    grant('defeated_hard');
  }
  if (progress.stats.puzzlesSolved >= 5) grant('tactician_5');
  if (Object.values(progress.dailyPuzzlesCompleted).some(Boolean)) grant('daily_challenger');
  if (progress.streak >= 3) grant('streak_3');
  if (progress.completedOpenings.length >= 3) grant('opening_scholar');
  if (progress.completedEndgames.length >= 3) grant('endgame_specialist');
  if (progress.stats.blindfoldBestStreak >= 5) grant('blindfold_vision');
  if (progress.ratingEstimate >= 1000) grant('rating_1000');

  return {
    updated: {
      ...progress,
      xp: progress.xp + bonusXp,
      unlockedAchievements: Array.from(unlocked),
    },
    newlyUnlocked,
  };
}

export function calculateNewRating(
  currentRating: number,
  difficulty: SavedGame['difficulty'],
  result: SavedGame['result']
): number {
  const opponentRatings: Record<SavedGame['difficulty'], number> = {
    beginner: 450,
    easy: 750,
    medium: 1100,
    hard: 1500,
    expert: 1900,
  };
  const opp = opponentRatings[difficulty];
  const expected = 1 / (1 + Math.pow(10, (opp - currentRating) / 400));
  const actual = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0;
  const k = 32;
  return Math.max(300, Math.round(currentRating + k * (actual - expected)));
}

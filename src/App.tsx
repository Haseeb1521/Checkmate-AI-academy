import { useCallback, useEffect, useState } from 'react';
import { Award, BookOpen, Home, Puzzle, Swords, User } from 'lucide-react';
import { OfflineBanner, PWAInstallButton } from './components/PWAInstallButton';
import { LESSONS } from './data/lessons';
import { soundService } from './services/sound';
import {
  calculateNewRating,
  evaluateAchievements,
  getDefaultProgress,
  getTodayKey,
  loadProgress,
  saveProgress,
} from './services/storage';
import type {
  AchievementDef,
  AIDifficulty,
  AppTab,
  PieceColor,
  SavedGame,
  UserProgress,
  UserSettings,
} from './types/chess';
import { HomeView } from './views/HomeView';
import { LearnView, type LearnSubTab } from './views/LearnView';
import { PlayView } from './views/PlayView';
import { PuzzlesView, type PuzzleSubTab } from './views/PuzzlesView';
import { ProfileView } from './views/ProfileView';

const LEVEL_1_IDS = LESSONS.filter((l) => l.level === 1).map((l) => l.id);

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [learnSubTab, setLearnSubTab] = useState<LearnSubTab>('curriculum');
  const [puzzleSubTab, setPuzzleSubTab] = useState<PuzzleSubTab>('puzzles');
  const [profileSubSection, setProfileSubSection] = useState<'stats' | 'replay'>('stats');
  const [playInitialSetup, setPlayInitialSetup] = useState<{
    fen?: string;
    playerColor?: PieceColor;
    openingName?: string;
    difficulty?: AIDifficulty;
  } | null>(null);

  const [progress, setProgress] = useState<UserProgress>(() => loadProgress());
  const [achievementToast, setAchievementToast] = useState<AchievementDef | null>(null);

  useEffect(() => {
    soundService.setEnabled(progress.settings.soundEnabled);
    saveProgress(progress);
  }, [progress]);

  const applyProgressUpdate = useCallback((updater: (prev: UserProgress) => UserProgress) => {
    setProgress((prev) => {
      const nextRaw = updater(prev);
      const { updated, newlyUnlocked } = evaluateAchievements(nextRaw, LEVEL_1_IDS);
      if (newlyUnlocked.length > 0) {
        setAchievementToast(newlyUnlocked[0]);
      }
      return updated;
    });
  }, []);

  useEffect(() => {
    if (!achievementToast) return;
    const t = setTimeout(() => setAchievementToast(null), 4000);
    return () => clearTimeout(t);
  }, [achievementToast]);

  const handleGameCompleted = useCallback(
    (game: SavedGame) => {
      applyProgressUpdate((prev) => {
        const xpGain = game.result === 'win' ? 65 : game.result === 'draw' ? 35 : 20;
        const nextRating = calculateNewRating(prev.ratingEstimate, game.difficulty, game.result);
        return {
          ...prev,
          xp: prev.xp + xpGain,
          ratingEstimate: nextRating,
          savedGames: [game, ...prev.savedGames].slice(0, 30),
          stats: {
            ...prev.stats,
            gamesPlayed: prev.stats.gamesPlayed + 1,
            wins: prev.stats.wins + (game.result === 'win' ? 1 : 0),
            losses: prev.stats.losses + (game.result === 'loss' ? 1 : 0),
            draws: prev.stats.draws + (game.result === 'draw' ? 1 : 0),
          },
        };
      });
    },
    [applyProgressUpdate]
  );

  const handleCompleteLesson = useCallback(
    (lessonId: string, xp: number) => {
      applyProgressUpdate((prev) => {
        if (prev.completedLessons.includes(lessonId)) return prev;
        return {
          ...prev,
          xp: prev.xp + xp,
          completedLessons: [...prev.completedLessons, lessonId],
        };
      });
    },
    [applyProgressUpdate]
  );

  const handleCompleteOpening = useCallback(
    (openingId: string) => {
      applyProgressUpdate((prev) => {
        if (prev.completedOpenings.includes(openingId)) return prev;
        return {
          ...prev,
          xp: prev.xp + 25,
          completedOpenings: [...prev.completedOpenings, openingId],
        };
      });
    },
    [applyProgressUpdate]
  );

  const handleCompleteEndgame = useCallback(
    (endgameId: string, xp: number) => {
      applyProgressUpdate((prev) => {
        const already = prev.completedEndgames.includes(endgameId);
        return {
          ...prev,
          xp: prev.xp + (already ? 15 : xp),
          completedEndgames: already ? prev.completedEndgames : [...prev.completedEndgames, endgameId],
          stats: {
            ...prev.stats,
            endgamesCompleted: already
              ? prev.stats.endgamesCompleted
              : prev.stats.endgamesCompleted + 1,
          },
        };
      });
    },
    [applyProgressUpdate]
  );

  const handlePuzzleSolved = useCallback(
    (puzzleId: string, isDaily: boolean, xp: number) => {
      const todayKey = getTodayKey();
      applyProgressUpdate((prev) => {
        const alreadySolved = prev.solvedPuzzles.includes(puzzleId);
        const dailyAlready = Boolean(prev.dailyPuzzlesCompleted[todayKey]);
        return {
          ...prev,
          xp: prev.xp + (alreadySolved && (!isDaily || dailyAlready) ? 10 : xp),
          ratingEstimate: alreadySolved ? prev.ratingEstimate : prev.ratingEstimate + 6,
          solvedPuzzles: alreadySolved ? prev.solvedPuzzles : [...prev.solvedPuzzles, puzzleId],
          dailyPuzzlesCompleted: isDaily
            ? { ...prev.dailyPuzzlesCompleted, [todayKey]: true }
            : prev.dailyPuzzlesCompleted,
          stats: {
            ...prev.stats,
            puzzlesSolved: prev.stats.puzzlesSolved + 1,
          },
        };
      });
    },
    [applyProgressUpdate]
  );

  const handlePuzzleAttempt = useCallback(() => {
    setProgress((prev) => ({
      ...prev,
      stats: { ...prev.stats, puzzleAttempts: prev.stats.puzzleAttempts + 1 },
    }));
  }, []);

  const handleGuessBestMoveSolved = useCallback(
    (xp: number) => {
      applyProgressUpdate((prev) => ({
        ...prev,
        xp: prev.xp + xp,
        stats: {
          ...prev.stats,
          guessBestMoveSolved: prev.stats.guessBestMoveSolved + 1,
        },
      }));
    },
    [applyProgressUpdate]
  );

  const handleBlindfoldStreakUpdate = useCallback(
    (streak: number) => {
      applyProgressUpdate((prev) => {
        if (streak <= prev.stats.blindfoldBestStreak) return prev;
        return {
          ...prev,
          xp: prev.xp + 15,
          stats: {
            ...prev.stats,
            blindfoldBestStreak: streak,
          },
        };
      });
    },
    [applyProgressUpdate]
  );

  const handleUpdateSettings = useCallback((next: Partial<UserSettings>) => {
    setProgress((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...next },
    }));
  }, []);

  const handleResetAllProgress = useCallback(() => {
    const fresh = getDefaultProgress();
    setProgress(fresh);
    saveProgress(fresh);
  }, []);

  const navItems: Array<{ id: AppTab; label: string; icon: typeof Home }> = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'learn', label: 'Learn', icon: BookOpen },
    { id: 'play', label: 'Play', icon: Swords },
    { id: 'puzzles', label: 'Puzzles', icon: Puzzle },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-[#0B0C0E] text-[#F4F1EA] flex flex-col">
      {/* Top Bar Contract: [Wordmark] — [5 single-line links] — [1 primary action] */}
      <header className="sticky top-0 z-30 h-14 bg-[#0B0C0E]/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-6xl mx-auto h-full px-4 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="font-display text-lg font-bold tracking-tight text-[#D4AF37] whitespace-nowrap shrink-0"
          >
            CHECKMATE
          </button>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#A3A8B4]">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`whitespace-nowrap shrink-0 transition-colors py-1 border-b-2 ${
                  activeTab === item.id
                    ? 'text-[#F4F1EA] border-[#D4AF37]'
                    : 'border-transparent hover:text-[#F4F1EA]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <OfflineBanner />
            <PWAInstallButton compact />
            {activeTab !== 'play' && (
              <button
                type="button"
                onClick={() => setActiveTab('play')}
                className="hidden sm:inline-flex items-center justify-center px-4 py-2 min-h-[38px] rounded-xl bg-[#D4AF37] text-[#0B0C0E] text-xs font-semibold hover:bg-[#E8C766] transition-colors whitespace-nowrap shrink-0"
              >
                Quick Match
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {activeTab === 'home' && (
          <HomeView
            progress={progress}
            onNavigateTab={setActiveTab}
            onOpenLearn={(sub) => {
              setLearnSubTab(sub);
              setActiveTab('learn');
            }}
            onOpenPuzzles={(sub) => {
              setPuzzleSubTab(sub);
              setActiveTab('puzzles');
            }}
            onQuickPlay={(difficulty) => {
              setPlayInitialSetup({ difficulty, playerColor: 'w', openingName: 'Standard Game' });
              setActiveTab('play');
            }}
            onOpenReplay={() => {
              setProfileSubSection('replay');
              setActiveTab('profile');
            }}
          />
        )}

        {activeTab === 'learn' && (
          <LearnView
            key={learnSubTab}
            initialSubTab={learnSubTab}
            settings={progress.settings}
            completedLessons={progress.completedLessons}
            completedOpenings={progress.completedOpenings}
            completedEndgames={progress.completedEndgames}
            onCompleteLesson={handleCompleteLesson}
            onCompleteOpening={handleCompleteOpening}
            onCompleteEndgame={handleCompleteEndgame}
            onPracticeOpening={(fen, playerColor, openingName, difficulty) => {
              setPlayInitialSetup({ fen, playerColor, openingName, difficulty });
              setActiveTab('play');
            }}
          />
        )}

        {activeTab === 'play' && (
          <PlayView
            settings={progress.settings}
            initialSetup={playInitialSetup}
            onClearInitialSetup={() => setPlayInitialSetup(null)}
            onGameCompleted={handleGameCompleted}
          />
        )}

        {activeTab === 'puzzles' && (
          <PuzzlesView
            key={puzzleSubTab}
            initialSubTab={puzzleSubTab}
            settings={progress.settings}
            solvedPuzzles={progress.solvedPuzzles}
            dailyPuzzlesCompleted={progress.dailyPuzzlesCompleted}
            blindfoldBestStreak={progress.stats.blindfoldBestStreak}
            onPuzzleSolved={handlePuzzleSolved}
            onPuzzleAttempt={handlePuzzleAttempt}
            onGuessBestMoveSolved={handleGuessBestMoveSolved}
            onBlindfoldStreakUpdate={handleBlindfoldStreakUpdate}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileView
            progress={progress}
            initialSubSection={profileSubSection}
            onUpdateSettings={handleUpdateSettings}
            onResetAllProgress={handleResetAllProgress}
          />
        )}
      </main>

      {/* Achievement Toast */}
      {achievementToast && (
        <div className="fixed top-16 right-4 z-50 max-w-xs rounded-2xl bg-[#161920] border border-[#D4AF37] p-3.5 shadow-2xl flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-mono text-[#D4AF37]">
              Achievement Unlocked · +{achievementToast.xpReward} XP
            </div>
            <div className="text-sm font-bold text-[#F4F1EA]">{achievementToast.title}</div>
          </div>
        </div>
      )}

      {/* Android-First Fixed Bottom Navigation Bar (5 Tabs) */}
      <nav
        aria-label="Primary Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0E1014]/95 backdrop-blur-md border-t border-white/10 pb-safe"
      >
        <div className="grid grid-cols-5 h-16 items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'profile') setProfileSubSection('stats');
                  setActiveTab(item.id);
                }}
                className={`flex flex-col items-center justify-center min-h-[44px] transition-colors ${
                  isActive ? 'text-[#D4AF37]' : 'text-[#8D93A3] hover:text-[#F4F1EA]'
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.4 : 1.8} />
                <span className="text-[10px] font-medium mt-1 tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

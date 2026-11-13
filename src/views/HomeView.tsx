import React from 'react';
import {
  BookOpen,
  ChevronRight,
  Crown,
  EyeOff,
  Flame,
  History,
  Puzzle,
  Swords,
  Target,
  Trophy,
} from 'lucide-react';
import { LESSONS } from '../data/lessons';
import { getDailyPuzzle } from '../data/puzzles';
import { getLevelFromXp, getTodayKey } from '../services/storage';
import type { AIDifficulty, AppTab, UserProgress } from '../types/chess';
import type { LearnSubTab } from './LearnView';
import type { PuzzleSubTab } from './PuzzlesView';

interface HomeViewProps {
  progress: UserProgress;
  onNavigateTab: (tab: AppTab) => void;
  onOpenLearn: (sub: LearnSubTab) => void;
  onOpenPuzzles: (sub: PuzzleSubTab) => void;
  onQuickPlay: (difficulty: AIDifficulty) => void;
  onOpenReplay: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  progress,
  onNavigateTab,
  onOpenLearn,
  onOpenPuzzles,
  onQuickPlay,
  onOpenReplay,
}) => {
  const todayKey = getTodayKey();
  const dailyPuzzle = getDailyPuzzle(todayKey);
  const dailyDone = Boolean(progress.dailyPuzzlesCompleted[todayKey]);

  const levelInfo = getLevelFromXp(progress.xp);
  const nextLesson =
    LESSONS.find((l) => !progress.completedLessons.includes(l.id)) ?? LESSONS[LESSONS.length - 1];
  const academyPercent = Math.round((progress.completedLessons.length / LESSONS.length) * 100);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 pt-5 pb-24 lg:pb-10 space-y-6">
      {/* Hero / Personal Academy Strip */}
      <section className="rounded-3xl bg-[#14161A] border border-[#D4AF37]/25 p-5 sm:p-7">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="text-xs font-medium text-[#D4AF37]">
              Level {levelInfo.level} · {levelInfo.title}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#F4F1EA] leading-tight text-balance">
              Master Every Square from First Move to Checkmate
            </h1>
            <p className="text-sm text-[#A3A8B4] leading-relaxed">
              Structured interactive lessons, Stockfish-powered AI battles, daily tactical puzzles, and real-time coaching explanations.
            </p>
            <div className="pt-2 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => onNavigateTab('play')}
                className="min-h-[44px] px-5 rounded-xl bg-[#D4AF37] text-[#0B0C0E] text-sm font-semibold hover:bg-[#E8C766] inline-flex items-center gap-2 transition-colors"
              >
                <Swords className="w-4 h-4" />
                <span>Play vs AI</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenLearn('curriculum')}
                className="min-h-[44px] px-5 rounded-xl bg-[#1E222B] text-[#F4F1EA] text-sm font-medium hover:bg-[#272C38] inline-flex items-center gap-2 transition-colors"
              >
                <BookOpen className="w-4 h-4 text-[#D4AF37]" />
                <span>Continue Lessons</span>
              </button>
            </div>
          </div>

          {/* 4-Metric Dashboard Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3 shrink-0 lg:w-[320px]">
            <div className="rounded-2xl bg-[#1B1E25] p-3.5 border border-white/5">
              <div className="text-[11px] text-[#A3A8B4]">Rating Estimate</div>
              <div className="text-2xl font-mono font-bold text-[#D4AF37] tabular-nums mt-0.5">
                {progress.ratingEstimate}
              </div>
            </div>
            <div className="rounded-2xl bg-[#1B1E25] p-3.5 border border-white/5">
              <div className="text-[11px] text-[#A3A8B4]">Daily Streak</div>
              <div className="text-2xl font-mono font-bold text-[#F4F1EA] tabular-nums mt-0.5">
                {progress.streak}d
              </div>
            </div>
            <div className="rounded-2xl bg-[#1B1E25] p-3.5 border border-white/5">
              <div className="text-[11px] text-[#A3A8B4]">Total XP</div>
              <div className="text-2xl font-mono font-bold text-[#F4F1EA] tabular-nums mt-0.5">
                {progress.xp}
              </div>
            </div>
            <div className="rounded-2xl bg-[#1B1E25] p-3.5 border border-white/5">
              <div className="text-[11px] text-[#A3A8B4]">Academy</div>
              <div className="text-2xl font-mono font-bold text-emerald-400 tabular-nums mt-0.5">
                {academyPercent}%
              </div>
            </div>
          </div>
        </div>

        {/* XP Level Bar */}
        <div className="mt-5 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-[#A3A8B4]">Progress to Level {levelInfo.level + 1}</span>
            <span className="font-mono text-[#D4AF37] tabular-nums">
              {levelInfo.currentLevelXp} / {levelInfo.nextLevelXp} XP
            </span>
          </div>
          <div className="h-2 rounded-full bg-[#1B1E25] overflow-hidden">
            <div
              className="h-full bg-[#D4AF37] transition-all duration-300"
              style={{ width: `${levelInfo.percent}%` }}
            />
          </div>
        </div>
      </section>

      {/* Daily Challenge + Next Academy Lesson */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => onOpenPuzzles('puzzles')}
          className="text-left rounded-2xl bg-[#14161A] border border-white/10 hover:border-[#D4AF37]/60 p-5 flex items-center justify-between gap-4 transition-colors"
        >
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-mono text-[#D4AF37]">
              <Flame className="w-4 h-4" />
              <span>Daily Chess Challenge · {dailyDone ? 'Completed' : '+75 XP'}</span>
            </div>
            <h2 className="text-lg font-bold text-[#F4F1EA]">{dailyPuzzle.title}</h2>
            <p className="text-xs text-[#A3A8B4]">
              {dailyPuzzle.difficulty} · {dailyPuzzle.theme} · Rating {dailyPuzzle.rating}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#D4AF37]/15 flex items-center justify-center text-[#E8C766] shrink-0">
            <Puzzle className="w-5 h-5" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onOpenLearn('curriculum')}
          className="text-left rounded-2xl bg-[#14161A] border border-white/10 hover:border-[#D4AF37]/60 p-5 flex items-center justify-between gap-4 transition-colors"
        >
          <div className="space-y-1.5">
            <div className="text-xs font-mono text-[#D4AF37]">
              Up Next · Level {nextLesson.level} · {nextLesson.durationMinutes} min
            </div>
            <h2 className="text-lg font-bold text-[#F4F1EA]">{nextLesson.title}</h2>
            <p className="text-xs text-[#A3A8B4]">{nextLesson.subtitle}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#1E222B] flex items-center justify-center text-[#F4F1EA] shrink-0">
            <ChevronRight className="w-5 h-5" />
          </div>
        </button>
      </section>

      {/* Quick Play Difficulty Launcher */}
      <section className="rounded-2xl bg-[#14161A] border border-white/10 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#F4F1EA]">Quick Match vs Computer</h2>
            <p className="text-xs text-[#A3A8B4]">Choose a Stockfish AI strength and start immediately</p>
          </div>
          <span className="font-mono text-xs text-[#A3A8B4] tabular-nums">
            {progress.stats.wins}W · {progress.stats.losses}L · {progress.stats.draws}D
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {(
            [
              { id: 'beginner', label: 'Beginner', elo: '450' },
              { id: 'easy', label: 'Easy', elo: '750' },
              { id: 'medium', label: 'Medium', elo: '1100' },
              { id: 'hard', label: 'Hard', elo: '1500' },
              { id: 'expert', label: 'Expert', elo: '1900' },
            ] as const
          ).map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onQuickPlay(d.id)}
              className="min-h-[54px] rounded-xl bg-[#1B1E25] hover:bg-[#D4AF37]/15 border border-white/5 hover:border-[#D4AF37] p-3 text-left transition-colors"
            >
              <div className="text-sm font-semibold text-[#F4F1EA]">{d.label}</div>
              <div className="text-[11px] font-mono text-[#D4AF37] tabular-nums">Elo ~{d.elo}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Special Training Modes */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-[#F4F1EA]">Special Training Modes</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => onOpenPuzzles('guess-best')}
            className="text-left rounded-2xl bg-[#14161A] border border-white/10 hover:border-[#D4AF37]/60 p-4 space-y-2 transition-colors"
          >
            <Target className="w-5 h-5 text-[#D4AF37]" />
            <div className="text-sm font-semibold text-[#F4F1EA]">Guess the Best Move</div>
            <p className="text-xs text-[#A3A8B4]">
              Find the strongest engine move in real game moments.
            </p>
          </button>

          <button
            type="button"
            onClick={onOpenReplay}
            className="text-left rounded-2xl bg-[#14161A] border border-white/10 hover:border-[#D4AF37]/60 p-4 space-y-2 transition-colors"
          >
            <History className="w-5 h-5 text-[#D4AF37]" />
            <div className="text-sm font-semibold text-[#F4F1EA]">Replay My Game</div>
            <p className="text-xs text-[#A3A8B4]">
              Step through your {progress.savedGames.length} saved games with coach insights.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onOpenPuzzles('blindfold')}
            className="text-left rounded-2xl bg-[#14161A] border border-white/10 hover:border-[#D4AF37]/60 p-4 space-y-2 transition-colors"
          >
            <EyeOff className="w-5 h-5 text-[#D4AF37]" />
            <div className="text-sm font-semibold text-[#F4F1EA]">Blindfold Training</div>
            <p className="text-xs text-[#A3A8B4]">
              Sharpen square colors, coordinates, and mental piece geometry.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onOpenLearn('endgames')}
            className="text-left rounded-2xl bg-[#14161A] border border-white/10 hover:border-[#D4AF37]/60 p-4 space-y-2 transition-colors"
          >
            <Crown className="w-5 h-5 text-[#D4AF37]" />
            <div className="text-sm font-semibold text-[#F4F1EA]">Endgame Trainer</div>
            <p className="text-xs text-[#A3A8B4]">
              Practice King & Pawn, Rook endings, and checkmate drills vs AI.
            </p>
          </button>
        </div>
      </section>

      {/* Achievements Strip */}
      <section className="rounded-2xl bg-[#14161A] border border-white/10 p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/15 flex items-center justify-center text-[#D4AF37]">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-[#F4F1EA]">
              {progress.unlockedAchievements.length} Achievements Unlocked
            </div>
            <div className="text-xs text-[#A3A8B4]">
              View full career stats, badges, and board settings in Profile.
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigateTab('profile')}
          className="min-h-[40px] px-4 rounded-xl bg-[#1E222B] text-xs font-medium text-[#F4F1EA] hover:bg-[#272C38] whitespace-nowrap shrink-0"
        >
          View Profile
        </button>
      </section>
    </div>
  );
};

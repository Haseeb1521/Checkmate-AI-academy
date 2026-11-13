import React, { useEffect, useState } from 'react';
import {
  Award,
  ChevronLeft,
  ChevronRight,
  History,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ChessBoard } from '../components/ChessBoard';
import { EvalBar } from '../components/EvalBar';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { LESSONS } from '../data/lessons';
import { explainPositionWithCoach } from '../services/coachService';
import { stockfishEngine } from '../services/stockfishEngine';
import { ACHIEVEMENTS, getLevelFromXp } from '../services/storage';
import type { BoardTheme, CoachExplanation, SavedGame, UserProgress, UserSettings } from '../types/chess';

interface ProfileViewProps {
  progress: UserProgress;
  initialSubSection?: 'stats' | 'replay';
  onUpdateSettings: (next: Partial<UserSettings>) => void;
  onResetAllProgress: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  progress,
  initialSubSection = 'stats',
  onUpdateSettings,
  onResetAllProgress,
}) => {
  const [activeTab, setActiveTab] = useState<'stats' | 'replay' | 'achievements' | 'settings'>(
    initialSubSection
  );

  // Replay My Game state
  const [selectedGame, setSelectedGame] = useState<SavedGame | null>(progress.savedGames[0] ?? null);
  const [replayIndex, setReplayIndex] = useState(0); // 0 = initial, 1..moves.length
  const [autoPlaying, setAutoPlaying] = useState(false);
  const [replayEvalCp, setReplayEvalCp] = useState(0);
  const [replayMateIn, setReplayMateIn] = useState<number | null>(null);
  const [replayCoachLoading, setReplayCoachLoading] = useState(false);
  const [replayCoachData, setReplayCoachData] = useState<CoachExplanation | null>(null);

  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    setActiveTab(initialSubSection);
  }, [initialSubSection]);

  useEffect(() => {
    if (!selectedGame && progress.savedGames.length > 0) {
      setSelectedGame(progress.savedGames[0]);
    }
  }, [progress.savedGames, selectedGame]);

  const currentReplayFen =
    selectedGame && selectedGame.fens[replayIndex]
      ? selectedGame.fens[replayIndex]
      : 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  useEffect(() => {
    if (!autoPlaying || !selectedGame) return;
    if (replayIndex >= selectedGame.moves.length) {
      setAutoPlaying(false);
      return;
    }
    const timer = setTimeout(() => {
      setReplayIndex((i) => Math.min(selectedGame.moves.length, i + 1));
    }, 850);
    return () => clearTimeout(timer);
  }, [autoPlaying, replayIndex, selectedGame]);

  useEffect(() => {
    if (activeTab !== 'replay' || !selectedGame) return;
    let cancelled = false;
    stockfishEngine.evaluatePosition(currentReplayFen, 8, 180).then((ev) => {
      if (!cancelled) {
        setReplayEvalCp(ev.evalCp);
        setReplayMateIn(ev.mateIn);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeTab, currentReplayFen, selectedGame]);

  const handleExplainReplayMove = async () => {
    if (!selectedGame) return;
    setReplayCoachLoading(true);
    try {
      const exp = await explainPositionWithCoach({
        fen: currentReplayFen,
        lastMove: replayIndex > 0 ? selectedGame.moves[replayIndex - 1] : undefined,
        playerColor: selectedGame.playerColor,
        openingName: selectedGame.openingName,
        moveHistory: selectedGame.moves.slice(0, replayIndex),
      });
      setReplayCoachData(exp);
    } finally {
      setReplayCoachLoading(false);
    }
  };

  const levelInfo = getLevelFromXp(progress.xp);
  const academyPercent = Math.round((progress.completedLessons.length / LESSONS.length) * 100);
  const puzzleAccuracy =
    progress.stats.puzzleAttempts > 0
      ? Math.min(100, Math.round((progress.stats.puzzlesSolved / progress.stats.puzzleAttempts) * 100))
      : 0;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 pt-4 pb-24 lg:pb-10 space-y-5">
      {/* Header + Sub-nav */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#F4F1EA]">Player Profile & Archive</h1>
          <p className="text-xs text-[#A3A8B4] mt-0.5">
            Level {levelInfo.level} {levelInfo.title} · Rating {progress.ratingEstimate} ·{' '}
            {progress.xp} XP
          </p>
        </div>

        <div className="flex items-center bg-[#14161A] border border-white/10 rounded-xl p-1 self-start overflow-x-auto max-w-full">
          {(
            [
              { id: 'stats', label: 'Stats' },
              { id: 'replay', label: 'Replay My Game' },
              { id: 'achievements', label: 'Badges' },
              { id: 'settings', label: 'Settings' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-3.5 py-2 min-h-[40px] rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                activeTab === t.id
                  ? 'bg-[#D4AF37] text-[#0B0C0E] font-semibold'
                  : 'text-[#A3A8B4] hover:text-[#F4F1EA]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ===================== 1. STATS ===================== */}
      {activeTab === 'stats' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-[#14161A] border border-white/10 p-4">
            <div className="text-xs text-[#A3A8B4]">Estimated Rating</div>
            <div className="text-2xl font-mono font-bold text-[#D4AF37] tabular-nums mt-1">
              {progress.ratingEstimate}
            </div>
          </div>
          <div className="rounded-2xl bg-[#14161A] border border-white/10 p-4">
            <div className="text-xs text-[#A3A8B4]">Games Played</div>
            <div className="text-2xl font-mono font-bold text-[#F4F1EA] tabular-nums mt-1">
              {progress.stats.gamesPlayed}
            </div>
          </div>
          <div className="rounded-2xl bg-[#14161A] border border-white/10 p-4">
            <div className="text-xs text-[#A3A8B4]">Win / Loss / Draw</div>
            <div className="text-xl font-mono font-bold text-[#F4F1EA] tabular-nums mt-1">
              {progress.stats.wins} / {progress.stats.losses} / {progress.stats.draws}
            </div>
          </div>
          <div className="rounded-2xl bg-[#14161A] border border-white/10 p-4">
            <div className="text-xs text-[#A3A8B4]">Learning Streak</div>
            <div className="text-2xl font-mono font-bold text-emerald-400 tabular-nums mt-1">
              {progress.streak} days
            </div>
          </div>
          <div className="rounded-2xl bg-[#14161A] border border-white/10 p-4">
            <div className="text-xs text-[#A3A8B4]">Academy Progress</div>
            <div className="text-2xl font-mono font-bold text-[#F4F1EA] tabular-nums mt-1">
              {academyPercent}%
            </div>
          </div>
          <div className="rounded-2xl bg-[#14161A] border border-white/10 p-4">
            <div className="text-xs text-[#A3A8B4]">Puzzles Solved</div>
            <div className="text-2xl font-mono font-bold text-[#F4F1EA] tabular-nums mt-1">
              {progress.stats.puzzlesSolved}
            </div>
          </div>
          <div className="rounded-2xl bg-[#14161A] border border-white/10 p-4">
            <div className="text-xs text-[#A3A8B4]">Puzzle Accuracy</div>
            <div className="text-2xl font-mono font-bold text-[#D4AF37] tabular-nums mt-1">
              {puzzleAccuracy}%
            </div>
          </div>
          <div className="rounded-2xl bg-[#14161A] border border-white/10 p-4">
            <div className="text-xs text-[#A3A8B4]">Blindfold Best Streak</div>
            <div className="text-2xl font-mono font-bold text-[#F4F1EA] tabular-nums mt-1">
              {progress.stats.blindfoldBestStreak}
            </div>
          </div>
        </div>
      )}

      {/* ===================== 2. REPLAY MY GAME ===================== */}
      {activeTab === 'replay' && (
        <>
          {progress.savedGames.length === 0 ? (
            <div className="rounded-2xl bg-[#14161A] border border-white/10 p-8 text-center space-y-2">
              <History className="w-8 h-8 text-[#D4AF37] mx-auto" />
              <h2 className="text-base font-bold text-[#F4F1EA]">No Completed Games Yet</h2>
              <p className="text-xs text-[#A3A8B4]">
                Finish a game against the AI in the Play tab to replay it move-by-move with coach explanations.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Saved Games List */}
              <div className="lg:col-span-4 space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {progress.savedGames.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      setSelectedGame(g);
                      setReplayIndex(0);
                      setAutoPlaying(false);
                      setReplayCoachData(null);
                    }}
                    className={`w-full text-left rounded-xl p-3.5 border transition-colors ${
                      selectedGame?.id === g.id
                        ? 'bg-[#D4AF37]/12 border-[#D4AF37]'
                        : 'bg-[#14161A] border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-[#D4AF37] uppercase">{g.result}</span>
                      <span className="text-[#A3A8B4] font-mono tabular-nums">
                        {new Date(g.date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-[#F4F1EA] mt-0.5">
                      {g.openingName}
                    </div>
                    <div className="text-xs text-[#A3A8B4]">
                      vs {g.difficulty} · {g.termination} · {g.moves.length} plies
                    </div>
                  </button>
                ))}
              </div>

              {/* Replay Board & Controls */}
              {selectedGame && (
                <div className="lg:col-span-8 space-y-4">
                  <EvalBar
                    evalCp={replayEvalCp}
                    mateIn={replayMateIn}
                    orientation={selectedGame.playerColor}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                    <div className="md:col-span-7 space-y-3">
                      <ChessBoard
                        fen={currentReplayFen}
                        orientation={selectedGame.playerColor}
                        interactive={false}
                        theme={progress.settings.boardTheme}
                        showCoordinates={progress.settings.showCoordinates}
                      />

                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAutoPlaying(false);
                            setReplayIndex(0);
                          }}
                          className="min-h-[42px] min-w-[42px] rounded-xl bg-[#14161A] border border-white/10 flex items-center justify-center text-[#F4F1EA]"
                          aria-label="First move"
                        >
                          <SkipBack className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAutoPlaying(false);
                            setReplayIndex((i) => Math.max(0, i - 1));
                          }}
                          className="min-h-[42px] min-w-[42px] rounded-xl bg-[#14161A] border border-white/10 flex items-center justify-center text-[#F4F1EA]"
                          aria-label="Previous move"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setAutoPlaying((p) => !p)}
                          className="min-h-[42px] px-4 rounded-xl bg-[#D4AF37] text-[#0B0C0E] text-xs font-semibold inline-flex items-center gap-1.5"
                        >
                          {autoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          <span>{autoPlaying ? 'Pause' : 'Auto'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAutoPlaying(false);
                            setReplayIndex((i) => Math.min(selectedGame.moves.length, i + 1));
                          }}
                          className="min-h-[42px] min-w-[42px] rounded-xl bg-[#14161A] border border-white/10 flex items-center justify-center text-[#F4F1EA]"
                          aria-label="Next move"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAutoPlaying(false);
                            setReplayIndex(selectedGame.moves.length);
                          }}
                          className="min-h-[42px] min-w-[42px] rounded-xl bg-[#14161A] border border-white/10 flex items-center justify-center text-[#F4F1EA]"
                          aria-label="Last move"
                        >
                          <SkipForward className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="md:col-span-5 space-y-3">
                      <div className="rounded-2xl bg-[#14161A] border border-white/10 p-4">
                        <div className="text-xs font-semibold text-[#F4F1EA] mb-2">
                          Move List ({replayIndex}/{selectedGame.moves.length})
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-[180px] overflow-y-auto font-mono text-xs">
                          {selectedGame.moves.map((san, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setAutoPlaying(false);
                                setReplayIndex(idx + 1);
                              }}
                              className={`px-2 py-1 rounded ${
                                replayIndex === idx + 1
                                  ? 'bg-[#D4AF37] text-[#0B0C0E] font-semibold'
                                  : 'bg-[#1B1E25] text-[#D7D2C8]'
                              }`}
                            >
                              {idx % 2 === 0 ? `${Math.floor(idx / 2) + 1}. ` : ''}
                              {san}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleExplainReplayMove}
                        disabled={replayCoachLoading}
                        className="w-full min-h-[44px] rounded-xl bg-[#D4AF37] text-[#0B0C0E] text-xs font-semibold inline-flex items-center justify-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>{replayCoachLoading ? 'Analyzing Move...' : 'Explain This Position'}</span>
                      </button>

                      {replayCoachData && (
                        <div className="rounded-2xl bg-[#14161A] border border-[#D4AF37]/30 p-4 space-y-2 text-xs">
                          <div className="font-semibold text-[#E8C766]">{replayCoachData.headline}</div>
                          <p className="text-[#D7D2C8] leading-relaxed">{replayCoachData.summary}</p>
                          <p className="text-[#A3A8B4] leading-relaxed">
                            <strong className="text-[#F4F1EA]">Plan: </strong>
                            {replayCoachData.recommendedPlan}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ===================== 3. ACHIEVEMENTS ===================== */}
      {activeTab === 'achievements' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ACHIEVEMENTS.map((ach) => {
            const isUnlocked = progress.unlockedAchievements.includes(ach.id);
            return (
              <div
                key={ach.id}
                className={`rounded-2xl p-4 border transition-colors ${
                  isUnlocked
                    ? 'bg-[#D4AF37]/10 border-[#D4AF37]/50'
                    : 'bg-[#14161A] border-white/10 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Award className={`w-5 h-5 ${isUnlocked ? 'text-[#D4AF37]' : 'text-[#6E7485]'}`} />
                  <span className="font-mono text-xs text-[#D4AF37] tabular-nums">
                    +{ach.xpReward} XP
                  </span>
                </div>
                <h3 className="text-sm font-bold text-[#F4F1EA]">{ach.title}</h3>
                <p className="text-xs text-[#A3A8B4] mt-1">{ach.description}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ===================== 4. SETTINGS ===================== */}
      {activeTab === 'settings' && (
        <div className="max-w-2xl space-y-4">
          <div className="rounded-2xl bg-[#14161A] border border-white/10 p-5 space-y-4">
            <h2 className="text-base font-bold text-[#F4F1EA]">Board & Gameplay Preferences</h2>

            <div>
              <label className="block text-xs text-[#A3A8B4] mb-2">Chessboard Theme</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { id: 'obsidian', label: 'Obsidian Gold' },
                    { id: 'walnut', label: 'Classic Walnut' },
                    { id: 'emerald', label: 'Tournament Green' },
                    { id: 'slate', label: 'Midnight Slate' },
                  ] as Array<{ id: BoardTheme; label: string }>
                ).map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => onUpdateSettings({ boardTheme: theme.id })}
                    className={`min-h-[44px] px-3 rounded-xl text-xs font-medium border transition-colors ${
                      progress.settings.boardTheme === theme.id
                        ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-[#E8C766]'
                        : 'bg-[#1B1E25] border-white/10 text-[#D7D2C8]'
                    }`}
                  >
                    {theme.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => onUpdateSettings({ soundEnabled: !progress.settings.soundEnabled })}
                className="w-full min-h-[48px] px-4 rounded-xl bg-[#1B1E25] flex items-center justify-between text-sm text-[#F4F1EA]"
              >
                <span className="flex items-center gap-2">
                  {progress.settings.soundEnabled ? (
                    <Volume2 className="w-4 h-4 text-[#D4AF37]" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-[#A3A8B4]" />
                  )}
                  Sound Effects
                </span>
                <span className="font-mono text-xs text-[#D4AF37]">
                  {progress.settings.soundEnabled ? 'ON' : 'OFF'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ showLegalMoves: !progress.settings.showLegalMoves })}
                className="w-full min-h-[48px] px-4 rounded-xl bg-[#1B1E25] flex items-center justify-between text-sm text-[#F4F1EA]"
              >
                <span>Highlight Legal Moves</span>
                <span className="font-mono text-xs text-[#D4AF37]">
                  {progress.settings.showLegalMoves ? 'ON' : 'OFF'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ showCoordinates: !progress.settings.showCoordinates })}
                className="w-full min-h-[48px] px-4 rounded-xl bg-[#1B1E25] flex items-center justify-between text-sm text-[#F4F1EA]"
              >
                <span>Show Board Coordinates (a–h, 1–8)</span>
                <span className="font-mono text-xs text-[#D4AF37]">
                  {progress.settings.showCoordinates ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-[#14161A] border border-white/10 p-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[#F4F1EA]">Install on Android / Offline</div>
              <div className="text-xs text-[#A3A8B4]">
                Works offline with local Stockfish engine & saved progress.
              </div>
            </div>
            <PWAInstallButton />
          </div>

          <div className="rounded-2xl bg-[#14161A] border border-rose-500/20 p-5">
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="min-h-[44px] px-4 rounded-xl bg-rose-500/15 text-rose-300 text-xs font-semibold inline-flex items-center gap-2 hover:bg-rose-500/25"
              >
                <Trash2 className="w-4 h-4" />
                <span>Reset Local Learning Progress</span>
              </button>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-rose-200">
                  Erase all XP, completed lessons, and saved games?
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="min-h-[40px] px-3 rounded-lg bg-[#1B1E25] text-xs text-[#F4F1EA]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onResetAllProgress();
                      setConfirmReset(false);
                      setSelectedGame(null);
                    }}
                    className="min-h-[40px] px-3 rounded-lg bg-rose-600 text-white text-xs font-semibold"
                  >
                    Confirm Reset
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

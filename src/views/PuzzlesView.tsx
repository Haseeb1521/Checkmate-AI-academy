import React, { useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import {
  Brain,
  CheckCircle2,
  Eye,
  EyeOff,
  Flame,
  HelpCircle,
  Play,
  Puzzle,
  RotateCcw,
  Target,
} from 'lucide-react';
import { ChessBoard } from '../components/ChessBoard';
import {
  getDailyPuzzle,
  GUESS_BEST_MOVE_POSITIONS,
  PUZZLES,
} from '../data/puzzles';
import { soundService } from '../services/sound';
import { formatEvalScore, stockfishEngine } from '../services/stockfishEngine';
import { getTodayKey } from '../services/storage';
import type { ChessPuzzle, UserSettings } from '../types/chess';

export type PuzzleSubTab = 'puzzles' | 'guess-best' | 'blindfold';

interface PuzzlesViewProps {
  initialSubTab?: PuzzleSubTab;
  settings: UserSettings;
  solvedPuzzles: string[];
  dailyPuzzlesCompleted: Record<string, boolean>;
  blindfoldBestStreak: number;
  onPuzzleSolved: (puzzleId: string, isDaily: boolean, xp: number) => void;
  onPuzzleAttempt: () => void;
  onGuessBestMoveSolved: (xp: number) => void;
  onBlindfoldStreakUpdate: (streak: number) => void;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];

function randomSquare(): string {
  return FILES[Math.floor(Math.random() * 8)] + RANKS[Math.floor(Math.random() * 8)];
}

function isLightSquare(sq: string): boolean {
  const f = FILES.indexOf(sq[0]) + 1;
  const r = Number(sq[1]);
  return (f + r) % 2 === 1;
}

export const PuzzlesView: React.FC<PuzzlesViewProps> = ({
  initialSubTab = 'puzzles',
  settings,
  solvedPuzzles,
  dailyPuzzlesCompleted,
  blindfoldBestStreak,
  onPuzzleSolved,
  onPuzzleAttempt,
  onGuessBestMoveSolved,
  onBlindfoldStreakUpdate,
}) => {
  const [subTab, setSubTab] = useState<PuzzleSubTab>(initialSubTab);

  // ================= DAILY & TACTICAL PUZZLES =================
  const todayKey = getTodayKey();
  const dailyPuzzle = useMemo(() => getDailyPuzzle(todayKey), [todayKey]);
  const isDailyDone = Boolean(dailyPuzzlesCompleted[todayKey]);

  const [difficultyFilter, setDifficultyFilter] = useState<string>('All');
  const [activePuzzle, setActivePuzzle] = useState<ChessPuzzle>(dailyPuzzle);
  const [puzzleFen, setPuzzleFen] = useState(dailyPuzzle.fen);
  const [solutionStep, setSolutionStep] = useState(0);
  const [puzzleStatus, setPuzzleStatus] = useState<'solving' | 'wrong' | 'solved' | 'revealed'>('solving');
  const [showHint, setShowHint] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

  // ================= GUESS THE BEST MOVE =================
  const [gbmIdx, setGbmIdx] = useState(0);
  const currentGbm = GUESS_BEST_MOVE_POSITIONS[gbmIdx];
  const [gbmFen, setGbmFen] = useState(currentGbm.fen);
  const [gbmEvaluating, setGbmEvaluating] = useState(false);
  const [gbmFeedback, setGbmFeedback] = useState<{
    grade: 'exact' | 'strong' | 'inaccurate';
    playedSan: string;
    playedEval: string;
    bestEval: string;
    explanation: string;
  } | null>(null);

  // ================= BLINDFOLD TRAINING =================
  const [blindfoldMode, setBlindfoldMode] = useState<'color' | 'coordinate' | 'knight-reach'>('color');
  const [targetSquare, setTargetSquare] = useState<string>(() => randomSquare());
  const [blindfoldStreak, setBlindfoldStreak] = useState(0);
  const [blindfoldFeedback, setBlindfoldFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [knightStartSq, setKnightStartSq] = useState<string>('d4');
  const [knightTargetSq, setKnightTargetSq] = useState<string>('f5');

  const selectPuzzle = (p: ChessPuzzle) => {
    setActivePuzzle(p);
    setPuzzleFen(p.fen);
    setSolutionStep(0);
    setPuzzleStatus('solving');
    setShowHint(false);
    setLastMove(null);
  };

  const handlePuzzleMove = (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n'): boolean => {
    if (puzzleStatus === 'solved' || puzzleStatus === 'revealed') return false;
    const expectedUci = activePuzzle.solutionMovesUci[solutionStep];
    const playedUci = from + to + (promotion ?? '');

    const sim = new Chess(puzzleFen);
    try {
      const m = sim.move({ from, to, promotion });
      if (!m) return false;

      onPuzzleAttempt();

      if (playedUci === expectedUci || (expectedUci.length === 4 && playedUci.startsWith(expectedUci))) {
        if (m.captured) soundService.playCapture();
        else soundService.playMove();

        const nextStep = solutionStep + 1;
        setPuzzleFen(sim.fen());
        setLastMove({ from: m.from, to: m.to });
        setShowHint(false);

        if (nextStep >= activePuzzle.solutionMovesUci.length) {
          soundService.playSuccess();
          setPuzzleStatus('solved');
          setSolutionStep(nextStep);
          const isDaily = activePuzzle.id === dailyPuzzle.id;
          onPuzzleSolved(activePuzzle.id, isDaily, isDaily ? 75 : 45);
          return true;
        }

        // Opponent auto-reply
        setSolutionStep(nextStep);
        setTimeout(() => {
          const replyUci = activePuzzle.solutionMovesUci[nextStep];
          if (!replyUci) return;
          const replyChess = new Chess(sim.fen());
          const replyMove = replyChess.move({
            from: replyUci.slice(0, 2),
            to: replyUci.slice(2, 4),
            promotion: replyUci[4],
          });
          if (replyMove) {
            setPuzzleFen(replyChess.fen());
            setLastMove({ from: replyMove.from, to: replyMove.to });
            setSolutionStep(nextStep + 1);
          }
        }, 350);
        return true;
      } else {
        soundService.playError();
        setPuzzleStatus('wrong');
        return false;
      }
    } catch {
      return false;
    }
  };

  const handleRevealSolution = () => {
    const sim = new Chess(activePuzzle.fen);
    let last: { from: string; to: string } | null = null;
    for (const uci of activePuzzle.solutionMovesUci) {
      const m = sim.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci[4],
      });
      if (m) last = { from: m.from, to: m.to };
    }
    setPuzzleFen(sim.fen());
    setLastMove(last);
    setPuzzleStatus('revealed');
    setShowHint(false);
  };

  // Guess the Best Move handler
  const handleGuessMove = async (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => {
    if (gbmEvaluating || gbmFeedback) return false;
    const sim = new Chess(currentGbm.fen);
    try {
      const moveObj = sim.move({ from, to, promotion });
      if (!moveObj) return false;
      const playedUci = from + to + (promotion ?? '');
      setGbmFen(sim.fen());
      setGbmEvaluating(true);

      const [bestEvalRes, afterPlayerRes] = await Promise.all([
        stockfishEngine.evaluatePosition(currentGbm.fen, 10, 350),
        stockfishEngine.evaluatePosition(sim.fen(), 10, 350),
      ]);

      const turnSign = new Chess(currentGbm.fen).turn() === 'w' ? 1 : -1;
      const diffCp = (bestEvalRes.evalCp - afterPlayerRes.evalCp) * turnSign;

      let grade: 'exact' | 'strong' | 'inaccurate' = 'inaccurate';
      if (playedUci === currentGbm.bestMoveUci || playedUci === bestEvalRes.bestMoveUci || diffCp <= 25) {
        grade = 'exact';
        soundService.playSuccess();
        onGuessBestMoveSolved(40);
      } else if (diffCp <= 90) {
        grade = 'strong';
        soundService.playMove();
        onGuessBestMoveSolved(20);
      } else {
        soundService.playError();
      }

      setGbmFeedback({
        grade,
        playedSan: moveObj.san,
        playedEval: formatEvalScore(afterPlayerRes.evalCp, afterPlayerRes.mateIn),
        bestEval: formatEvalScore(bestEvalRes.evalCp, bestEvalRes.mateIn),
        explanation: currentGbm.explanation,
      });
      setGbmEvaluating(false);
      return true;
    } catch {
      setGbmEvaluating(false);
      return false;
    }
  };

  // Blindfold helpers
  const nextBlindfoldChallenge = (mode = blindfoldMode) => {
    setBlindfoldFeedback('idle');
    if (mode === 'knight-reach') {
      const start = randomSquare();
      const sFile = FILES.indexOf(start[0]);
      const sRank = Number(start[1]) - 1;
      const shouldBeReachable = Math.random() < 0.55;
      const deltas = [
        [1, 2],
        [2, 1],
        [-1, 2],
        [-2, 1],
        [1, -2],
        [2, -1],
        [-1, -2],
        [-2, -1],
      ].filter(([df, dr]) => sFile + df >= 0 && sFile + df < 8 && sRank + dr >= 0 && sRank + dr < 8);
      if (shouldBeReachable && deltas.length > 0) {
        const [df, dr] = deltas[Math.floor(Math.random() * deltas.length)];
        setKnightStartSq(start);
        setKnightTargetSq(`${FILES[sFile + df]}${sRank + dr + 1}`);
      } else {
        setKnightStartSq(start);
        let rand = randomSquare();
        while (rand === start) rand = randomSquare();
        setKnightTargetSq(rand);
      }
    } else {
      setTargetSquare(randomSquare());
    }
  };

  const handleBlindfoldAnswer = (isCorrect: boolean) => {
    if (isCorrect) {
      soundService.playSuccess();
      const nextStreak = blindfoldStreak + 1;
      setBlindfoldStreak(nextStreak);
      setBlindfoldFeedback('correct');
      onBlindfoldStreakUpdate(nextStreak);
      setTimeout(() => nextBlindfoldChallenge(), 550);
    } else {
      soundService.playError();
      setBlindfoldStreak(0);
      setBlindfoldFeedback('wrong');
    }
  };

  const isKnightOneMove = (a: string, b: string) => {
    const df = Math.abs(FILES.indexOf(a[0]) - FILES.indexOf(b[0]));
    const dr = Math.abs(Number(a[1]) - Number(b[1]));
    return (df === 1 && dr === 2) || (df === 2 && dr === 1);
  };

  const filteredPuzzles = useMemo(() => {
    if (difficultyFilter === 'All') return PUZZLES;
    return PUZZLES.filter((p) => p.difficulty === difficultyFilter);
  }, [difficultyFilter]);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 pt-4 pb-24 lg:pb-10">
      {/* Header + Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#F4F1EA]">Puzzles & Tactical Vision</h1>
          <p className="text-xs text-[#A3A8B4] mt-0.5">
            Daily challenge, mate patterns, best-move intuition, and blindfold visualization
          </p>
        </div>

        <div className="flex items-center bg-[#14161A] border border-white/10 rounded-xl p-1 self-start overflow-x-auto max-w-full">
          {(
            [
              { id: 'puzzles', label: 'Daily & Tactics', icon: Puzzle },
              { id: 'guess-best', label: 'Best Move', icon: Target },
              { id: 'blindfold', label: 'Blindfold', icon: EyeOff },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSubTab(t.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  subTab === t.id
                    ? 'bg-[#D4AF37] text-[#0B0C0E] font-semibold'
                    : 'text-[#A3A8B4] hover:text-[#F4F1EA]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===================== 1. DAILY & TACTICAL PUZZLES ===================== */}
      {subTab === 'puzzles' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Active Puzzle Board */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#14161A] border border-white/10">
              <div>
                <div className="text-xs font-mono text-[#D4AF37]">
                  {activePuzzle.id === dailyPuzzle.id ? 'Daily Chess Challenge · ' : ''}
                  {activePuzzle.difficulty} · Rating {activePuzzle.rating}
                </div>
                <div className="text-sm font-semibold text-[#F4F1EA]">
                  {activePuzzle.title} — {activePuzzle.theme}
                </div>
              </div>
              <span className="text-xs font-medium text-[#E8C766]">
                {new Chess(puzzleFen).turn() === 'w' ? 'White to move' : 'Black to move'}
              </span>
            </div>

            <ChessBoard
              fen={puzzleFen}
              orientation={new Chess(activePuzzle.fen).turn()}
              interactive={puzzleStatus === 'solving' || puzzleStatus === 'wrong'}
              playerColor={new Chess(activePuzzle.fen).turn()}
              theme={settings.boardTheme}
              showLegalMoves={settings.showLegalMoves}
              showCoordinates={settings.showCoordinates}
              lastMove={lastMove}
              arrow={
                showHint && activePuzzle.solutionMovesUci[solutionStep]
                  ? {
                      from: activePuzzle.solutionMovesUci[solutionStep].slice(0, 2),
                      to: activePuzzle.solutionMovesUci[solutionStep].slice(2, 4),
                    }
                  : null
              }
              onMove={handlePuzzleMove}
            />

            {puzzleStatus === 'wrong' && (
              <div className="rounded-xl bg-rose-500/15 border border-rose-500/40 p-3 text-xs text-rose-200">
                Not the strongest continuation—look for checks, captures, or mating threats!
              </div>
            )}

            {showHint && puzzleStatus !== 'solved' && (
              <div className="rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 p-3 text-xs text-[#E8C766]">
                Hint: {activePuzzle.hint}
              </div>
            )}

            {(puzzleStatus === 'solved' || puzzleStatus === 'revealed') && (
              <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/40 p-3.5 text-xs text-emerald-200 leading-relaxed">
                <strong className="block mb-1">
                  {puzzleStatus === 'solved' ? 'Puzzle Solved!' : 'Solution Revealed'}
                </strong>
                {activePuzzle.explanation}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {puzzleStatus !== 'solved' && puzzleStatus !== 'revealed' && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowHint(true)}
                    className="min-h-[44px] px-4 rounded-xl bg-[#14161A] border border-white/10 text-xs font-medium text-[#E8C766] inline-flex items-center gap-1.5"
                  >
                    <HelpCircle className="w-4 h-4" />
                    <span>Hint</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRevealSolution}
                    className="min-h-[44px] px-4 rounded-xl bg-[#14161A] border border-white/10 text-xs font-medium text-[#D7D2C8] inline-flex items-center gap-1.5"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Show Solution</span>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => selectPuzzle(activePuzzle)}
                className="min-h-[44px] px-4 rounded-xl bg-[#14161A] border border-white/10 text-xs font-medium text-[#F4F1EA] inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Retry</span>
              </button>
            </div>
          </div>

          {/* Right: Daily Banner + Puzzle Progression Library */}
          <div className="lg:col-span-5 space-y-4">
            <button
              type="button"
              onClick={() => selectPuzzle(dailyPuzzle)}
              className="w-full text-left rounded-2xl bg-[#14161A] border border-[#D4AF37]/40 p-4 hover:bg-[#191C22] transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-mono text-[#D4AF37]">
                  <Flame className="w-4 h-4" />
                  <span>Daily Challenge · {todayKey}</span>
                </div>
                {isDailyDone && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                    <CheckCircle2 className="w-4 h-4" /> Solved
                  </span>
                )}
              </div>
              <div className="text-base font-bold text-[#F4F1EA] mt-1">{dailyPuzzle.title}</div>
              <div className="text-xs text-[#A3A8B4] mt-0.5">
                {dailyPuzzle.difficulty} · {dailyPuzzle.theme} · +75 XP
              </div>
            </button>

            <div className="rounded-2xl bg-[#14161A] border border-white/10 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#F4F1EA]">Puzzle Progression</h2>
                <span className="font-mono text-xs text-[#D4AF37] tabular-nums">
                  {solvedPuzzles.length}/{PUZZLES.length}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {['All', 'Mate in 1', 'Mate in 2', 'Mate in 3', 'Tactic'].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setDifficultyFilter(f)}
                    className={`px-2.5 py-1.5 min-h-[34px] rounded-lg text-[11px] font-medium transition-colors ${
                      difficultyFilter === f
                        ? 'bg-[#D4AF37] text-[#0B0C0E] font-semibold'
                        : 'bg-[#1B1E25] text-[#A3A8B4] hover:text-[#F4F1EA]'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <div className="max-h-[320px] overflow-y-auto space-y-1.5 pr-1">
                {filteredPuzzles.map((p) => {
                  const isSolved = solvedPuzzles.includes(p.id);
                  const isSelected = activePuzzle.id === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectPuzzle(p)}
                      className={`w-full text-left rounded-xl p-3 border transition-colors flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-[#D4AF37]/12 border-[#D4AF37]'
                          : 'bg-[#1B1E25] border-transparent hover:border-white/15'
                      }`}
                    >
                      <div>
                        <div className="text-[11px] font-mono text-[#D4AF37]">
                          {p.difficulty} · {p.rating}
                        </div>
                        <div className="text-xs font-semibold text-[#F4F1EA]">{p.title}</div>
                      </div>
                      {isSolved && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== 2. GUESS THE BEST MOVE ===================== */}
      {subTab === 'guess-best' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-6">
            <ChessBoard
              fen={gbmFen}
              orientation={new Chess(currentGbm.fen).turn()}
              interactive={!gbmEvaluating && !gbmFeedback}
              playerColor={new Chess(currentGbm.fen).turn()}
              theme={settings.boardTheme}
              showLegalMoves={settings.showLegalMoves}
              showCoordinates={settings.showCoordinates}
              arrow={
                gbmFeedback
                  ? {
                      from: currentGbm.bestMoveUci.slice(0, 2),
                      to: currentGbm.bestMoveUci.slice(2, 4),
                    }
                  : null
              }
              onMove={handleGuessMove}
            />
          </div>

          <div className="lg:col-span-6 rounded-2xl bg-[#14161A] border border-white/10 p-5 space-y-4">
            <div>
              <div className="text-xs font-mono text-[#D4AF37]">
                Guess the Best Move · {currentGbm.phase} ({gbmIdx + 1}/{GUESS_BEST_MOVE_POSITIONS.length})
              </div>
              <h2 className="text-xl font-bold text-[#F4F1EA] mt-0.5">{currentGbm.title}</h2>
              <p className="text-xs text-[#A3A8B4] mt-1">
                Play the strongest move on the board. Stockfish will compare your choice against the top engine line.
              </p>
            </div>

            {gbmEvaluating && (
              <div className="rounded-xl bg-[#1B1E25] p-4 text-xs text-[#D4AF37] flex items-center gap-2">
                <Brain className="w-4 h-4 animate-spin" />
                <span>Evaluating your candidate move with Stockfish...</span>
              </div>
            )}

            {gbmFeedback && (
              <div
                className={`rounded-xl border p-4 space-y-2 ${
                  gbmFeedback.grade === 'exact'
                    ? 'bg-emerald-500/15 border-emerald-500/40'
                    : gbmFeedback.grade === 'strong'
                    ? 'bg-[#D4AF37]/12 border-[#D4AF37]/40'
                    : 'bg-amber-500/12 border-amber-500/40'
                }`}
              >
                <div className="text-sm font-bold text-[#F4F1EA]">
                  {gbmFeedback.grade === 'exact'
                    ? `Grandmaster Choice! (${gbmFeedback.playedSan})`
                    : gbmFeedback.grade === 'strong'
                    ? `Strong Alternative (${gbmFeedback.playedSan})`
                    : `Missed Strongest Move (${gbmFeedback.playedSan})`}
                </div>
                <div className="text-xs font-mono text-[#D7D2C8] tabular-nums">
                  Your move eval: {gbmFeedback.playedEval} · Best ({currentGbm.bestMoveSan}):{' '}
                  {gbmFeedback.bestEval}
                </div>
                <p className="text-xs text-[#D7D2C8] leading-relaxed">{gbmFeedback.explanation}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setGbmFen(currentGbm.fen);
                  setGbmFeedback(null);
                }}
                className="min-h-[44px] px-4 rounded-xl bg-[#1B1E25] text-xs font-medium text-[#F4F1EA] inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset Board</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = (gbmIdx + 1) % GUESS_BEST_MOVE_POSITIONS.length;
                  setGbmIdx(next);
                  setGbmFen(GUESS_BEST_MOVE_POSITIONS[next].fen);
                  setGbmFeedback(null);
                }}
                className="min-h-[44px] px-5 rounded-xl bg-[#D4AF37] text-[#0B0C0E] text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Play className="w-4 h-4" />
                <span>Next Position</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== 3. BLINDFOLD TRAINING ===================== */}
      {subTab === 'blindfold' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-6">
            <ChessBoard
              fen="8/8/8/8/8/8/8/8 w - - 0 1"
              interactive={false}
              blindfoldMode={true}
              showCoordinates={blindfoldMode !== 'coordinate' && settings.showCoordinates}
              theme={settings.boardTheme}
              highlightSquares={
                blindfoldMode === 'knight-reach'
                  ? [knightStartSq, knightTargetSq]
                  : blindfoldFeedback !== 'idle'
                  ? [targetSquare]
                  : []
              }
              onSquareTap={(sq) => {
                if (blindfoldMode === 'coordinate') {
                  handleBlindfoldAnswer(sq === targetSquare);
                }
              }}
            />
          </div>

          <div className="lg:col-span-6 rounded-2xl bg-[#14161A] border border-white/10 p-5 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-mono text-[#D4AF37]">Blindfold Visualization</div>
                <h2 className="text-xl font-bold text-[#F4F1EA]">Train Your Mind’s Eye</h2>
              </div>
              <div className="text-right">
                <div className="text-lg font-mono font-bold text-[#D4AF37] tabular-nums">
                  {blindfoldStreak}
                </div>
                <div className="text-[11px] text-[#A3A8B4] tabular-nums">
                  Best: {blindfoldBestStreak}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'color', label: 'Square Color' },
                  { id: 'coordinate', label: 'Find Square' },
                  { id: 'knight-reach', label: 'Knight Geometry' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setBlindfoldMode(m.id);
                    setBlindfoldStreak(0);
                    nextBlindfoldChallenge(m.id);
                  }}
                  className={`px-3 py-2 min-h-[38px] rounded-xl text-xs font-medium ${
                    blindfoldMode === m.id
                      ? 'bg-[#D4AF37] text-[#0B0C0E] font-semibold'
                      : 'bg-[#1B1E25] text-[#A3A8B4] hover:text-[#F4F1EA]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {blindfoldMode === 'color' && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-[#1B1E25] p-6 text-center">
                  <div className="text-xs text-[#A3A8B4] mb-1">Without looking at labels, what color is:</div>
                  <div className="text-4xl font-mono font-bold text-[#E8C766]">{targetSquare}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleBlindfoldAnswer(isLightSquare(targetSquare))}
                    className="min-h-[52px] rounded-xl bg-[#EAE4D3] text-[#111318] font-bold text-sm hover:opacity-90"
                  >
                    Light Square
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBlindfoldAnswer(!isLightSquare(targetSquare))}
                    className="min-h-[52px] rounded-xl bg-[#272B35] border border-white/15 text-[#F4F1EA] font-bold text-sm hover:border-[#D4AF37]"
                  >
                    Dark Square
                  </button>
                </div>
              </div>
            )}

            {blindfoldMode === 'coordinate' && (
              <div className="rounded-2xl bg-[#1B1E25] p-6 text-center space-y-2">
                <div className="text-xs text-[#A3A8B4]">Tap this exact square on the empty board:</div>
                <div className="text-4xl font-mono font-bold text-[#E8C766]">{targetSquare}</div>
                <p className="text-xs text-[#A3A8B4]">Coordinates are hidden to build true board memory.</p>
              </div>
            )}

            {blindfoldMode === 'knight-reach' && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-[#1B1E25] p-6 text-center">
                  <div className="text-xs text-[#A3A8B4] mb-1">
                    Can a Knight move in ONE jump from
                  </div>
                  <div className="text-3xl font-mono font-bold text-[#E8C766]">
                    {knightStartSq} → {knightTargetSq}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleBlindfoldAnswer(isKnightOneMove(knightStartSq, knightTargetSq))}
                    className="min-h-[52px] rounded-xl bg-[#D4AF37] text-[#0B0C0E] font-bold text-sm"
                  >
                    Yes, 1 Move
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBlindfoldAnswer(!isKnightOneMove(knightStartSq, knightTargetSq))}
                    className="min-h-[52px] rounded-xl bg-[#272B35] border border-white/15 text-[#F4F1EA] font-bold text-sm"
                  >
                    No
                  </button>
                </div>
              </div>
            )}

            {blindfoldFeedback === 'correct' && (
              <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/40 p-3 text-xs text-emerald-200 text-center">
                Sharp visualization! Streak +1
              </div>
            )}
            {blindfoldFeedback === 'wrong' && (
              <div className="rounded-xl bg-rose-500/15 border border-rose-500/40 p-3 text-xs text-rose-200 text-center">
                Streak reset—take a breath and visualize the ranks & files!
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

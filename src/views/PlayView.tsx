import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import {
  Brain,
  ChevronLeft,
  ChevronRight,
  Flag,
  Lightbulb,
  RotateCcw,
  Sparkles,
  Swords,
  Undo2,
  X,
} from 'lucide-react';
import { ChessBoard } from '../components/ChessBoard';
import { EvalBar } from '../components/EvalBar';
import { explainPositionWithCoach, generatePostGameCoachFeedback } from '../services/coachService';
import { soundService } from '../services/sound';
import { stockfishEngine } from '../services/stockfishEngine';
import type {
  AIDifficulty,
  CoachExplanation,
  GameReviewReport,
  PieceColor,
  SavedGame,
  UserSettings,
} from '../types/chess';

interface PlayViewProps {
  settings: UserSettings;
  initialSetup?: {
    fen?: string;
    playerColor?: PieceColor;
    openingName?: string;
    difficulty?: AIDifficulty;
  } | null;
  onClearInitialSetup?: () => void;
  onGameCompleted: (game: SavedGame) => void;
}

const DIFFICULTIES: Array<{ id: AIDifficulty; label: string; elo: string }> = [
  { id: 'beginner', label: 'Beginner', elo: '450' },
  { id: 'easy', label: 'Easy', elo: '750' },
  { id: 'medium', label: 'Medium', elo: '1100' },
  { id: 'hard', label: 'Hard', elo: '1500' },
  { id: 'expert', label: 'Expert', elo: '1900' },
];

const PIECE_POINTS: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const PIECE_GLYPHS: Record<PieceColor, Record<string, string>> = {
  w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕' },
  b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' },
};

export const PlayView: React.FC<PlayViewProps> = ({
  settings,
  initialSetup,
  onClearInitialSetup,
  onGameCompleted,
}) => {
  const [difficulty, setDifficulty] = useState<AIDifficulty>(initialSetup?.difficulty ?? 'easy');
  const [playerColor, setPlayerColor] = useState<PieceColor>(initialSetup?.playerColor ?? 'w');
  const [orientation, setOrientation] = useState<PieceColor>(initialSetup?.playerColor ?? 'w');
  const [openingName, setOpeningName] = useState<string>(initialSetup?.openingName ?? 'Standard Game');

  const [startFen, setStartFen] = useState<string>(
    initialSetup?.fen ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
  );
  const [fen, setFen] = useState<string>(startFen);
  const [movesSan, setMovesSan] = useState<string[]>([]);
  const [fensHistory, setFensHistory] = useState<string[]>([startFen]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [gameOverState, setGameOverState] = useState<{
    result: 'win' | 'loss' | 'draw';
    termination: string;
  } | null>(null);

  const [isAiThinking, setIsAiThinking] = useState(false);
  const [evalCp, setEvalCp] = useState(0);
  const [mateIn, setMateIn] = useState<number | null>(null);

  // Coach Drawer ("Explain This Position")
  const [coachOpen, setCoachOpen] = useState(false);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachData, setCoachData] = useState<CoachExplanation | null>(null);
  const [coachBestArrow, setCoachBestArrow] = useState<{ from: string; to: string } | null>(null);
  const [coachQuestion, setCoachQuestion] = useState('');

  // Post-Game Review
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewReport, setReviewReport] = useState<GameReviewReport | null>(null);
  const [reviewPlyIndex, setReviewPlyIndex] = useState<number | null>(null);

  const gameSavedRef = useRef(false);
  const aiGenerationRef = useRef(0);

  // Apply external initialSetup when arriving from Opening Library
  useEffect(() => {
    if (!initialSetup) return;
    const nextFen =
      initialSetup.fen ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const nextColor = initialSetup.playerColor ?? 'w';
    aiGenerationRef.current++;
    setDifficulty(initialSetup.difficulty ?? 'easy');
    setPlayerColor(nextColor);
    setOrientation(nextColor);
    setOpeningName(initialSetup.openingName ?? 'Custom Position');
    setStartFen(nextFen);
    setFen(nextFen);
    setMovesSan([]);
    setFensHistory([nextFen]);
    setLastMove(null);
    setGameOverState(null);
    setReviewReport(null);
    setReviewPlyIndex(null);
    setCoachData(null);
    setCoachBestArrow(null);
    gameSavedRef.current = false;
    onClearInitialSetup?.();
  }, [initialSetup, onClearInitialSetup]);

  const displayedFen =
    reviewPlyIndex !== null && reviewReport?.analyzedMoves[reviewPlyIndex]
      ? reviewReport.analyzedMoves[reviewPlyIndex].fenAfter
      : fen;

  const chess = useMemo(() => new Chess(displayedFen), [displayedFen]);

  // Captured material summary
  const materialInfo = useMemo(() => {
    const startCounts: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
    const currentCounts: Record<PieceColor, Record<string, number>> = {
      w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
      b: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    };
    const board = chess.board();
    for (const row of board) {
      for (const piece of row) {
        if (piece && piece.type !== 'k') {
          currentCounts[piece.color as PieceColor][piece.type]++;
        }
      }
    }
    const capturedByWhite: string[] = [];
    const capturedByBlack: string[] = [];
    let whiteScore = 0;
    let blackScore = 0;

    for (const t of ['q', 'r', 'b', 'n', 'p']) {
      const missingBlack = Math.max(0, startCounts[t] - currentCounts.b[t]);
      const missingWhite = Math.max(0, startCounts[t] - currentCounts.w[t]);
      for (let i = 0; i < missingBlack; i++) capturedByWhite.push(PIECE_GLYPHS.b[t]);
      for (let i = 0; i < missingWhite; i++) capturedByBlack.push(PIECE_GLYPHS.w[t]);
      whiteScore += currentCounts.w[t] * PIECE_POINTS[t];
      blackScore += currentCounts.b[t] * PIECE_POINTS[t];
    }

    return {
      capturedByWhite,
      capturedByBlack,
      whiteLead: whiteScore - blackScore,
    };
  }, [chess]);

  const finishGame = useCallback(
    (finalChess: Chess, nextMoves: string[], nextFens: string[], forcedResult?: 'loss' | 'draw', forcedTerm?: string) => {
      if (gameSavedRef.current) return;
      gameSavedRef.current = true;

      let result: 'win' | 'loss' | 'draw' = forcedResult ?? 'draw';
      let termination = forcedTerm ?? 'Draw';

      if (!forcedResult) {
        if (finalChess.isCheckmate()) {
          const winner = finalChess.turn() === 'w' ? 'b' : 'w';
          result = winner === playerColor ? 'win' : 'loss';
          termination = 'Checkmate';
        } else if (finalChess.isStalemate()) {
          result = 'draw';
          termination = 'Stalemate';
        } else if (finalChess.isInsufficientMaterial()) {
          result = 'draw';
          termination = 'Insufficient Material';
        } else if (finalChess.isThreefoldRepetition()) {
          result = 'draw';
          termination = 'Threefold Repetition';
        } else {
          result = 'draw';
          termination = '50-Move Rule';
        }
      }

      if (result === 'win') soundService.playSuccess();
      setGameOverState({ result, termination });

      const saved: SavedGame = {
        id: `game-${Date.now()}`,
        date: new Date().toISOString(),
        playerColor,
        difficulty,
        result,
        termination,
        moves: nextMoves,
        fens: nextFens,
        pgn: finalChess.pgn(),
        openingName,
      };
      onGameCompleted(saved);
    },
    [difficulty, onGameCompleted, openingName, playerColor]
  );

  const updateEvalAsync = useCallback(async (targetFen: string, generation: number) => {
    try {
      const ev = await stockfishEngine.evaluatePosition(targetFen, 9, 250);
      if (aiGenerationRef.current !== generation) return;
      setEvalCp(ev.evalCp);
      setMateIn(ev.mateIn);
    } catch {
      // Ignore eval cancel
    }
  }, []);

  // Trigger AI move whenever it's AI's turn
  useEffect(() => {
    if (gameOverState || reviewPlyIndex !== null) return;
    const current = new Chess(fen);
    if (current.isGameOver()) {
      finishGame(current, movesSan, fensHistory);
      return;
    }

    if (current.turn() === playerColor) {
      return;
    }

    const gen = ++aiGenerationRef.current;
    setIsAiThinking(true);

    const timer = setTimeout(async () => {
      try {
        const aiResult = await stockfishEngine.getBestMoveForDifficulty(fen, difficulty);
        if (aiGenerationRef.current !== gen) return;

        const nextGame = new Chess(fen);
        let moveObj = null;
        if (aiResult.moveUci && aiResult.moveUci.length >= 4) {
          try {
            moveObj = nextGame.move({
              from: aiResult.moveUci.slice(0, 2),
              to: aiResult.moveUci.slice(2, 4),
              promotion: aiResult.moveUci.length > 4 ? aiResult.moveUci[4] : 'q',
            });
          } catch {
            moveObj = null;
          }
        }
        if (!moveObj) {
          const legal = nextGame.moves({ verbose: true });
          if (legal.length > 0) moveObj = nextGame.move(legal[0]);
        }

        if (moveObj) {
          if (nextGame.inCheck()) soundService.playCheck();
          else if (moveObj.captured) soundService.playCapture();
          else if (moveObj.flags.includes('k') || moveObj.flags.includes('q')) soundService.playCastle();
          else soundService.playMove();

          const nextFen = nextGame.fen();
          const nextMoves = [...movesSan, moveObj.san];
          const nextFens = [...fensHistory, nextFen];
          setFen(nextFen);
          setMovesSan(nextMoves);
          setFensHistory(nextFens);
          setLastMove({ from: moveObj.from, to: moveObj.to });
          setCoachBestArrow(null);

          if (nextGame.isGameOver()) {
            finishGame(nextGame, nextMoves, nextFens);
          } else {
            updateEvalAsync(nextFen, gen);
          }
        }
      } finally {
        if (aiGenerationRef.current === gen) {
          setIsAiThinking(false);
        }
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [difficulty, fen, fensHistory, finishGame, gameOverState, movesSan, playerColor, reviewPlyIndex, updateEvalAsync]);

  const handlePlayerMove = (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n'): boolean => {
    if (gameOverState || isAiThinking || reviewPlyIndex !== null) return false;
    const current = new Chess(fen);
    if (current.turn() !== playerColor) return false;

    try {
      const moveObj = current.move({ from, to, promotion });
      if (!moveObj) return false;

      if (current.inCheck()) soundService.playCheck();
      else if (moveObj.captured) soundService.playCapture();
      else if (moveObj.flags.includes('k') || moveObj.flags.includes('q')) soundService.playCastle();
      else soundService.playMove();

      const nextFen = current.fen();
      const nextMoves = [...movesSan, moveObj.san];
      const nextFens = [...fensHistory, nextFen];

      setFen(nextFen);
      setMovesSan(nextMoves);
      setFensHistory(nextFens);
      setLastMove({ from: moveObj.from, to: moveObj.to });
      setCoachBestArrow(null);
      setCoachData(null);

      if (current.isGameOver()) {
        finishGame(current, nextMoves, nextFens);
      } else {
        updateEvalAsync(nextFen, aiGenerationRef.current);
      }
      return true;
    } catch {
      return false;
    }
  };

  const handleStartNewGame = (newColor: PieceColor = playerColor, newDiff: AIDifficulty = difficulty) => {
    aiGenerationRef.current++;
    const freshFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    setPlayerColor(newColor);
    setOrientation(newColor);
    setDifficulty(newDiff);
    setOpeningName('Standard Game');
    setStartFen(freshFen);
    setFen(freshFen);
    setMovesSan([]);
    setFensHistory([freshFen]);
    setLastMove(null);
    setGameOverState(null);
    setIsAiThinking(false);
    setEvalCp(0);
    setMateIn(null);
    setReviewReport(null);
    setReviewPlyIndex(null);
    setCoachData(null);
    setCoachBestArrow(null);
    gameSavedRef.current = false;
  };

  const handleUndo = () => {
    if (isAiThinking || gameOverState || movesSan.length === 0) return;
    aiGenerationRef.current++;
    const pliesToPop = new Chess(fen).turn() === playerColor && movesSan.length >= 2 ? 2 : 1;
    const nextMoves = movesSan.slice(0, movesSan.length - pliesToPop);
    const nextFens = fensHistory.slice(0, fensHistory.length - pliesToPop);
    const targetFen = nextFens[nextFens.length - 1] ?? startFen;

    setMovesSan(nextMoves);
    setFensHistory(nextFens);
    setFen(targetFen);
    setLastMove(null);
    setCoachBestArrow(null);
    setCoachData(null);
    updateEvalAsync(targetFen, aiGenerationRef.current);
  };

  const handleResign = () => {
    if (gameOverState || movesSan.length === 0) return;
    aiGenerationRef.current++;
    setIsAiThinking(false);
    finishGame(new Chess(fen), movesSan, fensHistory, 'loss', 'Resignation');
  };

  const handleExplainPosition = async (customQ?: string) => {
    setCoachOpen(true);
    setCoachLoading(true);
    setCoachBestArrow(null);
    try {
      const targetFen = displayedFen;
      const ev = await stockfishEngine.evaluatePosition(targetFen, 11, 450);
      if (ev.bestMoveUci.length >= 4) {
        setCoachBestArrow({ from: ev.bestMoveUci.slice(0, 2), to: ev.bestMoveUci.slice(2, 4) });
      }
      const explanation = await explainPositionWithCoach({
        fen: targetFen,
        lastMove: movesSan[movesSan.length - 1],
        userQuestion: customQ || undefined,
        playerColor,
        openingName,
        moveHistory: movesSan,
      });
      setCoachData(explanation);
    } finally {
      setCoachLoading(false);
    }
  };

  const handleAnalyzeGame = async () => {
    if (movesSan.length === 0) return;
    setReviewLoading(true);
    try {
      const rawReport = await stockfishEngine.analyzeCompletedGame(fensHistory, movesSan, playerColor);
      const enriched = await generatePostGameCoachFeedback({
        playerColor,
        result: gameOverState?.result ?? 'draw',
        termination: gameOverState?.termination ?? 'Completed',
        difficulty,
        openingName,
        report: rawReport,
      });
      setReviewReport(enriched);
      setReviewPlyIndex(movesSan.length - 1);
    } finally {
      setReviewLoading(false);
    }
  };

  // Paired move list for algebraic display
  const movePairs = useMemo(() => {
    const pairs: Array<{ moveNum: number; white?: string; black?: string; wIdx: number; bIdx: number }> = [];
    for (let i = 0; i < movesSan.length; i += 2) {
      pairs.push({
        moveNum: Math.floor(i / 2) + 1,
        white: movesSan[i],
        black: movesSan[i + 1],
        wIdx: i,
        bIdx: i + 1,
      });
    }
    return pairs;
  }, [movesSan]);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 pt-4 pb-24 lg:pb-10">
      {/* Top Setup Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#F4F1EA]">Play vs Stockfish AI</h1>
          <p className="text-xs text-[#A3A8B4] mt-0.5">
            {openingName} · Playing {playerColor === 'w' ? 'White' : 'Black'} ·{' '}
            {DIFFICULTIES.find((d) => d.id === difficulty)?.label} (Elo ~
            {DIFFICULTIES.find((d) => d.id === difficulty)?.elo})
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#14161A] border border-white/10 rounded-xl p-1">
            {(['w', 'b'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => handleStartNewGame(c, difficulty)}
                className={`px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  playerColor === c
                    ? 'bg-[#D4AF37] text-[#0B0C0E] font-semibold'
                    : 'text-[#A3A8B4] hover:text-[#F4F1EA]'
                }`}
              >
                {c === 'w' ? 'White' : 'Black'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setOrientation((prev) => (prev === 'w' ? 'b' : 'w'))}
            className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-[#14161A] border border-white/10 text-xs font-medium text-[#D7D2C8] hover:border-[#D4AF37]/50 transition-colors"
            title="Flip board"
          >
            Flip
          </button>
        </div>
      </div>

      {/* Difficulty Selector */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4">
        {DIFFICULTIES.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => handleStartNewGame(playerColor, d.id)}
            className={`px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 border ${
              difficulty === d.id
                ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-[#E8C766]'
                : 'bg-[#14161A] border-white/10 text-[#A3A8B4] hover:text-[#F4F1EA]'
            }`}
          >
            {d.label} · {d.elo}
          </button>
        ))}
      </div>

      {/* Main 2-Column Arena */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Board + Player Bars */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          {/* Opponent Bar */}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#14161A] border border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#20242D] flex items-center justify-center text-[#D4AF37]">
                <Brain className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-[#F4F1EA]">
                  Stockfish ({DIFFICULTIES.find((d) => d.id === difficulty)?.label})
                </div>
                <div className="text-xs text-[#A3A8B4]">
                  {isAiThinking ? 'Calculating move...' : chess.turn() !== playerColor && !gameOverState ? 'Your opponent’s turn' : 'Ready'}
                </div>
              </div>
            </div>
            <div className="text-sm tracking-tight text-[#D7D2C8]">
              {(orientation === 'w' ? materialInfo.capturedByBlack : materialInfo.capturedByWhite).join('')}
              {((orientation === 'w' && materialInfo.whiteLead < 0) ||
                (orientation === 'b' && materialInfo.whiteLead > 0)) && (
                <span className="ml-1.5 font-mono text-xs text-[#D4AF37] tabular-nums">
                  +{Math.abs(materialInfo.whiteLead)}
                </span>
              )}
            </div>
          </div>

          {/* Evaluation Bar */}
          <EvalBar evalCp={evalCp} mateIn={mateIn} orientation={orientation} />

          {/* Interactive Chessboard */}
          <ChessBoard
            fen={displayedFen}
            orientation={orientation}
            interactive={!gameOverState && !isAiThinking && reviewPlyIndex === null}
            playerColor={playerColor}
            showLegalMoves={settings.showLegalMoves}
            showCoordinates={settings.showCoordinates}
            theme={settings.boardTheme}
            lastMove={lastMove}
            arrow={coachBestArrow}
            onMove={handlePlayerMove}
          />

          {/* Player Bar */}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#14161A] border border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/20 flex items-center justify-center text-[#E8C766]">
                <Swords className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-[#F4F1EA]">
                  You ({playerColor === 'w' ? 'White' : 'Black'})
                </div>
                <div className="text-xs text-[#A3A8B4]">
                  {gameOverState
                    ? `${gameOverState.result.toUpperCase()} · ${gameOverState.termination}`
                    : chess.turn() === playerColor
                    ? chess.inCheck()
                      ? 'Check! Find a safe reply'
                      : 'Your turn to move'
                    : 'Waiting for AI'}
                </div>
              </div>
            </div>
            <div className="text-sm tracking-tight text-[#D7D2C8]">
              {(orientation === 'w' ? materialInfo.capturedByWhite : materialInfo.capturedByBlack).join('')}
              {((orientation === 'w' && materialInfo.whiteLead > 0) ||
                (orientation === 'b' && materialInfo.whiteLead < 0)) && (
                <span className="ml-1.5 font-mono text-xs text-[#D4AF37] tabular-nums">
                  +{Math.abs(materialInfo.whiteLead)}
                </span>
              )}
            </div>
          </div>

          {/* Primary Board Action Controls */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={handleUndo}
              disabled={isAiThinking || Boolean(gameOverState) || movesSan.length === 0}
              className="min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-[#14161A] border border-white/10 text-xs font-medium text-[#F4F1EA] hover:border-[#D4AF37]/50 disabled:opacity-40 transition-colors"
            >
              <Undo2 className="w-4 h-4" />
              <span>Undo</span>
            </button>

            <button
              type="button"
              onClick={() => handleStartNewGame(playerColor, difficulty)}
              className="min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-[#14161A] border border-white/10 text-xs font-medium text-[#F4F1EA] hover:border-[#D4AF37]/50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restart</span>
            </button>

            <button
              type="button"
              onClick={handleResign}
              disabled={Boolean(gameOverState) || movesSan.length === 0}
              className="min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-[#14161A] border border-white/10 text-xs font-medium text-[#F4F1EA] hover:border-red-500/50 disabled:opacity-40 transition-colors"
            >
              <Flag className="w-4 h-4" />
              <span>Resign</span>
            </button>

            <button
              type="button"
              onClick={() => handleExplainPosition()}
              className="min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-[#D4AF37] text-[#0B0C0E] text-xs font-semibold hover:bg-[#E8C766] transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span>Explain Position</span>
            </button>
          </div>
        </div>

        {/* Right: Notation, Game Over Summary & Post-Game Coach Review */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {gameOverState && (
            <div className="rounded-2xl bg-[#14161A] border border-[#D4AF37]/40 p-5">
              <div className="text-xs font-medium text-[#D4AF37] mb-1">Game Complete</div>
              <h2 className="text-xl font-bold text-[#F4F1EA]">
                {gameOverState.result === 'win'
                  ? 'Victory! You defeated the AI'
                  : gameOverState.result === 'draw'
                  ? 'Game Drawn'
                  : 'AI Takes This Round'}
              </h2>
              <p className="text-sm text-[#A3A8B4] mt-1">
                Ended by {gameOverState.termination} in {Math.ceil(movesSan.length / 2)} moves.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleAnalyzeGame}
                  disabled={reviewLoading}
                  className="flex-1 min-h-[44px] px-4 rounded-xl bg-[#D4AF37] text-[#0B0C0E] text-sm font-semibold hover:bg-[#E8C766] disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{reviewLoading ? 'Analyzing Moves...' : 'AI Coach Game Review'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleStartNewGame(playerColor, difficulty)}
                  className="min-h-[44px] px-4 rounded-xl bg-[#20242D] text-[#F4F1EA] text-sm font-medium hover:bg-[#2B303C] transition-colors"
                >
                  Play Again
                </button>
              </div>
            </div>
          )}

          {/* Post-Game Review Report */}
          {reviewReport && (
            <div className="rounded-2xl bg-[#14161A] border border-white/10 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#F4F1EA]">{reviewReport.coachVerdict}</h3>
                  <p className="text-xs text-[#A3A8B4] mt-0.5">{reviewReport.coachFeedback}</p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <div className="text-2xl font-mono font-bold text-[#D4AF37] tabular-nums">
                    {reviewReport.accuracyPercent}%
                  </div>
                  <div className="text-[11px] text-[#A3A8B4]">Accuracy</div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="rounded-xl bg-[#1B1E25] p-2.5">
                  <div className="text-base font-mono font-bold text-emerald-400 tabular-nums">
                    {reviewReport.bestMovesCount}
                  </div>
                  <div className="text-[11px] text-[#A3A8B4]">Best</div>
                </div>
                <div className="rounded-xl bg-[#1B1E25] p-2.5">
                  <div className="text-base font-mono font-bold text-[#F4F1EA] tabular-nums">
                    {reviewReport.goodMovesCount}
                  </div>
                  <div className="text-[11px] text-[#A3A8B4]">Good</div>
                </div>
                <div className="rounded-xl bg-[#1B1E25] p-2.5">
                  <div className="text-base font-mono font-bold text-amber-400 tabular-nums">
                    {reviewReport.mistakesCount + reviewReport.inaccuraciesCount}
                  </div>
                  <div className="text-[11px] text-[#A3A8B4]">Mistakes</div>
                </div>
                <div className="rounded-xl bg-[#1B1E25] p-2.5">
                  <div className="text-base font-mono font-bold text-rose-400 tabular-nums">
                    {reviewReport.blundersCount}
                  </div>
                  <div className="text-[11px] text-[#A3A8B4]">Blunders</div>
                </div>
              </div>

              {reviewReport.missedTactics.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-[#D4AF37] mb-2">
                    Missed Opportunities
                  </div>
                  <div className="space-y-2">
                    {reviewReport.missedTactics.map((mt, idx) => (
                      <div key={idx} className="rounded-xl bg-[#1B1E25] p-3 text-xs text-[#D7D2C8]">
                        <span className="font-mono text-[#E8C766]">Move {mt.moveNumber}:</span> You
                        played <span className="font-mono text-rose-300">{mt.playedSan}</span> · Best
                        was <span className="font-mono text-emerald-300">{mt.bestSan}</span>.{' '}
                        {mt.explanation}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {reviewReport.coachImprovements && reviewReport.coachImprovements.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-[#F4F1EA] mb-1.5">
                    Coach Recommendations
                  </div>
                  <ul className="space-y-1.5 text-xs text-[#A3A8B4]">
                    {reviewReport.coachImprovements.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Lightbulb className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 mt-0.5" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Step through analyzed moves */}
              {reviewPlyIndex !== null && (
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setReviewPlyIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
                    className="min-h-[40px] px-3 rounded-lg bg-[#1B1E25] text-xs text-[#F4F1EA] flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" /> Prev
                  </button>
                  <span className="font-mono text-xs text-[#A3A8B4] tabular-nums">
                    Ply {reviewPlyIndex + 1} / {reviewReport.analyzedMoves.length}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setReviewPlyIndex((i) =>
                        i !== null && i < reviewReport.analyzedMoves.length - 1 ? i + 1 : i
                      )
                    }
                    className="min-h-[40px] px-3 rounded-lg bg-[#1B1E25] text-xs text-[#F4F1EA] flex items-center gap-1"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Algebraic Move History */}
          <div className="rounded-2xl bg-[#14161A] border border-white/10 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#F4F1EA]">Move History</h3>
              <span className="font-mono text-xs text-[#A3A8B4] tabular-nums">
                {movesSan.length} plies
              </span>
            </div>

            {movePairs.length === 0 ? (
              <p className="text-xs text-[#A3A8B4] py-4 text-center">
                Make a move on the board to begin the match.
              </p>
            ) : (
              <div className="max-h-[260px] overflow-y-auto space-y-1 pr-1 font-mono text-xs tabular-nums">
                {movePairs.map((pair) => (
                  <div
                    key={pair.moveNum}
                    className="grid grid-cols-12 items-center py-1 px-2 rounded-lg hover:bg-white/5"
                  >
                    <span className="col-span-2 text-[#A3A8B4]">{pair.moveNum}.</span>
                    <button
                      type="button"
                      disabled={!reviewReport}
                      onClick={() => reviewReport && setReviewPlyIndex(pair.wIdx)}
                      className={`col-span-5 text-left px-1.5 py-0.5 rounded ${
                        reviewPlyIndex === pair.wIdx
                          ? 'bg-[#D4AF37]/25 text-[#E8C766]'
                          : 'text-[#F4F1EA]'
                      }`}
                    >
                      {pair.white}
                    </button>
                    <button
                      type="button"
                      disabled={!reviewReport || !pair.black}
                      onClick={() => reviewReport && pair.black && setReviewPlyIndex(pair.bIdx)}
                      className={`col-span-5 text-left px-1.5 py-0.5 rounded ${
                        reviewPlyIndex === pair.bIdx
                          ? 'bg-[#D4AF37]/25 text-[#E8C766]'
                          : 'text-[#D7D2C8]'
                      }`}
                    >
                      {pair.black ?? ''}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Explain This Position Coach Bottom Sheet / Modal */}
      {coachOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-[#14161A] border border-[#D4AF37]/30 p-5 max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3 sm:hidden" />
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#D4AF37]" />
                <h2 className="text-base font-bold text-[#F4F1EA]">AI Chess Coach</h2>
              </div>
              <button
                type="button"
                onClick={() => setCoachOpen(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#A3A8B4] hover:text-[#F4F1EA]"
                aria-label="Close coach"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {coachLoading ? (
              <div className="py-8 text-center text-sm text-[#A3A8B4]">
                Evaluating board geometry and tactical threats...
              </div>
            ) : coachData ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-[#1B1E25] p-3.5 border border-white/5">
                  <div className="flex items-center justify-between gap-2 text-xs text-[#D4AF37] mb-1">
                    <span>{coachData.source === 'gemini' ? 'AI Coach Analysis' : 'Offline Engine Coach'}</span>
                    {coachData.evaluationText && (
                      <span className="font-mono tabular-nums">Eval {coachData.evaluationText}</span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-[#F4F1EA]">{coachData.headline}</div>
                  <p className="text-xs text-[#D7D2C8] mt-1.5 leading-relaxed">{coachData.summary}</p>
                </div>

                {coachData.bestMoveSan && (
                  <div className="rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 p-3.5">
                    <div className="text-xs font-semibold text-[#E8C766] mb-1">
                      Suggested Move: <span className="font-mono">{coachData.bestMoveSan}</span>
                    </div>
                    <p className="text-xs text-[#F4F1EA] leading-relaxed">{coachData.recommendedPlan}</p>
                  </div>
                )}

                {coachData.keyIdeas.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-[#F4F1EA] mb-1.5">Key Concepts</div>
                    <ul className="space-y-1.5 text-xs text-[#A3A8B4]">
                      {coachData.keyIdeas.map((idea, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-[#D4AF37]">•</span>
                          <span>{idea}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {coachData.threats.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-[#F4F1EA] mb-1.5">Threats to Watch</div>
                    <ul className="space-y-1.5 text-xs text-[#A3A8B4]">
                      {coachData.threats.map((t, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-amber-400">•</span>
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Ask Follow-Up Question */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (coachQuestion.trim()) {
                      handleExplainPosition(coachQuestion.trim());
                      setCoachQuestion('');
                    }
                  }}
                  className="flex gap-2 pt-2 border-t border-white/10"
                >
                  <input
                    type="text"
                    value={coachQuestion}
                    onChange={(e) => setCoachQuestion(e.target.value)}
                    placeholder="Ask Coach a question about this board..."
                    className="flex-1 min-h-[44px] rounded-xl bg-[#1B1E25] border border-white/10 px-3 text-xs text-[#F4F1EA] placeholder:text-[#6E7485] focus:outline-none focus:border-[#D4AF37]"
                  />
                  <button
                    type="submit"
                    className="min-h-[44px] px-4 rounded-xl bg-[#D4AF37] text-[#0B0C0E] text-xs font-semibold hover:bg-[#E8C766]"
                  >
                    Ask
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

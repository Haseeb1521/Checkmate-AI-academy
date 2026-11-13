import { Chess } from 'chess.js';
import type { AIDifficulty, CoachExplanation, GameReviewReport, PieceColor } from '../types/chess';
import { formatEvalScore, stockfishEngine } from './stockfishEngine';

const PIECE_NAMES: Record<string, string> = {
  p: 'Pawn',
  n: 'Knight',
  b: 'Bishop',
  r: 'Rook',
  q: 'Queen',
  k: 'King',
};

const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

function buildOfflinePositionExplanation(
  fen: string,
  bestMoveSan: string,
  evalCp: number,
  mateIn: number | null,
  playerColor?: PieceColor
): CoachExplanation {
  const chess = new Chess(fen);
  const turn = chess.turn();
  const sideLabel = turn === 'w' ? 'White' : 'Black';
  const board = chess.board();

  let whiteMat = 0;
  let blackMat = 0;
  let whiteCenter = 0;
  let blackCenter = 0;
  const centerSquares = new Set(['d4', 'e4', 'd5', 'e5']);

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      const val = PIECE_VALUES[piece.type] ?? 0;
      if (piece.color === 'w') whiteMat += val;
      else blackMat += val;

      const sq = `${'abcdefgh'[c]}${8 - r}`;
      if (centerSquares.has(sq)) {
        if (piece.color === 'w') whiteCenter++;
        else blackCenter++;
      }
    }
  }

  const matDiff = whiteMat - blackMat;
  const evalText = formatEvalScore(evalCp, mateIn);
  const keyIdeas: string[] = [];
  const threats: string[] = [];

  if (chess.isCheck()) {
    threats.push(`${sideLabel}'s King is currently in check and must escape, block, or capture the attacker.`);
  }

  if (Math.abs(matDiff) >= 2) {
    const ahead = matDiff > 0 ? 'White' : 'Black';
    keyIdeas.push(`${ahead} holds a material edge of ${Math.abs(matDiff)} points—look to trade pieces cleanly when ahead.`);
  } else {
    keyIdeas.push('Material is roughly balanced, so piece activity and King safety decide the position.');
  }

  if (whiteCenter > blackCenter) {
    keyIdeas.push('White has stronger central presence on d4/e4/d5/e5, giving pieces more room to maneuver.');
  } else if (blackCenter > whiteCenter) {
    keyIdeas.push('Black exerts stronger central control, limiting White’s pawn breaks.');
  } else {
    keyIdeas.push('Control of the central squares (d4, e4, d5, e5) is contested—fight for space with pawns and knights.');
  }

  // Detect captures available right now
  const captures = chess
    .moves({ verbose: true })
    .filter((m) => Boolean(m.captured))
    .slice(0, 2);
  if (captures.length > 0) {
    threats.push(
      `Tactical captures exist right now, such as ${captures
        .map((c) => `${c.san} (targeting a ${PIECE_NAMES[c.captured!]})`)
        .join(' or ')}.`
    );
  } else {
    threats.push('Check for unprotected pieces and back-rank weaknesses before committing pawns forward.');
  }

  let headline = `${sideLabel} to move · Evaluation ${evalText}`;
  if (mateIn !== null && mateIn !== 0) {
    headline = `Forced Checkmate Sequence (${evalText})`;
  } else if (Math.abs(evalCp) < 45) {
    headline = `Balanced Battle (${evalText})`;
  } else if ((evalCp > 0 && playerColor === 'w') || (evalCp < 0 && playerColor === 'b')) {
    headline = `Favorable Position (${evalText})`;
  }

  const summary = chess.isGameOver()
    ? chess.isCheckmate()
      ? `The game ended by checkmate—the defending King has no legal escape.`
      : `The position is a draw, with neither side able to force a win.`
    : `${sideLabel} is to move. Looking at material (${whiteMat} vs ${blackMat}) and square control, the evaluation stands at ${evalText}.`;

  const recommendedPlan = bestMoveSan
    ? `Play ${bestMoveSan}. It improves piece coordination, keeps your King safer, and creates immediate pressure on key squares.`
    : 'Look for a developing move that brings another piece toward the center.';

  return {
    source: 'offline',
    headline,
    summary,
    keyIdeas,
    threats,
    recommendedPlan,
    bestMoveSan,
    evaluationText: evalText,
  };
}

export async function explainPositionWithCoach(params: {
  fen: string;
  lastMove?: string;
  userQuestion?: string;
  playerColor?: PieceColor;
  openingName?: string;
  moveHistory?: string[];
}): Promise<CoachExplanation> {
  const chess = new Chess(params.fen);
  const engineEval = await stockfishEngine.evaluatePosition(params.fen, 11, 500);
  const evalText = formatEvalScore(engineEval.evalCp, engineEval.mateIn);

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return buildOfflinePositionExplanation(
      params.fen,
      engineEval.bestMoveSan,
      engineEval.evalCp,
      engineEval.mateIn,
      params.playerColor
    );
  }

  try {
    const res = await fetch('/api/coach/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fen: params.fen,
        turn: chess.turn(),
        lastMove: params.lastMove,
        bestMoveSan: engineEval.bestMoveSan,
        evaluationText: evalText,
        userQuestion: params.userQuestion,
        playerColor: params.playerColor,
        openingName: params.openingName,
        moveHistory: params.moveHistory,
      }),
    });

    if (!res.ok) {
      return buildOfflinePositionExplanation(
        params.fen,
        engineEval.bestMoveSan,
        engineEval.evalCp,
        engineEval.mateIn,
        params.playerColor
      );
    }

    const data = await res.json();
    return {
      source: 'gemini',
      headline: data.headline || `Coach Insight (${evalText})`,
      summary: data.summary || '',
      keyIdeas: Array.isArray(data.keyIdeas) ? data.keyIdeas : [],
      threats: Array.isArray(data.threats) ? data.threats : [],
      recommendedPlan: data.recommendedPlan || `Consider ${engineEval.bestMoveSan}.`,
      bestMoveSan: engineEval.bestMoveSan,
      evaluationText: evalText,
    };
  } catch {
    return buildOfflinePositionExplanation(
      params.fen,
      engineEval.bestMoveSan,
      engineEval.evalCp,
      engineEval.mateIn,
      params.playerColor
    );
  }
}

export async function generatePostGameCoachFeedback(params: {
  playerColor: PieceColor;
  result: 'win' | 'loss' | 'draw';
  termination: string;
  difficulty: AIDifficulty;
  openingName: string;
  report: GameReviewReport;
}): Promise<GameReviewReport> {
  const { report } = params;
  const fallbackStrengths: string[] = [];
  const fallbackImprovements: string[] = [];

  if (report.bestMovesCount + report.goodMovesCount > 0) {
    fallbackStrengths.push(
      `You found ${report.bestMovesCount} top engine moves and ${report.goodMovesCount} solid moves (${report.accuracyPercent}% accuracy).`
    );
  }
  if (report.blundersCount === 0) {
    fallbackStrengths.push('Zero major blunders—your piece safety discipline held steady.');
  }

  if (report.missedTactics.length > 0) {
    const first = report.missedTactics[0];
    fallbackImprovements.push(
      `On move ${first.moveNumber}, ${first.bestSan} was much stronger than ${first.playedSan}.`
    );
  }
  if (report.blundersCount > 0) {
    fallbackImprovements.push(
      'Pause before moving to check if your target square is defended and whether any of your pieces are hanging.'
    );
  }
  fallbackImprovements.push(
    'Castle early and connect your rooks before launching flank pawn storms.'
  );

  const fallbackVerdict =
    params.result === 'win'
      ? `Victory with ${report.accuracyPercent}% Accuracy`
      : params.result === 'draw'
      ? `Hard-Fought Draw (${report.accuracyPercent}% Accuracy)`
      : `Valuable Lesson (${report.accuracyPercent}% Accuracy)`;

  const fallbackOverall =
    params.result === 'win'
      ? `Well played! You converted your chances against the ${params.difficulty} AI and closed out the game by ${params.termination}.`
      : `Good effort against ${params.difficulty} difficulty. Reviewing the key turning points below will quickly sharpen your tactical radar.`;

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      ...report,
      coachVerdict: fallbackVerdict,
      coachFeedback: fallbackOverall,
      coachStrengths: fallbackStrengths,
      coachImprovements: fallbackImprovements,
    };
  }

  try {
    const res = await fetch('/api/coach/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerColor: params.playerColor,
        result: params.result,
        termination: params.termination,
        difficulty: params.difficulty,
        openingName: params.openingName,
        summaryStats: {
          accuracyPercent: report.accuracyPercent,
          best: report.bestMovesCount,
          good: report.goodMovesCount,
          inaccuracies: report.inaccuraciesCount,
          mistakes: report.mistakesCount,
          blunders: report.blundersCount,
        },
        keyMoments: report.missedTactics,
      }),
    });

    if (!res.ok) {
      return {
        ...report,
        coachVerdict: fallbackVerdict,
        coachFeedback: fallbackOverall,
        coachStrengths: fallbackStrengths,
        coachImprovements: fallbackImprovements,
      };
    }

    const data = await res.json();
    return {
      ...report,
      coachVerdict: data.verdictTitle || fallbackVerdict,
      coachFeedback: data.overallFeedback || fallbackOverall,
      coachStrengths: Array.isArray(data.strengths) ? data.strengths : fallbackStrengths,
      coachImprovements: Array.isArray(data.lessonsToImprove)
        ? data.lessonsToImprove
        : fallbackImprovements,
    };
  } catch {
    return {
      ...report,
      coachVerdict: fallbackVerdict,
      coachFeedback: fallbackOverall,
      coachStrengths: fallbackStrengths,
      coachImprovements: fallbackImprovements,
    };
  }
}

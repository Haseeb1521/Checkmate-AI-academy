import { Chess, type Move } from 'chess.js';
import type {
  AIDifficulty,
  AnalyzedMove,
  GameReviewReport,
  MoveClassification,
  PieceColor,
} from '../types/chess';

export interface EngineEvalResult {
  evalCp: number; // White perspective (+ means White better)
  mateIn: number | null; // White perspective (+ means White mates in N)
  bestMoveUci: string;
  bestMoveSan: string;
  pvSan: string[];
}

interface SearchTask {
  fen: string;
  skillLevel: number;
  depth: number;
  movetimeMs: number;
  multiPv?: number;
  resolve: (result: InternalSearchOutput) => void;
  reject: (err: Error) => void;
}

interface InternalSearchOutput {
  bestMoveUci: string;
  evalCp: number; // side-to-move perspective from Stockfish
  mateIn: number | null; // side-to-move perspective
  pvUci: string[];
  candidates: Array<{ moveUci: string; evalCp: number }>;
}

const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

const PAWN_PST = [
  0, 0, 0, 0, 0, 0, 0, 0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
  5, 5, 10, 27, 27, 10, 5, 5,
  0, 0, 0, 24, 24, 0, 0, 0,
  5, -5, -10, 0, 0, -10, -5, 5,
  5, 10, 10, -22, -22, 10, 10, 5,
  0, 0, 0, 0, 0, 0, 0, 0,
];

const KNIGHT_PST = [
  -50, -40, -30, -30, -30, -30, -40, -50,
  -40, -20, 0, 0, 0, 0, -20, -40,
  -30, 0, 10, 15, 15, 10, 0, -30,
  -30, 5, 15, 20, 20, 15, 5, -30,
  -30, 0, 15, 20, 20, 15, 0, -30,
  -30, 5, 10, 15, 15, 10, 5, -30,
  -40, -20, 0, 5, 5, 0, -20, -40,
  -50, -40, -30, -30, -30, -30, -40, -50,
];

function evaluateFallbackStatic(chess: Chess): number {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -99999 : 99999;
  }
  if (chess.isDraw()) return 0;

  const board = chess.board();
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      let val = PIECE_VALUES[p.type] ?? 0;
      const idx = p.color === 'w' ? r * 8 + c : (7 - r) * 8 + c;
      if (p.type === 'p') val += PAWN_PST[idx];
      else if (p.type === 'n') val += KNIGHT_PST[idx];
      else if (p.type === 'b') val += r >= 2 && r <= 5 && c >= 2 && c <= 5 ? 15 : 0;
      score += p.color === 'w' ? val : -val;
    }
  }
  return score;
}

function alphaBeta(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean
): number {
  if (depth === 0 || chess.isGameOver()) {
    return evaluateFallbackStatic(chess);
  }
  const moves = chess.moves({ verbose: true });
  moves.sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0));

  if (maximizing) {
    let maxEval = -Infinity;
    for (const m of moves) {
      chess.move(m);
      const ev = alphaBeta(chess, depth - 1, alpha, beta, false);
      chess.undo();
      if (ev > maxEval) maxEval = ev;
      if (ev > alpha) alpha = ev;
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const m of moves) {
      chess.move(m);
      const ev = alphaBeta(chess, depth - 1, alpha, beta, true);
      chess.undo();
      if (ev < minEval) minEval = ev;
      if (ev < beta) beta = ev;
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

function getFallbackBestMove(fen: string, depth = 2): InternalSearchOutput {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) {
    return { bestMoveUci: '', evalCp: 0, mateIn: null, pvUci: [], candidates: [] };
  }
  const maximizing = chess.turn() === 'w';
  const scored: Array<{ move: Move; score: number }> = [];
  for (const m of moves) {
    chess.move(m);
    const sc = alphaBeta(chess, Math.max(0, depth - 1), -Infinity, Infinity, !maximizing);
    chess.undo();
    scored.push({ move: m, score: sc });
  }
  scored.sort((a, b) => (maximizing ? b.score - a.score : a.score - b.score));
  const best = scored[0];
  const turnSign = maximizing ? 1 : -1;
  return {
    bestMoveUci: best.move.from + best.move.to + (best.move.promotion ?? ''),
    evalCp: Math.round(best.score * turnSign),
    mateIn: Math.abs(best.score) > 90000 ? (best.score * turnSign > 0 ? 1 : -1) : null,
    pvUci: [best.move.from + best.move.to + (best.move.promotion ?? '')],
    candidates: scored.slice(0, 4).map((s) => ({
      moveUci: s.move.from + s.move.to + (s.move.promotion ?? ''),
      evalCp: Math.round(s.score * turnSign),
    })),
  };
}

class StockfishEngineService {
  private worker: Worker | null = null;
  private isReady = false;
  private initPromise: Promise<void> | null = null;
  private queue: SearchTask[] = [];
  private activeTask: SearchTask | null = null;
  private lastEvalCp = 0;
  private lastMateIn: number | null = null;
  private lastPvUci: string[] = [];
  private multiPvMap = new Map<number, { moveUci: string; evalCp: number }>();
  private workerFailed = false;
  private taskTimer: ReturnType<typeof setTimeout> | null = null;

  private ensureInit(): Promise<void> {
    if (this.workerFailed) return Promise.reject(new Error('Worker unavailable'));
    if (this.isReady && this.worker) return Promise.resolve();
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise<void>((resolve, reject) => {
      if (typeof Worker === 'undefined') {
        this.workerFailed = true;
        reject(new Error('Web Workers unsupported'));
        return;
      }

      try {
        const w = new Worker('/stockfish.js');
        this.worker = w;
        const timeout = setTimeout(() => {
          if (!this.isReady) {
            this.workerFailed = true;
            reject(new Error('Stockfish init timeout'));
          }
        }, 6000);

        w.onmessage = (e: MessageEvent<string>) => {
          const line = String(e.data || '').trim();
          if (!line) return;

          if (line === 'uciok') {
            w.postMessage('isready');
            return;
          }
          if (line === 'readyok') {
            if (!this.isReady) {
              this.isReady = true;
              clearTimeout(timeout);
              resolve();
            }
            return;
          }
          this.handleEngineLine(line);
        };

        w.onerror = () => {
          this.workerFailed = true;
          clearTimeout(timeout);
          if (!this.isReady) reject(new Error('Stockfish worker failed'));
          this.failActiveTask(new Error('Stockfish worker error'));
        };

        w.postMessage('uci');
      } catch (err) {
        this.workerFailed = true;
        reject(err instanceof Error ? err : new Error('Worker error'));
      }
    });

    return this.initPromise;
  }

  private handleEngineLine(line: string) {
    if (!this.activeTask) return;

    if (line.startsWith('info ') && line.includes(' pv ')) {
      const multipvMatch = line.match(/\bmultipv (\d+)/);
      const pvIdx = multipvMatch ? Number(multipvMatch[1]) : 1;

      const cpMatch = line.match(/\bscore cp (-?\d+)/);
      const mateMatch = line.match(/\bscore mate (-?\d+)/);
      const pvMatch = line.match(/\bpv (.+)$/);

      let cp = this.lastEvalCp;
      let mateIn: number | null = null;

      if (cpMatch) {
        cp = Number(cpMatch[1]);
        mateIn = null;
      } else if (mateMatch) {
        mateIn = Number(mateMatch[1]);
        cp = mateIn > 0 ? 10000 - mateIn * 10 : -10000 - mateIn * 10;
      }

      const pvTokens = pvMatch ? pvMatch[1].trim().split(/\s+/) : [];

      if (pvIdx === 1) {
        this.lastEvalCp = cp;
        this.lastMateIn = mateIn;
        this.lastPvUci = pvTokens;
      }
      if (pvTokens[0]) {
        this.multiPvMap.set(pvIdx, { moveUci: pvTokens[0], evalCp: cp });
      }
      return;
    }

    if (line.startsWith('bestmove ')) {
      const parts = line.split(/\s+/);
      const bestMoveUci = parts[1] && parts[1] !== '(none)' ? parts[1] : '';
      const task = this.activeTask;
      this.activeTask = null;
      if (this.taskTimer) {
        clearTimeout(this.taskTimer);
        this.taskTimer = null;
      }

      const candidates = Array.from(this.multiPvMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, val]) => val);

      task.resolve({
        bestMoveUci,
        evalCp: this.lastEvalCp,
        mateIn: this.lastMateIn,
        pvUci: this.lastPvUci,
        candidates,
      });

      this.pumpQueue();
    }
  }

  private failActiveTask(err: Error) {
    if (this.activeTask) {
      const task = this.activeTask;
      this.activeTask = null;
      if (this.taskTimer) {
        clearTimeout(this.taskTimer);
        this.taskTimer = null;
      }
      task.reject(err);
    }
    this.pumpQueue();
  }

  private runTask(params: Omit<SearchTask, 'resolve' | 'reject'>): Promise<InternalSearchOutput> {
    return new Promise((resolve, reject) => {
      this.queue.push({ ...params, resolve, reject });
      this.pumpQueue();
    });
  }

  private async pumpQueue() {
    if (this.activeTask || this.queue.length === 0) return;

    const next = this.queue.shift()!;
    try {
      await this.ensureInit();
    } catch {
      next.resolve(getFallbackBestMove(next.fen, Math.min(2, next.depth)));
      this.pumpQueue();
      return;
    }

    if (!this.worker) {
      next.resolve(getFallbackBestMove(next.fen, 2));
      this.pumpQueue();
      return;
    }

    this.activeTask = next;
    this.lastEvalCp = 0;
    this.lastMateIn = null;
    this.lastPvUci = [];
    this.multiPvMap.clear();

    const w = this.worker;
    w.postMessage('stop');
    w.postMessage(`setoption name Skill Level value ${next.skillLevel}`);
    w.postMessage(`setoption name MultiPV value ${next.multiPv ?? 1}`);
    w.postMessage(`position fen ${next.fen}`);
    w.postMessage(`go depth ${next.depth} movetime ${next.movetimeMs}`);

    this.taskTimer = setTimeout(() => {
      if (this.activeTask === next && this.worker) {
        this.worker.postMessage('stop');
      }
    }, next.movetimeMs + 1200);
  }

  async getBestMoveForDifficulty(
    fen: string,
    difficulty: AIDifficulty
  ): Promise<{ moveUci: string; evalCp: number }> {
    const config: Record<
      AIDifficulty,
      { skill: number; depth: number; movetime: number; multiPv: number }
    > = {
      beginner: { skill: 0, depth: 2, movetime: 150, multiPv: 4 },
      easy: { skill: 3, depth: 4, movetime: 250, multiPv: 2 },
      medium: { skill: 8, depth: 7, movetime: 450, multiPv: 1 },
      hard: { skill: 14, depth: 10, movetime: 700, multiPv: 1 },
      expert: { skill: 20, depth: 13, movetime: 1000, multiPv: 1 },
    };

    const cfg = config[difficulty];
    const res = await this.runTask({
      fen,
      skillLevel: cfg.skill,
      depth: cfg.depth,
      movetimeMs: cfg.movetime,
      multiPv: cfg.multiPv,
    });

    const chess = new Chess(fen);
    const turnSign = chess.turn() === 'w' ? 1 : -1;

    // For beginner, occasionally select 2nd or 3rd candidate if not losing a queen immediately,
    // so beginners have real tactical chances while still facing sensible chess.
    if (difficulty === 'beginner' && res.candidates.length > 1) {
      const topEval = res.candidates[0].evalCp;
      const reasonable = res.candidates.filter((c) => topEval - c.evalCp < 260);
      const pool = reasonable.length > 0 ? reasonable : res.candidates;
      const picked = pool[Math.floor(Math.random() * Math.min(pool.length, 3))];
      if (picked?.moveUci) {
        return { moveUci: picked.moveUci, evalCp: picked.evalCp * turnSign };
      }
    }

    if (difficulty === 'easy' && res.candidates.length > 1 && Math.random() < 0.35) {
      const second = res.candidates[1];
      if (second && res.candidates[0].evalCp - second.evalCp < 160) {
        return { moveUci: second.moveUci, evalCp: second.evalCp * turnSign };
      }
    }

    return {
      moveUci: res.bestMoveUci,
      evalCp: res.evalCp * turnSign,
    };
  }

  async evaluatePosition(fen: string, depth = 11, movetimeMs = 550): Promise<EngineEvalResult> {
    const chess = new Chess(fen);
    if (chess.isGameOver()) {
      const turn = chess.turn();
      const mateVal = chess.isCheckmate() ? (turn === 'w' ? -10000 : 10000) : 0;
      return {
        evalCp: mateVal,
        mateIn: chess.isCheckmate() ? (turn === 'w' ? -0 : 0) : null,
        bestMoveUci: '',
        bestMoveSan: '',
        pvSan: [],
      };
    }

    const res = await this.runTask({
      fen,
      skillLevel: 20,
      depth,
      movetimeMs,
      multiPv: 1,
    });

    const turnSign = chess.turn() === 'w' ? 1 : -1;
    const evalCp = res.evalCp * turnSign;
    const mateIn = res.mateIn !== null ? res.mateIn * turnSign : null;

    const pvSan: string[] = [];
    const sim = new Chess(fen);
    const pvSource = res.pvUci.length > 0 ? res.pvUci : res.bestMoveUci ? [res.bestMoveUci] : [];
    for (const uci of pvSource.slice(0, 6)) {
      if (uci.length < 4) break;
      try {
        const m = sim.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          promotion: uci.length > 4 ? uci[4] : undefined,
        });
        if (m) pvSan.push(m.san);
        else break;
      } catch {
        break;
      }
    }

    return {
      evalCp,
      mateIn,
      bestMoveUci: res.bestMoveUci,
      bestMoveSan: pvSan[0] ?? res.bestMoveUci,
      pvSan,
    };
  }

  async analyzeCompletedGame(
    fens: string[],
    movesSan: string[],
    playerColor: PieceColor
  ): Promise<GameReviewReport> {
    const analyzedMoves: AnalyzedMove[] = [];
    const evals: Array<{ evalCp: number; bestMoveSan: string; bestMoveUci: string }> = [];

    // Cap deep engine review to first 60 plies if extremely long, or evaluate all quickly
    for (let i = 0; i < fens.length; i++) {
      const res = await this.evaluatePosition(fens[i], 8, 120);
      evals.push({
        evalCp: res.evalCp,
        bestMoveSan: res.bestMoveSan,
        bestMoveUci: res.bestMoveUci,
      });
    }

    let bestMovesCount = 0;
    let goodMovesCount = 0;
    let inaccuraciesCount = 0;
    let mistakesCount = 0;
    let blundersCount = 0;
    let totalCpLoss = 0;
    let playerMoveCount = 0;
    const missedTactics: GameReviewReport['missedTactics'] = [];

    for (let ply = 0; ply < movesSan.length; ply++) {
      const fenBefore = fens[ply];
      const fenAfter = fens[ply + 1];
      if (!fenBefore || !fenAfter) break;

      const sim = new Chess(fenBefore);
      const color = sim.turn();
      const moveObj = sim.move(movesSan[ply]);
      const uci = moveObj ? moveObj.from + moveObj.to + (moveObj.promotion ?? '') : '';

      const evalBefore = evals[ply]?.evalCp ?? 0;
      const evalAfter = evals[ply + 1]?.evalCp ?? evalBefore;
      const bestMoveUci = evals[ply]?.bestMoveUci ?? uci;
      const bestMoveSan = evals[ply]?.bestMoveSan ?? movesSan[ply];

      // Centipawn loss from the moving side's perspective
      const rawLoss = color === 'w' ? evalBefore - evalAfter : evalAfter - evalBefore;
      const cpLoss = uci === bestMoveUci ? 0 : Math.max(0, rawLoss);

      let classification: MoveClassification = 'good';
      if (uci === bestMoveUci || cpLoss <= 20) classification = 'best';
      else if (cpLoss <= 60) classification = 'good';
      else if (cpLoss <= 130) classification = 'inaccuracy';
      else if (cpLoss <= 260) classification = 'mistake';
      else classification = 'blunder';

      if (color === playerColor) {
        playerMoveCount++;
        totalCpLoss += Math.min(cpLoss, 600);
        if (classification === 'best') bestMovesCount++;
        else if (classification === 'good') goodMovesCount++;
        else if (classification === 'inaccuracy') inaccuraciesCount++;
        else if (classification === 'mistake') mistakesCount++;
        else if (classification === 'blunder') blundersCount++;

        if ((classification === 'mistake' || classification === 'blunder') && bestMoveSan) {
          missedTactics.push({
            moveNumber: Math.floor(ply / 2) + 1,
            playedSan: movesSan[ply],
            bestSan: bestMoveSan,
            cpLoss,
            explanation: `Playing ${bestMoveSan} instead of ${movesSan[ply]} saved about ${(
              cpLoss / 100
            ).toFixed(1)} pawns of advantage.`,
          });
        }
      }

      analyzedMoves.push({
        ply: ply + 1,
        moveNumber: Math.floor(ply / 2) + 1,
        color,
        san: movesSan[ply],
        uci,
        fenBefore,
        fenAfter,
        evalBeforeCp: evalBefore,
        evalAfterCp: evalAfter,
        cpLoss,
        bestMoveSan,
        bestMoveUci,
        classification,
      });
    }

    const avgLoss = playerMoveCount > 0 ? totalCpLoss / playerMoveCount : 0;
    const accuracyPercent = Math.max(15, Math.min(99, Math.round(103 * Math.exp(-0.004 * avgLoss))));

    return {
      accuracyPercent,
      bestMovesCount,
      goodMovesCount,
      inaccuraciesCount,
      mistakesCount,
      blundersCount,
      analyzedMoves,
      missedTactics: missedTactics.slice(0, 5),
    };
  }
}

export const stockfishEngine = new StockfishEngineService();

export function formatEvalScore(evalCp: number, mateIn: number | null): string {
  if (mateIn !== null) {
    if (mateIn === 0) return 'Checkmate';
    return mateIn > 0 ? `M${mateIn}` : `-M${Math.abs(mateIn)}`;
  }
  const pawns = (evalCp / 100).toFixed(1);
  return evalCp > 0 ? `+${pawns}` : `${pawns}`;
}

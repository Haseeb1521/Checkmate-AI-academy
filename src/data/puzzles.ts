import type { ChessPuzzle } from '../types/chess';

export const PUZZLES: ChessPuzzle[] = [
  // Mate in 1
  {
    id: 'p-m1-backrank',
    title: 'Back Rank Thunder',
    theme: 'Back Rank Mate',
    difficulty: 'Mate in 1',
    rating: 650,
    fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
    solutionMovesUci: ['d1d8'],
    hint: 'Black’s own pawns trap their King on the 8th rank.',
    explanation: 'Rd8# delivers an unstoppable back-rank checkmate because f7, g7, and h7 block the King’s escape.',
  },
  {
    id: 'p-m1-queen-kiss',
    title: 'The Queen’s Embrace',
    theme: 'Back Rank Checkmate',
    difficulty: 'Mate in 1',
    rating: 700,
    fen: '6k1/5ppp/6B1/8/8/4Q3/8/6K1 w - - 0 1',
    solutionMovesUci: ['e3e8'],
    hint: 'Your Queen can invade the 8th rank where nothing defends e8.',
    explanation: 'Qe8# is checkmate on the back rank because Black has no defender on e8 and no pawn escape.',
  },
  {
    id: 'p-m1-smothered',
    title: 'Royal Smother',
    theme: 'Smothered Mate',
    difficulty: 'Mate in 1',
    rating: 880,
    fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1',
    solutionMovesUci: ['g5f7'],
    hint: 'Jump your Knight to attack the cornered King—it cannot escape its own pieces!',
    explanation: 'Nf7# is a classic Smothered Mate: the Rook on g8 and pawns on g7/h7 block every square around the Black King.',
  },
  {
    id: 'p-m1-scholars',
    title: 'Punishing the Weak f7',
    theme: 'Queen & Bishop Battery',
    difficulty: 'Mate in 1',
    rating: 720,
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    solutionMovesUci: ['h5f7'],
    hint: 'Both your Queen and c4 Bishop aim at f7!',
    explanation: 'Qxf7# (Scholar’s Mate) wins immediately because the c4 Bishop defends the Queen on f7.',
  },
  {
    id: 'p-m1-arabian',
    title: 'Arabian Mate',
    theme: 'Rook & Knight Mate',
    difficulty: 'Mate in 1',
    rating: 920,
    fen: '7k/8/5N1K/8/8/8/8/6R1 w - - 0 1',
    solutionMovesUci: ['g1g8'],
    hint: 'Your Knight on f6 protects g8 and seals h7. Deliver check with the Rook!',
    explanation: 'Rg8# is the ancient Arabian Mate: the Knight defends the Rook while covering the King’s escape square.',
  },

  // Mate in 2
  {
    id: 'p-m2-deflection',
    title: 'Queen Sacrifice to Back Rank',
    theme: 'Deflection Mate',
    difficulty: 'Mate in 2',
    rating: 1100,
    fen: '2r3k1/5ppp/8/8/Q7/8/5PPP/4R1K1 w - - 0 1',
    solutionMovesUci: ['a4e8', 'c8e8', 'e1e8'],
    hint: 'Black’s c8 Rook guards e8. Check on e8 with your Queen first!',
    explanation: '1. Qe8+! forces 1...Rxe8, deflecting the Rook so 2. Rxe8# wins on the back rank.',
  },
  {
    id: 'p-m2-anastasia',
    title: 'Anastasia’s Finish',
    theme: 'Knight & Rook Mate',
    difficulty: 'Mate in 2',
    rating: 1220,
    fen: '7k/4N1pp/8/7Q/8/3R4/8/6K1 w - - 0 1',
    solutionMovesUci: ['h5h7', 'h8h7', 'd3h3'],
    hint: 'Sacrifice your Queen on h7 to drag the King onto the h-file for your Rook!',
    explanation: '1. Qxh7+! Kxh7 2. Rh3# — Anastasia’s Mate! The Knight on e7 takes away g8 and g6.',
  },
  {
    id: 'p-m2-opera',
    title: 'Morphy’s Opera Mate',
    theme: 'Rook & Bishop Mate',
    difficulty: 'Mate in 2',
    rating: 1180,
    fen: '4kb1r/p2n1ppp/4q3/4p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 0 1',
    solutionMovesUci: ['b3b8', 'd7b8', 'd1d8'],
    hint: 'Sacrifice the Queen on b8 to pull the Knight off d7!',
    explanation: '1. Qb8+! Nxb8 2. Rd8# — Paul Morphy’s famous Opera Game finish! The g5 Bishop guards d8.',
  },

  // Mate in 3
  {
    id: 'p-m3-philidor',
    title: 'Philidor’s Legacy',
    theme: 'Smothered Mate in 3',
    difficulty: 'Mate in 3',
    rating: 1450,
    fen: '5rk1/5Npp/8/8/8/8/Q7/6K1 w - - 0 1',
    solutionMovesUci: ['f7h6', 'g8h8', 'a2g8', 'f8g8', 'h6f7'],
    hint: 'Start with a double check from your Knight, then sacrifice the Queen on g8!',
    explanation: '1. Nh6+! (double check) Kh8 2. Qg8+! Rxg8 3. Nf7# — chess’s most famous smothered mate combination.',
  },
  {
    id: 'p-m3-corridor',
    title: 'Back-Rank Overload',
    theme: 'Mate in 3',
    difficulty: 'Mate in 3',
    rating: 1350,
    fen: '2qr2k1/5ppp/8/1Q6/8/8/5PPP/3RR1K1 w - - 0 1',
    solutionMovesUci: ['d1d8', 'c8d8', 'b5e8', 'd8e8', 'e1e8'],
    hint: 'Trade off the d8 Rook first, then drive the Queen off e8!',
    explanation: '1. Rxd8+ Qxd8 2. Qe8+ Qxe8 3. Rxe8# overwhelms both back-rank defenders.',
  },

  // Tactical Puzzles
  {
    id: 'p-tac-fork1',
    title: 'Royal Knight Fork',
    theme: 'Knight Fork',
    difficulty: 'Tactic',
    rating: 850,
    fen: 'q3k3/8/8/1N6/8/8/8/4K3 w - - 0 1',
    solutionMovesUci: ['b5c7'],
    hint: 'Attack both the King and Queen in a single Knight leap.',
    explanation: '1. Nc7+ forks Black’s King and Queen, winning the Queen cleanly.',
  },
  {
    id: 'p-tac-fork2',
    title: 'Family Fork',
    theme: 'Knight Fork',
    difficulty: 'Tactic',
    rating: 950,
    fen: 'r3k2r/pp3ppp/2n5/3N4/8/8/PPP2PPP/4K3 w kq - 0 1',
    solutionMovesUci: ['d5c7'],
    hint: 'Jump your Knight to c7 to attack King and Rook simultaneously!',
    explanation: '1. Nc7+ forks the Black King on e8 and the Rook on a8.',
  },
  {
    id: 'p-tac-skewer',
    title: 'Diagonal X-Ray Skewer',
    theme: 'Skewer',
    difficulty: 'Tactic',
    rating: 1000,
    fen: '8/8/6r1/5k2/8/8/8/1B2K3 w - - 0 1',
    solutionMovesUci: ['b1d3'],
    hint: 'Check the King along the diagonal where the Rook stands directly behind it.',
    explanation: '1. Bd3+ skewers the King on f5 and the Rook on g6.',
  },
  {
    id: 'p-tac-pin',
    title: 'Exploiting the Pin',
    theme: 'Absolute Pin',
    difficulty: 'Tactic',
    rating: 980,
    fen: '4k3/4n3/8/3P4/8/8/4R3/4K3 w - - 0 1',
    solutionMovesUci: ['d5d6'],
    hint: 'Black’s Knight on e7 is pinned to the King by your e2 Rook—attack it with a pawn!',
    explanation: '1. d6 attacks the pinned Knight, which cannot move because of the King behind it.',
  },
];

export interface GuessBestMovePosition {
  id: string;
  title: string;
  phase: 'Opening' | 'Middlegame' | 'Endgame';
  fen: string;
  bestMoveUci: string;
  bestMoveSan: string;
  explanation: string;
}

export const GUESS_BEST_MOVE_POSITIONS: GuessBestMovePosition[] = [
  {
    id: 'gbm-1',
    title: 'Punishing Weak f7',
    phase: 'Opening',
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    bestMoveUci: 'h5f7',
    bestMoveSan: 'Qxf7#',
    explanation: 'Black played 3...Nf6? overlooking that both the Queen on h5 and Bishop on c4 target f7. Qxf7# is Scholar’s Mate!',
  },
  {
    id: 'gbm-2',
    title: 'Fried Liver Opportunity',
    phase: 'Opening',
    fen: 'r1bqkb1r/ppp2ppp/2n5/3np1N1/2B5/8/PPPP1PPP/RNBQK2R w KQkq - 0 6',
    bestMoveUci: 'g5f7',
    bestMoveSan: 'Nxf7',
    explanation: 'Classic Fried Liver Attack! 6. Nxf7 forks Black’s Queen on d8 and Rook on h8, forcing 6...Kxf7 into a deadly central pin.',
  },
  {
    id: 'gbm-3',
    title: 'Central Breakthrough',
    phase: 'Middlegame',
    fen: 'r1bq1rk1/pp2bppp/2n1pn2/2pp4/3P4/2PBPN2/PP1N1PPP/R1BQ1RK1 w - - 0 8',
    bestMoveUci: 'd4c5',
    bestMoveSan: 'dxc5',
    explanation: 'Capturing on c5 opens the d-file and prepares an e4 break to activate White’s dark-squared Bishop and Queen.',
  },
  {
    id: 'gbm-4',
    title: 'Active Queen Pressure',
    phase: 'Middlegame',
    fen: 'r2q1rk1/ppp2ppp/2n5/3pP3/3P4/2N5/PP2QPPP/R4RK1 w - - 0 12',
    bestMoveUci: 'e2b5',
    bestMoveSan: 'Qb5',
    explanation: 'Developing pressure onto c6 and b7 while eyeing d5 keeps Black tied down defensively.',
  },
  {
    id: 'gbm-5',
    title: 'Endgame King Activity',
    phase: 'Endgame',
    fen: '8/5pk1/6p1/8/4P3/5K2/8/8 w - - 0 1',
    bestMoveUci: 'f3f4',
    bestMoveSan: 'Kf4',
    explanation: 'In King and Pawn endgames, activate your King aggressively toward the center and enemy pawns.',
  },
];

export function getDailyPuzzle(dateKey: string): ChessPuzzle {
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  }
  return PUZZLES[hash % PUZZLES.length];
}

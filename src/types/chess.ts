export type AppTab = 'home' | 'learn' | 'play' | 'puzzles' | 'profile';

export type PieceColor = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export type AIDifficulty = 'beginner' | 'easy' | 'medium' | 'hard' | 'expert';
export type BoardTheme = 'obsidian' | 'walnut' | 'emerald' | 'slate';

export type MoveClassification = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder' | 'book';

export interface AnalyzedMove {
  ply: number;
  moveNumber: number;
  color: PieceColor;
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  evalBeforeCp: number; // from White's perspective
  evalAfterCp: number; // from White's perspective
  cpLoss: number;
  bestMoveSan: string;
  bestMoveUci: string;
  classification: MoveClassification;
}

export interface GameReviewReport {
  accuracyPercent: number;
  bestMovesCount: number;
  goodMovesCount: number;
  inaccuraciesCount: number;
  mistakesCount: number;
  blundersCount: number;
  analyzedMoves: AnalyzedMove[];
  coachVerdict?: string;
  coachFeedback?: string;
  coachStrengths?: string[];
  coachImprovements?: string[];
  missedTactics: Array<{
    moveNumber: number;
    playedSan: string;
    bestSan: string;
    cpLoss: number;
    explanation: string;
  }>;
}

export interface SavedGame {
  id: string;
  date: string;
  playerColor: PieceColor;
  difficulty: AIDifficulty;
  result: 'win' | 'loss' | 'draw';
  termination: string;
  moves: string[];
  fens: string[];
  pgn: string;
  openingName: string;
  review?: GameReviewReport;
}

export interface CoachExplanation {
  source: 'gemini' | 'offline';
  headline: string;
  summary: string;
  keyIdeas: string[];
  threats: string[];
  recommendedPlan: string;
  bestMoveSan?: string;
  evaluationText?: string;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  category: 'academy' | 'play' | 'puzzles' | 'special';
}

export interface UserSettings {
  boardTheme: BoardTheme;
  soundEnabled: boolean;
  showLegalMoves: boolean;
  showCoordinates: boolean;
}

export interface UserStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  puzzlesSolved: number;
  puzzleAttempts: number;
  guessBestMoveSolved: number;
  blindfoldBestStreak: number;
  endgamesCompleted: number;
}

export interface UserProgress {
  xp: number;
  streak: number;
  lastActiveDate: string; // YYYY-MM-DD
  ratingEstimate: number;
  completedLessons: string[];
  completedOpenings: string[];
  completedEndgames: string[];
  solvedPuzzles: string[];
  dailyPuzzlesCompleted: Record<string, boolean>;
  unlockedAchievements: string[];
  savedGames: SavedGame[];
  stats: UserStats;
  settings: UserSettings;
}

export interface LessonDemoStep {
  fen: string;
  caption: string;
  highlightSquares?: string[];
  arrow?: { from: string; to: string };
}

export interface LessonExercise {
  prompt: string;
  fen: string;
  orientation: PieceColor;
  acceptedMovesUci: string[]; // e.g. ['e2e4'] or ['e1g1']
  successMessage: string;
  hint: string;
}

export interface LessonQuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Lesson {
  id: string;
  level: 1 | 2 | 3;
  order: number;
  title: string;
  subtitle: string;
  durationMinutes: number;
  xpReward: number;
  explanation: string[];
  demoSteps: LessonDemoStep[];
  exercise: LessonExercise;
  quiz: LessonQuizQuestion;
}

export interface OpeningMoveStep {
  san: string;
  uci: string;
  purpose: string;
}

export interface OpeningVariation {
  name: string;
  description: string;
  moves: string[]; // UCI moves from starting position
}

export interface OpeningEntry {
  id: string;
  name: string;
  eco: string;
  color: PieceColor;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  tagline: string;
  strategicIdeas: string[];
  mainLine: OpeningMoveStep[];
  variations: OpeningVariation[];
}

export interface ChessPuzzle {
  id: string;
  title: string;
  theme: string;
  difficulty: 'Mate in 1' | 'Mate in 2' | 'Mate in 3' | 'Tactic';
  rating: number;
  fen: string;
  solutionMovesUci: string[]; // alternating player, opponent, player...
  hint: string;
  explanation: string;
}

export interface EndgameExercise {
  id: string;
  title: string;
  category: 'King & Pawn' | 'Rook Endgame' | 'Checkmate Technique';
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  fen: string;
  playerColor: PieceColor;
  goal: 'win' | 'draw';
  goalDescription: string;
  keyTechnique: string;
  hintMoveUci: string;
  maxMoves?: number;
}

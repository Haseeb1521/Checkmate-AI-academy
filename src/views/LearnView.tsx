import React, { useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  Crown,
  HelpCircle,
  Play,
  RotateCcw,
} from 'lucide-react';
import { ChessBoard } from '../components/ChessBoard';
import { ENDGAMES } from '../data/endgames';
import { LESSONS } from '../data/lessons';
import { OPENINGS } from '../data/openings';
import { soundService } from '../services/sound';
import { stockfishEngine } from '../services/stockfishEngine';
import type { AIDifficulty, EndgameExercise, Lesson, OpeningEntry, PieceColor, UserSettings } from '../types/chess';

export type LearnSubTab = 'curriculum' | 'openings' | 'endgames';

interface LearnViewProps {
  initialSubTab?: LearnSubTab;
  settings: UserSettings;
  completedLessons: string[];
  completedOpenings: string[];
  completedEndgames: string[];
  onCompleteLesson: (lessonId: string, xp: number) => void;
  onCompleteOpening: (openingId: string) => void;
  onCompleteEndgame: (endgameId: string, xp: number) => void;
  onPracticeOpening: (fen: string, color: PieceColor, openingName: string, difficulty: AIDifficulty) => void;
}

export const LearnView: React.FC<LearnViewProps> = ({
  initialSubTab = 'curriculum',
  settings,
  completedLessons,
  completedOpenings,
  completedEndgames,
  onCompleteLesson,
  onCompleteOpening,
  onCompleteEndgame,
  onPracticeOpening,
}) => {
  const [subTab, setSubTab] = useState<LearnSubTab>(initialSubTab);

  // ================= CURRICULUM STATE =================
  const [levelFilter, setLevelFilter] = useState<1 | 2 | 3>(1);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [lessonStage, setLessonStage] = useState<'concept' | 'demo' | 'exercise' | 'quiz'>('concept');
  const [demoStepIdx, setDemoStepIdx] = useState(0);
  const [exerciseFen, setExerciseFen] = useState('');
  const [exerciseStatus, setExerciseStatus] = useState<'idle' | 'solved' | 'wrong'>('idle');
  const [showExerciseHint, setShowExerciseHint] = useState(false);
  const [selectedQuizOption, setSelectedQuizOption] = useState<number | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // ================= OPENINGS STATE =================
  const [activeOpening, setActiveOpening] = useState<OpeningEntry>(OPENINGS[0]);
  const [openingStepIdx, setOpeningStepIdx] = useState(0); // 0 = start pos, 1..N = moves played
  const [activeVariationIdx, setActiveVariationIdx] = useState<number | null>(null);

  // ================= ENDGAME TRAINER STATE =================
  const [activeEndgame, setActiveEndgame] = useState<EndgameExercise>(ENDGAMES[0]);
  const [endgameFen, setEndgameFen] = useState(ENDGAMES[0].fen);
  const [endgameThinking, setEndgameThinking] = useState(false);
  const [endgameShowHint, setEndgameShowHint] = useState(false);
  const [endgameStatus, setEndgameStatus] = useState<'playing' | 'won' | 'draw'>('playing');

  const openLesson = (lesson: Lesson) => {
    setActiveLesson(lesson);
    setLessonStage('concept');
    setDemoStepIdx(0);
    setExerciseFen(lesson.exercise.fen);
    setExerciseStatus('idle');
    setShowExerciseHint(false);
    setSelectedQuizOption(null);
    setQuizSubmitted(false);
  };

  const handleExerciseMove = (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n'): boolean => {
    if (!activeLesson || exerciseStatus === 'solved') return false;
    const uci = from + to + (promotion ?? '');
    const sim = new Chess(exerciseFen);
    try {
      const m = sim.move({ from, to, promotion });
      if (!m) return false;
      if (activeLesson.exercise.acceptedMovesUci.includes(uci)) {
        soundService.playSuccess();
        setExerciseFen(sim.fen());
        setExerciseStatus('solved');
        return true;
      } else {
        soundService.playError();
        setExerciseStatus('wrong');
        return false;
      }
    } catch {
      return false;
    }
  };

  // Opening board state derived from step index or variation
  const openingBoardState = useMemo(() => {
    const chess = new Chess();
    const movesToPlay =
      activeVariationIdx !== null
        ? activeOpening.variations[activeVariationIdx].moves
        : activeOpening.mainLine.map((m) => m.uci);
    const clampedIdx = Math.min(openingStepIdx, movesToPlay.length);
    let lastMove: { from: string; to: string } | null = null;
    for (let i = 0; i < clampedIdx; i++) {
      const uci = movesToPlay[i];
      const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      if (m) lastMove = { from: m.from, to: m.to };
    }
    return {
      fen: chess.fen(),
      lastMove,
      totalSteps: movesToPlay.length,
      currentStep: clampedIdx,
    };
  }, [activeOpening, activeVariationIdx, openingStepIdx]);

  const selectOpening = (op: OpeningEntry) => {
    setActiveOpening(op);
    setActiveVariationIdx(null);
    setOpeningStepIdx(op.mainLine.length);
    onCompleteOpening(op.id);
  };

  // Endgame interactive play vs Stockfish
  const selectEndgame = (eg: EndgameExercise) => {
    setActiveEndgame(eg);
    setEndgameFen(eg.fen);
    setEndgameThinking(false);
    setEndgameShowHint(false);
    setEndgameStatus('playing');
  };

  const handleEndgameMove = async (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => {
    if (endgameThinking || endgameStatus !== 'playing') return false;
    const sim = new Chess(endgameFen);
    try {
      const m = sim.move({ from, to, promotion });
      if (!m) return false;

      if (m.captured) soundService.playCapture();
      else soundService.playMove();

      setEndgameShowHint(false);
      const afterPlayerFen = sim.fen();
      setEndgameFen(afterPlayerFen);

      if (sim.isCheckmate()) {
        soundService.playSuccess();
        setEndgameStatus('won');
        onCompleteEndgame(activeEndgame.id, 85);
        return true;
      }
      if (sim.isDraw()) {
        setEndgameStatus('draw');
        return true;
      }

      setEndgameThinking(true);
      const aiReply = await stockfishEngine.getBestMoveForDifficulty(afterPlayerFen, 'medium');
      const simAi = new Chess(afterPlayerFen);
      if (aiReply.moveUci.length >= 4) {
        try {
          simAi.move({
            from: aiReply.moveUci.slice(0, 2),
            to: aiReply.moveUci.slice(2, 4),
            promotion: aiReply.moveUci[4] ?? 'q',
          });
        } catch {
          const legal = simAi.moves();
          if (legal[0]) simAi.move(legal[0]);
        }
      }
      setEndgameFen(simAi.fen());
      setEndgameThinking(false);

      if (simAi.isGameOver()) {
        setEndgameStatus('draw');
      }
      return true;
    } catch {
      return false;
    }
  };

  const filteredLessons = useMemo(
    () => LESSONS.filter((l) => l.level === levelFilter).sort((a, b) => a.order - b.order),
    [levelFilter]
  );

  return (
    <div className="w-full max-w-6xl mx-auto px-4 pt-4 pb-24 lg:pb-10">
      {/* Header + Segmented Section Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#F4F1EA]">Chess Academy</h1>
          <p className="text-xs text-[#A3A8B4] mt-0.5">
            {completedLessons.length} of {LESSONS.length} lessons · {completedOpenings.length} of{' '}
            {OPENINGS.length} openings · {completedEndgames.length} of {ENDGAMES.length} endgames
          </p>
        </div>

        <div className="flex items-center bg-[#14161A] border border-white/10 rounded-xl p-1 self-start">
          {(
            [
              { id: 'curriculum', label: 'Lessons', icon: BookOpen },
              { id: 'openings', label: 'Openings', icon: Compass },
              { id: 'endgames', label: 'Endgames', icon: Crown },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setSubTab(tab.id);
                  setActiveLesson(null);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  subTab === tab.id
                    ? 'bg-[#D4AF37] text-[#0B0C0E] font-semibold'
                    : 'text-[#A3A8B4] hover:text-[#F4F1EA]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===================== 1. CURRICULUM ===================== */}
      {subTab === 'curriculum' && !activeLesson && (
        <div className="space-y-5">
          {/* Level Tabs */}
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { level: 1, name: 'Level 1 · Beginner', desc: 'Rules, pieces, checkmate' },
                { level: 2, name: 'Level 2 · Intermediate', desc: 'Tactics, forks, pins' },
                { level: 3, name: 'Level 3 · Advanced', desc: 'Strategy, combos, endgames' },
              ] as const
            ).map((lvl) => {
              const countInLvl = LESSONS.filter((l) => l.level === lvl.level).length;
              const doneInLvl = LESSONS.filter(
                (l) => l.level === lvl.level && completedLessons.includes(l.id)
              ).length;
              return (
                <button
                  key={lvl.level}
                  type="button"
                  onClick={() => setLevelFilter(lvl.level)}
                  className={`text-left rounded-2xl p-3.5 border transition-colors min-h-[68px] ${
                    levelFilter === lvl.level
                      ? 'bg-[#D4AF37]/12 border-[#D4AF37] text-[#F4F1EA]'
                      : 'bg-[#14161A] border-white/10 text-[#A3A8B4] hover:border-white/25'
                  }`}
                >
                  <div className="text-xs sm:text-sm font-semibold text-[#F4F1EA]">{lvl.name}</div>
                  <div className="text-[11px] text-[#A3A8B4] mt-0.5 hidden sm:block">{lvl.desc}</div>
                  <div className="text-[11px] font-mono text-[#D4AF37] mt-1 tabular-nums">
                    {doneInLvl}/{countInLvl} Done
                  </div>
                </button>
              );
            })}
          </div>

          {/* Lessons Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredLessons.map((lesson) => {
              const isDone = completedLessons.includes(lesson.id);
              return (
                <button
                  key={lesson.id}
                  type="button"
                  onClick={() => openLesson(lesson)}
                  className="text-left rounded-2xl bg-[#14161A] border border-white/10 hover:border-[#D4AF37]/60 p-4 flex items-center justify-between gap-4 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-xs text-[#D4AF37] font-mono tabular-nums mb-1">
                      Lesson {lesson.order} · {lesson.durationMinutes} min · +{lesson.xpReward} XP
                    </div>
                    <h3 className="text-base font-semibold text-[#F4F1EA] truncate">{lesson.title}</h3>
                    <p className="text-xs text-[#A3A8B4] mt-1 line-clamp-2">{lesson.subtitle}</p>
                  </div>
                  <div className="shrink-0">
                    {isDone ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-[#A3A8B4]" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Lesson Player */}
      {subTab === 'curriculum' && activeLesson && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setActiveLesson(null)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#D4AF37] hover:text-[#E8C766] min-h-[36px]"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Level {activeLesson.level} Lessons</span>
          </button>

          <div className="rounded-2xl bg-[#14161A] border border-white/10 p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <div className="text-xs font-mono text-[#D4AF37] mb-1">
                  Level {activeLesson.level} · Lesson {activeLesson.order} · +{activeLesson.xpReward} XP
                </div>
                <h2 className="text-xl font-bold text-[#F4F1EA]">{activeLesson.title}</h2>
              </div>

              <div className="flex items-center gap-1 bg-[#1B1E25] p-1 rounded-xl">
                {(
                  [
                    { id: 'concept', label: '1. Explain' },
                    { id: 'demo', label: '2. Demo' },
                    { id: 'exercise', label: '3. Practice' },
                    { id: 'quiz', label: '4. Quiz' },
                  ] as const
                ).map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setLessonStage(st.id)}
                    className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                      lessonStage === st.id
                        ? 'bg-[#D4AF37] text-[#0B0C0E] font-semibold'
                        : 'text-[#A3A8B4] hover:text-[#F4F1EA]'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {lessonStage === 'concept' && (
              <div className="space-y-4">
                {activeLesson.explanation.map((para, i) => (
                  <p key={i} className="text-sm text-[#D7D2C8] leading-relaxed">
                    {para}
                  </p>
                ))}
                <button
                  type="button"
                  onClick={() => setLessonStage('demo')}
                  className="min-h-[44px] px-5 rounded-xl bg-[#D4AF37] text-[#0B0C0E] text-sm font-semibold hover:bg-[#E8C766] inline-flex items-center gap-2"
                >
                  <span>Start Interactive Demo</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {lessonStage === 'demo' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                <div className="lg:col-span-6">
                  <ChessBoard
                    fen={activeLesson.demoSteps[demoStepIdx].fen}
                    interactive={false}
                    theme={settings.boardTheme}
                    showCoordinates={settings.showCoordinates}
                    highlightSquares={activeLesson.demoSteps[demoStepIdx].highlightSquares}
                    arrow={activeLesson.demoSteps[demoStepIdx].arrow}
                  />
                </div>
                <div className="lg:col-span-6 space-y-4">
                  <div className="text-xs font-mono text-[#D4AF37]">
                    Demonstration {demoStepIdx + 1} of {activeLesson.demoSteps.length}
                  </div>
                  <p className="text-sm sm:text-base text-[#F4F1EA] leading-relaxed">
                    {activeLesson.demoSteps[demoStepIdx].caption}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={demoStepIdx === 0}
                      onClick={() => setDemoStepIdx((i) => Math.max(0, i - 1))}
                      className="min-h-[44px] px-4 rounded-xl bg-[#1B1E25] text-xs font-medium text-[#F4F1EA] disabled:opacity-40"
                    >
                      Previous
                    </button>
                    {demoStepIdx < activeLesson.demoSteps.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => setDemoStepIdx((i) => i + 1)}
                        className="min-h-[44px] px-5 rounded-xl bg-[#D4AF37] text-[#0B0C0E] text-xs font-semibold"
                      >
                        Next Step
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setLessonStage('exercise')}
                        className="min-h-[44px] px-5 rounded-xl bg-[#D4AF37] text-[#0B0C0E] text-xs font-semibold"
                      >
                        Try Practice Exercise
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {lessonStage === 'exercise' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                <div className="lg:col-span-6">
                  <ChessBoard
                    fen={exerciseFen}
                    orientation={activeLesson.exercise.orientation}
                    interactive={exerciseStatus !== 'solved'}
                    playerColor={activeLesson.exercise.orientation}
                    theme={settings.boardTheme}
                    showLegalMoves={settings.showLegalMoves}
                    showCoordinates={settings.showCoordinates}
                    arrow={
                      showExerciseHint
                        ? {
                            from: activeLesson.exercise.acceptedMovesUci[0].slice(0, 2),
                            to: activeLesson.exercise.acceptedMovesUci[0].slice(2, 4),
                          }
                        : null
                    }
                    onMove={handleExerciseMove}
                  />
                </div>
                <div className="lg:col-span-6 space-y-4">
                  <div className="text-xs font-mono text-[#D4AF37]">Interactive Exercise</div>
                  <p className="text-sm sm:text-base font-medium text-[#F4F1EA]">
                    {activeLesson.exercise.prompt}
                  </p>

                  {exerciseStatus === 'wrong' && (
                    <div className="rounded-xl bg-rose-500/15 border border-rose-500/30 p-3 text-xs text-rose-200">
                      Not quite the target move—try again or use a hint!
                    </div>
                  )}

                  {showExerciseHint && exerciseStatus !== 'solved' && (
                    <div className="rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 p-3 text-xs text-[#E8C766]">
                      Hint: {activeLesson.exercise.hint}
                    </div>
                  )}

                  {exerciseStatus === 'solved' && (
                    <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-3.5 text-xs text-emerald-200 leading-relaxed">
                      {activeLesson.exercise.successMessage}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {exerciseStatus !== 'solved' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowExerciseHint(true)}
                          className="min-h-[44px] px-4 rounded-xl bg-[#1B1E25] text-xs font-medium text-[#E8C766] inline-flex items-center gap-1.5"
                        >
                          <HelpCircle className="w-4 h-4" />
                          <span>Hint</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setExerciseFen(activeLesson.exercise.fen);
                            setExerciseStatus('idle');
                          }}
                          className="min-h-[44px] px-4 rounded-xl bg-[#1B1E25] text-xs font-medium text-[#F4F1EA] inline-flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>Reset</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setLessonStage('quiz')}
                        className="min-h-[44px] px-5 rounded-xl bg-[#D4AF37] text-[#0B0C0E] text-sm font-semibold"
                      >
                        Continue to Mini Quiz
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {lessonStage === 'quiz' && (
              <div className="max-w-xl space-y-4">
                <div className="text-xs font-mono text-[#D4AF37]">Mini Quiz</div>
                <h3 className="text-base font-semibold text-[#F4F1EA]">
                  {activeLesson.quiz.question}
                </h3>
                <div className="space-y-2">
                  {activeLesson.quiz.options.map((opt, idx) => {
                    const isCorrect = idx === activeLesson.quiz.correctIndex;
                    const isSelected = selectedQuizOption === idx;
                    let cls = 'bg-[#1B1E25] border-white/10 text-[#D7D2C8]';
                    if (quizSubmitted) {
                      if (isCorrect) cls = 'bg-emerald-500/15 border-emerald-500 text-emerald-200';
                      else if (isSelected) cls = 'bg-rose-500/15 border-rose-500 text-rose-200';
                    } else if (isSelected) {
                      cls = 'bg-[#D4AF37]/15 border-[#D4AF37] text-[#F4F1EA]';
                    }
                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={quizSubmitted}
                        onClick={() => setSelectedQuizOption(idx)}
                        className={`w-full text-left rounded-xl border p-3.5 text-sm transition-colors min-h-[48px] ${cls}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {!quizSubmitted ? (
                  <button
                    type="button"
                    disabled={selectedQuizOption === null}
                    onClick={() => {
                      setQuizSubmitted(true);
                      if (selectedQuizOption === activeLesson.quiz.correctIndex) {
                        soundService.playSuccess();
                        onCompleteLesson(activeLesson.id, activeLesson.xpReward);
                      } else {
                        soundService.playError();
                      }
                    }}
                    className="min-h-[44px] px-5 rounded-xl bg-[#D4AF37] text-[#0B0C0E] text-sm font-semibold disabled:opacity-40"
                  >
                    Submit Answer
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-xl bg-[#1B1E25] p-3.5 text-xs text-[#D7D2C8] leading-relaxed">
                      {activeLesson.quiz.explanation}
                    </div>
                    {selectedQuizOption !== activeLesson.quiz.correctIndex ? (
                      <button
                        type="button"
                        onClick={() => {
                          setQuizSubmitted(false);
                          setSelectedQuizOption(null);
                        }}
                        className="min-h-[44px] px-4 rounded-xl bg-[#1B1E25] text-xs font-medium text-[#F4F1EA]"
                      >
                        Try Again
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveLesson(null)}
                        className="min-h-[44px] px-5 rounded-xl bg-emerald-500 text-[#0B0C0E] text-sm font-semibold"
                      >
                        Lesson Complete · Return to Curriculum
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== 2. OPENING LIBRARY ===================== */}
      {subTab === 'openings' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Opening List */}
          <div className="lg:col-span-4 space-y-2">
            {OPENINGS.map((op) => {
              const isSelected = activeOpening.id === op.id;
              const isStudied = completedOpenings.includes(op.id);
              return (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => selectOpening(op)}
                  className={`w-full text-left rounded-xl p-3.5 border transition-colors flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-[#D4AF37]/12 border-[#D4AF37]'
                      : 'bg-[#14161A] border-white/10 hover:border-white/25'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-[11px] font-mono text-[#D4AF37]">
                      {op.eco} · {op.color === 'w' ? 'White' : 'Black'} · {op.difficulty}
                    </div>
                    <div className="text-sm font-semibold text-[#F4F1EA] truncate">{op.name}</div>
                  </div>
                  {isStudied && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Interactive Opening Explorer */}
          <div className="lg:col-span-8 rounded-2xl bg-[#14161A] border border-white/10 p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-mono text-[#D4AF37]">
                  ECO {activeOpening.eco} · {activeOpening.color === 'w' ? 'White Repertoire' : 'Black Defense'}
                </div>
                <h2 className="text-xl font-bold text-[#F4F1EA]">{activeOpening.name}</h2>
                <p className="text-xs text-[#A3A8B4] mt-0.5">{activeOpening.tagline}</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  onPracticeOpening(
                    openingBoardState.fen,
                    activeOpening.color,
                    activeOpening.name,
                    'easy'
                  )
                }
                className="min-h-[44px] px-4 rounded-xl bg-[#D4AF37] text-[#0B0C0E] text-xs font-semibold hover:bg-[#E8C766] inline-flex items-center gap-2 shrink-0"
              >
                <Play className="w-4 h-4" />
                <span>Practice vs AI</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
              <div className="md:col-span-6 space-y-3">
                <ChessBoard
                  fen={openingBoardState.fen}
                  orientation={activeOpening.color}
                  interactive={false}
                  theme={settings.boardTheme}
                  showCoordinates={settings.showCoordinates}
                  lastMove={openingBoardState.lastMove}
                />

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setOpeningStepIdx(0)}
                    className="min-h-[40px] px-3 rounded-lg bg-[#1B1E25] text-xs text-[#F4F1EA]"
                  >
                    Start
                  </button>
                  <button
                    type="button"
                    disabled={openingBoardState.currentStep === 0}
                    onClick={() => setOpeningStepIdx((s) => Math.max(0, s - 1))}
                    className="min-h-[40px] px-3 rounded-lg bg-[#1B1E25] text-xs text-[#F4F1EA] disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <span className="font-mono text-xs text-[#D4AF37] tabular-nums">
                    Move {openingBoardState.currentStep} / {openingBoardState.totalSteps}
                  </span>
                  <button
                    type="button"
                    disabled={openingBoardState.currentStep >= openingBoardState.totalSteps}
                    onClick={() =>
                      setOpeningStepIdx((s) => Math.min(openingBoardState.totalSteps, s + 1))
                    }
                    className="min-h-[40px] px-3 rounded-lg bg-[#1B1E25] text-xs text-[#F4F1EA] disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>

              <div className="md:col-span-6 space-y-4">
                {/* Main Line Moves */}
                <div>
                  <div className="text-xs font-semibold text-[#F4F1EA] mb-2">
                    Move-by-Move Purpose
                  </div>
                  <div className="max-h-[220px] overflow-y-auto space-y-1.5 pr-1">
                    {activeOpening.mainLine.map((step, idx) => {
                      const isActive = activeVariationIdx === null && openingBoardState.currentStep === idx + 1;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setActiveVariationIdx(null);
                            setOpeningStepIdx(idx + 1);
                          }}
                          className={`w-full text-left rounded-xl p-2.5 text-xs transition-colors border ${
                            isActive
                              ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-[#F4F1EA]'
                              : 'bg-[#1B1E25] border-transparent text-[#D7D2C8] hover:border-white/15'
                          }`}
                        >
                          <span className="font-mono font-semibold text-[#E8C766] mr-2">
                            {Math.floor(idx / 2) + 1}
                            {idx % 2 === 0 ? '.' : '...'} {step.san}
                          </span>
                          <span className="text-[#A3A8B4]">{step.purpose}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Common Variations */}
                <div>
                  <div className="text-xs font-semibold text-[#F4F1EA] mb-1.5">
                    Common Variations
                  </div>
                  <div className="space-y-1.5">
                    {activeOpening.variations.map((v, vIdx) => (
                      <button
                        key={v.name}
                        type="button"
                        onClick={() => {
                          setActiveVariationIdx(vIdx);
                          setOpeningStepIdx(v.moves.length);
                        }}
                        className={`w-full text-left rounded-xl p-2.5 text-xs border transition-colors ${
                          activeVariationIdx === vIdx
                            ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-[#F4F1EA]'
                            : 'bg-[#1B1E25] border-transparent text-[#A3A8B4] hover:text-[#F4F1EA]'
                        }`}
                      >
                        <div className="font-semibold text-[#F4F1EA]">{v.name}</div>
                        <div className="mt-0.5">{v.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Strategic Ideas */}
                <div>
                  <div className="text-xs font-semibold text-[#F4F1EA] mb-1.5">
                    Core Strategic Ideas
                  </div>
                  <ul className="space-y-1 text-xs text-[#A3A8B4]">
                    {activeOpening.strategicIdeas.map((idea, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-[#D4AF37]">•</span>
                        <span>{idea}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== 3. ENDGAME TRAINER ===================== */}
      {subTab === 'endgames' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4 space-y-2">
            {ENDGAMES.map((eg) => {
              const isSelected = activeEndgame.id === eg.id;
              const isDone = completedEndgames.includes(eg.id);
              return (
                <button
                  key={eg.id}
                  type="button"
                  onClick={() => selectEndgame(eg)}
                  className={`w-full text-left rounded-xl p-3.5 border transition-colors flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-[#D4AF37]/12 border-[#D4AF37]'
                      : 'bg-[#14161A] border-white/10 hover:border-white/25'
                  }`}
                >
                  <div>
                    <div className="text-[11px] font-mono text-[#D4AF37]">
                      {eg.category} · {eg.difficulty}
                    </div>
                    <div className="text-sm font-semibold text-[#F4F1EA]">{eg.title}</div>
                  </div>
                  {isDone && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-8 rounded-2xl bg-[#14161A] border border-white/10 p-4 sm:p-5 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
            <div className="md:col-span-6">
              <ChessBoard
                fen={endgameFen}
                orientation={activeEndgame.playerColor}
                interactive={!endgameThinking && endgameStatus === 'playing'}
                playerColor={activeEndgame.playerColor}
                theme={settings.boardTheme}
                showLegalMoves={settings.showLegalMoves}
                showCoordinates={settings.showCoordinates}
                arrow={
                  endgameShowHint
                    ? {
                        from: activeEndgame.hintMoveUci.slice(0, 2),
                        to: activeEndgame.hintMoveUci.slice(2, 4),
                      }
                    : null
                }
                onMove={handleEndgameMove}
              />
            </div>

            <div className="md:col-span-6 space-y-4">
              <div>
                <div className="text-xs font-mono text-[#D4AF37]">{activeEndgame.category}</div>
                <h2 className="text-xl font-bold text-[#F4F1EA] mt-0.5">{activeEndgame.title}</h2>
                <p className="text-xs text-[#D7D2C8] mt-2 leading-relaxed">
                  {activeEndgame.goalDescription}
                </p>
              </div>

              <div className="rounded-xl bg-[#1B1E25] p-3.5 text-xs text-[#A3A8B4] leading-relaxed">
                <span className="font-semibold text-[#E8C766]">Key Technique: </span>
                {activeEndgame.keyTechnique}
              </div>

              {endgameStatus === 'won' && (
                <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/40 p-3.5 text-xs text-emerald-200">
                  Checkmate achieved! Endgame technique mastered (+85 XP).
                </div>
              )}

              {endgameStatus === 'draw' && (
                <div className="rounded-xl bg-amber-500/15 border border-amber-500/40 p-3.5 text-xs text-amber-200">
                  Draw / Stalemate reached! Reset and tighten your King & piece coordination.
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {endgameFen === activeEndgame.fen && endgameStatus === 'playing' && (
                  <button
                    type="button"
                    onClick={() => setEndgameShowHint(true)}
                    className="min-h-[44px] px-4 rounded-xl bg-[#1B1E25] text-xs font-medium text-[#E8C766] inline-flex items-center gap-1.5"
                  >
                    <HelpCircle className="w-4 h-4" />
                    <span>Show First Move Hint</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => selectEndgame(activeEndgame)}
                  className="min-h-[44px] px-4 rounded-xl bg-[#D4AF37] text-[#0B0C0E] text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset Endgame</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

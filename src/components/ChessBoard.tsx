import React, { useMemo, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import type { BoardTheme, PieceColor, PieceType } from '../types/chess';
import { ChessPieceSvg } from './ChessPieceSvg';

interface ChessBoardProps {
  fen: string;
  orientation?: PieceColor;
  interactive?: boolean;
  playerColor?: PieceColor | 'both';
  showLegalMoves?: boolean;
  showCoordinates?: boolean;
  theme?: BoardTheme;
  lastMove?: { from: string; to: string } | null;
  highlightSquares?: string[];
  arrow?: { from: string; to: string } | null;
  blindfoldMode?: boolean;
  onMove?: (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => boolean | void | Promise<boolean | void>;
  onSquareTap?: (square: string) => void;
}

const THEME_COLORS: Record<BoardTheme, { light: string; dark: string; coordLight: string; coordDark: string }> = {
  obsidian: {
    light: '#D7CDB8',
    dark: '#4D473E',
    coordLight: '#4D473E',
    coordDark: '#D7CDB8',
  },
  walnut: {
    light: '#E6CFA8',
    dark: '#7A5134',
    coordLight: '#6A442A',
    coordDark: '#E6CFA8',
  },
  emerald: {
    light: '#EEEED2',
    dark: '#4C7A58',
    coordLight: '#3D6547',
    coordDark: '#EEEED2',
  },
  slate: {
    light: '#CBD5E1',
    dark: '#475569',
    coordLight: '#334155',
    coordDark: '#E2E8F0',
  },
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

function squareToPercent(sq: string, orientation: PieceColor): { x: number; y: number } {
  const fileIdx = FILES.indexOf(sq[0]);
  const rankIdx = RANKS.indexOf(sq[1]);
  const col = orientation === 'w' ? fileIdx : 7 - fileIdx;
  const row = orientation === 'w' ? rankIdx : 7 - rankIdx;
  return {
    x: col * 12.5 + 6.25,
    y: row * 12.5 + 6.25,
  };
}

export const ChessBoard: React.FC<ChessBoardProps> = ({
  fen,
  orientation = 'w',
  interactive = true,
  playerColor = 'both',
  showLegalMoves = true,
  showCoordinates = true,
  theme = 'obsidian',
  lastMove = null,
  highlightSquares = [],
  arrow = null,
  blindfoldMode = false,
  onMove,
  onSquareTap,
}) => {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string; color: PieceColor } | null>(null);

  const chess = useMemo(() => {
    try {
      return new Chess(fen);
    } catch {
      return new Chess();
    }
  }, [fen]);

  const legalTargets = useMemo(() => {
    const map = new Map<string, { isCapture: boolean; isPromotion: boolean }>();
    if (!selectedSquare || !interactive) return map;
    const moves = chess.moves({ square: selectedSquare as Square, verbose: true });
    for (const m of moves) {
      map.set(m.to, {
        isCapture: Boolean(m.captured),
        isPromotion: Boolean(m.promotion),
      });
    }
    return map;
  }, [chess, selectedSquare, interactive]);

  const checkKingSquare = useMemo(() => {
    if (!chess.inCheck()) return null;
    const turn = chess.turn();
    const board = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type === 'k' && piece.color === turn) {
          return `${FILES[c]}${RANKS[r]}`;
        }
      }
    }
    return null;
  }, [chess]);

  const displayRanks = orientation === 'w' ? RANKS : [...RANKS].reverse();
  const displayFiles = orientation === 'w' ? FILES : [...FILES].reverse();
  const palette = THEME_COLORS[theme];

  const handleSquareClick = (sq: string) => {
    if (onSquareTap) {
      onSquareTap(sq);
    }
    if (!interactive || !onMove) return;

    const currentTurn = chess.turn();
    if (playerColor !== 'both' && currentTurn !== playerColor) {
      return;
    }

    if (selectedSquare && legalTargets.has(sq)) {
      const targetInfo = legalTargets.get(sq)!;
      if (targetInfo.isPromotion) {
        setPendingPromotion({ from: selectedSquare, to: sq, color: currentTurn });
        return;
      }
      onMove(selectedSquare, sq);
      setSelectedSquare(null);
      return;
    }

    const piece = chess.get(sq as Square);
    if (piece && piece.color === currentTurn && (playerColor === 'both' || piece.color === playerColor)) {
      setSelectedSquare((prev) => (prev === sq ? null : sq));
    } else {
      setSelectedSquare(null);
    }
  };

  const handlePromotionSelect = (promo: 'q' | 'r' | 'b' | 'n') => {
    if (!pendingPromotion || !onMove) return;
    onMove(pendingPromotion.from, pendingPromotion.to, promo);
    setPendingPromotion(null);
    setSelectedSquare(null);
  };

  const arrowCoords = useMemo(() => {
    if (!arrow) return null;
    const from = squareToPercent(arrow.from, orientation);
    const to = squareToPercent(arrow.to, orientation);
    return { from, to };
  }, [arrow, orientation]);

  return (
    <div className="relative w-full aspect-square max-w-[540px] mx-auto select-none">
      <div
        className="w-full h-full grid grid-cols-8 grid-rows-8 rounded-xl overflow-hidden border border-[#D4AF37]/30 shadow-2xl shadow-black/60"
        style={{ touchAction: 'manipulation' }}
      >
        {displayRanks.map((rank, rIdx) =>
          displayFiles.map((file, cIdx) => {
            const sq = `${file}${rank}`;
            const fileNum = FILES.indexOf(file);
            const rankNum = Number(rank);
            const isLight = (fileNum + rankNum) % 2 === 1;
            const piece = chess.get(sq as Square);
            const isSelected = selectedSquare === sq;
            const isLastFrom = lastMove?.from === sq;
            const isLastTo = lastMove?.to === sq;
            const isHighlighted = highlightSquares.includes(sq);
            const legalInfo = legalTargets.get(sq);
            const isKingInCheck = checkKingSquare === sq;

            const showRankLabel = showCoordinates && cIdx === 0;
            const showFileLabel = showCoordinates && rIdx === 7;

            return (
              <button
                key={sq}
                type="button"
                onClick={() => handleSquareClick(sq)}
                aria-label={`Square ${sq}${piece ? ` ${piece.color === 'w' ? 'White' : 'Black'} ${piece.type}` : ''}`}
                className="relative flex items-center justify-center w-full h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:z-10 transition-colors duration-100"
                style={{
                  backgroundColor: isLight ? palette.light : palette.dark,
                }}
              >
                {/* Last move highlight */}
                {(isLastFrom || isLastTo) && (
                  <span className="absolute inset-0 bg-[#D4AF37]/30 pointer-events-none" />
                )}

                {/* Custom lesson/hint highlight */}
                {isHighlighted && (
                  <span className="absolute inset-0 ring-2 ring-inset ring-[#E8C766] bg-[#D4AF37]/25 pointer-events-none" />
                )}

                {/* Selected square */}
                {isSelected && (
                  <span className="absolute inset-0 bg-[#D4AF37]/45 ring-2 ring-inset ring-[#F6E299] pointer-events-none" />
                )}

                {/* Check highlight */}
                {isKingInCheck && (
                  <span
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: 'radial-gradient(circle, rgba(220,38,38,0.82) 0%, rgba(185,28,28,0.35) 65%, transparent 100%)',
                    }}
                  />
                )}

                {/* Coordinate labels */}
                {showRankLabel && (
                  <span
                    className="absolute top-0.5 left-1 text-[10px] font-mono font-semibold leading-none pointer-events-none opacity-80"
                    style={{ color: isLight ? palette.coordLight : palette.coordDark }}
                  >
                    {rank}
                  </span>
                )}
                {showFileLabel && (
                  <span
                    className="absolute bottom-0.5 right-1 text-[10px] font-mono font-semibold leading-none pointer-events-none opacity-80"
                    style={{ color: isLight ? palette.coordLight : palette.coordDark }}
                  >
                    {file}
                  </span>
                )}

                {/* Piece SVG */}
                {piece && !blindfoldMode && (
                  <div className="relative z-10 w-[86%] h-[86%] transition-transform duration-150 active:scale-95">
                    <ChessPieceSvg color={piece.color as PieceColor} type={piece.type as PieceType} />
                  </div>
                )}

                {/* Legal move marker */}
                {showLegalMoves && legalInfo && (
                  <span
                    className={`pointer-events-none absolute z-20 ${
                      legalInfo.isCapture
                        ? 'inset-[5%] rounded-full border-[3px] border-[#D4AF37]/85'
                        : 'w-[28%] h-[28%] rounded-full bg-[#111318]/45 ring-2 ring-[#D4AF37]/70'
                    }`}
                  />
                )}
              </button>
            );
          })
        )}
      </div>

      {/* SVG Arrow Overlay */}
      {arrowCoords && (
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full pointer-events-none z-20"
        >
          <defs>
            <marker
              id="gold-arrowhead"
              markerWidth="4"
              markerHeight="4"
              refX="2.5"
              refY="2"
              orient="auto"
            >
              <polygon points="0 0, 4 2, 0 4" fill="#D4AF37" fillOpacity="0.9" />
            </marker>
          </defs>
          <line
            x1={arrowCoords.from.x}
            y1={arrowCoords.from.y}
            x2={arrowCoords.to.x}
            y2={arrowCoords.to.y}
            stroke="#D4AF37"
            strokeOpacity="0.88"
            strokeWidth="2.1"
            strokeLinecap="round"
            markerEnd="url(#gold-arrowhead)"
          />
        </svg>
      )}

      {/* Pawn Promotion Selection Modal */}
      {pendingPromotion && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 backdrop-blur-sm rounded-xl p-4">
          <div className="bg-[#161920] border border-[#D4AF37]/40 rounded-2xl p-4 w-full max-w-[280px] shadow-2xl">
            <h3 className="text-sm font-semibold text-[#F4F1EA] text-center mb-3">
              Choose Promotion Piece
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {(['q', 'r', 'b', 'n'] as const).map((promoType) => (
                <button
                  key={promoType}
                  type="button"
                  onClick={() => handlePromotionSelect(promoType)}
                  className="aspect-square min-h-[48px] rounded-xl bg-[#222631] hover:bg-[#D4AF37]/20 border border-white/10 hover:border-[#D4AF37] p-2 flex items-center justify-center transition-colors"
                >
                  <ChessPieceSvg color={pendingPromotion.color} type={promoType} />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPendingPromotion(null)}
              className="mt-3 w-full py-2 text-xs text-[#A3A8B4] hover:text-[#F4F1EA]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

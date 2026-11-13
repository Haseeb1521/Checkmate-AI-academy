import React from 'react';
import { formatEvalScore } from '../services/stockfishEngine';

interface EvalBarProps {
  evalCp: number;
  mateIn: number | null;
  orientation?: 'w' | 'b';
}

export const EvalBar: React.FC<EvalBarProps> = ({ evalCp, mateIn, orientation = 'w' }) => {
  // Clamp centipawns to [-900, 900] -> percentage [5%, 95%]
  let whitePercent = 50;
  if (mateIn !== null) {
    whitePercent = mateIn > 0 ? 98 : mateIn < 0 ? 2 : 50;
  } else {
    const clamped = Math.max(-900, Math.min(900, evalCp));
    whitePercent = Math.round(50 + (clamped / 900) * 45);
  }

  const label = formatEvalScore(evalCp, mateIn);
  const displayPercent = orientation === 'w' ? whitePercent : 100 - whitePercent;

  return (
    <div className="w-full flex items-center gap-3">
      <div className="relative flex-1 h-2.5 rounded-full overflow-hidden bg-[#1D2028] border border-white/10">
        <div
          className="h-full transition-all duration-300 ease-out"
          style={{
            width: `${displayPercent}%`,
            backgroundColor: orientation === 'w' ? '#EAE4D3' : '#323743',
          }}
        />
      </div>
      <span className="font-mono text-xs tabular-nums text-[#D4AF37] min-w-[46px] text-right">
        {label}
      </span>
    </div>
  );
};

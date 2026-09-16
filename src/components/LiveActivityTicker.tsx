import React from 'react';
import { Zap, ArrowUpRight } from 'lucide-react';
import { ActivityEvent } from '../types';

interface LiveActivityTickerProps {
  events: ActivityEvent[];
}

export const LiveActivityTicker: React.FC<LiveActivityTickerProps> = ({ events }) => {
  if (!events.length) return null;

  const latest = events[0];

  const formatTime = (timestamp: number) => {
    const diff = Math.max(1, Math.round((Date.now() - timestamp) / 1000 / 60));
    if (diff < 1) return 'agora mesmo';
    if (diff < 60) return `${diff}m atrás`;
    return `${Math.round(diff / 60)}h atrás`;
  };

  return (
    <div className="w-full bg-stone-900 text-stone-300 py-2 px-4 border-b border-stone-800 text-xs font-mono">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 overflow-hidden">
        <div className="flex items-center gap-2 shrink-0 text-orange-400 font-semibold">
          <Zap className="w-3.5 h-3.5 fill-orange-400" />
          <span className="uppercase tracking-wider text-[11px]">Última Atividade:</span>
        </div>

        <div className="flex items-center gap-2 truncate text-stone-200">
          <span className="font-semibold text-white truncate">{latest.listingTitle}</span>
          <span className="text-stone-400">
            {latest.type === 'new_listing' ? 'entrou no ranking com' : 'deu lance de'}
          </span>
          <span className="text-orange-400 font-bold font-mono">${latest.bidAmount}</span>
          <span className="text-stone-400">e assumiu a posição</span>
          <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 font-bold">
            #{latest.rankAchieved}
          </span>
        </div>

        <div className="shrink-0 text-stone-500 text-[11px] hidden sm:flex items-center gap-1">
          <span>{formatTime(latest.timestamp)}</span>
          <ArrowUpRight className="w-3 h-3" />
        </div>
      </div>
    </div>
  );
};

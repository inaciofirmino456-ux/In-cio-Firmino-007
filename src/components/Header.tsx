import React from 'react';
import { Flame, HelpCircle, ShieldCheck, Volume2, VolumeX, TrendingUp } from 'lucide-react';
import { StatsSummary } from '../types';

interface HeaderProps {
  stats: StatsSummary;
  onOpenHowItWorks: () => void;
  onOpenAdmin: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  stats,
  onOpenHowItWorks,
  onOpenAdmin,
  soundEnabled,
  onToggleSound,
}) => {
  return (
    <header className="w-full border-b border-stone-200/90 bg-white/95 backdrop-blur-xs sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-xs">
            <Flame className="w-5 h-5 fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-xl tracking-tight text-stone-900 font-mono">
                outbid<span className="text-orange-500">.lol</span>
              </span>
              <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-200">
                Live Board
              </span>
            </div>
          </div>
        </div>

        {/* Global Live Stats (scannable) */}
        <div className="hidden md:flex items-center gap-6 text-xs text-stone-600 font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-stone-400">Total Bids:</span>
            <span className="font-semibold text-stone-900">${stats.totalRevenue.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-stone-400" />
            <span className="text-stone-400">Top Spot:</span>
            <span className="font-semibold text-orange-600">${stats.topBid.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-stone-400">Clicks Sent:</span>
            <span className="font-semibold text-stone-900">{stats.totalClicks.toLocaleString()}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            id="sound-toggle-btn"
            onClick={onToggleSound}
            title={soundEnabled ? 'Silenciar sons' : 'Ativar sons de lance'}
            className="p-2 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-stone-400" />}
          </button>

          <button
            id="how-it-works-btn"
            onClick={onOpenHowItWorks}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-stone-700 bg-stone-100 hover:bg-stone-200/80 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5 text-stone-500" />
            <span>Como Funciona</span>
          </button>

          <button
            id="admin-mode-btn"
            onClick={onOpenAdmin}
            title="Painel de Administrador / Dono do site"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden sm:inline">Painel Admin</span>
          </button>
        </div>
      </div>
    </header>
  );
};

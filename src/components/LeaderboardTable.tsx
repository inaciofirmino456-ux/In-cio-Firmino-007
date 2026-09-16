import React, { useState } from 'react';
import { ExternalLink, Flame, Search, Crown, Sparkles, TrendingUp, MousePointerClick } from 'lucide-react';
import { Category, Listing } from '../types';

interface LeaderboardTableProps {
  listings: Listing[];
  onOutbidListing: (listing: Listing) => void;
  onRecordClick: (listingId: string) => void;
}

const CATEGORIES: Category[] = [
  'All',
  'AI & Tech',
  'SaaS & Tools',
  'Dev & Open Source',
  'Crypto & Web3',
  'Design & Creative',
  'Indie Makers',
  'Other',
];

const getSafeUrl = (url: string) => {
  const target = url.trim();
  if (target.startsWith('@')) {
    return `https://x.com/${target.replace('@', '')}`;
  }
  if (!target.startsWith('http://') && !target.startsWith('https://')) {
    return `https://${target}`;
  }
  return target;
};

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
  listings,
  onOutbidListing,
  onRecordClick,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<Category>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter listings
  const filtered = listings.filter((item) => {
    const matchesCategory =
      selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tagline.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <div className="flex items-center gap-1 font-mono font-black text-amber-600 bg-amber-100/90 border border-amber-300 px-2 py-1 rounded-md text-xs">
          <Crown className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />
          <span>#1</span>
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="font-mono font-bold text-stone-700 bg-stone-200/80 border border-stone-300 px-2 py-1 rounded-md text-xs">
          #2
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="font-mono font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md text-xs">
          #3
        </div>
      );
    }
    return (
      <span className="font-mono font-bold text-stone-400 text-xs px-2 py-1">
        #{rank}
      </span>
    );
  };

  return (
    <div className="w-full space-y-4">
      {/* Category Pills & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
              }`}
            >
              {cat === 'All' ? 'Todos' : cat}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar projeto ou link..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-stone-200 bg-white text-stone-900 text-xs focus:outline-hidden focus:border-orange-500 transition-colors"
          />
        </div>
      </div>

      {/* Leaderboard Table Container */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-xs overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-2 px-4 sm:px-6 py-3 bg-stone-50/80 border-b border-stone-200 text-[11px] font-mono font-bold uppercase tracking-wider text-stone-500">
          <div className="col-span-2 sm:col-span-1">Rank</div>
          <div className="col-span-7 sm:col-span-6">Projeto & Link</div>
          <div className="hidden sm:block sm:col-span-2 text-right">Cliques</div>
          <div className="col-span-3 sm:col-span-3 text-right">Lance Atual</div>
        </div>

        {/* Table Rows */}
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-stone-500 text-sm">
            Nenhum projeto encontrado para esta busca ou categoria.
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {filtered.map((item, index) => {
              const actualRank = listings.findIndex((l) => l.id === item.id) + 1;
              const isTop3 = actualRank <= 3;

              return (
                <React.Fragment key={item.id}>
                  {/* Top 10 Divider if applicable */}
                  {actualRank === 11 && (
                    <div className="px-6 py-2 bg-stone-100/70 border-y border-stone-200/80 text-[11px] font-mono uppercase font-bold text-stone-500 flex items-center justify-between">
                      <span>• Posições Seguintes •</span>
                      <span>Disputa aberta</span>
                    </div>
                  )}

                  <div
                    className={`grid grid-cols-12 gap-2 px-4 sm:px-6 py-4 items-center transition-colors group ${
                      actualRank === 1
                        ? 'bg-amber-50/40 hover:bg-amber-50/70'
                        : actualRank === 2
                        ? 'bg-stone-50/50 hover:bg-stone-100/60'
                        : actualRank === 3
                        ? 'bg-orange-50/20 hover:bg-orange-50/40'
                        : 'hover:bg-stone-50/80'
                    }`}
                  >
                    {/* Rank */}
                    <div className="col-span-2 sm:col-span-1 flex items-center">
                      {getRankBadge(actualRank)}
                    </div>

                    {/* Project & Tagline */}
                    <div className="col-span-7 sm:col-span-6 flex items-center gap-3 min-w-0 pr-2">
                      <div className="w-8 h-8 rounded-lg bg-stone-100 border border-stone-200/80 flex items-center justify-center shrink-0 text-stone-700 font-bold text-xs uppercase overflow-hidden relative">
                        <span className="select-none">{item.title.slice(0, 2)}</span>
                        {item.iconUrl && (
                          <img
                            src={item.iconUrl}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            className="absolute inset-0 w-full h-full object-cover bg-white"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <a
                            href={getSafeUrl(item.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => onRecordClick(item.id)}
                            className="font-bold text-stone-900 text-sm hover:text-orange-600 transition-colors truncate text-left cursor-pointer flex items-center gap-1 group-hover:underline"
                          >
                            <span>{item.title}</span>
                            <ExternalLink className="w-3 h-3 text-stone-400 group-hover:text-orange-500 shrink-0" />
                          </a>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200/60 shrink-0">
                            {item.category}
                          </span>
                        </div>
                        <p className="text-xs text-stone-500 truncate mt-0.5">
                          {item.tagline}
                        </p>
                      </div>
                    </div>

                    {/* Clicks */}
                    <div className="hidden sm:flex sm:col-span-2 items-center justify-end gap-1.5 text-xs font-mono text-stone-600">
                      <MousePointerClick className="w-3.5 h-3.5 text-stone-400" />
                      <span>{item.clicks.toLocaleString()} cliques</span>
                    </div>

                    {/* Current Bid & Outbid CTA */}
                    <div className="col-span-3 sm:col-span-3 flex items-center justify-end gap-2 sm:gap-3">
                      <div className="text-right font-mono">
                        <div className="font-extrabold text-stone-900 text-sm sm:text-base">
                          ${item.currentBid}
                        </div>
                        <span className="text-[10px] text-stone-400 block sm:inline">
                          {item.totalBidsCount} {item.totalBidsCount === 1 ? 'lance' : 'lances'}
                        </span>
                      </div>

                      <button
                        id={`outbid-btn-${item.id}`}
                        onClick={() => onOutbidListing(item)}
                        title={`Superar lance de $${item.currentBid}`}
                        className="px-2.5 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0"
                      >
                        <Flame className="w-3 h-3 fill-orange-500" />
                        <span className="hidden sm:inline">Superar</span>
                      </button>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Flame, ArrowRight, ShieldAlert, Sparkles } from 'lucide-react';
import { Category, Listing } from '../types';

interface HeroBiddingCardProps {
  topListing: Listing | undefined;
  allListings: Listing[];
  onInitiateBid: (draft: {
    url: string;
    title: string;
    tagline: string;
    category: Exclude<Category, 'All'>;
    bidAmount: number;
    existingListingId?: string;
  }) => void;
  initialDraft?: {
    listingId?: string;
    title?: string;
    url?: string;
    tagline?: string;
    category?: Exclude<Category, 'All'>;
    suggestedBid?: number;
  };
}

const CATEGORIES: Exclude<Category, 'All'>[] = [
  'AI & Tech',
  'SaaS & Tools',
  'Dev & Open Source',
  'Crypto & Web3',
  'Design & Creative',
  'Indie Makers',
  'Other',
];

export const HeroBiddingCard: React.FC<HeroBiddingCardProps> = ({
  topListing,
  allListings,
  onInitiateBid,
}) => {
  const topBid = topListing ? topListing.currentBid : 10;
  const minToTakeTop = topBid + 5;

  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [tagline, setTagline] = useState('');
  const [category, setCategory] = useState<Exclude<Category, 'All'>>('AI & Tech');
  const [bidAmount, setBidAmount] = useState<number>(minToTakeTop);
  const [error, setError] = useState<string | null>(null);

  // Calculate projected rank
  const calculateProjectedRank = (amount: number): number => {
    if (!allListings.length) return 1;
    let rank = 1;
    for (const item of allListings) {
      if (amount > item.currentBid) {
        break;
      }
      rank++;
    }
    return Math.min(rank, allListings.length + 1);
  };

  const projectedRank = calculateProjectedRank(bidAmount);

  // Handle auto-filling title when URL is typed
  const handleUrlBlur = () => {
    if (url && !title) {
      try {
        let clean = url.trim().replace(/^https?:\/\//, '').replace(/^www\./, '');
        if (clean.startsWith('@')) {
          setTitle(clean);
        } else {
          const domain = clean.split('/')[0].split('.')[0];
          setTitle(domain.charAt(0).toUpperCase() + domain.slice(1));
        }
      } catch {
        // ignore
      }
    }
  };

  const handleQuickAdd = (increment: number) => {
    setBidAmount((prev) => Math.max(5, prev + increment));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!url.trim()) {
      setError('Informe a URL do seu site ou @perfil no X.');
      return;
    }
    if (!title.trim()) {
      setError('Dê um nome para o seu projeto.');
      return;
    }
    if (bidAmount < 5) {
      setError('O lance mínimo na plataforma é de $5.');
      return;
    }

    onInitiateBid({
      url: url.trim(),
      title: title.trim(),
      tagline: tagline.trim() || 'Melhor produto e novidades online.',
      category,
      bidAmount,
    });
  };

  return (
    <div className="w-full bg-white rounded-2xl border border-stone-200/90 shadow-xs p-6 sm:p-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-stone-100">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-orange-50 border border-orange-200/60 text-orange-700 text-xs font-semibold font-mono">
            <Flame className="w-3.5 h-3.5 fill-orange-500 text-orange-500" />
            <span>Pay to Rank • Tráfego Direto</span>
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
            Ranqueie seu produto no topo pelo lance mais alto
          </h1>
          <p className="mt-1 text-stone-500 text-sm max-w-xl">
            Sem anúncios escondidos. Sem burocracia. Quem der o maior lance fica no Topo #1 e recebe todos os cliques.
          </p>
        </div>

        {/* Projected Rank Indicator */}
        <div className="shrink-0 bg-stone-50 border border-stone-200 rounded-xl p-4 text-center lg:min-w-[200px]">
          <span className="text-[11px] uppercase font-bold text-stone-400 font-mono tracking-wider">
            Posição Prevista
          </span>
          <div className="mt-1 flex items-baseline justify-center gap-1">
            <span className="text-3xl sm:text-4xl font-black font-mono text-orange-500">
              #{projectedRank}
            </span>
            <span className="text-xs text-stone-500 font-medium">
              {projectedRank === 1 ? '👑 Topo Absoluto' : `de ${allListings.length + 1}`}
            </span>
          </div>
          <p className="text-[11px] text-stone-500 mt-1">
            {projectedRank === 1
              ? 'Supera o líder atual!'
              : `Fica acima do #${projectedRank + 1}`}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-semibold text-stone-500 uppercase tracking-wider">
            Formulário de Lance
          </span>
          <button
            type="button"
            id="fill-test-data-btn"
            onClick={() => {
              setUrl('https://inacioai.com');
              setTitle('Inacio AI');
              setCategory('AI & Tech');
              setTagline('Assistente inteligente para automação de tarefas e código');
              setBidAmount(minToTakeTop);
              setError(null);
            }}
            className="text-xs font-mono font-medium text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200/80 px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Sparkles className="w-3 h-3 text-orange-500" />
            <span>Preencher Exemplo de Teste</span>
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* URL Input */}
          <div className="space-y-1.5 lg:col-span-2">
            <label htmlFor="bid-url" className="text-xs font-semibold text-stone-700">
              URL do Produto ou @Perfil no X
            </label>
            <input
              id="bid-url"
              type="text"
              placeholder="ex: https://meuapp.com ou @meuperfil"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={handleUrlBlur}
              className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-stone-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-mono"
            />
          </div>

          {/* Project Name */}
          <div className="space-y-1.5">
            <label htmlFor="bid-title" className="text-xs font-semibold text-stone-700">
              Nome do Projeto
            </label>
            <input
              id="bid-title"
              type="text"
              placeholder="ex: MeuApp"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-stone-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label htmlFor="bid-category" className="text-xs font-semibold text-stone-700">
              Categoria
            </label>
            <select
              id="bid-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as Exclude<Category, 'All'>)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-stone-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all bg-white"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tagline */}
        <div className="space-y-1.5">
          <label htmlFor="bid-tagline" className="text-xs font-semibold text-stone-700">
            Descrição Curta (Tagline)
          </label>
          <input
            id="bid-tagline"
            type="text"
            placeholder="O que o seu produto faz? (visível na linha do ranking)"
            value={tagline}
            maxLength={100}
            onChange={(e) => setTagline(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-stone-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
          />
        </div>

        {/* Bid Stepper & Claim CTA */}
        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-stone-700 uppercase font-mono mr-1">
              Valor do Lance:
            </span>

            {/* Numeric input */}
            <div className="relative inline-flex items-center">
              <span className="absolute left-3 text-stone-400 font-mono font-bold text-sm">$</span>
              <input
                id="bid-amount-input"
                type="number"
                min={5}
                step={5}
                value={bidAmount}
                onChange={(e) => setBidAmount(Math.max(5, parseInt(e.target.value) || 5))}
                className="w-28 pl-7 pr-3 py-2 text-base font-bold font-mono text-stone-900 border border-stone-300 rounded-lg focus:outline-hidden focus:border-orange-500"
              />
            </div>

            {/* Steppers */}
            <button
              type="button"
              id="stepper-minus5-btn"
              onClick={() => handleQuickAdd(-5)}
              className="px-2.5 py-2 rounded-lg border border-stone-200 text-stone-600 text-xs font-mono font-medium hover:bg-stone-50"
            >
              -$5
            </button>
            <button
              type="button"
              id="stepper-plus10-btn"
              onClick={() => handleQuickAdd(10)}
              className="px-2.5 py-2 rounded-lg border border-stone-200 text-stone-600 text-xs font-mono font-medium hover:bg-stone-50"
            >
              +$10
            </button>
            <button
              type="button"
              id="stepper-plus25-btn"
              onClick={() => handleQuickAdd(25)}
              className="px-2.5 py-2 rounded-lg border border-stone-200 text-stone-600 text-xs font-mono font-medium hover:bg-stone-50"
            >
              +$25
            </button>
            <button
              type="button"
              id="stepper-take1-btn"
              onClick={() => setBidAmount(minToTakeTop)}
              className="px-3 py-2 rounded-lg bg-orange-50 border border-orange-300 text-orange-800 text-xs font-mono font-bold hover:bg-orange-100 transition-colors flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5 text-orange-500" />
              <span>Assumir #1 (${minToTakeTop})</span>
            </button>
          </div>

          {/* Submit Claim Button */}
          <button
            type="submit"
            id="claim-spot-btn"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm shadow-xs hover:shadow-sm transition-all cursor-pointer font-mono"
          >
            <span>Dar Lance de ${bidAmount}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};

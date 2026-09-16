import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { LiveActivityTicker } from './components/LiveActivityTicker';
import { HeroBiddingCard } from './components/HeroBiddingCard';
import { LeaderboardTable } from './components/LeaderboardTable';
import { BidCheckoutModal } from './components/BidCheckoutModal';
import { AdminModal } from './components/AdminModal';
import { HowItWorksModal } from './components/HowItWorksModal';
import { INITIAL_LISTINGS, INITIAL_EVENTS } from './data/initialListings';
import { Listing, ActivityEvent, Category, StatsSummary } from './types';
import { playBidSound } from './utils/audio';
import { ShieldCheck, Flame } from 'lucide-react';

const STORAGE_KEY_LISTINGS = 'outbid_listings_v1';
const STORAGE_KEY_EVENTS = 'outbid_events_v1';
const STORAGE_KEY_PAYMENT_URL = 'outbid_payment_url_v1';
const DEFAULT_PAYMENT_URL = 'https://paygooogeral.goootrafego.com/?utm_source=ig&utm_medium=social&utm_content=link_in_bio&fbclid=PAcGRvZgJleHRuA2FlbQIxMQBzcnRjBmFwcF9pZA81NjcwNjczNDMzNTI0MjcAAadr02';

export default function App() {
  // Load listings from local storage or defaults
  const [listings, setListings] = useState<Listing[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LISTINGS);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return INITIAL_LISTINGS;
  });

  // Load activity events
  const [events, setEvents] = useState<ActivityEvent[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_EVENTS);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return INITIAL_EVENTS;
  });

  // Payment URL configured by owner
  const [paymentUrl, setPaymentUrl] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PAYMENT_URL);
      if (saved && saved.trim().length > 0) {
        return saved;
      }
    } catch {
      // ignore
    }
    return DEFAULT_PAYMENT_URL;
  });

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [activeDraft, setActiveDraft] = useState<{
    url: string;
    title: string;
    tagline: string;
    category: Exclude<Category, 'All'>;
    bidAmount: number;
    existingListingId?: string;
  } | null>(null);

  // Sync to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LISTINGS, JSON.stringify(listings));
    } catch {
      // ignore
    }
  }, [listings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(events));
    } catch {
      // ignore
    }
  }, [events]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PAYMENT_URL, paymentUrl);
    } catch {
      // ignore
    }
  }, [paymentUrl]);

  // Sort listings: Highest bid first. Equal bids: older timestamp wins.
  const sortedListings = useMemo(() => {
    return [...listings].sort((a, b) => {
      if (b.currentBid !== a.currentBid) {
        return b.currentBid - a.currentBid;
      }
      return a.createdAt - b.createdAt;
    });
  }, [listings]);

  // Computed summary metrics
  const stats: StatsSummary = useMemo(() => {
    const totalRevenue = listings.reduce((acc, curr) => acc + curr.currentBid, 0);
    const totalClicks = listings.reduce((acc, curr) => acc + curr.clicks, 0);
    const topBid = sortedListings[0]?.currentBid || 0;
    return {
      totalRevenue,
      activeListingsCount: listings.length,
      totalClicks,
      topBid,
    };
  }, [listings, sortedListings]);

  // Handle clicking on an external link
  const handleRecordClick = (listingId: string) => {
    setListings((prev) =>
      prev.map((item) =>
        item.id === listingId ? { ...item, clicks: item.clicks + 1 } : item
      )
    );
  };

  // Handle preparing outbid for an existing listing
  const handleOutbidListing = (item: Listing) => {
    setActiveDraft({
      url: item.url,
      title: item.title,
      tagline: item.tagline,
      category: item.category,
      bidAmount: item.currentBid + 10,
      existingListingId: item.id,
    });
  };

  // Confirming a paid bid
  const handleConfirmBid = (draft: {
    url: string;
    title: string;
    tagline: string;
    category: Exclude<Category, 'All'>;
    bidAmount: number;
    existingListingId?: string;
  }) => {
    if (soundEnabled) {
      playBidSound();
    }

    let rankAchieved = 1;
    setListings((prev) => {
      let updated: Listing[];
      const existingIdx = prev.findIndex(
        (l) =>
          (draft.existingListingId && l.id === draft.existingListingId) ||
          l.url.toLowerCase() === draft.url.toLowerCase()
      );

      if (existingIdx >= 0) {
        // Update existing listing
        const old = prev[existingIdx];
        const newListing: Listing = {
          ...old,
          title: draft.title || old.title,
          tagline: draft.tagline || old.tagline,
          category: draft.category || old.category,
          previousBid: old.currentBid,
          currentBid: Math.max(old.currentBid + 5, draft.bidAmount),
          totalBidsCount: old.totalBidsCount + 1,
          updatedAt: Date.now(),
        };
        updated = [...prev];
        updated[existingIdx] = newListing;
      } else {
        // Create brand new listing
        let iconUrl: string | undefined = undefined;
        try {
          if (draft.url.startsWith('http://') || draft.url.startsWith('https://')) {
            iconUrl = `${new URL(draft.url).origin}/favicon.ico`;
          }
        } catch {
          iconUrl = undefined;
        }

        const newListing: Listing = {
          id: `bid-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          title: draft.title,
          url: draft.url,
          tagline: draft.tagline,
          category: draft.category,
          currentBid: draft.bidAmount,
          totalBidsCount: 1,
          clicks: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          iconUrl,
        };
        updated = [newListing, ...prev];
      }

      // Re-sort
      const sorted = [...updated].sort((a, b) => {
        if (b.currentBid !== a.currentBid) {
          return b.currentBid - a.currentBid;
        }
        return a.createdAt - b.createdAt;
      });

      rankAchieved = sorted.findIndex((l) => l.url === draft.url) + 1;
      return sorted;
    });

    // Add activity event
    const newEvent: ActivityEvent = {
      id: `evt-${Date.now()}`,
      timestamp: Date.now(),
      type: draft.existingListingId ? 'increased_bid' : 'new_listing',
      listingTitle: draft.title,
      listingUrl: draft.url,
      bidAmount: draft.bidAmount,
      rankAchieved,
    };

    setEvents((prev) => [newEvent, ...prev.slice(0, 19)]);
  };

  // Admin: delete listing (moderation)
  const handleDeleteListing = (id: string) => {
    setListings((prev) => prev.filter((item) => item.id !== id));
  };

  // Admin: reset data to defaults
  const handleResetData = () => {
    setListings(INITIAL_LISTINGS);
    setEvents(INITIAL_EVENTS);
    localStorage.removeItem(STORAGE_KEY_LISTINGS);
    localStorage.removeItem(STORAGE_KEY_EVENTS);
  };

  const existingListingForDraft = activeDraft?.existingListingId
    ? listings.find((l) => l.id === activeDraft.existingListingId)
    : undefined;

  return (
    <div className="min-h-screen bg-stone-100/70 text-stone-900 font-sans antialiased flex flex-col selection:bg-orange-500 selection:text-white">
      {/* Header */}
      <Header
        stats={stats}
        onOpenHowItWorks={() => setIsHowItWorksOpen(true)}
        onOpenAdmin={() => setIsAdminOpen(true)}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((v) => !v)}
      />

      {/* Live Activity Ticker */}
      <LiveActivityTicker events={events} />

      {/* Main Body */}
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-8 flex-1">
        {/* Hero Bidding Section */}
        <HeroBiddingCard
          topListing={sortedListings[0]}
          allListings={sortedListings}
          onInitiateBid={(draft) => setActiveDraft(draft)}
        />

        {/* Leaderboard Table Feed */}
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-stone-900">
                Tabela Pública de Ranks
              </h2>
              <p className="text-xs text-stone-500">
                Atualização em tempo real baseada no lance mais alto.
              </p>
            </div>
            <span className="font-mono text-xs text-stone-500">
              {sortedListings.length} posições ativas
            </span>
          </div>

          <LeaderboardTable
            listings={sortedListings}
            onOutbidListing={handleOutbidListing}
            onRecordClick={handleRecordClick}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white py-8 px-4 sm:px-6 text-xs text-stone-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-orange-500 text-white flex items-center justify-center">
              <Flame className="w-3 h-3 fill-white" />
            </div>
            <span className="font-mono font-bold text-stone-900">outbid.lol</span>
            <span className="text-stone-300">•</span>
            <span>Pay to Rank Leaderboard</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsHowItWorksOpen(true)}
              className="hover:text-stone-900 transition-colors"
            >
              Regras do Leilão
            </button>
            <span className="text-stone-300">•</span>
            <button
              onClick={() => setIsAdminOpen(true)}
              className="text-amber-800 hover:text-amber-900 font-medium transition-colors flex items-center gap-1"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
              <span>Painel do Administrador (Dono)</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <BidCheckoutModal
        draft={activeDraft}
        existingListing={existingListingForDraft}
        onClose={() => setActiveDraft(null)}
        onConfirmBid={handleConfirmBid}
        paymentUrl={paymentUrl}
      />

      <AdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        listings={sortedListings}
        stats={stats}
        onDeleteListing={handleDeleteListing}
        onResetData={handleResetData}
        paymentUrl={paymentUrl}
        onUpdatePaymentUrl={setPaymentUrl}
      />

      <HowItWorksModal
        isOpen={isHowItWorksOpen}
        onClose={() => setIsHowItWorksOpen(false)}
      />
    </div>
  );
}

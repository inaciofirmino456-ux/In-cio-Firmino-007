export type Category = 
  | 'All'
  | 'AI & Tech'
  | 'SaaS & Tools'
  | 'Dev & Open Source'
  | 'Crypto & Web3'
  | 'Design & Creative'
  | 'Indie Makers'
  | 'Other';

export interface Listing {
  id: string;
  title: string;
  url: string;
  tagline: string;
  category: Exclude<Category, 'All'>;
  currentBid: number; // in USD
  previousBid?: number;
  totalBidsCount: number;
  clicks: number;
  createdAt: number; // timestamp
  updatedAt: number; // timestamp
  iconUrl?: string;
  verified?: boolean;
}

export interface ActivityEvent {
  id: string;
  timestamp: number;
  type: 'new_listing' | 'outbid' | 'increased_bid';
  listingTitle: string;
  listingUrl: string;
  bidAmount: number;
  rankAchieved: number;
}

export interface StatsSummary {
  totalRevenue: number;
  activeListingsCount: number;
  totalClicks: number;
  topBid: number;
}

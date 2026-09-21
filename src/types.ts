export interface Listing {
  id: string;
  normalized_url: string;
  canonical_url: string;
  title: string;
  description: string;
  domain: string;
  category_id: string;
  total_paid_cents: number;
  created_at: string;
  updated_at: string;
  clicks: number;
  status: 'active' | 'removed';
  category?: { name: string; slug: string };
}

export interface CategoryRecord { id: string; slug: string; name: string; }
export interface Order { orderId: string; amountUsd: number; requestedTotalUsd: number; canonicalUrl: string; domain: string; }

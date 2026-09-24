import { supabase } from './supabase';
import type { Order, CategoryRecord } from '../types';

const publicKey = () =>
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

const functionsBase = () => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url) throw new Error('VITE_SUPABASE_URL is not configured');
  return url + '/functions/v1';
};

const headers = () => ({
  'Content-Type': 'application/json',
  ...(publicKey() ? { apikey: publicKey() } : {}),
});

async function callFunction<T>(name: string, body: unknown): Promise<T> {
  const response = await fetch(functionsBase() + '/' + name, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Pedido recusado pelo servidor.');
  return data;
}

export async function createOrder(input: { url: string; categorySlug: string; requestedTotalUsd: number }): Promise<Order> {
  return callFunction<Order>('create-order', input);
}

export async function getCryptoInstructions(orderId: string, network: string, asset: string): Promise<CryptoInstructions> {
  return callFunction<CryptoInstructions>('crypto-payment-instructions', { orderId, network, asset });
}

export interface UrlPreview {
  valid: boolean;
  url?: string;
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  domain?: string;
  error?: string;
}

export async function previewUrl(input: string): Promise<UrlPreview> {
  const trimmed = input.trim();
  const target = trimmed.startsWith("@") ? "https://x.com/" + trimmed.slice(1) : trimmed;

  // Social profile pages (Instagram, X, Facebook, TikTok, LinkedIn, YouTube and Threads)
  // often block server-side HTML scraping even when the public profile is valid.
  // Treat a well-formed public profile URL/handle as valid and let create-order
  // perform the authoritative server-side validation.
  const social =
    /^@[A-Za-z0-9._-]+$/.test(trimmed) ||
    /^https?:\/\/(?:www\.)?(?:instagram\.com|x\.com|twitter\.com|facebook\.com|tiktok\.com|linkedin\.com|youtube\.com|threads\.net)\/[A-Za-z0-9._@-]+\/?(?:[?#].*)?$/i.test(target);

  if (social) {
    const domain = new URL(target).hostname.replace(/^www\./, "");
    return {
      valid: true,
      url: target,
      domain,
      title: domain === "instagram.com" ? "Perfil do Instagram" : "Perfil público",
      description: "Perfil público detetado. A validação final é feita pelo servidor.",
      favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
    };
  }

  return callFunction<UrlPreview>("preview-url", { url: target });
}

export async function detectCryptoPayment(orderId: string, network: string, asset: string) {
  const fn = ["ethereum", "bsc", "robinhood_chain"].includes(network) ? "detect-evm-payment" : "detect-crypto-payment";
  return callFunction<{ status: string; detected?: boolean; txHash?: string; confirmations?: number }>(fn, { orderId, network, asset });
}

export async function getOrderStatus(orderId: string) {
  const base = functionsBase();
  const response = await fetch(base + '/order-status?orderId=' + encodeURIComponent(orderId), {
    method: 'GET',
    headers: headers(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Não foi possível consultar o pedido.');
  return data as { status: string; amountUsd?: number; rank?: number };
}

export async function recordClick(listingId: string) {
  await fetch(functionsBase() + '/click', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ listingId }),
  }).catch(() => undefined);
}

export async function getCategories(): Promise<CategoryRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('categories').select('id,slug,name').order('name');
  if (error) throw error;
  return data ?? [];
}

export async function getListings() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('listings')
    .select('id,normalized_url,canonical_url,title,description,domain,category_id,total_paid_cents,created_at,updated_at,clicks,status,category:categories(name,slug)')
    .eq('status', 'active')
    .order('total_paid_cents', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getDailyDays(): Promise<string[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('listing_daily_totals').select('day_utc').order('day_utc', { ascending: false });
  if (error) throw error;
  return [...new Set((data ?? []).map((row: any) => String(row.day_utc)))];
}

export async function getDailyListings(dayUtc: string) {
  if (!supabase) return [];
  const { data, error } = await supabase.from('listing_daily_totals')
    .select('listing_id,day_utc,paid_cents,first_payment_at,listing:listings(id,normalized_url,canonical_url,title,description,domain,category_id,total_paid_cents,created_at,updated_at,clicks,status,category:categories(name,slug))')
    .eq('day_utc', dayUtc)
    .order('paid_cents', { ascending: false })
    .order('first_payment_at', { ascending: true });
  if (error) throw error;
  return (data ?? [])
    .filter((row: any) => row.listing && row.listing.status === 'active')
    .map((row: any) => ({ ...row.listing, total_paid_cents: Number(row.paid_cents) }));
}

export interface CryptoInstructions {
  network: string;
  asset: string;
  expectedAmount: number;
  expectedUnits: string;
  decimals: number;
  receivingAddress: string;
  expiresAt: string;
}

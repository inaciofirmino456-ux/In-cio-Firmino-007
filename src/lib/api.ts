import { supabase } from './supabase';
import type { Order, CategoryRecord } from '../types';

const functionsBase = () => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url) throw new Error('VITE_SUPABASE_URL is not configured');
  return url + '/functions/v1';
};

const headers = () => ({
  'Content-Type': 'application/json',
  ...(import.meta.env.VITE_SUPABASE_ANON_KEY ? { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY } : {}),
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

export async function startPaymentSession(
  orderId: string,
  provider: 'binance_pay' | 'nowpayments' | 'paygo'
): Promise<PaymentSession> {
  return callFunction<PaymentSession>('payment-session', { orderId, provider });
}

export async function getCryptoInstructions(orderId: string, network: string, asset: string): Promise<CryptoInstructions> {
  return callFunction<CryptoInstructions>('crypto-payment-instructions', { orderId, network, asset });
}

export async function verifyCryptoPayment(orderId: string, network: string, asset: string, txHash: string) {
  return callFunction<{ status: string; message?: string }>('verify-crypto-payment', { orderId, network, asset, txHash });
}

export async function getOrderStatus(orderId: string) {
  return callFunction<{ status: string; amountUsd?: number; rank?: number }>('order-status', { orderId });
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

export interface PaymentSession {
  provider: string;
  providerPaymentId?: string;
  checkoutUrl?: string;
}

export interface CryptoInstructions {
  network: string;
  asset: string;
  expectedAmount: number;
  receivingAddress: string;
  expiresAt: string;
}

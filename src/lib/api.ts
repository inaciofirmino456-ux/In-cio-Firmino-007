import { supabase } from './supabase';
import type { Order } from '../types';

const functionsBase = () => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url) throw new Error('VITE_SUPABASE_URL is not configured');
  return url + '/functions/v1';
};

const headers = () => ({
  'Content-Type': 'application/json',
  ...(import.meta.env.VITE_SUPABASE_ANON_KEY ? { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY } : {}),
});

export async function createOrder(input: { url: string; categorySlug: string; requestedTotalUsd: number }): Promise<Order> {
  const response = await fetch(functionsBase() + '/create-order', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(input),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Não foi possível criar o pedido.');
  return data;
}

export async function startPaymentSession(orderId: string, provider: "binance_pay" | "nowpayments"): Promise<PaymentSession> {
  const response = await fetch(functionsBase() + "/payment-session", { method: "POST", headers: headers(), body: JSON.stringify({ orderId, provider }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Não foi possível iniciar o pagamento.");
  return data;
}

export async function getCryptoInstructions(orderId: string, network: string, asset: string): Promise<CryptoInstructions> {
  const response = await fetch(functionsBase() + "/crypto-payment-instructions", { method: "POST", headers: headers(), body: JSON.stringify({ orderId, network, asset }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Não foi possível preparar o pagamento crypto.");
  return data;
}

export async function recordClick(listingId: string) {
  await fetch(functionsBase() + '/click', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ listingId }),
  }).catch(() => undefined);
}

export async function getCategories() {
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

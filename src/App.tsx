import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowRight, ExternalLink, Flame, Loader2, ShieldCheck } from 'lucide-react';
import { createOrder, getCategories, getListings, recordClick } from './lib/api';
import { supabase } from './lib/supabase';
import type { CategoryRecord, Listing } from './types';

const MIN_BID_USD = 1;
const MAX_BID_USD = 999999;
const TOP_RANK_INCREMENT_USD = 5;

function money(cents: number) { return '$' + (cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 }); }
function relativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return seconds + 's ago';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + 'm ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h ago';
  return Math.floor(hours / 24) + 'd ago';
}

export default function App() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState('');
  const [bid, setBid] = useState(1);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [order, setOrder] = useState<{ id: string; amount: number } | null>(null);
  const [error, setError] = useState('');

  async function refresh() {
    const [nextListings, nextCategories] = await Promise.all([getListings(), getCategories()]);
    setListings(nextListings.map((item) => ({
      ...item,
      category: Array.isArray(item.category) ? item.category[0] : item.category,
    })) as unknown as Listing[]);
    setCategories(nextCategories as CategoryRecord[]);
    if (!category && nextCategories[0]) setCategory(nextCategories[0].slug);
  }

  useEffect(() => {
    refresh().catch((e) => setError(e instanceof Error ? e.message : 'Falha ao carregar.'));
    setLoading(false);
    const client = supabase;
    if (!client) return;
    const channel = client.channel('public-listings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listings' }, () => { refresh().catch(() => undefined); })
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, []);

  const top = listings[0];
  const minForTop = top ? Math.max(MIN_BID_USD, top.total_paid_cents / 100 + TOP_RANK_INCREMENT_USD) : MIN_BID_USD;
  const projectedRank = useMemo(() => {
    const index = listings.findIndex((item) => bid * 100 > item.total_paid_cents);
    return index < 0 ? listings.length + 1 : index + 1;
  }, [bid, listings]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setOrder(null);
    const requested = Math.min(MAX_BID_USD, Math.max(MIN_BID_USD, Math.floor(bid)));
    if (!url.trim()) return setError('Introduza a URL do site ou um @handle do X.');
    if (!category) return setError('Escolha uma categoria.');
    setCreating(true);
    try {
      const created = await createOrder({ url: url.trim(), categorySlug: category, requestedTotalUsd: requested });
      setOrder({ id: created.orderId, amount: created.amountUsd });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível criar o pedido.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-stone-900">
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <a href="/" className="flex items-center gap-2 font-black tracking-tight">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-orange-500 text-white"><Flame size={19}/></span>
            <span className="text-xl">TopBid</span>
          </a>
          <nav className="flex gap-4 text-sm text-stone-600"><a href="/today">Today</a><a href="/faq">FAQ</a><a href="/rules">Rules</a></nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_220px]">
            <div><p className="mb-2 text-xs font-bold uppercase tracking-widest text-orange-600">Pay to rank</p><h1 className="text-3xl font-black tracking-tight sm:text-5xl">Claim your place on the public leaderboard.</h1><p className="mt-3 max-w-2xl text-stone-500">Rank is determined only by confirmed money paid. No login is required to start checkout.</p></div>
            <div className="rounded-2xl bg-stone-950 p-5 text-white"><div className="text-xs uppercase tracking-widest text-stone-400">Target position</div><div className="mt-1 text-4xl font-black">#{projectedRank}</div><div className="mt-2 text-xs text-stone-400">Minimum for #1: {money(Math.round(minForTop * 100))}</div></div>
          </div>
          <form onSubmit={submit} className="mt-8 grid gap-4 md:grid-cols-[2fr_1fr_1fr_auto]">
            <input value={url} onChange={(e)=>setUrl(e.target.value)} placeholder="https://yourproduct.com or @handle" className="rounded-xl border border-stone-300 px-4 py-3 outline-none focus:border-orange-500"/>
            <select value={category} onChange={(e)=>setCategory(e.target.value)} className="rounded-xl border border-stone-300 bg-white px-4 py-3">{categories.map(c=><option key={c.id} value={c.slug}>{c.name}</option>)}</select>
            <input type="number" min={MIN_BID_USD} max={MAX_BID_USD} step={1} value={bid} onChange={(e)=>setBid(Number(e.target.value)||MIN_BID_USD)} className="rounded-xl border border-stone-300 px-4 py-3"/>
            <button disabled={creating} className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 font-bold text-white hover:bg-orange-600 disabled:opacity-60">{creating?<Loader2 className="animate-spin" size={18}/>:<ArrowRight size={18}/>} Claim</button>
          </form>
          {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {order && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"><strong>Pedido criado:</strong> {order.id}. Valor a pagar: <strong>{'$' + order.amount}</strong>. O checkout só deve ser liberado por um provedor configurado no servidor; não existe botão de “já paguei”.</div>}
          <p className="mt-4 flex items-center gap-2 text-xs text-stone-500"><ShieldCheck size={14}/> O ranking só muda depois de confirmação no servidor.</p>
        </section>
        <section className="mt-8 overflow-hidden rounded-3xl border border-stone-200 bg-white">
          <div className="border-b border-stone-200 px-5 py-4"><h2 className="font-bold">All-time ranking</h2></div>
          {loading?<div className="p-10 text-center"><Loader2 className="mx-auto animate-spin"/></div>:listings.length===0?<div className="p-10 text-center text-stone-500">No confirmed listings yet.</div>:listings.map((item,index)=>(
            <article key={item.id} className="grid gap-3 border-b border-stone-100 px-5 py-5 sm:grid-cols-[70px_1fr_auto] sm:items-center">
              <div className="text-lg font-black text-stone-400">#{index+1}</div>
              <div className="min-w-0"><a href={item.canonical_url} target="_blank" rel="noreferrer" onClick={()=>recordClick(item.id)} className="inline-flex items-center gap-1 font-bold hover:text-orange-600">{item.title}<ExternalLink size={13}/></a><p className="mt-1 line-clamp-2 text-sm text-stone-500">{item.description}</p><div className="mt-2 flex flex-wrap gap-2 text-xs text-stone-400"><span>{item.category?.name}</span><span>·</span><span>{item.domain}</span><span>·</span><span>{relativeTime(item.created_at)}</span><span>·</span><span>{item.clicks} clicks</span></div></div>
              <div className="text-right"><div className="text-xl font-black">{money(item.total_paid_cents)}</div><button onClick={()=>{setUrl(item.canonical_url);setBid(item.total_paid_cents/100+(index===0?TOP_RANK_INCREMENT_USD:1));window.scrollTo({top:0,behavior:'smooth'});}} className="text-xs font-bold text-orange-600">Claim this rank for {money(item.total_paid_cents+(index===0?TOP_RANK_INCREMENT_USD*100:100))}</button></div>
            </article>
          ))}
        </section>
      </main>
      <footer className="mx-auto max-w-6xl px-4 py-10 text-xs text-stone-500">TopBid · payments are final and rankings update only after verified payment confirmation.</footer>
    </div>
  );
}

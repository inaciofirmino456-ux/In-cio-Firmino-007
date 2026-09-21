import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, Flame, Loader2, ShieldCheck } from "lucide-react";
import { createOrder, getCategories, getListings, recordClick, startPaymentSession, getCryptoInstructions } from "./lib/api";
import { supabase } from "./lib/supabase";
import type { CategoryRecord, Listing } from "./types";

const MIN_BID_USD = 1;
const MAX_BID_USD = 999999;
const TOP_RANK_INCREMENT_USD = 5;

function money(cents: number) {
  return "$" + (cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 });
}
function relativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return seconds + "s ago";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + "m ago";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h ago";
  return Math.floor(hours / 24) + "d ago";
}
function path() { return window.location.pathname.replace(/\/+$/, "") || "/"; }

export default function App() {
  const [route, setRoute] = useState(path());
  const [listings, setListings] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("");
  const [bid, setBid] = useState(1);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [order, setOrder] = useState<{ id: string; amount: number } | null>(null);
  const [paymentLoading, setPaymentLoading] = useState("");
  const [paymentUrl, setPaymentUrl] = useState("");
  const [crypto, setCrypto] = useState<{ network: string; asset: string; amount: number; address: string; expiresAt: string } | null>(null);
  const [error, setError] = useState("");

  function navigate(to: string) {
    window.history.pushState({}, "", to);
    setRoute(to);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function refresh() {
    const [nextListings, nextCategories] = await Promise.all([getListings(), getCategories()]);
    setListings(nextListings.map((item) => {
      const rawCategory = Array.isArray(item.category) ? item.category[0] : item.category;
      return { ...item, category: rawCategory ? { name: String(rawCategory.name), slug: String(rawCategory.slug) } : undefined } as Listing;
    }));
    setCategories(nextCategories as CategoryRecord[]);
    if (!category && nextCategories[0]) setCategory(nextCategories[0].slug);
  }

  useEffect(() => {
    const onPop = () => setRoute(path());
    window.addEventListener("popstate", onPop);
    refresh().catch((e) => setError(e instanceof Error ? e.message : "Falha ao carregar."));
    setLoading(false);
    const client = supabase;
    if (!client) return () => window.removeEventListener("popstate", onPop);
    const channel = client.channel("public-listings")
      .on("postgres_changes", { event: "*", schema: "public", table: "listings" }, () => refresh().catch(() => undefined))
      .subscribe();
    return () => {
      window.removeEventListener("popstate", onPop);
      client.removeChannel(channel);
    };
  }, []);

  const top = listings[0];
  const minForTop = top ? top.total_paid_cents / 100 + TOP_RANK_INCREMENT_USD : MIN_BID_USD;
  const projectedRank = useMemo(() => {
    const index = listings.findIndex((item) => bid * 100 > item.total_paid_cents);
    return index < 0 ? listings.length + 1 : index + 1;
  }, [bid, listings]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setOrder(null);
    setPaymentUrl("");
    setCrypto(null);
    const requested = Math.min(MAX_BID_USD, Math.max(MIN_BID_USD, Math.floor(Number(bid) || 1)));
    if (!url.trim()) return setError("Introduza a URL do site ou um @handle do X.");
    if (!category) return setError("Escolha uma categoria.");
    setCreating(true);
    try {
      const created = await createOrder({ url: url.trim(), categorySlug: category, requestedTotalUsd: requested });
      setOrder({ id: created.orderId, amount: created.amountUsd });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível criar o pedido.");
    } finally {
      setCreating(false);
    }
  }

  async function pay(provider: "binance_pay" | "nowpayments") {
    if (!order) return;
    setPaymentLoading(provider);
    setError("");
    try {
      const result = await startPaymentSession(order.id, provider);
      if (!result.checkoutUrl) throw new Error("O provedor não devolveu um checkout.");
      setPaymentUrl(result.checkoutUrl);
      window.location.href = result.checkoutUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao iniciar pagamento.");
    } finally {
      setPaymentLoading("");
    }
  }

  async function prepareCrypto(network: string, asset: string) {
    if (!order) return;
    setPaymentLoading(network + asset);
    setError("");
    try {
      const result = await getCryptoInstructions(order.id, network, asset);
      setCrypto({ network, asset, amount: result.expectedAmount, address: result.receivingAddress, expiresAt: result.expiresAt });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível preparar o pagamento.");
    } finally {
      setPaymentLoading("");
    }
  }

  const Header = () => (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 font-black tracking-tight">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-orange-500 text-white"><Flame size={19} /></span>
          <span className="text-xl">TopBid</span>
        </button>
        <nav className="flex gap-4 text-sm font-medium text-stone-600">
          <button onClick={() => navigate("/today")} className="hover:text-orange-600">Today</button>
          <button onClick={() => navigate("/faq")} className="hover:text-orange-600">FAQ</button>
          <button onClick={() => navigate("/rules")} className="hover:text-orange-600">Rules</button>
        </nav>
      </div>
    </header>
  );

  const InfoPage = ({ title, children }: { title: string; children: ReactNode }) => (
    <><Header /><main className="mx-auto max-w-4xl px-4 py-10"><button onClick={() => navigate("/")} className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-orange-600"><ArrowLeft size={16} /> Back</button><section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-10"><h1 className="text-3xl font-black">{title}</h1><div className="mt-6 space-y-5 text-sm leading-7 text-stone-600">{children}</div></section></main></>
  );

  if (route === "/faq") return <InfoPage title="FAQ"><div><strong>Do I need an account?</strong><p>No. You can start a payment without logging in.</p></div><div><strong>When does a rank change?</strong><p>Only after the server verifies and confirms the payment.</p></div><div><strong>Can I increase an existing rank?</strong><p>Yes. A re-bid charges only the difference, and the new total must be at least $1 higher.</p></div></InfoPage>;
  if (route === "/rules") return <InfoPage title="Rules"><div><strong>Minimum bid:</strong> $1.</div><div><strong>#1:</strong> the new total must be at least $5 above the current #1.</div><div><strong>Ties:</strong> the older confirmed entry stays ahead.</div><div><strong>Links:</strong> product sites and X profiles only. Chat/invite, adult, affiliate and tracking links are rejected.</div><div><strong>Payments:</strong> final and non-refundable. A listing changes only after verified payment.</div></InfoPage>;

  const visibleListings = route === "/today"
    ? listings.filter((item) => new Date(item.created_at).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10))
    : listings;

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-stone-900">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_220px]">
            <div><p className="mb-2 text-xs font-bold uppercase tracking-widest text-orange-600">Pay to rank</p><h1 className="text-3xl font-black tracking-tight sm:text-5xl">Claim your place on the public leaderboard.</h1><p className="mt-3 max-w-2xl text-stone-500">Enter your product URL or X handle, choose a category and pay. The ranking changes only after verified payment.</p></div>
            <div className="rounded-2xl bg-stone-950 p-5 text-white"><div className="text-xs uppercase tracking-widest text-stone-400">Target position</div><div className="mt-1 text-4xl font-black">#{projectedRank}</div><div className="mt-2 text-xs text-stone-400">Minimum for #1: {money(Math.round(minForTop * 100))}</div></div>
          </div>
          <form onSubmit={submit} className="mt-8 grid gap-4 md:grid-cols-[2fr_1fr_1fr_auto]">
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://yourproduct.com or @handle" className="rounded-xl border border-stone-300 px-4 py-3 outline-none focus:border-orange-500" />
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-xl border border-stone-300 bg-white px-4 py-3"><option value="">Category</option>{categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}</select>
            <input type="number" min={MIN_BID_USD} max={MAX_BID_USD} step={1} value={bid} onChange={(e) => setBid(Number(e.target.value) || 1)} className="rounded-xl border border-stone-300 px-4 py-3" />
            <button disabled={creating} className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 font-bold text-white hover:bg-orange-600 disabled:opacity-60">{creating ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />} Claim</button>
          </form>
          {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {order && (
            <div className="mt-5 rounded-2xl border border-orange-200 bg-orange-50 p-5">
              <div className="flex items-center gap-2 font-bold"><CheckCircle2 size={18} className="text-orange-600" /> Pedido criado · {money(Math.round(order.amount * 100))}</div>
              <p className="mt-2 text-sm text-stone-600">Escolha um método para pagar. O ranking só será alterado após confirmação.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <button onClick={() => pay("binance_pay")} disabled={!!paymentLoading} className="rounded-xl bg-stone-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{paymentLoading === "binance_pay" ? "A abrir..." : "Binance Pay"}</button>
                <button onClick={() => pay("nowpayments")} disabled={!!paymentLoading} className="rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-bold disabled:opacity-50">{paymentLoading === "nowpayments" ? "A abrir..." : "Crypto checkout"}</button>
                <button onClick={() => prepareCrypto("bitcoin", "BTC")} disabled={!!paymentLoading} className="rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-bold disabled:opacity-50">Bitcoin</button>
                <button onClick={() => prepareCrypto("ethereum", "USDT")} disabled={!!paymentLoading} className="rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-bold disabled:opacity-50">USDT · Ethereum</button>
              </div>
              {paymentUrl && <a href={paymentUrl} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-orange-600">Abrir checkout <ExternalLink size={14} /></a>}
              {crypto && <div className="mt-4 rounded-xl bg-white p-4 text-sm"><div><strong>{crypto.asset} · {crypto.network}</strong></div><div className="mt-2 break-all font-mono text-xs">{crypto.address}</div><div className="mt-2 font-bold">Enviar exatamente: {crypto.amount}</div><div className="mt-2 text-xs text-stone-500">Depois de enviar, a verificação deve ser feita pelo servidor com o TX hash.</div></div>}
            </div>
          )}
          <p className="mt-4 flex items-center gap-2 text-xs text-stone-500"><ShieldCheck size={14} /> Pagamentos e ranking são validados no servidor.</p>
        </section>

        <section className="mt-8 overflow-hidden rounded-3xl border border-stone-200 bg-white">
          <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4"><h2 className="font-bold">{route === "/today" ? "Today" : "All-time ranking"}</h2>{route !== "/today" && <button onClick={() => navigate("/today")} className="text-xs font-bold text-orange-600">See today</button>}</div>
          {loading ? <div className="p-10 text-center"><Loader2 className="mx-auto animate-spin" /></div> : visibleListings.length === 0 ? <div className="p-10 text-center text-stone-500">No confirmed listings yet.</div> : visibleListings.map((item, index) => (
            <article key={item.id} className="grid gap-3 border-b border-stone-100 px-5 py-5 sm:grid-cols-[70px_1fr_auto] sm:items-center">
              <div className="text-lg font-black text-stone-400">#{index + 1}</div>
              <div className="min-w-0"><a href={item.canonical_url} target="_blank" rel="noreferrer" onClick={() => recordClick(item.id)} className="inline-flex items-center gap-1 font-bold hover:text-orange-600">{item.title}<ExternalLink size={13} /></a><p className="mt-1 line-clamp-2 text-sm text-stone-500">{item.description}</p><div className="mt-2 flex flex-wrap gap-2 text-xs text-stone-400"><span>{item.category?.name}</span><span>·</span><span>{item.domain}</span><span>·</span><span>{relativeTime(item.created_at)}</span><span>·</span><span>{item.clicks} clicks</span></div></div>
              <div className="text-right"><div className="text-xl font-black">{money(item.total_paid_cents)}</div><button onClick={() => { setUrl(item.canonical_url); setBid(item.total_paid_cents / 100 + (index === 0 ? TOP_RANK_INCREMENT_USD : 1)); navigate("/"); }} className="text-xs font-bold text-orange-600">Claim for {money(item.total_paid_cents + (index === 0 ? TOP_RANK_INCREMENT_USD * 100 : 100))}</button></div>
            </article>
          ))}
        </section>
      </main>
      <footer className="mx-auto max-w-6xl px-4 py-10 text-xs text-stone-500">TopBid · verified payments only · no fake/test payment controls.</footer>
    </div>
  );
}

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, CheckCircle2, ExternalLink, Flame, Loader2, Menu, ShieldCheck, X } from "lucide-react";
import {
  createOrder,
  getCategories,
  getListings,
  getDailyListings,
  getDailyDays,
  recordClick,
  startPaymentSession,
  getCryptoInstructions,
  verifyCryptoPayment,
  getOrderStatus,
} from "./lib/api";
import { supabase } from "./lib/supabase";
import type { CategoryRecord, Listing } from "./types";

const MIN_BID_USD = 1;
const MAX_BID_USD = 999999;
const TOP_RANK_INCREMENT_USD = 5;

const FALLBACK_CATEGORIES = [
  ["ai-agents-infrastructure","AI Agents & Infrastructure"],
  ["seo-ai-visibility","SEO & AI Visibility"],
  ["marketing-advertising","Marketing & Advertising"],
  ["analytics","Analytics"],
  ["crypto-web3-investing","Crypto, Web3 & Investing"],
  ["developer-tools","Developer Tools"],
  ["business-finance-legal","Business, Finance & Legal"],
  ["security-privacy-compliance","Security, Privacy & Compliance"],
  ["health-fitness-wellness","Health, Fitness & Wellness"],
  ["social-media-creator-tools","Social Media & Creator Tools"],
  ["leaderboards-attention-markets","Leaderboards & Attention Markets"],
  ["hiring-jobs-careers","Hiring, Jobs & Careers"],
  ["education-learning","Education & Learning"],
  ["agencies-studios-services","Agencies, Studios & Services"],
  ["ecommerce-retail","Ecommerce & Retail"],
  ["domains-web-assets","Domains & Web Assets"],
  ["games-entertainment","Games & Entertainment"],
  ["people-profiles","People & Profiles"],
  ["productivity-personal-tools","Productivity & Personal Tools"],
  ["design-creative","Design & Creative"],
  ["writing-content","Writing & Content"],
  ["directories-launch-discovery","Directories, Launch & Discovery"],
  ["ai-media-generation","AI Media Generation"],
  ["audio-voice-podcasting","Audio, Voice & Podcasting"],
  ["sales-lead-generation","Sales & Lead Generation"],
  ["travel-local-lifestyle","Travel, Local & Lifestyle"],
  ["real-estate-property","Real Estate & Property"],
  ["media-news","Media & News"],
  ["other","Other"],
] as const;

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
function currentPath() { return window.location.pathname.replace(/\/+$/, "") || "/"; }
function slugLabel(slug: string) {
  return FALLBACK_CATEGORIES.find(([s]) => s === slug)?.[1] ?? slug.replaceAll("-", " ");
}
function todayUtc(value: string) {
  return new Date(value).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
}

export default function App() {
  const [route, setRoute] = useState(currentPath());
  const [listings, setListings] = useState<Listing[]>([]);
  const [dailyListings, setDailyListings] = useState<Listing[]>([]);
  const [dailyDays, setDailyDays] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState(new Date().toISOString().slice(0, 10));
  const [dailyDays, setDailyDays] = useState<string[]>([]);
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
  const [txHash, setTxHash] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [error, setError] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);

  const navigate = (to: string) => {
    window.history.pushState({}, "", to);
    setRoute(to);
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  async function refresh() {
    const today = new Date().toISOString().slice(0, 10);
    const [nextListings, nextCategories, nextDaily, nextDays] = await Promise.all([getListings(), getCategories(), getDailyListings(today), getDailyDays()]);
    setDailyListings(nextDaily as Listing[]);
    setDailyDays(nextDays);
    setListings(nextListings.map((item) => {
      const rawCategory = Array.isArray(item.category) ? item.category[0] : item.category;
      return { ...item, category: rawCategory ? { name: String(rawCategory.name), slug: String(rawCategory.slug) } : undefined } as Listing;
    }));
    setCategories(nextCategories);
    if (!category && nextCategories[0]) setCategory(nextCategories[0].slug);
  }

  useEffect(() => {
    const onPop = () => setRoute(currentPath());
    window.addEventListener("popstate", onPop);
    refresh().catch((e) => setError(e instanceof Error ? e.message : "Falha ao carregar dados."));
    setLoading(false);
    const channel = supabase?.channel("topbid-listings")
      .on("postgres_changes", { event: "*", schema: "public", table: "listings" }, () => refresh().catch(() => undefined))
      .subscribe();
    return () => {
      window.removeEventListener("popstate", onPop);
      if (channel && supabase) supabase.removeChannel(channel);
    };
  }, []);

  const allCategories = categories.length ? categories : FALLBACK_CATEGORIES.map(([slug,name]) => ({ id: slug, slug, name }));
  const top = listings[0];
  const minForTop = top ? top.total_paid_cents / 100 + TOP_RANK_INCREMENT_USD : MIN_BID_USD;
  const projectedRank = useMemo(() => {
    const index = listings.findIndex((item) => bid * 100 > item.total_paid_cents);
    return index < 0 ? listings.length + 1 : index + 1;
  }, [bid, listings]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(""); setOrder(null); setPaymentUrl(""); setCrypto(null); setTxHash(""); setPaymentStatus("");
    const requested = Math.min(MAX_BID_USD, Math.max(MIN_BID_USD, Math.floor(Number(bid) || 1)));
    if (!url.trim()) return setError("Introduza a URL do site ou um @handle do X.");
    if (!category) return setError("Escolha uma categoria.");
    setCreating(true);
    try {
      const created = await createOrder({ url: url.trim(), categorySlug: category, requestedTotalUsd: requested });
      setOrder({ id: created.orderId, amount: created.amountUsd });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível criar o pedido.");
    } finally { setCreating(false); }
  }

  async function pay(provider: "binance_pay" | "nowpayments" | "paygo") {
    if (!order) return;
    setPaymentLoading(provider); setError("");
    try {
      const result = await startPaymentSession(order.id, provider);
      if (!result.checkoutUrl) throw new Error("O provedor não devolveu um checkout configurado.");
      setPaymentUrl(result.checkoutUrl);
      window.location.href = result.checkoutUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao iniciar pagamento.");
    } finally { setPaymentLoading(""); }
  }

  async function prepareCrypto(network: string, asset: string) {
    if (!order) return;
    setPaymentLoading(network + asset); setError(""); setPaymentStatus("");
    try {
      const result = await getCryptoInstructions(order.id, network, asset);
      setCrypto({ network, asset, amount: result.expectedAmount, address: result.receivingAddress, expiresAt: result.expiresAt });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível preparar o pagamento.");
    } finally { setPaymentLoading(""); }
  }

  async function confirmCrypto() {
    if (!order || !crypto || !txHash.trim()) return setError("Introduza o TX hash da transação.");
    setPaymentLoading("verify"); setError(""); setPaymentStatus("");
    try {
      const result = await verifyCryptoPayment(order.id, crypto.network, crypto.asset, txHash.trim());
      setPaymentStatus(result.status === "paid" ? "Pagamento confirmado. O ranking será atualizado." : (result.message || result.status));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "A transação ainda não foi confirmada.");
    } finally { setPaymentLoading(""); }
  }

  useEffect(() => {
    if (!order || !paymentStatus.includes("aguard")) return;
    const timer = window.setInterval(async () => {
      try {
        const status = await getOrderStatus(order.id);
        if (status.status === "paid") { setPaymentStatus("Pagamento confirmado. O ranking foi atualizado."); await refresh(); window.clearInterval(timer); }
      } catch {}
    }, 4000);
    return () => window.clearInterval(timer);
  }, [order, paymentStatus]);

  const Header = () => (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:py-4">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 font-black tracking-tight" aria-label="TopBid início">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-orange-500 text-white"><Flame size={19}/></span>
          <span className="text-xl">TopBid</span>
        </button>
        <nav className="hidden items-center gap-5 text-sm font-semibold text-stone-600 md:flex">
          <button onClick={() => navigate("/ranking")}>Ranking</button>
          <button onClick={() => navigate("/categories")}>Categorias</button>
          <button onClick={() => navigate("/how-it-works")}>Como funciona</button>
          <button onClick={() => navigate("/faq")}>FAQ</button>
          <button onClick={() => navigate("/rules")}>Regras</button>
        </nav>
        <button className="md:hidden rounded-xl border border-stone-200 p-2" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Abrir menu">
          {mobileMenu ? <X size={20}/> : <Menu size={20}/>}
        </button>
      </div>
      {mobileMenu && <nav className="grid gap-1 border-t border-stone-200 bg-white p-3 md:hidden">
        {[
          ["/ranking","Ranking"],["/categories","Categorias"],["/how-it-works","Como funciona"],
          ["/faq","FAQ"],["/rules","Regras"]
        ].map(([href,label]) => <button key={href} onClick={() => navigate(href)} className="rounded-xl px-4 py-3 text-left font-semibold hover:bg-stone-50">{label}</button>)}
      </nav>}
    </header>
  );

  const Footer = () => <footer className="mx-auto max-w-6xl px-4 py-10 text-xs text-stone-500">
    <div className="flex flex-wrap gap-x-5 gap-y-2">
      <button onClick={() => navigate("/rules")}>Regras</button><button onClick={() => navigate("/faq")}>FAQ</button>
      <button onClick={() => navigate("/how-it-works")}>Como funciona</button><button onClick={() => navigate("/categories")}>Categorias</button>
    </div>
    <p className="mt-4">TopBid · pagamentos verificados · sem pagamentos simulados.</p>
  </footer>;

  const InfoPage = ({ title, children }: { title: string; children: ReactNode }) => (
    <><Header/><main className="mx-auto max-w-4xl px-4 py-8 sm:py-12"><section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-10"><h1 className="text-3xl font-black sm:text-4xl">{title}</h1><div className="mt-7 space-y-6 text-sm leading-7 text-stone-600">{children}</div></section></main><Footer/></>
  );

  const ListingRows = ({ rows, heading }: { rows: Listing[]; heading: string }) => (
    <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-5 py-4"><h2 className="font-bold">{heading}</h2><span className="text-xs text-stone-400">{rows.length} resultados</span></div>
      {rows.length === 0 ? <div className="p-10 text-center text-stone-500">Ainda não existem posições confirmadas.</div> : rows.map((item,index) =>
        <article key={item.id} className="grid gap-3 border-b border-stone-100 px-5 py-5 sm:grid-cols-[70px_1fr_auto] sm:items-center">
          <div className="text-lg font-black text-stone-400">#{index+1}</div>
          <div className="min-w-0">
            <a href={item.canonical_url} target="_blank" rel="noreferrer" onClick={() => recordClick(item.id)} className="inline-flex max-w-full items-center gap-1 font-bold hover:text-orange-600"><span className="truncate">{item.title}</span><ExternalLink size={13}/></a>
            <p className="mt-1 line-clamp-2 text-sm text-stone-500">{item.description}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-stone-400"><span>{item.category?.name}</span><span>·</span><span>{item.domain}</span><span>·</span><span>{relativeTime(item.created_at)}</span><span>·</span><span>{item.clicks} clicks</span></div>
          </div>
          <div className="flex items-center justify-between gap-4 sm:block sm:text-right"><div className="text-xl font-black">{money(item.total_paid_cents)}</div><button onClick={() => {setUrl(item.canonical_url);setCategory(item.category?.slug||"");setBid(item.total_paid_cents/100+(index===0?5:1));navigate("/")}} className="text-xs font-bold text-orange-600">Claim for {money(item.total_paid_cents+(index===0?500:100))}</button></div>
        </article>
      )}
    </section>
  );

  const MainForm = () => (
    <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
        <div><p className="mb-2 text-xs font-bold uppercase tracking-widest text-orange-600">Pay to rank</p><h1 className="text-3xl font-black tracking-tight sm:text-5xl">Claim your place on the public leaderboard.</h1><p className="mt-3 max-w-2xl text-stone-500">Enter your product URL or X handle, choose a category and pay. The ranking changes only after verified payment.</p></div>
        <div className="rounded-2xl bg-stone-950 p-5 text-white"><div className="text-xs uppercase tracking-widest text-stone-400">Target position</div><div className="mt-1 text-4xl font-black">#{projectedRank}</div><div className="mt-2 text-xs text-stone-400">Minimum for #1: {money(Math.round(minForTop*100))}</div></div>
      </div>
      <form onSubmit={submit} className="mt-8 grid gap-3 md:grid-cols-[2fr_1.2fr_1fr_auto]">
        <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://yourproduct.com or @handle" className="min-w-0 rounded-xl border border-stone-300 px-4 py-3 outline-none focus:border-orange-500"/>
        <select value={category} onChange={e=>setCategory(e.target.value)} className="min-w-0 rounded-xl border border-stone-300 bg-white px-4 py-3"><option value="">Escolha uma categoria</option>{allCategories.map(c=><option key={c.id} value={c.slug}>{c.name}</option>)}</select>
        <input type="number" min={MIN_BID_USD} max={MAX_BID_USD} step={1} value={bid} onChange={e=>setBid(Number(e.target.value)||1)} className="min-w-0 rounded-xl border border-stone-300 px-4 py-3"/>
        <button disabled={creating} className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 font-bold text-white hover:bg-orange-600 disabled:opacity-60">{creating?<Loader2 className="animate-spin" size={18}/>:<ArrowRight size={18}/>} Alegar</button>
      </form>
      {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {order && <div className="mt-5 rounded-2xl border border-orange-200 bg-orange-50 p-5">
        <div className="flex items-center gap-2 font-bold"><CheckCircle2 size={18} className="text-orange-600"/> Pedido criado · {money(Math.round(order.amount*100))}</div>
        <p className="mt-2 text-sm text-stone-600">Escolha o método de pagamento. O ranking só muda depois da confirmação.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <button onClick={()=>pay("paygo")} disabled={!!paymentLoading} className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{paymentLoading==="paygo"?"A abrir...":"Cartão · PayGo"}</button>
          <button onClick={()=>pay("binance_pay")} disabled={!!paymentLoading} className="rounded-xl bg-stone-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{paymentLoading==="binance_pay"?"A abrir...":"Binance Pay"}</button>
          <button onClick={()=>pay("nowpayments")} disabled={!!paymentLoading} className="rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-bold disabled:opacity-50">Crypto checkout</button>
          <button onClick={()=>prepareCrypto("bitcoin","BTC")} disabled={!!paymentLoading} className="rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-bold disabled:opacity-50">Bitcoin</button>
          <button onClick={()=>prepareCrypto("ethereum","USDT")} disabled={!!paymentLoading} className="rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-bold disabled:opacity-50">USDT · Ethereum</button>
        </div>
        {paymentUrl && <a href={paymentUrl} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-orange-600">Abrir checkout <ExternalLink size={14}/></a>}
        {crypto && <div className="mt-4 rounded-xl bg-white p-4 text-sm">
          <div className="font-bold">{crypto.asset} · {crypto.network}</div><div className="mt-2 break-all font-mono text-xs">{crypto.address}</div><div className="mt-2 font-bold">Enviar exatamente: {crypto.amount}</div>
          <div className="mt-3"><input value={txHash} onChange={e=>setTxHash(e.target.value)} placeholder="Cole aqui o TX hash" className="w-full rounded-xl border border-stone-300 px-3 py-3 font-mono text-xs"/></div>
          <button onClick={confirmCrypto} disabled={paymentLoading==="verify"} className="mt-3 rounded-xl bg-stone-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{paymentLoading==="verify"?"A verificar...":"Verificar pagamento"}</button>
          <p className="mt-2 text-xs text-stone-500">O servidor verifica rede, ativo, destinatário, valor e confirmações antes de alterar o ranking.</p>
        </div>}
        {paymentStatus && <p className="mt-3 rounded-xl bg-white p-3 text-sm font-semibold text-green-700">{paymentStatus}</p>}
      </div>}
      <p className="mt-4 flex items-center gap-2 text-xs text-stone-500"><ShieldCheck size={14}/> Pagamentos e ranking são validados no servidor.</p>
    </section>
  );

  if (route === "/404") return <InfoPage title="404"><p>A página que procuras não existe.</p><button onClick={()=>navigate("/")} className="rounded-xl bg-orange-500 px-5 py-3 font-bold text-white">Voltar ao início</button></InfoPage>;
  if (route === "/rules") return <InfoPage title="Regras"><p>O ranking é público e a posição é determinada pelo valor confirmado.</p><p><strong>Valor mínimo:</strong> $1 para uma nova entrada. Para assumir o #1, o total deve ficar pelo menos $5 acima do atual #1.</p><p><strong>Empates:</strong> quando os valores são iguais, a entrada confirmada mais antiga permanece acima.</p><p><strong>Re-bid:</strong> usa a mesma URL ou @handle e paga apenas a diferença; o novo total deve superar o total atual em pelo menos $1.</p><p><strong>Conteúdo:</strong> sites de produtos e perfis X que o participante possui ou representa. Links de convite/chat, conteúdo adulto, afiliados e tracking não são aceites.</p><p><strong>Pagamento:</strong> uma posição só entra no ranking depois de confirmação real do pagamento. Pagamentos são finais e não reembolsáveis.</p></InfoPage>;
  if (route === "/faq") return <InfoPage title="Perguntas frequentes"><p><strong>Preciso de conta?</strong><br/>Não para criar um pedido e pagar.</p><p><strong>Quando entro no ranking?</strong><br/>Somente depois da confirmação do pagamento pelo servidor.</p><p><strong>Posso subir a minha posição?</strong><br/>Sim. Envia novamente a mesma URL/@handle e paga apenas a diferença necessária.</p><p><strong>O que acontece se alguém pagar enquanto estou no checkout?</strong><br/>A posição é calculada no momento em que o pagamento é confirmado.</p></InfoPage>;
  if (route === "/how-it-works") return <InfoPage title="Como funciona"><ol className="list-decimal space-y-3 pl-5"><li>Introduz o site do produto ou um @handle do X.</li><li>Escolhe uma das categorias disponíveis.</li><li>Define um valor inteiro a partir de $1.</li><li>Cria o pedido e escolhe PayGo/cartão ou um método crypto disponível.</li><li>O servidor verifica o pagamento.</li><li>Depois da confirmação, o valor pago é registado e a posição é calculada.</li><li>Quanto maior o total confirmado, mais acima fica a entrada.</li></ol></InfoPage>;
  if (route === "/categories") return <><Header/><main className="mx-auto max-w-6xl px-4 py-8 sm:py-12"><h1 className="text-3xl font-black sm:text-4xl">Categorias</h1><p className="mt-2 text-stone-500">Cada categoria tem o seu próprio ranking.</p><div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{allCategories.map(c=><button key={c.id} onClick={()=>navigate("/category/"+c.slug)} className="rounded-2xl border border-stone-200 bg-white p-5 text-left font-bold shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300"><span>{c.name}</span><span className="mt-2 block text-xs font-normal text-stone-400">Ver ranking →</span></button>)}</div></main><Footer/></>;
  if (route.startsWith("/category/")) {
    const slug = decodeURIComponent(route.slice("/category/".length));
    const rows = listings.filter(x=>x.category?.slug===slug);
    return <><Header/><main className="mx-auto max-w-6xl px-4 py-8 sm:py-12"><button onClick={()=>navigate("/categories")} className="mb-5 text-sm font-bold text-orange-600">← Todas as categorias</button><h1 className="text-3xl font-black sm:text-4xl">{slugLabel(slug)}</h1><p className="mt-2 text-stone-500">Ranking da categoria por valor total confirmado.</p><div className="mt-7"><ListingRows rows={rows} heading="Ranking da categoria"/></div></main><Footer/></>;
  }
  if (route === "/ranking" || route === "/today" || route === "/daily") {
    const isToday = route === "/today";
    const rows = isToday ? dailyListings : listings;
    return <><Header/><main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <div className="flex flex-wrap gap-2">
        <button onClick={()=>navigate("/ranking")} className="rounded-xl border px-4 py-2 text-sm font-bold">All-time</button>
        <button onClick={()=>navigate("/today")} className="rounded-xl border px-4 py-2 text-sm font-bold">Today</button>
        <button onClick={()=>navigate("/daily")} className="rounded-xl border px-4 py-2 text-sm font-bold">Daily</button>
      </div>
      {route === "/daily" && <div className="mt-5 flex flex-wrap gap-2">
        {dailyDays.length === 0 ? <span className="text-sm text-stone-500">Ainda não existem dias arquivados.</span> : dailyDays.map(day =>
          <button key={day} onClick={async()=>{setSelectedDay(day); try{setDailyListings(await getDailyListings(day) as Listing[])}catch(e){setError(e instanceof Error?e.message:"Falha ao carregar o dia.")}}}
            className={selectedDay===day?"rounded-xl bg-stone-950 px-3 py-2 text-xs font-bold text-white":"rounded-xl border px-3 py-2 text-xs font-bold"}>
            {day}
          </button>
        )}
      </div>}
      <div className="mt-6"><ListingRows rows={route==="/daily"?dailyListings:rows} heading={isToday?"Today's ranking":route==="/daily"?"Daily · "+selectedDay:"All-time ranking"}/></div>
    </main><Footer/></>
  if (route === "/admin") return <AdminPage navigate={navigate}/>;

  const knownRoute = route === "/" || route === "/ranking" || route === "/today" || route === "/daily" || route === "/categories" || route === "/how-it-works" || route === "/faq" || route === "/rules" || route === "/admin" || route.startsWith("/category/");
  if (!knownRoute) return <InfoPage title="404"><p>A página que procuras não existe.</p><button onClick={()=>navigate("/")} className="rounded-xl bg-orange-500 px-5 py-3 font-bold text-white">Voltar ao início</button></InfoPage>;

  return <div className="min-h-screen bg-[#f7f6f2] text-stone-900"><Header/><main className="mx-auto max-w-6xl px-4 py-6 sm:py-10"><MainForm/><div className="mt-8"><ListingRows rows={listings} heading="All-time ranking"/></div></main><Footer/></div>;
}

function AdminPage({navigate}:{navigate:(to:string)=>void}) {
  const [allowed,setAllowed]=useState<boolean|null>(null);
  useEffect(()=>{supabase?.auth.getUser().then(({data})=>setAllowed(data.user?.app_metadata?.role==="admin")); if(!supabase)setAllowed(false)},[]);
  if(allowed===null) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin"/></div>;
  return <><header className="border-b bg-white"><div className="mx-auto max-w-6xl px-4 py-4 flex justify-between"><button onClick={()=>navigate("/")} className="font-black">TopBid Admin</button><button onClick={()=>navigate("/")} className="text-sm">Sair</button></div></header><main className="mx-auto max-w-6xl px-4 py-10">{allowed?<section className="rounded-3xl border bg-white p-7"><h1 className="text-3xl font-black">Admin</h1><p className="mt-3 text-stone-500">Acesso autenticado. A gestão de utilizadores, pedidos, pagamentos, categorias e auditoria deve ser ligada às operações administrativas do backend.</p></section>:<section className="rounded-3xl border bg-white p-7"><h1 className="text-3xl font-black">Acesso reservado</h1><p className="mt-3 text-stone-500">Esta área só abre para uma sessão Supabase cujo app_metadata.role seja admin.</p></section>}</main></>;
}

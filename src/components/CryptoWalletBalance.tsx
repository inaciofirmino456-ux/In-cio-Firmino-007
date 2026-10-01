import { useEffect, useState } from "react";
import { Wallet, RefreshCw, CheckCircle2 } from "lucide-react";
import { connectEvmWallet, getEvmBalance, readConnectedEvmWallet, shortAddress } from "../lib/wallet";

const OPTIONS = [
  { network: "ethereum", asset: "USDT", label: "USDT · Ethereum" },
  { network: "ethereum", asset: "USDC", label: "USDC · Ethereum" },
  { network: "ethereum", asset: "ETH", label: "ETH · Ethereum" },
  { network: "bsc", asset: "USDT", label: "USDT · BNB Chain" },
  { network: "bsc", asset: "USDC", label: "USDC · BNB Chain" },
  { network: "bsc", asset: "BNB", label: "BNB · BNB Chain" },
  { network: "base", asset: "USDC", label: "USDC · Base" },
  { network: "base", asset: "USDT", label: "USDT · Base" },
  { network: "base", asset: "ETH", label: "ETH · Base" },
];

export default function CryptoWalletBalance() {
  const [selected, setSelected] = useState("ethereum:USDT");
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState("");
  const [balance, setBalance] = useState("");
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  const option = OPTIONS.find((item) => `${item.network}:${item.asset}` === selected) ?? OPTIONS[0];

  async function loadBalance(nextAddress?: string, nextChainId?: string) {
    const wallet = nextAddress || address;
    if (!wallet) return;
    setLoading(true);
    setError("");
    try {
      const value = await getEvmBalance(option.network, option.asset, wallet, nextChainId || chainId);
      setBalance(value);
    } catch (e) {
      setBalance("");
      setError(e instanceof Error ? e.message : "Não foi possível ler o saldo.");
    } finally {
      setLoading(false);
    }
  }

  async function connect() {
    setConnecting(true);
    setError("");
    try {
      const wallet = await connectEvmWallet();
      setAddress(wallet.address);
      setChainId(wallet.chainId);
      await loadBalance(wallet.address, wallet.chainId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível conectar a carteira.");
    } finally {
      setConnecting(false);
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const wallet = await readConnectedEvmWallet();
        if (wallet) {
          setAddress(wallet.address);
          setChainId(wallet.chainId);
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (address) void loadBalance();
  }, [selected, address, chainId]);

  useEffect(() => {
    const provider = typeof window !== "undefined" ? window.ethereum : undefined;
    if (!provider?.on) return;
    const onAccounts = (...args: unknown[]) => {
      const accounts = args[0] as string[] | undefined;
      const next = accounts?.[0] || "";
      setAddress(next);
      if (!next) setBalance("");
    };
    const onChain = (...args: unknown[]) => setChainId(String(args[0] || ""));
    provider.on("accountsChanged", onAccounts);
    provider.on("chainChanged", onChain);
    return () => {
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
    };
  }, []);

  return (
    <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-black text-stone-900">Pagamento com cripto</div>
          <div className="mt-1 text-xs text-stone-500">O saldo só é consultado depois de conectar a carteira.</div>
        </div>
        <select value={selected} onChange={(e) => setSelected(e.target.value)} className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-bold">
          {OPTIONS.map((item) => <option key={`${item.network}:${item.asset}`} value={`${item.network}:${item.asset}`}>{item.label}</option>)}
        </select>
      </div>

      {!address ? (
        <button onClick={connect} disabled={connecting} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-stone-950 px-4 py-3 text-sm font-black text-white disabled:opacity-60">
          <Wallet size={16}/>{connecting ? "A conectar carteira..." : "Conectar carteira para ver saldo"}
        </button>
      ) : (
        <div className="mt-4 rounded-xl border border-stone-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-bold text-green-700"><CheckCircle2 size={14}/> Carteira conectada</div>
              <div className="mt-1 truncate text-xs font-mono text-stone-500">{shortAddress(address)}</div>
            </div>
            <button onClick={() => void loadBalance()} disabled={loading} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50" aria-label="Atualizar saldo"><RefreshCw size={15} className={loading ? "animate-spin" : ""}/></button>
          </div>
          <div className="mt-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Saldo disponível · {option.asset}</div>
            <div className="mt-1 text-2xl font-black text-stone-950">{loading ? "A consultar..." : balance ? `${balance} ${option.asset}` : "0 ${option.asset}"}</div>
          </div>
          {error && <div className="mt-3 text-xs font-semibold text-red-600">{error}</div>}
        </div>
      )}
    </div>
  );
}

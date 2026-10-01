export type EvmWalletProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: EvmWalletProvider;
  }
}

export function getEvmWallet(): EvmWalletProvider | null {
  return typeof window !== "undefined" && window.ethereum ? window.ethereum : null;
}

export async function connectEvmWallet(): Promise<{ address: string; chainId: string }> {
  const provider = getEvmWallet();
  if (!provider) {
    throw new Error("Nenhuma carteira EVM foi encontrada. Abra o TopBid no navegador da Rabby, MetaMask ou outra carteira compatível.");
  }
  const accounts = await provider.request({ method: "eth_requestAccounts" }) as string[];
  const address = accounts?.[0];
  if (!address) throw new Error("A carteira não devolveu um endereço.");
  const chainId = String(await provider.request({ method: "eth_chainId" }));
  return { address, chainId };
}

export async function readConnectedEvmWallet(): Promise<{ address: string; chainId: string } | null> {
  const provider = getEvmWallet();
  if (!provider) return null;
  const accounts = await provider.request({ method: "eth_accounts" }) as string[];
  if (!accounts?.[0]) return null;
  const chainId = String(await provider.request({ method: "eth_chainId" }));
  return { address: accounts[0], chainId };
}

export function shortAddress(address: string) {
  return address ? address.slice(0, 6) + "…" + address.slice(-4) : "";
}

export function isValidEvmAddress(address: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

const CHAIN_IDS: Record<string, string> = {
  ethereum: "0x1",
  bsc: "0x38",
  base: "0x2105",
  robinhood_chain: "0x1237",
};

const TOKEN_ADDRESSES: Record<string, Record<string, string>> = {
  ethereum: {
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    USDC: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  },
  bsc: {
    USDT: "0x55d398326f99059fF775485246999027B3197955",
    USDC: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
  },
  base: {
    USDT: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
};

function formatUnits(raw: bigint, decimals: number, maxFractionDigits = 6) {
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const fraction = raw % base;
  if (fraction === 0n) return whole.toString();
  const fractionText = fraction.toString().padStart(decimals, "0").slice(0, maxFractionDigits).replace(/0+$/, "");
  return `${whole}.${fractionText}`;
}

export async function getEvmBalance(network: string, asset: string, address: string, connectedChainId?: string): Promise<string> {
  const provider = getEvmWallet();
  if (!provider) throw new Error("Conecte uma carteira EVM para consultar o saldo.");
  if (!isValidEvmAddress(address)) throw new Error("Endereço de carteira inválido.");
  const expectedChain = CHAIN_IDS[network];
  if (!expectedChain) throw new Error("Esta rede ainda não tem leitura de saldo configurada.");
  const currentChain = String(connectedChainId || await provider.request({ method: "eth_chainId" })).toLowerCase();
  if (currentChain !== expectedChain.toLowerCase()) {
    throw new Error("Mude a carteira para a rede selecionada para consultar este saldo.");
  }

  if (asset === "ETH" || asset === "BNB") {
    const raw = String(await provider.request({ method: "eth_getBalance", params: [address, "latest"] }));
    return formatUnits(BigInt(raw), 18);
  }

  const token = TOKEN_ADDRESSES[network]?.[asset];
  if (!token) throw new Error(`Saldo de ${asset} ainda não configurado nesta rede.`);
  const balanceHex = String(await provider.request({
    method: "eth_call",
    params: [{ to: token, data: `0x70a08231${address.slice(2).padStart(64, "0")}` }, "latest"],
  }));
  const decimalsHex = String(await provider.request({
    method: "eth_call",
    params: [{ to: token, data: "0x313ce567" }, "latest"],
  }));
  const decimals = Number(BigInt(decimalsHex));
  return formatUnits(BigInt(balanceHex), decimals || 18);
}

export async function sendNativePayment(
  network: string,
  from: string,
  to: string,
  valueHex: string,
): Promise<{ txHash: string }> {
  const provider = getEvmWallet();
  if (!provider) throw new Error("Abra o TopBid dentro de uma carteira EVM compatível.");
  const expectedChain = CHAIN_IDS[network];
  if (!expectedChain) throw new Error("Esta rede ainda não permite pagamento direto pela carteira.");
  const currentChain = String(await provider.request({ method: "eth_chainId" })).toLowerCase();
  if (currentChain !== expectedChain) {
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: expectedChain }],
      });
    } catch {
      throw new Error("A sua carteira está noutra rede. Mude para a rede selecionada e tente novamente.");
    }
  }
  const txHash = await provider.request({
    method: "eth_sendTransaction",
    params: [{ from, to, value: valueHex }],
  }) as string;
  if (!txHash) throw new Error("A carteira não devolveu o TX Hash.");
  return { txHash };
}

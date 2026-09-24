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

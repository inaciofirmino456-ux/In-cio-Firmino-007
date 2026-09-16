import React, { useState } from 'react';
import { X, ShieldAlert, Trash2, DollarSign, MousePointerClick, RefreshCw, Layers, Check, Link as LinkIcon, Save } from 'lucide-react';
import { Listing, StatsSummary } from '../types';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  listings: Listing[];
  stats: StatsSummary;
  onDeleteListing: (id: string) => void;
  onResetData: () => void;
  paymentUrl: string;
  onUpdatePaymentUrl: (url: string) => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  listings,
  stats,
  onDeleteListing,
  onResetData,
  paymentUrl,
  onUpdatePaymentUrl,
}) => {
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPaymentUrl, setCurrentPaymentUrl] = useState(paymentUrl);
  const [savedUrl, setSavedUrl] = useState(false);

  if (!isOpen) return null;

  const handleSavePaymentUrl = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdatePaymentUrl(currentPaymentUrl.trim());
    setSavedUrl(true);
    setTimeout(() => setSavedUrl(false), 2000);
  };

  const filteredListings = listings.filter(
    (l) =>
      l.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.url.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(listings, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'outbid_listings_backup.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-white">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-base font-mono tracking-tight">
                Painel do Administrador (Dono do Outbid)
              </h2>
              <p className="text-[11px] text-stone-400 font-mono">
                Controle do Proprietário • Moderação de Links e Gestão de Receita
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Top Metrics Cards */}
        <div className="p-6 border-b border-stone-100 bg-stone-50/70 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-white border border-stone-200 rounded-xl">
            <div className="flex items-center gap-1.5 text-stone-500 text-xs font-mono">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
              <span>Receita Bruta</span>
            </div>
            <div className="mt-1 text-xl font-black font-mono text-stone-900">
              ${stats.totalRevenue.toLocaleString()}
            </div>
          </div>

          <div className="p-3 bg-white border border-stone-200 rounded-xl">
            <div className="flex items-center gap-1.5 text-stone-500 text-xs font-mono">
              <Layers className="w-3.5 h-3.5 text-orange-500" />
              <span>Links Ativos</span>
            </div>
            <div className="mt-1 text-xl font-black font-mono text-stone-900">
              {stats.activeListingsCount}
            </div>
          </div>

          <div className="p-3 bg-white border border-stone-200 rounded-xl">
            <div className="flex items-center gap-1.5 text-stone-500 text-xs font-mono">
              <MousePointerClick className="w-3.5 h-3.5 text-blue-500" />
              <span>Cliques Gerados</span>
            </div>
            <div className="mt-1 text-xl font-black font-mono text-stone-900">
              {stats.totalClicks.toLocaleString()}
            </div>
          </div>

          <div className="p-3 bg-white border border-stone-200 rounded-xl">
            <div className="flex items-center gap-1.5 text-stone-500 text-xs font-mono">
              <span>Maior Lance</span>
            </div>
            <div className="mt-1 text-xl font-black font-mono text-orange-600">
              ${stats.topBid}
            </div>
          </div>
        </div>

        {/* Explain Admin Power */}
        <div className="px-6 py-3 bg-amber-50/60 border-b border-amber-200/60 text-xs text-amber-900 flex items-center justify-between gap-4">
          <p>
            <strong>Como funciona o administrador:</strong> O dono da plataforma pode configurar o link de pagamento onde recebe o dinheiro, moderar links maliciosos e exportar os dados do leilão.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportJson}
              className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-white border border-stone-300 text-stone-700 hover:bg-stone-100 flex items-center gap-1"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : null}
              <span>Exportar JSON</span>
            </button>
            <button
              onClick={onResetData}
              title="Restaurar dados de exemplo"
              className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-white border border-stone-300 text-stone-700 hover:bg-stone-100 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3 text-stone-500" />
              <span>Restaurar Base</span>
            </button>
          </div>
        </div>

        {/* Payment Gateway URL Config for the Owner */}
        <div className="px-6 py-4 border-b border-stone-200 bg-stone-50/50">
          <form onSubmit={handleSavePaymentUrl} className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="admin-payment-url" className="text-xs font-mono font-bold text-stone-700 flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-orange-600" />
                <span>Link do Seu Gateway de Pagamento (Onde o Dinheiro Cai):</span>
              </label>
              {savedUrl && (
                <span className="text-[11px] font-mono text-emerald-600 flex items-center gap-1 font-semibold">
                  <Check className="w-3 h-3" /> Salvo com sucesso!
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                id="admin-payment-url"
                type="url"
                value={currentPaymentUrl}
                onChange={(e) => setCurrentPaymentUrl(e.target.value)}
                placeholder="https://sua-pagina-de-pagamento.com"
                className="flex-1 px-3 py-2 text-xs font-mono border border-stone-300 rounded-lg focus:outline-hidden focus:border-orange-500 bg-white"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Salvar Link</span>
              </button>
            </div>
            <p className="text-[11px] text-stone-500">
              Quando o cliente clicar em dar lance, ele será enviado para este link para efetuar o pagamento.
            </p>
          </form>
        </div>

        {/* Moderation List */}
        <div className="p-6 flex-1 overflow-y-auto space-y-3">
          <div className="flex items-center justify-between gap-4 pb-2">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-stone-600">
              Moderação de Links ({filteredListings.length})
            </h3>
            <input
              type="text"
              placeholder="Filtrar links para moderar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1 text-xs border border-stone-200 rounded-lg w-52 focus:outline-hidden focus:border-stone-400"
            />
          </div>

          <div className="border border-stone-200 rounded-xl divide-y divide-stone-100 overflow-hidden text-xs">
            {filteredListings.length === 0 ? (
              <div className="p-6 text-center text-stone-400">Nenhum link encontrado.</div>
            ) : (
              filteredListings.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-3.5 flex items-center justify-between gap-4 hover:bg-stone-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono font-bold text-stone-400 w-6">#{idx + 1}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-900 truncate">{item.title}</span>
                        <span className="font-mono text-[10px] text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">
                          ${item.currentBid}
                        </span>
                      </div>
                      <p className="text-stone-400 text-[11px] font-mono truncate">{item.url}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-mono text-stone-500 hidden sm:inline">
                      {item.clicks} cliques
                    </span>
                    <button
                      onClick={() => onDeleteListing(item.id)}
                      title="Excluir / Banir do ranking (Moderação)"
                      className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-stone-200 bg-stone-50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-mono font-medium rounded-lg bg-stone-900 hover:bg-stone-800 text-white cursor-pointer"
          >
            Fechar Painel
          </button>
        </div>
      </div>
    </div>
  );
};

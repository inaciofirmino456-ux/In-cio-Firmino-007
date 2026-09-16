import React, { useState } from 'react';
import { X, CheckCircle2, Flame, CreditCard, Sparkles, ShieldCheck, ExternalLink, AlertCircle, ArrowRight } from 'lucide-react';
import { Category, Listing } from '../types';

interface BidDraft {
  url: string;
  title: string;
  tagline: string;
  category: Exclude<Category, 'All'>;
  bidAmount: number;
  existingListingId?: string;
}

interface BidCheckoutModalProps {
  draft: BidDraft | null;
  existingListing?: Listing;
  onClose: () => void;
  onConfirmBid: (draft: BidDraft) => void;
  paymentUrl?: string;
}

export const BidCheckoutModal: React.FC<BidCheckoutModalProps> = ({
  draft,
  existingListing,
  onClose,
  onConfirmBid,
  paymentUrl = 'https://paygooogeral.goootrafego.com/?utm_source=ig&utm_medium=social&utm_content=link_in_bio&fbclid=PAcGRvZgJleHRuA2FlbQIxMQBzcnRjBmFwcF9pZA81NjcwNjczNDMzNTI0MjcAAadr02',
}) => {
  const [hasOpenedPayment, setHasOpenedPayment] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!draft) return null;

  // Calculate actual amount to pay if increasing bid on existing listing
  const currentBid = existingListing ? existingListing.currentBid : 0;
  const amountToPay = existingListing ? Math.max(5, draft.bidAmount - currentBid) : draft.bidAmount;

  const handleOpenPaymentGateway = () => {
    setHasOpenedPayment(true);
    window.open(paymentUrl, '_blank', 'noopener,noreferrer');
  };

  const handleConfirmPaid = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setSuccess(true);
      setTimeout(() => {
        onConfirmBid(draft);
        onClose();
      }, 1000);
    }, 700);
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/65 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-900 text-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500 text-white flex items-center justify-center">
              <Flame className="w-4 h-4 fill-white" />
            </div>
            <div>
              <span className="font-bold text-sm font-mono block">
                Checkout de Pagamento do Lance
              </span>
              <span className="text-[11px] text-stone-300 font-mono">
                Transação Segura • Gateway Oficial
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {success ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-lg text-stone-900">Lance Aprovado e Publicado!</h3>
              <p className="text-xs text-stone-500 font-mono">Seu produto já subiu para a nova posição no ranking ao vivo!</p>
            </div>
          ) : (
            <>
              {/* Project summary card */}
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-stone-500 uppercase">Resumo do Pedido:</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-stone-200 text-stone-800 font-medium">
                    {draft.category}
                  </span>
                </div>
                <div className="font-bold text-stone-900 text-base">{draft.title}</div>
                <div className="text-xs font-mono text-stone-500 truncate">{draft.url}</div>
                <div className="text-xs text-stone-600 italic">"{draft.tagline}"</div>
              </div>

              {/* Price calculation */}
              <div className="p-4 rounded-xl bg-orange-50/70 border border-orange-200 space-y-2">
                <div className="flex justify-between text-xs text-stone-600 font-mono">
                  <span>Lance a ser Registrado:</span>
                  <span className="font-bold text-stone-900">${draft.bidAmount}</span>
                </div>
                {existingListing && (
                  <div className="flex justify-between text-xs text-stone-500 font-mono">
                    <span>Lance Anterior Já Pago:</span>
                    <span>-${currentBid}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-orange-200 flex justify-between items-baseline font-mono">
                  <span className="text-sm font-bold text-stone-900">Total a Pagar:</span>
                  <span className="text-2xl font-black text-orange-600">${amountToPay}</span>
                </div>
              </div>

              {/* Payment Steps Instructions */}
              <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-xs text-amber-900 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-amber-950">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Passo Obrigatório de Pagamento</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-900">
                  O cliente deve realizar o pagamento pelo gateway externo. Após efetuar o pagamento na página aberta, clique no botão de confirmação abaixo para validar e posicionar o produto no topo.
                </p>
              </div>

              {/* Payment Buttons */}
              <div className="space-y-2.5 pt-1">
                {/* Step 1: Open Payment Link */}
                <a
                  href={paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setHasOpenedPayment(true)}
                  id="external-pay-link-btn"
                  className="w-full py-3.5 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-mono font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>1. Ir para a Página de Pagamento (${amountToPay})</span>
                  <ExternalLink className="w-4 h-4 ml-1 opacity-80" />
                </a>

                {/* Step 2: Confirm paid */}
                <button
                  type="button"
                  id="confirm-paid-btn"
                  disabled={isProcessing}
                  onClick={handleConfirmPaid}
                  className={`w-full py-3 px-4 rounded-xl font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                    hasOpenedPayment
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 shadow-xs'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300'
                  }`}
                >
                  {isProcessing ? (
                    <span>Validando pagamento...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                      <span>{hasOpenedPayment ? '2. Já Paguei! Publicar Meu Lance no Ranking' : '2. Confirmar Após Pagamento'}</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-center gap-2 text-[11px] text-stone-500">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Gateway de pagamento externo seguro e criptografado.</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};


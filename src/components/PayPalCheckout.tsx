import { useEffect, useRef, useState } from "react";
import { Loader2, CreditCard } from "lucide-react";
import { createPaypalOrder, capturePaypalOrder } from "../lib/api";

declare global {
  interface Window {
    paypal?: any;
  }
}

type Props = {
  orderId: string;
  onSuccess: () => void | Promise<void>;
  onError: (message: string) => void;
};

const GATEWAY = "https://if7-paypal-gateway.onrender.com";

function loadSdk(clientId: string) {
  if (window.paypal) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById("topbid-paypal-sdk") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Não foi possível carregar o checkout PayPal.")), { once: true });
      if (window.paypal) resolve();
      return;
    }
    const script = document.createElement("script");
    script.id = "topbid-paypal-sdk";
    script.src = "https://www.paypal.com/sdk/js?" + new URLSearchParams({
      "client-id": clientId,
      currency: "USD",
      intent: "capture",
      components: "buttons",
      "enable-funding": "card",
    }).toString();
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Não foi possível carregar o checkout PayPal."));
    document.head.appendChild(script);
  });
}

export default function PayPalCheckout({ orderId, onSuccess, onError }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let cardButtons: any;

    async function setup() {
      try {
        const configResponse = await fetch(GATEWAY + "/api/paypal/config");
        const config = await configResponse.json();
        if (!configResponse.ok || !config.clientId) throw new Error("O checkout PayPal não está configurado.");
        await loadSdk(config.clientId);
        if (cancelled || !window.paypal) return;

        const create = async () => {
          const result = await createPaypalOrder(orderId);
          return result.paypalOrderId;
        };
        const approve = async (data: any) => {
          try {
            const result = await capturePaypalOrder(orderId, data.orderID);
            if (result.status === "paid" || result.status === "already_paid") await onSuccess();
            else onError("O pagamento ainda não foi confirmado. O ranking não foi alterado.");
          } catch (error) {
            onError(error instanceof Error ? error.message : "Não foi possível confirmar o pagamento.");
          }
        };

        let cardReady = false;
        if (cardRef.current && window.paypal.FUNDING?.CARD) {
          cardButtons = window.paypal.Buttons({
            fundingSource: window.paypal.FUNDING.CARD,
            createOrder: create,
            onApprove: approve,
            onError: () => onError("O PayPal não conseguiu processar o cartão. Tenta novamente."),
            style: { layout: "vertical", shape: "rect", label: "pay", height: 48 },
          });
          if (await cardButtons.isEligible()) {
            await cardButtons.render(cardRef.current);
            cardReady = true;
          }
        }
        if (!cancelled) setReady(cardReady);
      } catch (error) {
        if (!cancelled) onError(error instanceof Error ? error.message : "Não foi possível preparar o checkout.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void setup();
    return () => {
      cancelled = true;
      try { cardButtons?.close?.(); } catch {}
    };
  }, [orderId]);

  return (
    <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-black text-stone-800">
        <CreditCard size={18} className="text-orange-600" />
        Pagar com cartão Visa ou Mastercard
      </div>
      {loading && <div className="flex items-center justify-center gap-2 py-4 text-sm text-stone-500"><Loader2 size={17} className="animate-spin"/> A preparar pagamento seguro...</div>}
      <div ref={cardRef} />
      {!loading && !ready && <p className="text-xs text-amber-700">O PayPal não disponibilizou pagamento por cartão para esta transação. A disponibilidade depende da conta comercial e da elegibilidade do comprador.</p>}
      <p className="mt-3 text-center text-[11px] text-stone-500">Pagamento protegido pelo PayPal. A opção de cartão sem conta PayPal depende da elegibilidade da transação e do país.</p>
    </div>
  );
}

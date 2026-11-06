const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
}
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const { orderId, paypalOrderId } = await req.json();
    if (typeof orderId !== "string" || typeof paypalOrderId !== "string" || paypalOrderId.length > 128) return json({ error: "Dados do pagamento inválidos." }, 400);
    const sb = adminClient();
    const { data: order, error } = await sb.from("orders").select("id,charge_cents,status").eq("id", orderId).single();
    if (error || !order) return json({ error: "Pedido não encontrado." }, 404);
    if (order.status === "paid") return json({ status: "already_paid" });
    if (order.status !== "pending") return json({ error: "Este pedido não pode ser pago." }, 409);
    const gateway = Deno.env.get("TOPBID_PAYPAL_GATEWAY_URL") || "https://if7-paypal-gateway.onrender.com";
    const response = await fetch(gateway + "/api/topbid/paypal/capture-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, paypalOrderId }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.order) return json({ error: result.error || "O PayPal ainda não confirmou o pagamento." }, response.status || 502);
    const paypalOrder = result.order;
    const unit = (paypalOrder.purchase_units || [])[0] || {};
    const capture = ((unit.payments || {}).captures || [])[0] || {};
    const cents = Math.round(Number(capture.amount?.value) * 100);
    if (unit.custom_id !== orderId || paypalOrder.status !== "COMPLETED" || capture.status !== "COMPLETED" || capture.amount?.currency_code !== "USD" || !Number.isSafeInteger(cents) || cents !== Number(order.charge_cents)) {
      return json({ error: "O pagamento não corresponde ao valor exato do pedido. Não foi atualizado o ranking." }, 422);
    }
    const { data: confirmed, error: confirmError } = await sb.rpc("confirm_order_payment", {
      p_order_id: orderId, p_provider: "paypal", p_provider_payment_id: String(capture.id || paypalOrderId),
      p_amount_cents: cents, p_asset: "USD", p_network: null, p_tx_hash: null, p_recipient: null,
      p_confirmations: null, p_raw: paypalOrder
    });
    if (confirmError) throw confirmError;
    return json({ status: confirmed?.status || "paid", listingId: confirmed?.listing_id || null });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Erro ao confirmar pagamento." }, 400);
  }
});

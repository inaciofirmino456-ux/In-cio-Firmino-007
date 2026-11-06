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
    const { orderId } = await req.json();
    if (typeof orderId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) return json({ error: "Pedido inválido." }, 400);
    const sb = adminClient();
    const { data: order, error } = await sb.from("orders").select("id,charge_cents,status,metadata").eq("id", orderId).single();
    if (error || !order) return json({ error: "Pedido não encontrado." }, 404);
    if (order.status !== "pending") return json({ error: "Este pedido já foi processado." }, 409);
    const savedPaypalOrderId = order.metadata?.paypal_order_id;
    if (typeof savedPaypalOrderId === "string" && savedPaypalOrderId.length > 0) {
      return json({ paypalOrderId: savedPaypalOrderId, amountUsd: Number(order.charge_cents) / 100 });
    }
    const gateway = Deno.env.get("TOPBID_PAYPAL_GATEWAY_URL") || "https://if7-paypal-gateway.onrender.com";
    const response = await fetch(gateway + "/api/topbid/paypal/create-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.paypalOrderId) return json({ error: result.error || "Não foi possível iniciar o pagamento." }, response.status || 502);
    const metadata = { ...(order.metadata || {}), paypal_order_id: result.paypalOrderId };
    const { error: saveError } = await sb.from("orders").update({ metadata }).eq("id", orderId).eq("status", "pending");
    if (saveError) throw saveError;
    return json({ paypalOrderId: result.paypalOrderId, amountUsd: Number(order.charge_cents) / 100 });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Erro ao iniciar pagamento." }, 400);
  }
});

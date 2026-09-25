import DodoPayments from "npm:dodopayments@2.40.0";
import { corsHeaders } from "../_shared/cors.ts";
import { adminClient } from "../_shared/supabase.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const { orderId } = await req.json();
    if (typeof orderId !== "string") return json({ error: "INVALID_ORDER_ID" }, 400);

    const apiKey = Deno.env.get("DODO_PAYMENTS_API_KEY");
    const productId = Deno.env.get("DODO_PAYMENTS_PRODUCT_ID");
    const environment = (Deno.env.get("DODO_PAYMENTS_ENVIRONMENT") || "live_mode") as "test_mode" | "live_mode";
    if (!apiKey || !productId) return json({ error: "DODO_NOT_CONFIGURED" }, 500);

    const sb = adminClient();
    const { data: order, error } = await sb.from("orders")
      .select("id,charge_cents,status,expires_at")
      .eq("id", orderId)
      .single();
    if (error || !order) return json({ error: "ORDER_NOT_FOUND" }, 404);
    if (order.status !== "pending") return json({ error: "ORDER_NOT_PAYABLE" }, 409);
    if (order.expires_at && new Date(order.expires_at).getTime() <= Date.now()) return json({ error: "ORDER_EXPIRED" }, 409);

    const client = new DodoPayments({ bearerToken: apiKey, environment });
    const returnBase = Deno.env.get("DODO_RETURN_URL") || "https://topbid.onrender.com/";
    const url = new URL(returnBase);
    url.searchParams.set("payment", "success");
    url.searchParams.set("order", order.id);

    const session = await client.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1, amount: Number(order.charge_cents) }],
      billing_currency: "USD",
      allowed_payment_method_types: ["credit", "debit", "crypto_currency", "amazon_pay", "google_pay"],
      return_url: url.toString(),
      cancel_url: returnBase,
      metadata: { topbid_order_id: order.id },
      customization: {
        force_language: "pt-BR",
        show_order_details: true,
      },
    });

    return json({ checkoutUrl: session.checkout_url, sessionId: session.session_id });
  } catch (e) {
    console.error("dodo-checkout:", e);
    return json({ error: e instanceof Error ? e.message : "DODO_CHECKOUT_FAILED" }, 400);
  }
});

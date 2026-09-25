import DodoPayments from "npm:dodopayments@2.40.0";
import { adminClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const apiKey = Deno.env.get("DODO_PAYMENTS_API_KEY");
  const webhookKey = Deno.env.get("DODO_PAYMENTS_WEBHOOK_KEY");
  if (!apiKey || !webhookKey) return new Response("Webhook not configured", { status: 500 });

  try {
    const raw = await req.text();
    const headers = {
      "webhook-id": req.headers.get("webhook-id") || "",
      "webhook-signature": req.headers.get("webhook-signature") || "",
      "webhook-timestamp": req.headers.get("webhook-timestamp") || "",
    };
    const client = new DodoPayments({
      bearerToken: apiKey,
      webhookKey,
      environment: (Deno.env.get("DODO_PAYMENTS_ENVIRONMENT") || "live_mode") as "test_mode" | "live_mode",
    });
    const event = client.webhooks.unwrap(raw, { headers }) as any;
    if (event.type !== "payment.succeeded") return new Response(JSON.stringify({ received: true }), { status: 200 });

    const data = event.data || {};
    const orderId = data.metadata?.topbid_order_id;
    const paymentId = data.payment_id;
    const amountCents = Number(data.total_amount);
    if (typeof orderId !== "string" || typeof paymentId !== "string" || !Number.isSafeInteger(amountCents)) {
      return new Response("Invalid payment payload", { status: 400 });
    }

    const sb = adminClient();
    const { data: result, error } = await sb.rpc("confirm_order_payment", {
      p_order_id: orderId,
      p_provider: "dodo",
      p_provider_payment_id: paymentId,
      p_amount_cents: amountCents,
      p_asset: data.payment_method_type || data.payment_method || "fiat",
      p_network: "dodo",
      p_tx_hash: "",
      p_recipient: "",
      p_confirmations: 0,
      p_raw: data,
    });
    if (error) throw error;

    return new Response(JSON.stringify({ received: true, result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("dodo-webhook:", e);
    return new Response("Invalid webhook", { status: 401 });
  }
});

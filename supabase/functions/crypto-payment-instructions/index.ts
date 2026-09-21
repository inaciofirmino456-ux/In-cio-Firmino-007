import { corsHeaders } from "../_shared/cors.ts";
import { adminClient } from "../_shared/supabase.ts";

const NETWORKS = new Set(["bitcoin","solana","ethereum","bsc","robinhood_chain"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const orderId = String(body?.orderId || "");
    const network = String(body?.network || "").toLowerCase();
    const asset = String(body?.asset || "").toUpperCase();

    if (!orderId || !NETWORKS.has(network)) {
      throw new Error("INVALID_ORDER_OR_NETWORK");
    }

    const sb = adminClient();

    const { data: order, error: orderError } = await sb
      .from("orders")
      .select("id,charge_cents,status,expires_at")
      .eq("id", orderId)
      .single();

    if (orderError || !order) throw new Error("ORDER_NOT_FOUND");
    if (order.status !== "pending") throw new Error("ORDER_NOT_PAYABLE");
    if (order.expires_at && new Date(order.expires_at).getTime() <= Date.now()) {
      throw new Error("ORDER_EXPIRED");
    }

    const { data: receiver, error: receiverError } = await sb
      .from("payment_receiving_addresses")
      .select("network,address")
      .eq("network", network)
      .eq("active", true)
      .single();

    if (receiverError || !receiver) throw new Error("NETWORK_NOT_CONFIGURED");

    return new Response(JSON.stringify({
      orderId: order.id,
      network,
      asset,
      amountUsd: Number(order.charge_cents) / 100,
      receivingAddress: receiver.address,
      status: "awaiting_payment_confirmation"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "crypto_payment_instructions_failed"
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

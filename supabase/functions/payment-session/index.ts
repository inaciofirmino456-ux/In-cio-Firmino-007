import { corsHeaders } from "../_shared/cors.ts";
import { adminClient } from "../_shared/supabase.ts";

async function hmacHex(secret: string, message: string, algorithm = "SHA-512") {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: algorithm }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2,"0")).join("").toUpperCase();
}

async function binanceCreate(orderId: string, amountUsd: number, returnUrl: string) {
  const key = Deno.env.get("BINANCE_PAY_API_KEY");
  const secret = Deno.env.get("BINANCE_PAY_SECRET");
  if (!key || !secret) throw new Error("BINANCE_PAY_NOT_CONFIGURED");
  const timestamp = Date.now().toString();
  const nonce = crypto.randomUUID().replaceAll("-","").slice(0,32);
  const body = JSON.stringify({
    merchantTradeNo: orderId.replaceAll("-","").slice(0,32),
    orderAmount: amountUsd,
    currency: "USDT",
    goods: { goodsType: "02", goodsCategory: "Z000", referenceGoodsId: orderId, goodsName: "TopBid rank" },
    returnUrl
  });
  const signature = await hmacHex(secret, timestamp + "\n" + nonce + "\n" + body + "\n");
  const response = await fetch("https://bpay.binanceapi.com/binancepay/openapi/order", {
    method:"POST",
    headers: {
      "content-type":"application/json",
      "BinancePay-Timestamp":timestamp,
      "BinancePay-Nonce":nonce,
      "BinancePay-Certificate-SN":key,
      "BinancePay-Signature":signature
    },
    body
  });
  const data = await response.json();
  if (!response.ok || data.status !== "SUCCESS") throw new Error("BINANCE_PAY_CREATE_FAILED");
  return { provider:"binance_pay", providerPaymentId:data.data?.prepayId ?? orderId, checkoutUrl:data.data?.checkoutUrl ?? data.data?.universalUrl };
}

async function nowCreate(orderId: string, amountUsd: number, callbackUrl: string) {
  const key = Deno.env.get("NOWPAYMENTS_API_KEY");
  if (!key) throw new Error("NOWPAYMENTS_NOT_CONFIGURED");
  const response = await fetch("https://api.nowpayments.io/v1/payment", {
    method:"POST",
    headers:{"x-api-key":key,"content-type":"application/json"},
    body:JSON.stringify({
      price_amount:amountUsd,
      price_currency:"usd",
      pay_currency:Deno.env.get("NOWPAYMENTS_PAY_CURRENCY") || "btc",
      ipn_callback_url:callbackUrl,
      order_id:orderId,
      order_description:"TopBid rank"
    })
  });
  const data=await response.json();
  if(!response.ok || !data.payment_id) throw new Error("NOWPAYMENTS_CREATE_FAILED");
  return {provider:"nowpayments",providerPaymentId:String(data.payment_id),checkoutUrl:data.invoice_url || data.pay_address ? data.invoice_url : undefined};
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  try{
    const body=await req.json();
    const orderId=String(body?.orderId||"");
    const provider=String(body?.provider||"");
    const sb=adminClient();
    const {data:order,error}=await sb.from("orders").select("id,charge_cents,status").eq("id",orderId).single();
    if(error || !order) throw new Error("ORDER_NOT_FOUND");
    if(order.status!=="pending") throw new Error("ORDER_NOT_PAYABLE");
    const amountUsd=Number(order.charge_cents)/100;
    const origin=Deno.env.get("PUBLIC_APP_ORIGIN")||"";
    let result;
    if(provider==="binance_pay") result=await binanceCreate(orderId,amountUsd,origin);
    else if(provider==="nowpayments") result=await nowCreate(orderId,amountUsd,origin+"/payment");
    else throw new Error("PROVIDER_NOT_CONFIGURED");
    await sb.from("orders").update({provider:result.provider,provider_payment_id:result.providerPaymentId,updated_at:new Date().toISOString()}).eq("id",orderId);
    return new Response(JSON.stringify(result),{headers:{...corsHeaders,"Content-Type":"application/json"}});
  }catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:"payment_session_failed"}),{status:400,headers:{...corsHeaders,"Content-Type":"application/json"}});}
});
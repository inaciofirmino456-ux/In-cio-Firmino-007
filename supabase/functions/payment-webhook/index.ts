import { corsHeaders } from "../_shared/cors.ts";
import { adminClient } from "../_shared/supabase.ts";

function sortedObject(value:any):any{
  if(Array.isArray(value)) return value.map(sortedObject);
  if(value && typeof value==="object") return Object.keys(value).sort().reduce((o,k)=>{o[k]=sortedObject(value[k]);return o;},{} as any);
  return value;
}
async function hmacHex(secret:string,message:string,algorithm="SHA-512"){
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:algorithm},false,["sign"]);
  const sig=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function constantTime(a:string,b:string){
  if(a.length!==b.length) return false;
  let n=0; for(let i=0;i<a.length;i++) n|=a.charCodeAt(i)^b.charCodeAt(i); return n===0;
}
async function binanceVerify(req:Request,body:string){
  const secret=Deno.env.get("BINANCE_PAY_SECRET"); const sig=req.headers.get("BinancePay-Signature");
  const ts=req.headers.get("BinancePay-Timestamp"); const nonce=req.headers.get("BinancePay-Nonce");
  if(!secret||!sig||!ts||!nonce) return false;
  const expected=await hmacHex(secret,ts+"\n"+nonce+"\n"+body+"\n");
  return constantTime(expected.toUpperCase(),sig.toUpperCase());
}
async function nowVerify(body:any,sig:string|null){
  const secret=Deno.env.get("NOWPAYMENTS_IPN_SECRET"); if(!secret||!sig) return false;
  const expected=await hmacHex(secret,JSON.stringify(sortedObject(body)));
  return constantTime(expected.toLowerCase(),sig.toLowerCase());
}
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  const provider=new URL(req.url).searchParams.get("provider")||"";
  const raw=await req.text();
  let body:any; try{body=JSON.parse(raw);}catch{return new Response("bad json",{status:400});}
  let valid=false;
  if(provider==="binance_pay") valid=await binanceVerify(req,raw);
  else if(provider==="nowpayments") valid=await nowVerify(body,req.headers.get("x-nowpayments-sig"));
  else return new Response(JSON.stringify({error:"PROVIDER_NOT_IMPLEMENTED"}),{status:501,headers:{...corsHeaders,"Content-Type":"application/json"}});
  if(!valid) return new Response(JSON.stringify({error:"INVALID_SIGNATURE"}),{status:401,headers:{...corsHeaders,"Content-Type":"application/json"}});
  const sb=adminClient();
  const eventId=String(body.event_id||body.payment_id||body.merchantTradeNo||crypto.randomUUID());
  const {error:logError}=await sb.from("webhook_events").insert({provider,event_id:eventId,signature_valid:true,payload:body});
  if(logError && !String(logError.message).includes("duplicate")) return new Response(JSON.stringify({error:"EVENT_LOG_FAILED"}),{status:500,headers:{...corsHeaders,"Content-Type":"application/json"}});
  const orderId=String(body.order_id||body.merchantTradeNo||"");
  if(!orderId) return new Response(JSON.stringify({ok:true,ignored:true}),{headers:{...corsHeaders,"Content-Type":"application/json"}});
  const {data:order}=await sb.from("orders").select("id,charge_cents,provider_payment_id").eq("id",orderId).single();
  if(!order) return new Response(JSON.stringify({ok:true,ignored:true}),{headers:{...corsHeaders,"Content-Type":"application/json"}});
  let status="pending"; let amountCents=0; let paymentId=String(body.payment_id||body.merchantTradeNo||order.provider_payment_id||eventId);
  if(provider==="nowpayments"){
    status=String(body.payment_status||"").toLowerCase();
    amountCents=Math.round(Number(body.price_amount||0)*100);
  } else {
    status=String(body.status||"").toUpperCase();
    amountCents=Math.round(Number(body.orderAmount||0)*100);
  }
  if(["finished","confirmed","paid","completed"].includes(status.toLowerCase()) && amountCents===Number(order.charge_cents)){
    await sb.rpc("confirm_order_payment",{p_order_id:order.id,p_provider:provider,p_provider_payment_id:paymentId,p_amount_cents:amountCents,p_asset:body.pay_currency||body.currency||"USDT",p_network:body.network||"",p_tx_hash:body.tx_hash||body.transactionId||"",p_recipient:body.pay_address||"",p_confirmations:Number(body.confirmations||0),p_raw:body});
  }
  return new Response(JSON.stringify({ok:true}),{headers:{...corsHeaders,"Content-Type":"application/json"}});
});
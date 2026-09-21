import { corsHeaders } from "../_shared/cors.ts";
import { adminClient } from "../_shared/supabase.ts";

const NETWORKS = new Set(["bitcoin","solana","ethereum","bsc","robinhood_chain"]);
const ASSETS = new Set(["BTC","SOL","ETH","BNB","USDT","USDC"]);
const DECIMALS: Record<string,number> = {BTC:8,SOL:9,ETH:18,BNB:18,USDT:6,USDC:6};

function json(v:unknown,status=200){return new Response(JSON.stringify(v),{status,headers:{...corsHeaders,"Content-Type":"application/json"}})}

async function usdRate(asset:string){
  if(asset==="USDT"||asset==="USDC") return 1;
  const ids:Record<string,string>={BTC:"bitcoin",SOL:"solana",ETH:"ethereum",BNB:"binancecoin"};
  const id=ids[asset]; if(!id) throw new Error("UNSUPPORTED_ASSET");
  const r=await fetch("https://api.coingecko.com/api/v3/simple/price?ids="+id+"&vs_currencies=usd");
  if(!r.ok) throw new Error("PRICE_ORACLE_UNAVAILABLE");
  const j=await r.json(); const p=Number(j?.[id]?.usd);
  if(!Number.isFinite(p)||p<=0) throw new Error("INVALID_PRICE");
  return p;
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  try{
    const body=await req.json();
    const orderId=String(body?.orderId||"");
    const network=String(body?.network||"").toLowerCase();
    const asset=String(body?.asset||"").toUpperCase();
    if(!orderId||!NETWORKS.has(network)||!ASSETS.has(asset)) return json({error:"INVALID_ORDER_OR_ASSET"},400);

    const compatible =
      (network==="bitcoin" && asset==="BTC") ||
      (network==="solana" && asset==="SOL") ||
      (["ethereum","bsc","robinhood_chain"].includes(network) && ["ETH","BNB","USDT","USDC"].includes(asset));
    if(!compatible) return json({error:"ASSET_NOT_SUPPORTED_ON_NETWORK"},400);

    const sb=adminClient();
    const {data:order,error:oe}=await sb.from("orders").select("id,charge_cents,status,expires_at").eq("id",orderId).single();
    if(oe||!order) return json({error:"ORDER_NOT_FOUND"},404);
    if(order.status!=="pending") return json({error:"ORDER_NOT_PAYABLE"},409);
    if(order.expires_at && new Date(order.expires_at).getTime()<=Date.now()) return json({error:"ORDER_EXPIRED"},409);

    const {data:receiver,error:re}=await sb.from("payment_receiving_addresses").select("network,address").eq("network",network).eq("active",true).single();
    if(re||!receiver) return json({error:"NETWORK_NOT_CONFIGURED"},400);

    const rate=await usdRate(asset);
    const amountUsd=Number(order.charge_cents)/100;
    const expectedAmount=amountUsd/rate;
    const decimals=DECIMALS[asset];
    const expectedUnits=Math.ceil(expectedAmount*(10**decimals));
    const expiresAt=order.expires_at||new Date(Date.now()+30*60*1000).toISOString();

    const {error:qe}=await sb.from("crypto_payment_quotes").upsert({
      order_id:order.id,network,asset,recipient_address:receiver.address,
      rate_usd:rate,expected_amount:expectedAmount,expected_units:expectedUnits.toString(),
      decimals,expires_at:expiresAt
    },{onConflict:"order_id,network,asset"});
    if(qe) return json({error:"QUOTE_SAVE_FAILED",detail:qe.message},500);

    return json({orderId:order.id,network,asset,amountUsd,rateUsd:rate,expectedAmount,expectedUnits:String(expectedUnits),decimals,receivingAddress:receiver.address,expiresAt,status:"awaiting_payment"});
  }catch(e){return json({error:e instanceof Error?e.message:"CRYPTO_PAYMENT_SETUP_FAILED"},400)}
});

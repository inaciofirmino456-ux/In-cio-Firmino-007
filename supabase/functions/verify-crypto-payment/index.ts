import { corsHeaders } from "../_shared/cors.ts";
import { adminClient } from "../_shared/supabase.ts";

const NETWORKS = new Set(["bitcoin","ethereum","solana","bsc","robinhood_chain"]);
const CONTRACTS: Record<string,string|undefined> = {
  "ethereum:USDT": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  "ethereum:USDC": "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  "bsc:USDT": "0x55d398326f99059fF775485246999027B3197955",
  "bsc:USDC": "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
};
const RPC: Record<string,string|undefined> = {
  ethereum: Deno.env.get("ETHEREUM_RPC_URL") || "https://ethereum-rpc.publicnode.com",
  bsc: Deno.env.get("BSC_RPC_URL") || "https://bsc-rpc.publicnode.com",
  robinhood_chain: Deno.env.get("ROBINHOOD_CHAIN_RPC_URL") || "https://rpc.mainnet.chain.robinhood.com",
};
function json(v:unknown,status=200){return new Response(JSON.stringify(v),{status,headers:{...corsHeaders,"Content-Type":"application/json"}})}
function eq(a:string,b:string){return a.toLowerCase()===b.toLowerCase()}
async function rpcCall(url:string,method:string,params:any[]){
  const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})});
  if(!r.ok) throw new Error("RPC_HTTP_ERROR");
  const j=await r.json(); if(j.error) throw new Error("RPC_ERROR"); return j.result;
}
function hex(v:string){return BigInt(v||"0x0")}

async function verifyEvm(network:string,asset:string,txHash:string,recipient:string,expectedUnits:bigint){
  const expectedAsset = network==="ethereum" || network==="robinhood_chain" ? "ETH" : network==="bsc" ? "BNB" : "";
  if(asset!==expectedAsset) throw new Error("ASSET_NOT_SUPPORTED_ON_NETWORK");
  const rpc=RPC[network]; if(!rpc) throw new Error("RPC_NOT_CONFIGURED");
  const tx=await rpcCall(rpc,"eth_getTransactionByHash",[txHash]); if(!tx) throw new Error("TRANSACTION_NOT_FOUND");
  const receipt=await rpcCall(rpc,"eth_getTransactionReceipt",[txHash]);
  if(!receipt||receipt.status!=="0x1") throw new Error("TRANSACTION_NOT_CONFIRMED");
  const latest=await rpcCall(rpc,"eth_blockNumber",[]);
  const confirmations=Math.max(0,Number(hex(latest)-hex(receipt.blockNumber)));
  const min=Number(Deno.env.get("CRYPTO_MIN_CONFIRMATIONS")||"3");
  if(confirmations<min) throw new Error("INSUFFICIENT_CONFIRMATIONS");
  const received=eq(tx.to||"",recipient) ? hex(tx.value) : 0n;
  if(received!==expectedUnits) throw new Error("AMOUNT_MISMATCH");
  return {confirmations,receivedUnits:received.toString()};
}

async function verifySolana(txHash:string,recipient:string,expectedUnits:bigint){
  const rpc=Deno.env.get("SOLANA_RPC_URL")||"https://api.mainnet-beta.solana.com";
  const r=await fetch(rpc,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
    jsonrpc:"2.0",id:1,method:"getTransaction",
    params:[txHash,{encoding:"jsonParsed",commitment:"finalized",maxSupportedTransactionVersion:0}]
  })});
  if(!r.ok) throw new Error("SOLANA_RPC_ERROR");
  const j=await r.json(); const tx=j.result;
  if(!tx||tx.meta?.err) throw new Error("SOLANA_TRANSACTION_NOT_CONFIRMED");
  let received=0n;
  for(const ix of tx.transaction?.message?.instructions||[]){
    const info=ix?.parsed?.info;
    if(ix?.parsed?.type==="transfer" && info?.destination===recipient) received+=BigInt(info?.lamports||0);
  }
  if(received!==expectedUnits) throw new Error("AMOUNT_MISMATCH");
  return {confirmations:1,receivedUnits:received.toString()};
}

async function verifyBitcoin(txHash:string,recipient:string,expectedUnits:bigint){
  const r=await fetch("https://mempool.space/api/tx/"+encodeURIComponent(txHash));
  if(!r.ok) throw new Error("BTC_TRANSACTION_NOT_FOUND");
  const tx=await r.json(); if(tx.status?.confirmed!==true) throw new Error("TRANSACTION_NOT_CONFIRMED");
  const tip=await fetch("https://mempool.space/api/blocks/tip/height");
  const height=Number(await tip.text());
  const confirmations=Math.max(0,height-Number(tx.status.block_height)+1);
  const min=Number(Deno.env.get("CRYPTO_MIN_CONFIRMATIONS")||"3");
  if(confirmations<min) throw new Error("INSUFFICIENT_CONFIRMATIONS");
  let received=0n; for(const out of tx.vout||[]) if(out.scriptpubkey_address===recipient) received+=BigInt(out.value||0);
  if(received!==expectedUnits) throw new Error("AMOUNT_MISMATCH");
  return {confirmations,receivedUnits:received.toString()};
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  try{
    const body=await req.json();
    const orderId=String(body?.orderId||"");
    const network=String(body?.network||"").toLowerCase();
    const asset=String(body?.asset||"").toUpperCase();
    const txHash=String(body?.txHash||"");
    const validAsset =
      (network==="bitcoin" && asset==="BTC") ||
      (network==="ethereum" && asset==="ETH") ||
      (network==="solana" && asset==="SOL") ||
      (network==="bsc" && asset==="BNB") ||
      (network==="robinhood_chain" && asset==="ETH");
    if(!orderId||!NETWORKS.has(network)||!validAsset||!txHash) return json({error:"INVALID_INPUT"},400);

    const sb=adminClient();
    const {data:order,error:oe}=await sb.from("orders").select("id,charge_cents,status,expires_at").eq("id",orderId).single();
    if(oe||!order) return json({error:"ORDER_NOT_FOUND"},404);
    if(order.status!=="pending") return json({error:"ORDER_NOT_PAYABLE"},409);
    if(order.expires_at&&new Date(order.expires_at).getTime()<=Date.now()) return json({error:"ORDER_EXPIRED"},409);

    const {data:quote,error:qe}=await sb.from("crypto_payment_quotes").select("network,asset,recipient_address,expected_units,expires_at").eq("order_id",orderId).eq("network",network).eq("asset",asset).single();
    if(qe||!quote) return json({error:"CRYPTO_QUOTE_NOT_FOUND"},409);
    if(new Date(quote.expires_at).getTime()<=Date.now()) return json({error:"CRYPTO_QUOTE_EXPIRED"},409);

    const expectedUnits=BigInt(String(quote.expected_units));
    const verification=network==="bitcoin"
      ? await verifyBitcoin(txHash,quote.recipient_address,expectedUnits)
      : network==="solana"
        ? await verifySolana(txHash,quote.recipient_address,expectedUnits)
        : await verifyEvm(network,asset,txHash,quote.recipient_address,expectedUnits);

    const {data:result,error:ce}=await sb.rpc("confirm_order_payment",{
      p_order_id:order.id,p_provider:"crypto",p_provider_payment_id:txHash,p_amount_cents:order.charge_cents,
      p_asset:asset,p_network:network,p_tx_hash:txHash,p_recipient:quote.recipient_address,
      p_confirmations:verification.confirmations,p_raw:{...verification,network,asset,quote}
    });
    if(ce) return json({error:"CONFIRMATION_FAILED",detail:ce.message},500);
    return json({ok:true,verification,result});
  }catch(e){return json({ok:false,error:e instanceof Error?e.message:"VERIFICATION_FAILED"},400)}
});

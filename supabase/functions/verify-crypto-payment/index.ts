import { corsHeaders } from "../_shared/cors.ts";
import { adminClient } from "../_shared/supabase.ts";

type Network = "bitcoin"|"solana"|"ethereum"|"bsc"|"robinhood_chain";

const NETWORKS = new Set<Network>(["bitcoin","solana","ethereum","bsc","robinhood_chain"]);
const EVM_NETWORKS = new Set(["ethereum","bsc","robinhood_chain"]);

const RPC: Record<string,string|undefined> = {
  ethereum: Deno.env.get("ETHEREUM_RPC_URL"),
  bsc: Deno.env.get("BSC_RPC_URL"),
  robinhood_chain: Deno.env.get("ROBINHOOD_CHAIN_RPC_URL"),
};

const CONTRACTS: Record<string,string|undefined> = {
  "ethereum:USDT": Deno.env.get("ETHEREUM_USDT_CONTRACT"),
  "ethereum:USDC": Deno.env.get("ETHEREUM_USDC_CONTRACT"),
  "bsc:USDT": Deno.env.get("BSC_USDT_CONTRACT"),
  "bsc:USDC": Deno.env.get("BSC_USDC_CONTRACT"),
  "robinhood_chain:USDT": Deno.env.get("ROBINHOOD_USDT_CONTRACT"),
  "robinhood_chain:USDC": Deno.env.get("ROBINHOOD_USDC_CONTRACT"),
};

const DECIMALS: Record<string,number> = {
  "USDT": 6,
  "USDC": 6,
  "BTC": 8,
  "SOL": 9,
  "BNB": 18,
  "ETH": 18,
};

function eq(a:string,b:string){ return a.toLowerCase()===b.toLowerCase(); }
function json(data:unknown,status=200){ return new Response(JSON.stringify(data),{status,headers:{...corsHeaders,"Content-Type":"application/json"}}); }

async function rpcCall(url:string,method:string,params:any[]){
  const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})});
  if(!r.ok) throw new Error("RPC_HTTP_ERROR");
  const j=await r.json();
  if(j.error) throw new Error("RPC_ERROR");
  return j.result;
}

function hexToBigInt(v:string){ return BigInt(v||"0x0"); }

async function verifyEvm(network:Network,asset:string,txHash:string,recipient:string,expectedUsd:number){
  const rpc=RPC[network];
  if(!rpc) throw new Error("RPC_NOT_CONFIGURED");
  const tx=await rpcCall(rpc,"eth_getTransactionByHash",[txHash]);
  if(!tx) throw new Error("TRANSACTION_NOT_FOUND");
  if(!tx.to) throw new Error("INVALID_TRANSACTION");
  const receipt=await rpcCall(rpc,"eth_getTransactionReceipt",[txHash]);
  if(!receipt || receipt.status!=="0x1") throw new Error("TRANSACTION_NOT_CONFIRMED");
  const latest=await rpcCall(rpc,"eth_blockNumber",[]);
  const confirmations=Number(hexToBigInt(latest)-hexToBigInt(receipt.blockNumber));
  const minConfirmations=Number(Deno.env.get("CRYPTO_MIN_CONFIRMATIONS")||"3");
  if(confirmations < minConfirmations) throw new Error("INSUFFICIENT_CONFIRMATIONS");

  let received=0n;
  if(asset==="ETH" || asset==="BNB"){
    if(eq(tx.to,recipient)) received=hexToBigInt(tx.value);
  } else {
    const contract=CONTRACTS[network+":"+asset];
    if(!contract) throw new Error("TOKEN_CONTRACT_NOT_CONFIGURED");
    const transferTopic="0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a9df523b3ef";
    for(const log of (receipt.logs||[])){
      if(!eq(log.address,contract) || !log.topics || log.topics.length<3 || log.topics[0].toLowerCase()!==transferTopic) continue;
      const to="0x"+String(log.topics[2]).slice(-40);
      if(eq(to,recipient)) received += hexToBigInt(log.data);
    }
  }

  const decimals=DECIMALS[asset];
  if(decimals===undefined) throw new Error("UNSUPPORTED_ASSET");
  const expectedUnits=BigInt(Math.round(expectedUsd*10**decimals));
  if(received!==expectedUnits) throw new Error("AMOUNT_MISMATCH");
  return {confirmations,receivedUnits:received.toString(),asset,network,txHash,recipient};
}

async function verifyBitcoin(txHash:string,recipient:string,expectedUsd:number){
  const r=await fetch("https://mempool.space/api/tx/"+encodeURIComponent(txHash));
  if(!r.ok) throw new Error("BTC_TRANSACTION_NOT_FOUND");
  const tx=await r.json();
  if(tx.status?.confirmed!==true) throw new Error("TRANSACTION_NOT_CONFIRMED");
  const tip=await fetch("https://mempool.space/api/blocks/tip/height");
  const tipHeight=Number(await tip.text());
  const confirmations=Math.max(0,tipHeight-Number(tx.status.block_height)+1);
  const minConfirmations=Number(Deno.env.get("CRYPTO_MIN_CONFIRMATIONS")||"3");
  if(confirmations<minConfirmations) throw new Error("INSUFFICIENT_CONFIRMATIONS");
  const expectedSats=BigInt(Math.round(expectedUsd*1e8));
  let received=0n;
  for(const out of (tx.vout||[])){
    if(out.scriptpubkey_address===recipient) received+=BigInt(out.value||0);
  }
  if(received!==expectedSats) throw new Error("AMOUNT_MISMATCH");
  return {confirmations,receivedUnits:received.toString(),asset:"BTC",network:"bitcoin",txHash,recipient};
}

async function verifySolana(asset:string,txHash:string,recipient:string,expectedUsd:number){
  const rpc=Deno.env.get("SOLANA_RPC_URL")||"https://api.mainnet-beta.solana.com";
  const tx=await rpcCall(rpc,"getTransaction",[txHash,{encoding:"jsonParsed",commitment:"finalized",maxSupportedTransactionVersion:0}]);
  if(!tx || tx.meta?.err) throw new Error("SOLANA_TRANSACTION_NOT_CONFIRMED");
  const message=tx.transaction?.message;
  const instructions=message?.instructions||[];
  if(asset==="SOL"){
    let received=0n;
    for(const ix of instructions){
      if(ix.parsed?.type==="transfer" && ix.parsed?.info?.destination===recipient) received+=BigInt(ix.parsed.info.lamports||0);
    }
    const expectedLamports=BigInt(Math.round(expectedUsd*1e9));
    if(received!==expectedLamports) throw new Error("AMOUNT_MISMATCH");
  } else {
    throw new Error("SOLANA_TOKEN_VERIFICATION_REQUIRES_TOKEN_CONFIG");
  }
  return {confirmations:1,receivedUnits:"verified",asset,network:"solana",txHash,recipient};
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  try{
    const body=await req.json();
    const orderId=String(body?.orderId||"");
    const network=String(body?.network||"").toLowerCase() as Network;
    const asset=String(body?.asset||"").toUpperCase();
    const txHash=String(body?.txHash||"");
    if(!orderId||!NETWORKS.has(network)||!txHash) return json({error:"INVALID_INPUT"},400);

    const sb=adminClient();
    const {data:order,error:oe}=await sb.from("orders").select("id,charge_cents,status,expires_at").eq("id",orderId).single();
    if(oe||!order) return json({error:"ORDER_NOT_FOUND"},404);
    if(order.status!=="pending") return json({error:"ORDER_NOT_PAYABLE"},409);
    if(order.expires_at && new Date(order.expires_at).getTime()<=Date.now()) return json({error:"ORDER_EXPIRED"},409);

    const {data:receiver,error:re}=await sb.from("payment_receiving_addresses").select("address").eq("network",network).eq("active",true).single();
    if(re||!receiver) return json({error:"NETWORK_NOT_CONFIGURED"},400);

    const expectedUsd=Number(order.charge_cents)/100;
    const verification = network==="bitcoin"
      ? await verifyBitcoin(txHash,receiver.address,expectedUsd)
      : network==="solana"
        ? await verifySolana(asset,txHash,receiver.address,expectedUsd)
        : await verifyEvm(network,asset,txHash,receiver.address,expectedUsd);

    const provider = "crypto";
    const {data:result,error:ce}=await sb.rpc("confirm_order_payment",{
      p_order_id:order.id,p_provider:provider,p_provider_payment_id:txHash,p_amount_cents:order.charge_cents,
      p_asset:asset,p_network:network,p_tx_hash:txHash,p_recipient:receiver.address,
      p_confirmations:verification.confirmations,p_raw:verification
    });
    if(ce) return json({error:"CONFIRMATION_FAILED",detail:ce.message},500);
    return json({ok:true,verification,result});
  }catch(e){
    return json({ok:false,error:e instanceof Error?e.message:"VERIFICATION_FAILED"},400);
  }
});

import { corsHeaders } from "../_shared/cors.ts";
import { adminClient } from "../_shared/supabase.ts";
import { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";

const botPattern=/bot|crawler|spider|slurp|facebookexternalhit|preview|headless|curl|wget/i;

async function hash(value:string){
  const data=new TextEncoder().encode(value);
  const digest=await crypto.subtle.digest("SHA-256",data);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  try{
    const body=await req.json();
    const listingId=String(body?.listingId||"");
    if(!listingId) return new Response(JSON.stringify({error:"invalid_request"}),{status:400,headers:{...corsHeaders,"Content-Type":"application/json"}});
    const ua=req.headers.get("user-agent")||"";
    const isBot=botPattern.test(ua);
    const sb=adminClient();
    await sb.from("click_events").insert({listing_id:listingId,ip_hash:await hash(req.headers.get("x-forwarded-for")||"unknown"),user_agent:ua,is_bot:isBot});
    if(!isBot) await sb.rpc("increment_listing_clicks",{p_listing_id:listingId});
    return new Response(JSON.stringify({ok:true}),{headers:{...corsHeaders,"Content-Type":"application/json"}});
  }catch(e){return new Response(JSON.stringify({error:"click_failed"}),{status:500,headers:{...corsHeaders,"Content-Type":"application/json"}});}
});

import { corsHeaders } from "../_shared/cors.ts";
import { adminClient } from "../_shared/supabase.ts";

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  try{
    const url=new URL(req.url);
    const orderId=url.searchParams.get("orderId");
    if(!orderId) throw new Error("ORDER_ID_REQUIRED");
    const sb=adminClient();
    const {data,error}=await sb.from("orders").select("id,status,charge_cents,created_at,expires_at").eq("id",orderId).single();
    if(error || !data) throw new Error("ORDER_NOT_FOUND");
    return new Response(JSON.stringify(data),{headers:{...corsHeaders,"Content-Type":"application/json"}});
  }catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:"status_failed"}),{status:400,headers:{...corsHeaders,"Content-Type":"application/json"}});}
});
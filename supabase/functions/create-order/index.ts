import { corsHeaders } from "../_shared/cors.ts";
import { adminClient } from "../_shared/supabase.ts";

const blockedHosts = /(^|\.)((t\.me)|(telegram\.me)|(wa\.me)|(whatsapp\.com)|(discord\.gg)|(discord\.com)|(m\.me)|(signal\.org))$/i;
const shorteners = /(^|\.)(bit\.ly|tinyurl\.com|t\.co|is\.gd|cutt\.ly|goo\.gl)$/i;

function normalize(input: string) {
  const raw = input.trim();
  if (raw.startsWith("@")) {
    const handle = raw.slice(1).replace(/[^a-zA-Z0-9_]/g, "");
    if (!handle) throw new Error("invalid X handle");
    return { canonical: `https://x.com/${handle}`, normalized: `x.com/${handle.toLowerCase()}`, domain: "x.com" };
  }
  const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  u.hash = "";
  for (const key of [...u.searchParams.keys()]) u.searchParams.delete(key);
  if (blockedHosts.test(u.hostname)) throw new Error("chat or invite links are not allowed");
  if (shorteners.test(u.hostname)) throw new Error("URL shorteners are not allowed; submit the final URL");
  if (!["http:","https:"].includes(u.protocol)) throw new Error("invalid protocol");
  const path = u.pathname.replace(/\/+$/,"") || "/";
  const canonical = `${u.protocol}//${u.hostname.toLowerCase()}${path}`;
  return { canonical, normalized: `${u.hostname.toLowerCase()}${path}`, domain: u.hostname.toLowerCase() };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok",{headers:corsHeaders});
  try {
    const body = await req.json();
    if (typeof body?.url !== "string" || typeof body?.requestedTotalUsd !== "number" || typeof body?.categorySlug !== "string") {
      return new Response(JSON.stringify({error:"invalid_request"}),{status:400,headers:{...corsHeaders,"Content-Type":"application/json"}});
    }
    const target = normalize(body.url);
    const sb = adminClient();
    const {data:category,error:catError}=await sb.from("categories").select("id,name").eq("slug",body.categorySlug).single();
    if(catError) throw catError;
    const requested = Math.round(body.requestedTotalUsd*100);
    const {data:order,error}=await sb.rpc("create_order",{
      p_normalized_url:target.normalized,
      p_canonical_url:target.canonical,
      p_category_id:category.id,
      p_requested_total_cents:requested
    });
    if(error) throw error;
    const created = Array.isArray(order) ? order[0] : order;
    return new Response(JSON.stringify({
      orderId:created.id,
      amountUsd:Number(created.charge_cents)/100,
      requestedTotalUsd:Number(created.requested_total_cents)/100,
      canonicalUrl:target.canonical,
      domain:target.domain
    }),{headers:{...corsHeaders,"Content-Type":"application/json"}});
  } catch (e) {
    return new Response(JSON.stringify({error:e instanceof Error?e.message:"invalid_request"}),{status:400,headers:{...corsHeaders,"Content-Type":"application/json"}});
  }
});

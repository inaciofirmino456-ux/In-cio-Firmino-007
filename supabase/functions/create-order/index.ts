import { corsHeaders } from "../_shared/cors.ts";
import { adminClient } from "../_shared/supabase.ts";

const blockedHosts = new Set(["t.me","telegram.me","wa.me","whatsapp.com","discord.gg","discord.com","m.me","signal.org"]);
const shorteners = new Set(["bit.ly","tinyurl.com","t.co","is.gd","cutt.ly","goo.gl"]);

function rejectPrivateHost(hostname: string) {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host === "::1") throw new Error("private/local URLs are not allowed");
  const parts = host.split(".").map(Number);
  if (parts.length === 4 && parts.every(Number.isInteger)) {
    const [a,b] = parts;
    if (a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) throw new Error("private IP URLs are not allowed");
  }
}

async function resolveUrl(raw: string) {
  if (raw.startsWith("@")) {
    const handle = raw.slice(1).replace(/[^a-zA-Z0-9_]/g, "");
    if (!handle) throw new Error("invalid X handle");
    return { canonical: "https://x.com/" + handle, normalized: "x.com/" + handle.toLowerCase(), domain: "x.com", title: "@" + handle, description: "" };
  }

  const original = new URL(/^https?:\/\//i.test(raw) ? raw : "https://" + raw);
  if (!["http:","https:"].includes(original.protocol)) throw new Error("invalid protocol");
  rejectPrivateHost(original.hostname);
  const originalHost = original.hostname.toLowerCase();
  if ([...blockedHosts].some(h => originalHost === h || originalHost.endsWith("." + h))) throw new Error("chat or invite links are not allowed");

  let finalUrl = original;
  if (shorteners.has(originalHost)) {
    const response = await fetch(original.toString(), { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(8000) });
    finalUrl = new URL(response.url);
    rejectPrivateHost(finalUrl.hostname);
  }

  finalUrl.hash = "";
  for (const key of [...finalUrl.searchParams.keys()]) finalUrl.searchParams.delete(key);
  const cleanPath = finalUrl.pathname.replace(/\/+$/, "") || "/";
  const canonical = finalUrl.protocol + "//" + finalUrl.hostname.toLowerCase() + cleanPath;

  let title = finalUrl.hostname;
  let description = "";
  try {
    const response = await fetch(canonical, { redirect: "follow", signal: AbortSignal.timeout(8000), headers: { "user-agent": "TopBidMetadataBot/1.0" } });
    const html = (await response.text()).slice(0, 500_000);
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const descriptionMatch = html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']*)["']/i);
    if (titleMatch?.[1]) title = titleMatch[1].replace(/\s+/g, " ").trim().slice(0, 160);
    if (descriptionMatch?.[1]) description = descriptionMatch[1].replace(/\s+/g, " ").trim().slice(0, 300);
  } catch {}

  return { canonical, normalized: finalUrl.hostname.toLowerCase() + cleanPath, domain: finalUrl.hostname.toLowerCase(), title, description };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    if (typeof body?.url !== "string" || typeof body?.requestedTotalUsd !== "number" || typeof body?.categorySlug !== "string") {
      return new Response(JSON.stringify({ error: "invalid_request" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const target = await resolveUrl(body.url.trim());
    const requested = Math.round(body.requestedTotalUsd * 100);
    if (!Number.isSafeInteger(requested) || requested < 100 || requested > 99_999_900) throw new Error("amount outside limits");

    const sb = adminClient();
    const { data: category, error: catError } = await sb.from("categories").select("id,name").eq("slug", body.categorySlug).single();
    if (catError) throw catError;

    const { data: order, error } = await sb.rpc("create_order", {
      p_normalized_url: target.normalized,
      p_canonical_url: target.canonical,
      p_category_id: category.id,
      p_requested_total_cents: requested,
    });
    if (error) throw error;
    const created = Array.isArray(order) ? order[0] : order;
    await sb.from("orders").update({ metadata: { title: target.title, description: target.description, domain: target.domain } }).eq("id", created.id);

    return new Response(JSON.stringify({
      orderId: created.id,
      amountUsd: Number(created.charge_cents) / 100,
      requestedTotalUsd: Number(created.requested_total_cents) / 100,
      canonicalUrl: target.canonical,
      domain: target.domain,
      title: target.title,
      description: target.description,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "invalid_request" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

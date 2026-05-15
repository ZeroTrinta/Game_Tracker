// ml-proxy — Supabase Edge Function
// Aceita: ?mlbid=MLB123 ou ?mlbid=MLB123&endpoint=clips ou ?oauth=1 (POST)

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: cors });
  }

  try {
    const url      = new URL(req.url);
    const mlbid    = url.searchParams.get("mlbid");
    const endpoint = url.searchParams.get("endpoint");
    const oauth    = url.searchParams.get("oauth");
    const token    = req.headers.get("Authorization") || req.headers.get("authorization") || "";

    let mlUrl: string;
    let method = req.method;
    let headers: Record<string, string> = {};
    let body: string | undefined;

    if (oauth === "1" || method === "POST") {
      // OAuth token exchange/refresh
      mlUrl = "https://api.mercadolibre.com/oauth/token";
      method = "POST";
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      body = await req.text();
    } else if (mlbid && endpoint === "clips") {
      mlUrl = `https://api.mercadolibre.com/items/${mlbid}/clips`;
      if (token) headers["Authorization"] = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
    } else if (mlbid) {
      mlUrl = `https://api.mercadolibre.com/items/${mlbid}`;
      if (token) headers["Authorization"] = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
    } else {
      return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    const mlRes  = await fetch(mlUrl, { method, headers, body });
    const mlText = await mlRes.text();

    return new Response(mlText, {
      status: mlRes.status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

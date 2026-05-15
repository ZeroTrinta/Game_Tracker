// api/ml-proxy.js — Vercel Serverless Function
// Proxy para API do Mercado Livre (resolve CORS)

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { path } = req.query;

  if (!path) {
    return res.status(400).json({ error: "Parâmetro 'path' obrigatório" });
  }

  // Segurança: só permite paths do ML
  const allowed = ["/items/", "/clips", "/oauth/token"];
  if (!allowed.some(p => path.includes(p))) {
    return res.status(403).json({ error: "Path não permitido" });
  }

  const mlUrl  = `https://api.mercadolibre.com${path}`;
  const token  = req.headers["authorization"] || "";
  const method = req.method;

  const headers = {};
  if (token) headers["Authorization"] = token;

  let body = undefined;
  if (method === "POST") {
    const ct = req.headers["content-type"] || "";
    if (ct.includes("x-www-form-urlencoded")) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      body = new URLSearchParams(req.body).toString();
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(req.body);
    }
  }

  try {
    const mlRes  = await fetch(mlUrl, { method, headers, body });
    const mlData = await mlRes.json();
    return res.status(mlRes.status).json(mlData);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

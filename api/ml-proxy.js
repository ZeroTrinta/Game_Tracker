export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { mlbid, endpoint } = req.query;
  
  let mlUrl;
  if (req.method === "POST") {
    mlUrl = "https://api.mercadolibre.com/oauth/token";
  } else if (mlbid && endpoint === "clips") {
    mlUrl = `https://api.mercadolibre.com/items/${mlbid}/clips`;
  } else if (mlbid) {
    mlUrl = `https://api.mercadolibre.com/items/${mlbid}`;
  } else {
    return res.status(400).json({ error: "mlbid obrigatório" });
  }

  const token = req.headers["authorization"] || "";
  const headers = {};
  if (token) headers["Authorization"] = token;

  let body = undefined;
  if (req.method === "POST") {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(req.body || {})) params.append(k, v);
    body = params.toString();
  }

  try {
    const mlRes = await fetch(mlUrl, { method: req.method, headers, body });
    const mlData = await mlRes.json();
    return res.status(mlRes.status).json(mlData);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

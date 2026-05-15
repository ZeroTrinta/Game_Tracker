export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { path } = req.query;
  if (!path) return res.status(400).json({ error: "path obrigatório" });

  const allowed = ["/items/", "/clips", "/oauth/token"];
  if (!allowed.some(p => path.includes(p))) return res.status(403).json({ error: "Path não permitido" });

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
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(req.body || {})) params.append(k, v);
      body = params.toString();
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

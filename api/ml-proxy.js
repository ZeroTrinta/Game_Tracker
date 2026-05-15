export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") return res.status(200).end();

  // Extrai o path diretamente da URL raw para evitar problemas de double-encoding
  const rawUrl = req.url || "";
  const pathParam = rawUrl.split("path=")[1];
  if (!pathParam) return res.status(400).json({ error: "path obrigatório" });

  // Decodifica o path (pode estar encoded uma ou duas vezes)
  let mlPath;
  try { mlPath = decodeURIComponent(pathParam); } catch { mlPath = pathParam; }
  // Segunda decodificação se ainda tiver %
  if (mlPath.includes("%")) {
    try { mlPath = decodeURIComponent(mlPath); } catch {}
  }

  // Segurança: só permite paths do ML
  const allowed = ["/items/", "/clips", "/oauth/token"];
  if (!allowed.some(p => mlPath.includes(p))) {
    return res.status(403).json({ error: "Path não permitido: " + mlPath });
  }

  const mlUrl  = `https://api.mercadolibre.com${mlPath}`;
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

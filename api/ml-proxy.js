export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") return res.status(200).end();

  // Pega o path e tenta decodificar de todas as formas possíveis
  let mlPath = req.query.path || "";

  // Tenta decodificar até não ter mais % encoded
  for (let i = 0; i < 3; i++) {
    if (!mlPath.includes("%")) break;
    try { mlPath = decodeURIComponent(mlPath); } catch { break; }
  }

  // Garante que começa com /
  if (!mlPath.startsWith("/")) mlPath = "/" + mlPath;

  // Log para debug (aparece nos logs da Vercel)
  console.log("mlPath final:", mlPath);

  // Sem restrição de path por enquanto — aceita qualquer path do ML
  const mlUrl = `https://api.mercadolibre.com${mlPath}`;
  const token = req.headers["authorization"] || "";
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
    const mlRes = await fetch(mlUrl, { method, headers, body });
    const mlData = await mlRes.json();
    return res.status(mlRes.status).json(mlData);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

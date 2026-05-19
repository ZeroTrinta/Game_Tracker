import { createServer } from "http";
import { request as httpsRequest } from "https";
import { parse } from "url";

const PORT = process.env.PORT || 3000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  const parsed   = parse(req.url, true);
  const mlbid    = parsed.query.mlbid;
  const endpoint = parsed.query.endpoint;
  const oauth    = parsed.query.oauth;
  const token    = req.headers["authorization"] || "";

  // Endpoint de debug — mostra o que está chegando
  if (parsed.pathname === "/debug") {
    res.writeHead(200, { ...CORS, "Content-Type": "application/json" });
    res.end(JSON.stringify({
      token_presente: !!token,
      token_preview: token ? token.substring(0, 30) + "..." : "VAZIO",
      mlbid, endpoint, oauth,
      headers: req.headers,
    }));
    return;
  }

  let mlUrl, method = req.method, headers = {}, bodyData = "";

  await new Promise(resolve => {
    req.on("data", chunk => bodyData += chunk);
    req.on("end", resolve);
  });

  if (oauth === "1" || method === "POST") {
    mlUrl = "https://api.mercadolibre.com/oauth/token";
    method = "POST";
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  } else if (mlbid && endpoint === "clips") {
    mlUrl = `https://api.mercadolibre.com/items/${mlbid}/clips`;
    if (token) headers["Authorization"] = token;
  } else if (mlbid && endpoint === "items") {
    // Busca itens de um produto agrupado (/p/MLB...)
    mlUrl = `https://api.mercadolibre.com/products/${mlbid}/items?limit=1`;
    if (token) headers["Authorization"] = token;
  } else if (mlbid && endpoint === "search") {
    // Busca anúncios pelo seller usando product_id
    mlUrl = `https://api.mercadolibre.com/users/me/items/search?product_id=${mlbid}`;
    if (token) headers["Authorization"] = token;
  } else if (mlbid) {
    mlUrl = `https://api.mercadolibre.com/items/${mlbid}`;
    if (token) headers["Authorization"] = token;
  } else {
    res.writeHead(400, { ...CORS, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "mlbid obrigatório" }));
    return;
  }

  console.log(`[ML] ${method} ${mlUrl} | token: ${token ? "SIM" : "NÃO"}`);

  const mlParsed = parse(mlUrl);
  const options  = { hostname: mlParsed.hostname, path: mlParsed.path, method, headers };
  if (bodyData) options.headers["Content-Length"] = Buffer.byteLength(bodyData);

  const mlReq = httpsRequest(options, mlRes => {
    let data = "";
    mlRes.on("data", chunk => data += chunk);
    mlRes.on("end", () => {
      console.log(`[ML] status: ${mlRes.statusCode}`);
      res.writeHead(mlRes.statusCode, { ...CORS, "Content-Type": "application/json" });
      res.end(data);
    });
  });

  mlReq.on("error", err => {
    res.writeHead(500, { ...CORS, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  });

  if (bodyData) mlReq.write(bodyData);
  mlReq.end();

}).listen(PORT, () => console.log(`ML Proxy rodando na porta ${PORT}`));

const http = require("http");
const https = require("https");
const url = require("url");

const PORT = process.env.PORT || 3000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  const parsed   = url.parse(req.url, true);
  const mlbid    = parsed.query.mlbid;
  const endpoint = parsed.query.endpoint;
  const oauth    = parsed.query.oauth;
  const token    = req.headers["authorization"] || "";

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
  } else if (mlbid) {
    mlUrl = `https://api.mercadolibre.com/items/${mlbid}`;
    if (token) headers["Authorization"] = token;
  } else {
    res.writeHead(400, { ...CORS, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "mlbid obrigatório" }));
    return;
  }

  const mlParsed = url.parse(mlUrl);
  const options  = { hostname: mlParsed.hostname, path: mlParsed.path, method, headers };
  if (bodyData) options.headers["Content-Length"] = Buffer.byteLength(bodyData);

  const mlReq = https.request(options, mlRes => {
    let data = "";
    mlRes.on("data", chunk => data += chunk);
    mlRes.on("end", () => {
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
});

server.listen(PORT, () => console.log(`ML Proxy rodando na porta ${PORT}`));

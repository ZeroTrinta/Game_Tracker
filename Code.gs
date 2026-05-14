// ============================================================
// GameTracker ML — Google Apps Script (Cole no Apps Script)
// ============================================================
// Como usar:
// 1. Abra sua planilha no Google Sheets
// 2. Menu: Extensões → Apps Script
// 3. Cole todo este código e salve
// 4. Clique em "Implantar" → "Nova implantação"
// 5. Tipo: "App da Web" | Acesso: "Qualquer pessoa"
// 6. Copie a URL gerada e cole no App.jsx (APPS_SCRIPT_URL)
// ============================================================

const SHEET_NAME = "Jogos";
const HEADERS = ["id", "titulo", "console", "status", "url_video", "url_anuncio_ml", "ml_id", "motivo_negacao", "observacoes", "importado_em", "atualizado_em"];

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    // Formatar cabeçalho
    const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setBackground("#1a1a1a");
    headerRange.setFontColor("#f97316");
    headerRange.setFontWeight("bold");
  }
  return sheet;
}

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    const action = e.parameter.action || (e.postData ? JSON.parse(e.postData.contents).action : null);
    const body = e.postData ? JSON.parse(e.postData.contents) : {};

    let result;
    switch (action) {
      case "getAll":      result = getAll(e.parameter);     break;
      case "save":        result = saveJogo(body);           break;
      case "importBatch": result = importBatch(body);        break;
      case "getStats":    result = getStats();               break;
      default:            result = { error: "Ação desconhecida: " + action };
    }

    output.setContent(JSON.stringify(result));
  } catch (err) {
    output.setContent(JSON.stringify({ error: err.message }));
  }

  return output;
}

// ── Buscar todos os jogos com filtros e paginação ──
function getAll(params) {
  const sheet = getOrCreateSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { jogos: [], total: 0 };

  const headers = data[0];
  let rows = data.slice(1).map((row, i) => {
    const obj = {};
    headers.forEach((h, j) => obj[h] = row[j]);
    obj._rowIndex = i + 2; // linha real na planilha (1-based + header)
    return obj;
  }).filter(r => r.id); // ignorar linhas vazias

  // Filtros
  const search = (params.search || "").toLowerCase();
  const status = params.status || "";
  const console_ = params.console || "";

  if (search) rows = rows.filter(r =>
    (r.titulo || "").toLowerCase().includes(search) ||
    (r.console || "").toLowerCase().includes(search)
  );
  if (status) rows = rows.filter(r => r.status === status);
  if (console_) rows = rows.filter(r => r.console === console_);

  const total = rows.length;

  // Paginação
  const page = parseInt(params.page || "0");
  const pageSize = parseInt(params.pageSize || "50");
  const paginated = rows.reverse().slice(page * pageSize, (page + 1) * pageSize);

  return { jogos: paginated, total };
}

// ── Salvar / atualizar um jogo ──
function saveJogo(body) {
  const sheet = getOrCreateSheet();
  const jogo = body.jogo;
  if (!jogo) return { error: "Nenhum jogo enviado" };

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // Procura linha pelo ID
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(jogo.id)) {
      rowIndex = i + 1; // 1-based
      break;
    }
  }

  jogo.atualizado_em = new Date().toISOString();

  if (rowIndex > 0) {
    // Atualiza linha existente
    const rowData = HEADERS.map(h => jogo[h] !== undefined ? jogo[h] : "");
    sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([rowData]);
    return { success: true, action: "updated" };
  } else {
    // Insere nova linha
    jogo.id = jogo.id || Utilities.getUuid();
    jogo.importado_em = jogo.importado_em || new Date().toISOString();
    const rowData = HEADERS.map(h => jogo[h] !== undefined ? jogo[h] : "");
    sheet.appendRow(rowData);
    return { success: true, action: "inserted", id: jogo.id };
  }
}

// ── Importar lote de jogos ──
function importBatch(body) {
  const sheet = getOrCreateSheet();
  const jogos = body.jogos;
  if (!jogos || !jogos.length) return { error: "Nenhum jogo enviado" };

  // Pega IDs existentes para detectar duplicatas
  const data = sheet.getDataRange().getValues();
  const existingTitles = new Set(data.slice(1).map(r => (r[1] || "").toLowerCase().trim()));

  const toInsert = [];
  let duplicates = 0;

  for (const jogo of jogos) {
    const titleKey = (jogo.titulo || "").toLowerCase().trim();
    if (existingTitles.has(titleKey)) {
      duplicates++;
      continue;
    }
    jogo.id = Utilities.getUuid();
    jogo.status = jogo.status || "pendente";
    jogo.importado_em = new Date().toISOString();
    jogo.atualizado_em = new Date().toISOString();
    toInsert.push(HEADERS.map(h => jogo[h] !== undefined ? jogo[h] : ""));
    existingTitles.add(titleKey);
  }

  if (toInsert.length > 0) {
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, toInsert.length, HEADERS.length).setValues(toInsert);
  }

  return { success: true, inserted: toInsert.length, duplicates };
}

// ── Estatísticas por status ──
function getStats() {
  const sheet = getOrCreateSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { counts: {}, consoles: [] };

  const statusIdx = HEADERS.indexOf("status");
  const consoleIdx = HEADERS.indexOf("console");

  const counts = {};
  const consolesSet = new Set();

  data.slice(1).forEach(row => {
    if (!row[0]) return; // linha vazia
    const st = row[statusIdx] || "pendente";
    counts[st] = (counts[st] || 0) + 1;
    if (row[consoleIdx]) consolesSet.add(row[consoleIdx]);
  });

  return { counts, consoles: [...consolesSet].sort() };
}

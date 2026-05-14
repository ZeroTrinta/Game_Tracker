import { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Search, Upload, Download, RefreshCw, Link2, ChevronRight,
  X, Check, Clock, Pause, Eye, Edit3,
  BarChart2, LogIn, Gamepad2, Save,
  AlertTriangle, CheckCircle2, XCircle,
  Loader2, Menu, ShoppingBag, History
} from "lucide-react";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const SUPABASE_URL      = "https://baftwizxkazuwdczqhpm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhZnR3aXp4a2F6dXdkY3pxaHBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NjU1ODYsImV4cCI6MjA5NDM0MTU4Nn0.bSVcyhVh_0es0TENfkZJHuR-1KufbijmN8iif39On04";
const ML_APP_ID         = "000000";
const ML_REDIRECT_URI   = window.location.origin + window.location.pathname;

// ─── SUPABASE CLIENT ─────────────────────────────────────────────────────────
const sb = (() => {
  const h = {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
  const base = SUPABASE_URL + "/rest/v1";
  return {
    async select(table, params = "") {
      const r = await fetch(`${base}/${table}?${params}`, { headers: { ...h, Prefer: "return=representation" } });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    async insert(table, body) {
      const r = await fetch(`${base}/${table}`, { method: "POST", headers: { ...h, Prefer: "return=representation" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    async update(table, id, body) {
      const r = await fetch(`${base}/${table}?id=eq.${id}`, { method: "PATCH", headers: { ...h, Prefer: "return=representation" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    async count(table, filter = "") {
      const r = await fetch(`${base}/${table}?${filter}`, { headers: { ...h, Prefer: "count=exact", Range: "0-0" } });
      const ct = r.headers.get("Content-Range") || "0/0";
      return parseInt(ct.split("/")[1] || "0");
    },
    // Busca TODOS os registros sem limite (paginação automática de 1000 em 1000)
    async selectAll(table, params = "") {
      const PAGE = 1000;
      let all = [], offset = 0, done = false;
      while (!done) {
        const r = await fetch(`${base}/${table}?${params}&limit=${PAGE}&offset=${offset}`, { headers: { ...h, Prefer: "return=representation" } });
        if (!r.ok) throw new Error(await r.text());
        const chunk = await r.json();
        all = all.concat(chunk);
        if (chunk.length < PAGE) done = true;
        else offset += PAGE;
      }
      return all;
    },
  };
})();

// ─── LIMPEZA E EXTRAÇÃO DE CONSOLE ───────────────────────────────────────────
// Switch 2 é diferente do Switch (1). Switch Lite/OLED = Switch normal.
const CONSOLE_PATTERNS = [
  { regex: /\bNintendo\s*Switch\s*2\b/i,                        nome: "Switch 2"      },
  { regex: /\bSwitch\s*2\b/i,                                    nome: "Switch 2"      },
  { regex: /\bNintendo\s*Switch\s*(?:Lite|OLED)\b/i,            nome: "Switch"        },
  { regex: /\bSwitch\s*(?:Lite|OLED)\b/i,                       nome: "Switch"        },
  { regex: /\bNintendo\s*Switch\b/i,                             nome: "Switch"        },
  { regex: /\bSwitch\b/i,                                        nome: "Switch"        },
  { regex: /\bXbox\s*Series\s*X\b/i,                            nome: "Xbox Series X" },
  { regex: /\bXbox\s*Series\s*S\b/i,                            nome: "Xbox Series S" },
  { regex: /\bXbox\s*One\b/i,                                    nome: "Xbox One"      },
  { regex: /\bXbox\s*360\b/i,                                    nome: "Xbox 360"      },
  { regex: /\bXbox\b/i,                                          nome: "Xbox One"      },
  { regex: /\bPS\s*5\b|\bPs\s*5\b|\bPS5\b|\bPlayStation\s*5\b/i, nome: "PS5"          },
  { regex: /\bPS\s*4\b|\bPs\s*4\b|\bPS4\b|\bPlayStation\s*4\b/i, nome: "PS4"          },
  { regex: /\bPS\s*3\b|\bPs\s*3\b|\bPS3\b|\bPlayStation\s*3\b/i, nome: "PS3"          },
  { regex: /\bPS\s*2\b|\bPs\s*2\b|\bPS2\b|\bPlayStation\s*2\b/i, nome: "PS2"          },
  { regex: /\bNintendo\s*DS\b/i,                                 nome: "Nintendo DS"   },
  { regex: /\b3DS\b/i,                                           nome: "3DS"           },
  { regex: /\bWii\s*U\b/i,                                       nome: "Wii U"         },
  { regex: /\bWii\b/i,                                           nome: "Wii"           },
  { regex: /\bPC\b/i,                                            nome: "PC"            },
];

// Palavras/frases que serão removidas do título
const REMOVER_REGEX = /\b(M[íi]dia\s*F[íi]sica|Midia\s*Fisica|M[íi]dia\s*Digital|F[íi]sico|F[íi]sica|Jogo\s+(?=\w)|BR\b|Portugu[eê]s|Portuguese|with\s+Upgrade.*|Day\s+One\s+Edition.*|Day\s+1\s+Edition.*|Launch\s+Edition.*)\b/gi;

function limparEExtrairConsole(produto) {
  let t = String(produto || "").trim();

  // 1. Detecta e remove o console
  let cons = "";
  for (const p of CONSOLE_PATTERNS) {
    if (p.regex.test(t)) {
      cons = p.nome;
      t = t.replace(p.regex, " ");
      break;
    }
  }

  // 2. Remove termos indesejados
  t = t.replace(REMOVER_REGEX, " ");

  // 3. Remove "Jogo" isolado no início
  t = t.replace(/^Jogo\s+/i, "");

  // 4. Normaliza espaços e remove pontuação solta no final
  t = t.replace(/\s{2,}/g, " ").replace(/[\s\-–—:,]+$/, "").trim();

  return { titulo: t || String(produto).trim(), console: cons };
}

// ─── STATUS ──────────────────────────────────────────────────────────────────
// Fluxo: Pendente → Em Edição → Aguardando Aprovação → Aprovado | Negado | Pausado
const STATUS = {
  pendente:             { label: "Pendente",          color: "#6b7280", bg: "#1f2937", icon: Clock   },
  em_edicao:            { label: "Em Edição",         color: "#3b82f6", bg: "#1e3a5f", icon: Edit3   },
  aguardando_aprovacao: { label: "Aguard. Aprovação", color: "#f59e0b", bg: "#422006", icon: Eye     },
  aprovado:             { label: "Aprovado",          color: "#22c55e", bg: "#14532d", icon: Check   },
  negado:               { label: "Negado",            color: "#ef4444", bg: "#450a0a", icon: XCircle },
  pausado:              { label: "Pausado",           color: "#f97316", bg: "#431407", icon: Pause   },
};

const ML_STATUS_MAP = {
  active: "aprovado", paused: "pausado",
  closed: "negado", under_review: "aguardando_aprovacao", inactive: "pausado",
};

const CONSOLE_COLORS = {
  "Switch 2":     "#C8000F",
  "Switch":       "#E4000F",
  "PS5":          "#003791",
  "PS4":          "#003087",
  "PS3":          "#003087",
  "PS2":          "#003087",
  "Xbox Series X":"#107C10",
  "Xbox Series S":"#0E7010",
  "Xbox One":     "#107C10",
  "Xbox 360":     "#145214",
  "Nintendo DS":  "#CC0000",
  "3DS":          "#CC0000",
  "Wii U":        "#6D28D9",
  "Wii":          "#8B5CF6",
  "PC":           "#555555",
};

// ─── COMPONENTES ─────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, type = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);
  return { toasts, add };
}

function ToastContainer({ toasts }) {
  return (
    <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: t.type === "error" ? "#450a0a" : t.type === "warning" ? "#422006" : "#064e3b",
          border: `1px solid ${t.type === "error" ? "#ef4444" : t.type === "warning" ? "#f59e0b" : "#10b981"}`,
          color: "#fff", padding: "10px 16px", borderRadius: 8, fontSize: 13,
          maxWidth: 360, display: "flex", alignItems: "center", gap: 8,
          boxShadow: "0 4px 24px rgba(0,0,0,0.6)", animation: "slideIn 0.3s ease",
        }}>
          {t.type === "error" ? <XCircle size={15} color="#ef4444" /> : t.type === "warning" ? <AlertTriangle size={15} color="#f59e0b" /> : <CheckCircle2 size={15} color="#10b981" />}
          {t.msg}
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.pendente;
  const Icon = s.icon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: s.bg, color: s.color, border: `1px solid ${s.color}44`, borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
      <Icon size={11} />{s.label}
    </span>
  );
}

function ConsoleBadge({ console: c }) {
  if (!c) return <span style={{ color: "#333", fontSize: 11 }}>—</span>;
  const color = CONSOLE_COLORS[c] || "#555";
  return (
    <span style={{ display: "inline-flex", background: color + "25", color, border: `1px solid ${color}66`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{c}</span>
  );
}

function StatCard({ label, value, color, icon: Icon, onClick, active }) {
  return (
    <div onClick={onClick} style={{ background: active ? `${color}18` : "#111", border: `1px solid ${active ? color : "#222"}`, borderRadius: 10, padding: "11px 14px", cursor: "pointer", transition: "all 0.2s", flex: "1 1 100px", minWidth: 90 }}
      onMouseEnter={e => e.currentTarget.style.borderColor = color}
      onMouseLeave={e => e.currentTarget.style.borderColor = active ? color : "#222"}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
        <Icon size={12} color={color} />
        <span style={{ fontSize: 10, color: "#777", fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value ?? "—"}</div>
    </div>
  );
}

function ImportPreviewModal({ preview, onConfirm, onCancel, loading }) {
  if (!preview) return null;
  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "#000000bb", zIndex: 200 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 620, maxHeight: "80vh", background: "#0d0d0d", border: "2px solid #f97316", borderRadius: 12, zIndex: 201, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #1a1a1a", display: "flex", alignItems: "center", gap: 10 }}>
          <Upload size={16} color="#f97316" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: "#fff", fontSize: 14 }}>Preview da Importação</div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 3, display: "flex", gap: 14 }}>
              <span>📄 <strong style={{ color: "#888" }}>{preview.total}</strong> no arquivo</span>
              <span>✅ <strong style={{ color: "#22c55e" }}>{preview.novos}</strong> novos</span>
              <span>⚠️ <strong style={{ color: "#f59e0b" }}>{preview.duplicatas}</strong> já existem (ignorados)</span>
            </div>
          </div>
          <button onClick={onCancel} style={{ background: "transparent", border: "none", color: "#555", cursor: "pointer" }}><X size={16} /></button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
          <div style={{ fontSize: 10, color: "#f97316", fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: ".08em" }}>
            Amostra dos primeiros jogos novos (após limpeza automática)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {preview.amostra.map((j, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", background: "#111", borderRadius: 7, border: "1px solid #1a1a1a" }}>
                <span style={{ fontSize: 12, color: "#ddd", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.titulo}</span>
                <ConsoleBadge console={j.console} />
              </div>
            ))}
          </div>
          {preview.novos > 15 && (
            <div style={{ textAlign: "center", color: "#555", fontSize: 12, marginTop: 10 }}>
              ... e mais {preview.novos - 15} jogos
            </div>
          )}
        </div>

        <div style={{ padding: "14px 20px", borderTop: "1px solid #1a1a1a", display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "9px", background: "#111", border: "1px solid #222", borderRadius: 8, color: "#888", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
          <button onClick={onConfirm} disabled={loading || preview.novos === 0} style={{
            flex: 2, padding: "9px",
            background: preview.novos === 0 ? "#1a1a1a" : "linear-gradient(135deg,#f97316,#fb923c)",
            border: "none", borderRadius: 8,
            color: preview.novos === 0 ? "#444" : "#000",
            fontSize: 13, fontWeight: 800, cursor: loading || preview.novos === 0 ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7
          }}>
            {loading ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Upload size={13} />}
            {loading ? "Importando..." : preview.novos === 0 ? "Nenhum jogo novo" : `Importar ${preview.novos} jogos novos`}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function App() {
  const { toasts, add: toast } = useToast();
  const [jogos, setJogos]           = useState([]);
  const [total, setTotal]           = useState(0);
  const [counts, setCounts]         = useState({});
  const [consoles, setConsoles]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(0);
  const PAGE_SIZE = 50;

  const [search, setSearch]               = useState("");
  const [filterStatus, setFilterStatus]   = useState("");
  const [filterConsole, setFilterConsole] = useState("");

  const [selected, setSelected]         = useState(null);
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [historico, setHistorico]       = useState([]);
  const [saving, setSaving]             = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const [mlToken, setMlToken]   = useState(() => localStorage.getItem("ml_token") || "");
  const [syncing, setSyncing]   = useState(false);
  const [lastSync, setLastSync] = useState(() => localStorage.getItem("ml_last_sync") || "");

  const [importPreview, setImportPreview] = useState(null);
  const [importData, setImportData]       = useState([]);
  const [importing, setImporting]         = useState(false);
  const [importResult, setImportResult]   = useState(null);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const fileRef = useRef();

  // OAuth ML
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      window.history.replaceState({}, "", window.location.pathname);
      exchangeMLCode(code);
    }
  }, []);

  async function exchangeMLCode(code) {
    try {
      const r = await fetch("https://api.mercadolibre.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({ grant_type: "authorization_code", client_id: ML_APP_ID, code, redirect_uri: ML_REDIRECT_URI }),
      });
      const data = await r.json();
      if (data.access_token) { localStorage.setItem("ml_token", data.access_token); setMlToken(data.access_token); toast("Mercado Livre conectado!"); }
      else toast("Erro OAuth ML", "error");
    } catch (e) { toast("Erro OAuth: " + e.message, "error"); }
  }

  // Carregar jogos
  const loadJogos = useCallback(async () => {
    setLoading(true);
    try {
      let params = `order=atualizado_em.desc,importado_em.desc&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`;
      if (search)        params += `&titulo=ilike.*${encodeURIComponent(search)}*`;
      if (filterStatus)  params += `&status=eq.${filterStatus}`;
      if (filterConsole) params += `&console=eq.${encodeURIComponent(filterConsole)}`;

      const [data, allJogos] = await Promise.all([
        sb.select("jogos", params),
        sb.selectAll("jogos", "select=status,console"),
      ]);
      setJogos(data);

      // Contagens
      const countObj = {};
      for (const s of Object.keys(STATUS)) countObj[s] = allJogos.filter(j => j.status === s).length;
      setCounts(countObj);
      setTotal(filterStatus ? allJogos.filter(j => j.status === filterStatus).length : allJogos.length);

      const uniq = [...new Set(allJogos.map(j => j.console).filter(Boolean))].sort();
      setConsoles(uniq);
    } catch (e) { toast("Erro ao carregar: " + e.message, "error"); }
    setLoading(false);
  }, [page, search, filterStatus, filterConsole]);

  useEffect(() => { loadJogos(); }, [loadJogos]);

  // Drawer
  async function openDrawer(jogo) {
    setSelected({ ...jogo });
    setDrawerOpen(true);
    setDrawerLoading(true);
    try {
      const hist = await sb.select("historico_status", `jogo_id=eq.${jogo.id}&order=criado_em.desc`);
      setHistorico(hist);
    } catch { setHistorico([]); }
    setDrawerLoading(false);
  }

  async function saveJogo() {
    if (!selected) return;
    setSaving(true);
    try {
      const orig = jogos.find(j => j.id === selected.id);
      const now  = new Date().toISOString();
      await sb.update("jogos", selected.id, { ...selected, atualizado_em: now });
      if (orig && orig.status !== selected.status) {
        await sb.insert("historico_status", {
          jogo_id: selected.id, status_anterior: orig.status,
          status_novo: selected.status, observacao: selected.observacoes || "",
        });
      }
      toast("Jogo salvo!");
      setDrawerOpen(false);
      loadJogos();
    } catch (e) { toast("Erro ao salvar: " + e.message, "error"); }
    setSaving(false);
  }

  // Importação com limpeza + preview + deduplicação
  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const wb   = XLSX.read(ev.target.result, { type: "binary" });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

        // Limpa e extrai console de cada linha
        const processados = rows.map(r => {
          const produto = r["Produto"] || r["produto"] || r["Título"] || r["titulo"] || r["title"] || Object.values(r)[0] || "";
          if (!produto) return null;
          const { titulo, console: cons } = limparEExtrairConsole(String(produto));
          if (!titulo) return null;
          return { titulo, console: cons, status: "pendente" };
        }).filter(Boolean);

        // Busca títulos já no banco para deduplicar
        toast("Verificando duplicatas no banco...", "warning");
        const existentes = await sb.selectAll("jogos", "select=titulo");
        const existSet   = new Set(existentes.map(j => j.titulo.toLowerCase().trim()));

        const novos      = processados.filter(j => !existSet.has(j.titulo.toLowerCase().trim()));
        const duplicatas = processados.length - novos.length;

        setImportData(novos);
        setImportPreview({ total: processados.length, novos: novos.length, duplicatas, amostra: novos.slice(0, 15) });
      } catch (err) { toast("Erro ao ler planilha: " + err.message, "error"); }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  }

  async function confirmarImport() {
    if (!importData.length) return;
    setImporting(true);
    try {
      const now   = new Date().toISOString();
      const CHUNK = 100;
      let inserted = 0;
      for (let i = 0; i < importData.length; i += CHUNK) {
        const batch = importData.slice(i, i + CHUNK).map(j => ({ ...j, importado_em: now, atualizado_em: now }));
        await sb.insert("jogos", batch);
        inserted += batch.length;
      }
      setImportResult({ novos: inserted, duplicatas: importPreview.duplicatas });
      toast(`✅ ${inserted} jogos importados!`);
      setImportPreview(null);
      setImportData([]);
      loadJogos();
    } catch (e) { toast("Erro na importação: " + e.message, "error"); }
    setImporting(false);
  }

  // Sync ML
  async function syncML(jogo) {
    if (!mlToken) { toast("Conecte o ML primeiro", "warning"); return; }
    if (!jogo.ml_id) { toast("Cole a URL do anúncio ML primeiro", "warning"); return; }
    setSyncing(true);
    try {
      const r    = await fetch(`https://api.mercadolibre.com/items/${jogo.ml_id}`, { headers: { Authorization: `Bearer ${mlToken}` } });
      const data = await r.json();
      if (data.error) throw new Error(data.message);
      const ns = ML_STATUS_MAP[data.status] || "pendente";
      await sb.update("jogos", jogo.id, { status: ns, atualizado_em: new Date().toISOString() });
      setSelected(s => s ? { ...s, status: ns } : s);
      toast(`Status ML: ${STATUS[ns]?.label}`);
      loadJogos();
    } catch (e) { toast("Erro sync ML: " + e.message, "error"); }
    setSyncing(false);
  }

  // Exportar
  function exportExcel() {
    if (!jogos.length) { toast("Nenhum dado para exportar", "warning"); return; }
    const data = jogos.map(j => ({
      Título: j.titulo, Console: j.console,
      Status: STATUS[j.status]?.label || j.status,
      "URL Vídeo": j.url_video, "URL Anúncio ML": j.url_anuncio_ml,
      "ML ID": j.ml_id, "Motivo Negação": j.motivo_negacao,
      Observações: j.observacoes,
      "Atualizado em": j.atualizado_em ? new Date(j.atualizado_em).toLocaleString("pt-BR") : "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jogos");
    XLSX.writeFile(wb, `jogos_${Date.now()}.xlsx`);
    toast("Exportado!");
  }

  const totalGeral = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div style={{ display: "flex", height: "100vh", background: "#080808", color: "#e5e5e5", fontFamily: "'IBM Plex Mono', monospace", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-thumb { background: #f97316; border-radius: 3px; }
        input, select, textarea { font-family: inherit; }
        @keyframes slideIn { from { transform: translateX(40px); opacity: 0; } to { transform: none; opacity: 1; } }
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes spin    { to { transform: rotate(360deg); } }
        .row-hover:hover { background: #141414 !important; cursor: pointer; }
        .btn { transition: all 0.15s; cursor: pointer; }
        .btn:hover { filter: brightness(1.12); transform: translateY(-1px); }
      `}</style>

      {/* SIDEBAR */}
      <div style={{ width: sidebarOpen ? 210 : 52, background: "#0a0a0a", borderRight: "1px solid #1a1a1a", display: "flex", flexDirection: "column", transition: "width 0.2s", overflow: "hidden", flexShrink: 0 }}>
        <div style={{ padding: "14px 12px", borderBottom: "1px solid #1a1a1a", display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 28, height: 28, background: "linear-gradient(135deg,#f97316,#fb923c)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Gamepad2 size={15} color="#000" />
          </div>
          {sidebarOpen && <span style={{ fontWeight: 800, fontSize: 12, color: "#f97316", whiteSpace: "nowrap" }}>GameTracker ML</span>}
        </div>
        <nav style={{ flex: 1, padding: "10px 7px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 9px", borderRadius: 7, color: "#f97316", background: "#f9731615", border: "1px solid #f97316", fontSize: 12, fontWeight: 600 }}>
            <BarChart2 size={14} style={{ flexShrink: 0 }} />
            {sidebarOpen && <span style={{ whiteSpace: "nowrap" }}>Dashboard</span>}
          </div>
        </nav>
        <div style={{ padding: "10px 7px", borderTop: "1px solid #1a1a1a" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", background: mlToken ? "#f9731610" : "#111", borderRadius: 7, border: `1px solid ${mlToken ? "#f97316" : "#222"}` }}>
            <ShoppingBag size={13} color={mlToken ? "#f97316" : "#444"} style={{ flexShrink: 0 }} />
            {sidebarOpen && <span style={{ fontSize: 11, color: mlToken ? "#f97316" : "#444", whiteSpace: "nowrap" }}>{mlToken ? "ML Conectado" : "ML Desconectado"}</span>}
          </div>
        </div>
        <button onClick={() => setSidebarOpen(s => !s)} style={{ padding: 11, background: "transparent", border: "none", borderTop: "1px solid #1a1a1a", color: "#444", cursor: "pointer" }}>
          <Menu size={15} />
        </button>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* HEADER */}
        <div style={{ height: 54, background: "#0a0a0a", borderBottom: "1px solid #1a1a1a", display: "flex", alignItems: "center", padding: "0 18px", gap: 10, flexShrink: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: "#fff", flex: 1 }}>🎮 GameTracker ML</span>
          {lastSync && <span style={{ fontSize: 11, color: "#444" }}>Sync: {lastSync}</span>}
          {mlToken ? (
            <button onClick={() => { localStorage.removeItem("ml_token"); setMlToken(""); toast("ML desconectado", "warning"); }} className="btn" style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", background: "#f9731615", border: "1px solid #f97316", borderRadius: 7, color: "#f97316", fontSize: 11, fontWeight: 700 }}>
              <Link2 size={12} /> Desconectar ML
            </button>
          ) : (
            <button onClick={() => { window.location.href = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${ML_APP_ID}&redirect_uri=${encodeURIComponent(ML_REDIRECT_URI)}`; }} className="btn" style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", background: "linear-gradient(135deg,#f97316,#fb923c)", border: "none", borderRadius: 7, color: "#000", fontSize: 11, fontWeight: 800 }}>
              <LogIn size={12} /> Conectar ML
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
          {/* STAT CARDS */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            <StatCard label="Total" value={totalGeral} color="#f97316" icon={Gamepad2} onClick={() => setFilterStatus("")} active={!filterStatus} />
            {Object.entries(STATUS).map(([key, s]) => (
              <StatCard key={key} label={s.label} value={counts[key] || 0} color={s.color} icon={s.icon}
                onClick={() => { setFilterStatus(k => k === key ? "" : key); setPage(0); }} active={filterStatus === key} />
            ))}
          </div>

          {/* RESULTADO IMPORTAÇÃO */}
          {importResult && (
            <div style={{ background: "#064e3b", border: "1px solid #10b981", borderRadius: 8, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
              <CheckCircle2 size={15} color="#10b981" />
              <span>
                <strong style={{ color: "#10b981" }}>{importResult.novos}</strong> jogos novos importados •{" "}
                <strong style={{ color: "#f59e0b" }}>{importResult.duplicatas}</strong> duplicatas ignoradas
              </span>
              <button onClick={() => setImportResult(null)} style={{ marginLeft: "auto", background: "transparent", border: "none", color: "#aaa", cursor: "pointer" }}><X size={14} /></button>
            </div>
          )}

          {/* TOOLBAR */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 180px", display: "flex", alignItems: "center", gap: 7, background: "#111", border: "1px solid #222", borderRadius: 8, padding: "0 11px" }}>
              <Search size={13} color="#555" />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Buscar jogo..."
                style={{ background: "transparent", border: "none", outline: "none", color: "#ddd", fontSize: 12, flex: 1, padding: "8px 0" }} />
            </div>

            <select value={filterConsole} onChange={e => { setFilterConsole(e.target.value); setPage(0); }}
              style={{ background: "#111", border: "1px solid #222", borderRadius: 8, color: "#ddd", padding: "7px 10px", fontSize: 12, outline: "none", cursor: "pointer" }}>
              <option value="">Todos os consoles</option>
              {consoles.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: "none" }} />
            <button onClick={() => fileRef.current.click()} className="btn" style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", background: "#3b82f620", border: "1px solid #3b82f6", borderRadius: 8, color: "#3b82f6", fontSize: 12, fontWeight: 700 }}>
              <Upload size={13} /> Importar .xlsx
            </button>

            <button onClick={exportExcel} className="btn" style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", background: "#22c55e20", border: "1px solid #22c55e", borderRadius: 8, color: "#22c55e", fontSize: 12, fontWeight: 700 }}>
              <Download size={13} /> Exportar
            </button>

            <button onClick={loadJogos} disabled={loading} className="btn" style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 11px", background: "#111", border: "1px solid #333", borderRadius: 8, color: "#888", fontSize: 12 }}>
              <RefreshCw size={13} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
            </button>
          </div>

          {/* TABELA */}
          <div style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2.5fr 130px 155px 80px", padding: "9px 14px", background: "#111", borderBottom: "1px solid #1a1a1a" }}>
              {["Título", "Console", "Status", "Ação"].map(h => (
                <span key={h} style={{ fontSize: 10, color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em" }}>{h}</span>
              ))}
            </div>

            {loading ? (
              <div style={{ padding: 40, textAlign: "center", color: "#555" }}>
                <Loader2 size={22} style={{ animation: "spin 1s linear infinite", margin: "0 auto 8px", display: "block" }} />
                <div style={{ fontSize: 12 }}>Carregando jogos...</div>
              </div>
            ) : jogos.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#555" }}>
                <Gamepad2 size={30} style={{ margin: "0 auto 10px", display: "block", opacity: .3 }} />
                <div style={{ fontSize: 13 }}>Nenhum jogo encontrado.</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Importe sua planilha .xlsx para começar.</div>
              </div>
            ) : jogos.map((jogo, i) => (
              <div key={jogo.id} className="row-hover" onClick={() => openDrawer(jogo)} style={{ display: "grid", gridTemplateColumns: "2.5fr 130px 155px 80px", padding: "10px 14px", borderBottom: i < jogos.length - 1 ? "1px solid #111" : "none", background: i % 2 ? "#0a0a0a" : "#0d0d0d", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#ddd", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }} title={jogo.titulo}>{jogo.titulo}</span>
                <ConsoleBadge console={jogo.console} />
                <StatusBadge status={jogo.status} />
                <button onClick={e => { e.stopPropagation(); openDrawer(jogo); }} style={{ background: "#f9731620", border: "1px solid #f97316", borderRadius: 6, color: "#f97316", padding: "3px 9px", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
                  Editar
                </button>
              </div>
            ))}
          </div>

          {/* PAGINAÇÃO */}
          {!loading && total > PAGE_SIZE && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 14 }}>
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="btn" style={{ padding: "5px 13px", background: "#111", border: "1px solid #222", borderRadius: 7, color: page === 0 ? "#333" : "#ddd", fontSize: 12, cursor: page === 0 ? "not-allowed" : "pointer" }}>← Anterior</button>
              <span style={{ fontSize: 12, color: "#555" }}>Pág. {page + 1} / {Math.ceil(total / PAGE_SIZE)} ({total} jogos)</span>
              <button disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)} className="btn" style={{ padding: "5px 13px", background: "#111", border: "1px solid #222", borderRadius: 7, color: (page + 1) * PAGE_SIZE >= total ? "#333" : "#ddd", fontSize: 12, cursor: (page + 1) * PAGE_SIZE >= total ? "not-allowed" : "pointer" }}>Próxima →</button>
            </div>
          )}
        </div>
      </div>

      {/* DRAWER */}
      {drawerOpen && selected && (
        <>
          <div onClick={() => setDrawerOpen(false)} style={{ position: "fixed", inset: 0, background: "#00000085", zIndex: 100, animation: "fadeIn .2s" }} />
          <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: 460, background: "#0a0a0a", borderLeft: "2px solid #f97316", zIndex: 101, display: "flex", flexDirection: "column", animation: "slideIn .25s ease" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #1a1a1a", display: "flex", alignItems: "center", gap: 10 }}>
              <Gamepad2 size={17} color="#f97316" />
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.titulo}</div>
                <div style={{ marginTop: 4 }}><ConsoleBadge console={selected.console} /></div>
              </div>
              <button onClick={() => setDrawerOpen(false)} style={{ background: "transparent", border: "none", color: "#555", cursor: "pointer" }}><X size={17} /></button>
            </div>

            <div style={{ flex: 1, overflow: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Status */}
              <div>
                <label style={{ fontSize: 10, color: "#f97316", fontWeight: 700, display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: ".08em" }}>Status</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {Object.entries(STATUS).map(([key, s]) => (
                    <button key={key} onClick={() => setSelected(v => ({ ...v, status: key }))} style={{ padding: "4px 11px", borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: "pointer", background: selected.status === key ? s.bg : "#111", border: `1px solid ${selected.status === key ? s.color : "#222"}`, color: selected.status === key ? s.color : "#555", display: "flex", alignItems: "center", gap: 4 }}>
                      <s.icon size={11} /> {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {selected.status === "negado" && (
                <div>
                  <label style={{ fontSize: 10, color: "#ef4444", fontWeight: 700, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".08em" }}>Motivo da Negação</label>
                  <textarea value={selected.motivo_negacao || ""} onChange={e => setSelected(v => ({ ...v, motivo_negacao: e.target.value }))} rows={3} style={{ width: "100%", background: "#0d0d0d", border: "1px solid #ef444444", borderRadius: 8, color: "#ef4444", padding: "7px 11px", fontSize: 12, resize: "vertical", outline: "none" }} />
                </div>
              )}

              {/* URL do Vídeo */}
              <div>
                <label style={{ fontSize: 10, color: "#555", fontWeight: 700, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".08em" }}>🎬 URL do Vídeo</label>
                <input value={selected.url_video || ""} onChange={e => setSelected(v => ({ ...v, url_video: e.target.value }))} placeholder="https://..." style={{ width: "100%", background: "#111", border: "1px solid #222", borderRadius: 8, color: "#ddd", padding: "7px 11px", fontSize: 12, outline: "none" }} />
              </div>

              {/* URL Anúncio ML — extrai ML ID automaticamente */}
              <div>
                <label style={{ fontSize: 10, color: "#555", fontWeight: 700, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".08em" }}>🔗 URL do Anúncio ML</label>
                <input
                  value={selected.url_anuncio_ml || ""}
                  onChange={e => {
                    const url = e.target.value;
                    const match = url.match(/MLB\d+/i);
                    const mlId = match ? match[0].toUpperCase() : (selected.ml_id || "");
                    setSelected(v => ({ ...v, url_anuncio_ml: url, ml_id: mlId }));
                  }}
                  placeholder="https://www.mercadolivre.com.br/p/MLB..."
                  style={{ width: "100%", background: "#111", border: "1px solid #222", borderRadius: 8, color: "#ddd", padding: "7px 11px", fontSize: 12, outline: "none" }}
                />
                {selected.ml_id && (
                  <div style={{ marginTop: 5, fontSize: 11, display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ color: "#444" }}>ID detectado:</span>
                    <span style={{ color: "#3b82f6", fontWeight: 700 }}>{selected.ml_id}</span>
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: 10, color: "#555", fontWeight: 700, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".08em" }}>📝 Observações</label>
                <textarea value={selected.observacoes || ""} onChange={e => setSelected(v => ({ ...v, observacoes: e.target.value }))} rows={3} style={{ width: "100%", background: "#111", border: "1px solid #222", borderRadius: 8, color: "#ddd", padding: "7px 11px", fontSize: 12, resize: "vertical", outline: "none" }} />
              </div>

              {selected.ml_id && (
                <button onClick={() => syncML(selected)} disabled={syncing} className="btn" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "9px", background: "#3b82f620", border: "1px solid #3b82f6", borderRadius: 8, color: "#3b82f6", fontSize: 12, fontWeight: 700 }}>
                  <RefreshCw size={13} style={syncing ? { animation: "spin 1s linear infinite" } : {}} />
                  Sincronizar Status com ML
                </button>
              )}

              {!drawerLoading && historico.length > 0 && (
                <div>
                  <label style={{ fontSize: 10, color: "#f97316", fontWeight: 700, display: "flex", alignItems: "center", gap: 5, marginBottom: 8, textTransform: "uppercase", letterSpacing: ".08em" }}>
                    <History size={12} /> Histórico
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {historico.map(h => (
                      <div key={h.id} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 7, padding: "7px 10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <StatusBadge status={h.status_anterior} />
                          <ChevronRight size={11} color="#555" />
                          <StatusBadge status={h.status_novo} />
                        </div>
                        <div style={{ fontSize: 10, color: "#333", marginTop: 4 }}>{new Date(h.criado_em).toLocaleString("pt-BR")}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: "12px 18px", borderTop: "1px solid #1a1a1a", display: "flex", gap: 8 }}>
              <button onClick={() => setDrawerOpen(false)} style={{ flex: 1, padding: "9px", background: "#111", border: "1px solid #222", borderRadius: 8, color: "#888", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
              <button onClick={saveJogo} disabled={saving} className="btn" style={{ flex: 2, padding: "9px", background: "linear-gradient(135deg,#f97316,#fb923c)", border: "none", borderRadius: 8, color: "#000", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                {saving ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={13} />}
                {saving ? "Salvando..." : "Salvar Alterações"}
              </button>
            </div>
          </div>
        </>
      )}

      <ImportPreviewModal
        preview={importPreview}
        onConfirm={confirmarImport}
        onCancel={() => { setImportPreview(null); setImportData([]); }}
        loading={importing}
      />

      <ToastContainer toasts={toasts} />
    </div>
  );
}

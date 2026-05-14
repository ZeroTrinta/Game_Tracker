import { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Search, Upload, Download, RefreshCw, Link2,
  X, Check, Clock, Pause, Eye, Edit3,
  BarChart2, LogIn, Gamepad2, Save,
  AlertTriangle, CheckCircle2, XCircle,
  Loader2, Settings, Menu, ShoppingBag, ChevronRight, History
} from "lucide-react";

// ─── CONFIG — troque pela sua URL do Apps Script ────────────────────────────
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyuzuOoxQfeKBP8bKWtpnsnGnQyHjfkLSdl3G_o6Vrk-cYKX4GAEyJV-BMm3fUmPWO_/exec";
const ML_APP_ID       = "000000"; // preencha quando tiver o ML App ID
const ML_REDIRECT_URI = window.location.origin + window.location.pathname;

// ─── CONSOLES detectados automaticamente ────────────────────────────────────
const CONSOLE_PATTERNS = [
  "Xbox Series X", "Xbox Series S", "Xbox One", "Xbox 360",
  "PS5", "PS4", "PS3", "PS2",
  "Switch", "Nintendo DS", "3DS", "DS",
  "PC", "Wii U", "Wii",
];

function splitTituloConsole(produto) {
  const p = (produto || "").trim();
  for (const c of CONSOLE_PATTERNS) {
    const idx = p.indexOf(c);
    if (idx !== -1) {
      let titulo = p.slice(0, idx).trim().replace(/[-–—]+$/, "").trim();
      // Remove sufixos comuns após o console
      titulo = titulo.replace(/\s+(Midia Fisica|Mídia Física|BR|with Upgrade.*|Day One.*|Day 1.*|Launch Edition.*|Special Edition.*|Elite Edition.*|Game of the Year.*|Anniversary.*|Complete.*|Bundle.*|Gold Edition.*|Deluxe.*|Standard.*|Português.*|Portuguese.*)$/i, "").trim();
      return { titulo: titulo || p, console: c };
    }
  }
  return { titulo: p, console: "" };
}

// ─── API Google Sheets ───────────────────────────────────────────────────────
async function api(action, params = {}, body = null) {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL === "COLE_SUA_URL_AQUI") {
    throw new Error("Configure a URL do Apps Script no arquivo App.jsx!");
  }
  if (body) {
    const r = await fetch(APPS_SCRIPT_URL, {
      method: "POST", redirect: "follow",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action, ...body }),
    });
    return r.json();
  } else {
    const qs = new URLSearchParams({ action, ...params }).toString();
    const r = await fetch(`${APPS_SCRIPT_URL}?${qs}`, { redirect: "follow" });
    return r.json();
  }
}

// ─── STATUS ─────────────────────────────────────────────────────────────────
const STATUS = {
  pendente:             { label: "Pendente",           color: "#6b7280", bg: "#1f2937", icon: Clock },
  em_edicao:            { label: "Em Edição",          color: "#3b82f6", bg: "#1e3a5f", icon: Edit3 },
  aguardando_aprovacao: { label: "Aguard. Aprovação",  color: "#f59e0b", bg: "#422006", icon: Eye },
  aprovado:             { label: "Aprovado",           color: "#22c55e", bg: "#14532d", icon: Check },
  negado:               { label: "Negado",             color: "#ef4444", bg: "#450a0a", icon: XCircle },
  pausado:              { label: "Pausado",            color: "#f97316", bg: "#431407", icon: Pause },
  publicado:            { label: "Publicado",          color: "#10b981", bg: "#064e3b", icon: CheckCircle2 },
};

const ML_STATUS_MAP = {
  active: "publicado", paused: "pausado",
  closed: "negado", under_review: "aguardando_aprovacao", inactive: "pausado",
};

// ─── TOAST ───────────────────────────────────────────────────────────────────
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
          maxWidth: 340, display: "flex", alignItems: "center", gap: 8,
          boxShadow: "0 4px 24px rgba(0,0,0,0.6)", animation: "slideIn 0.3s ease",
        }}>
          {t.type === "error" ? <XCircle size={15} color="#ef4444" /> : t.type === "warning" ? <AlertTriangle size={15} color="#f59e0b" /> : <CheckCircle2 size={15} color="#10b981" />}
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ─── STATUS BADGE ────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.pendente;
  const Icon = s.icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: s.bg, color: s.color, border: `1px solid ${s.color}44`,
      borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
    }}>
      <Icon size={11} />{s.label}
    </span>
  );
}

// ─── STAT CARD ───────────────────────────────────────────────────────────────
function StatCard({ label, value, color, icon: Icon, onClick, active }) {
  return (
    <div onClick={onClick} style={{
      background: active ? `${color}18` : "#111", border: `1px solid ${active ? color : "#222"}`,
      borderRadius: 10, padding: "12px 16px", cursor: "pointer", transition: "all 0.2s",
      flex: "1 1 110px", minWidth: 95,
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = color}
      onMouseLeave={e => e.currentTarget.style.borderColor = active ? color : "#222"}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <Icon size={13} color={color} />
        <span style={{ fontSize: 11, color: "#888", fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value ?? "—"}</div>
    </div>
  );
}

// ─── CONSOLE BADGE ───────────────────────────────────────────────────────────
const CONSOLE_COLORS = {
  PS5: "#003791", PS4: "#003087", PS3: "#003087", PS2: "#003087",
  Switch: "#e4000f", "Nintendo DS": "#e4000f", "3DS": "#cc0000", DS: "#cc0000",
  "Xbox Series X": "#107c10", "Xbox Series S": "#107c10", "Xbox One": "#107c10", "Xbox 360": "#107c10",
  PC: "#555", Wii: "#8b5cf6", "Wii U": "#8b5cf6",
};

function ConsoleBadge({ console: c }) {
  if (!c) return null;
  const color = CONSOLE_COLORS[c] || "#444";
  return (
    <span style={{
      display: "inline-flex", background: color + "33", color: "#ddd",
      border: `1px solid ${color}88`, borderRadius: 6,
      padding: "2px 8px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
    }}>{c}</span>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function App() {
  const { toasts, add: toast } = useToast();
  const [jogos, setJogos] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({});
  const [consoles, setConsoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterConsole, setFilterConsole] = useState("");

  const [selected, setSelected] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [mlToken, setMlToken] = useState(() => localStorage.getItem("ml_token") || "");
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(() => localStorage.getItem("ml_last_sync") || "");

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const fileRef = useRef();

  const [urlOk, setUrlOk] = useState(APPS_SCRIPT_URL !== "COLE_SUA_URL_AQUI");

  // OAuth ML callback
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
      if (data.access_token) {
        localStorage.setItem("ml_token", data.access_token);
        setMlToken(data.access_token);
        toast("Mercado Livre conectado!");
      } else toast("Erro OAuth ML", "error");
    } catch (e) { toast("Erro OAuth: " + e.message, "error"); }
  }

  // Carregar dados
  const loadData = useCallback(async () => {
    if (!urlOk) return;
    setLoading(true);
    try {
      const [result, stats] = await Promise.all([
        api("getAll", { page, pageSize: PAGE_SIZE, search, status: filterStatus, console: filterConsole }),
        api("getStats"),
      ]);
      if (result.error) throw new Error(result.error);
      setJogos(result.jogos || []);
      setTotal(result.total || 0);
      setCounts(stats.counts || {});
      setConsoles(stats.consoles || []);
    } catch (e) { toast("Erro ao carregar: " + e.message, "error"); }
    setLoading(false);
  }, [page, search, filterStatus, filterConsole, urlOk]);

  useEffect(() => { loadData(); }, [loadData]);

  // Importar Excel
  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const wb = XLSX.read(ev.target.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

        setImporting(true);
        setImportResult(null);

        // Mapeia e separa título/console
        const jogos = rows.map(r => {
          const produto = r["Produto"] || r["produto"] || r["titulo"] || r["Titulo"] || "";
          const { titulo, console: cons } = splitTituloConsole(produto);
          return { titulo, console: cons, status: "pendente" };
        }).filter(j => j.titulo);

        // Envia em lotes de 200
        let totalInserted = 0, totalDuplicates = 0;
        const CHUNK = 200;
        for (let i = 0; i < jogos.length; i += CHUNK) {
          const chunk = jogos.slice(i, i + CHUNK);
          const res = await api("importBatch", {}, { jogos: chunk });
          if (res.error) throw new Error(res.error);
          totalInserted += res.inserted || 0;
          totalDuplicates += res.duplicates || 0;
        }

        setImportResult({ inserted: totalInserted, duplicates: totalDuplicates });
        toast(`✅ ${totalInserted} jogos importados! (${totalDuplicates} duplicatas ignoradas)`);
        loadData();
      } catch (err) { toast("Erro na importação: " + err.message, "error"); }
      setImporting(false);
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  }

  // Salvar jogo
  async function saveJogo() {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await api("save", {}, { jogo: selected });
      if (res.error) throw new Error(res.error);
      toast("Jogo salvo!");
      setDrawerOpen(false);
      loadData();
    } catch (e) { toast("Erro ao salvar: " + e.message, "error"); }
    setSaving(false);
  }

  // Sync ML
  async function syncML(jogo) {
    if (!mlToken) { toast("Conecte o Mercado Livre primeiro", "warning"); return; }
    if (!jogo.ml_id) { toast("Preencha o ML ID primeiro", "warning"); return; }
    setSyncing(true);
    try {
      const r = await fetch(`https://api.mercadolibre.com/items/${jogo.ml_id}`, {
        headers: { Authorization: `Bearer ${mlToken}` }
      });
      const data = await r.json();
      if (data.error) throw new Error(data.message);
      const novoStatus = ML_STATUS_MAP[data.status] || "pendente";
      await api("save", {}, { jogo: { ...jogo, status: novoStatus } });
      setSelected(s => s ? { ...s, status: novoStatus } : s);
      toast(`Status ML: ${STATUS[novoStatus]?.label}`);
      loadData();
    } catch (e) { toast("Erro sync ML: " + e.message, "error"); }
    setSyncing(false);
  }

  // Exportar Excel
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

  // ─── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", height: "100vh", background: "#080808", color: "#e5e5e5", fontFamily: "'IBM Plex Mono', monospace", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-thumb { background: #f97316; border-radius: 3px; }
        input, select, textarea { font-family: inherit; }
        @keyframes slideIn { from { transform: translateX(40px); opacity: 0; } to { transform: none; opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .hover-row:hover { background: #141414 !important; cursor: pointer; }
        .btn { transition: all 0.15s; cursor: pointer; }
        .btn:hover { filter: brightness(1.12); transform: translateY(-1px); }
      `}</style>

      {/* ── SIDEBAR ── */}
      <div style={{ width: sidebarOpen ? 210 : 52, background: "#0a0a0a", borderRight: "1px solid #1a1a1a", display: "flex", flexDirection: "column", transition: "width 0.2s", overflow: "hidden", flexShrink: 0 }}>
        <div style={{ padding: "14px 12px", borderBottom: "1px solid #1a1a1a", display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 28, height: 28, background: "linear-gradient(135deg,#f97316,#fb923c)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Gamepad2 size={15} color="#000" />
          </div>
          {sidebarOpen && <span style={{ fontWeight: 800, fontSize: 12, color: "#f97316", whiteSpace: "nowrap" }}>GameTracker ML</span>}
        </div>

        <nav style={{ flex: 1, padding: "10px 7px", display: "flex", flexDirection: "column", gap: 3 }}>
          {[{ icon: BarChart2, label: "Dashboard" }, { icon: Settings, label: "Configurações" }].map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 9px", borderRadius: 7, color: i === 0 ? "#f97316" : "#666", background: i === 0 ? "#f9731615" : "transparent", border: `1px solid ${i === 0 ? "#f97316" : "transparent"}`, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              <item.icon size={14} style={{ flexShrink: 0 }} />
              {sidebarOpen && <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>}
            </div>
          ))}
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

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ height: 54, background: "#0a0a0a", borderBottom: "1px solid #1a1a1a", display: "flex", alignItems: "center", padding: "0 18px", gap: 10, flexShrink: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: "#fff", flex: 1 }}>🎮 Gerenciar Jogos</span>
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

        {/* Banner URL não configurada */}
        {!urlOk && (
          <div style={{ background: "#422006", border: "1px solid #f59e0b", borderRadius: 8, margin: 16, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle size={16} color="#f59e0b" />
            <div>
              <div style={{ fontWeight: 700, color: "#f59e0b", fontSize: 13 }}>Configure a URL do Apps Script</div>
              <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>Abra o arquivo <code style={{ color: "#f97316" }}>src/App.jsx</code> e substitua <code style={{ color: "#f97316" }}>COLE_SUA_URL_AQUI</code> pela URL gerada no Google Apps Script.</div>
            </div>
          </div>
        )}

        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>

          {/* Stats */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            <StatCard label="Total" value={totalGeral} color="#f97316" icon={Gamepad2} onClick={() => setFilterStatus("")} active={!filterStatus} />
            {Object.entries(STATUS).map(([key, s]) => (
              <StatCard key={key} label={s.label} value={counts[key] || 0} color={s.color} icon={s.icon}
                onClick={() => { setFilterStatus(k => k === key ? "" : key); setPage(0); }} active={filterStatus === key} />
            ))}
          </div>

          {/* Toolbar */}
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
            <button onClick={() => fileRef.current.click()} disabled={importing || !urlOk} className="btn" style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", background: importing ? "#111" : "#3b82f620", border: "1px solid #3b82f6", borderRadius: 8, color: "#3b82f6", fontSize: 12, fontWeight: 700, cursor: !urlOk || importing ? "not-allowed" : "pointer", opacity: !urlOk ? 0.5 : 1 }}>
              {importing ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Upload size={13} />}
              {importing ? "Importando..." : "Importar .xlsx"}
            </button>

            <button onClick={exportExcel} className="btn" style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", background: "#22c55e20", border: "1px solid #22c55e", borderRadius: 8, color: "#22c55e", fontSize: 12, fontWeight: 700 }}>
              <Download size={13} /> Exportar
            </button>

            <button onClick={loadData} disabled={loading} className="btn" style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 11px", background: "#111", border: "1px solid #333", borderRadius: 8, color: "#888", fontSize: 12, cursor: "pointer" }}>
              <RefreshCw size={13} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
            </button>
          </div>

          {/* Resultado importação */}
          {importResult && (
            <div style={{ background: "#064e3b", border: "1px solid #10b981", borderRadius: 8, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <CheckCircle2 size={15} color="#10b981" />
              <span><strong style={{ color: "#10b981" }}>{importResult.inserted}</strong> jogos importados • <strong style={{ color: "#f59e0b" }}>{importResult.duplicates}</strong> duplicatas ignoradas</span>
              <button onClick={() => setImportResult(null)} style={{ marginLeft: "auto", background: "transparent", border: "none", color: "#aaa", cursor: "pointer" }}><X size={14} /></button>
            </div>
          )}

          {/* Tabela */}
          <div style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 10, overflow: "hidden" }}>
            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "2.5fr 120px 150px 80px", padding: "9px 14px", background: "#111", borderBottom: "1px solid #1a1a1a" }}>
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
              <div key={jogo.id || i} className="hover-row" onClick={() => { setSelected({ ...jogo }); setDrawerOpen(true); }} style={{ display: "grid", gridTemplateColumns: "2.5fr 120px 150px 80px", padding: "10px 14px", borderBottom: i < jogos.length - 1 ? "1px solid #111" : "none", background: i % 2 ? "#0a0a0a" : "#0d0d0d", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#ddd", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{jogo.titulo}</span>
                <ConsoleBadge console={jogo.console} />
                <StatusBadge status={jogo.status} />
                <button onClick={e => { e.stopPropagation(); setSelected({ ...jogo }); setDrawerOpen(true); }} style={{ background: "#f9731620", border: "1px solid #f97316", borderRadius: 6, color: "#f97316", padding: "3px 9px", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
                  Editar
                </button>
              </div>
            ))}
          </div>

          {/* Paginação */}
          {!loading && total > PAGE_SIZE && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 14 }}>
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="btn" style={{ padding: "5px 13px", background: "#111", border: "1px solid #222", borderRadius: 7, color: page === 0 ? "#333" : "#ddd", fontSize: 12, cursor: page === 0 ? "not-allowed" : "pointer" }}>← Anterior</button>
              <span style={{ fontSize: 12, color: "#555" }}>Pág. {page + 1} / {Math.ceil(total / PAGE_SIZE)} ({total} jogos)</span>
              <button disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)} className="btn" style={{ padding: "5px 13px", background: "#111", border: "1px solid #222", borderRadius: 7, color: (page + 1) * PAGE_SIZE >= total ? "#333" : "#ddd", fontSize: 12, cursor: (page + 1) * PAGE_SIZE >= total ? "not-allowed" : "pointer" }}>Próxima →</button>
            </div>
          )}
        </div>
      </div>

      {/* ── DRAWER ── */}
      {drawerOpen && selected && (
        <>
          <div onClick={() => setDrawerOpen(false)} style={{ position: "fixed", inset: 0, background: "#00000085", zIndex: 100, animation: "fadeIn .2s" }} />
          <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: 460, background: "#0a0a0a", borderLeft: "2px solid #f97316", zIndex: 101, display: "flex", flexDirection: "column", animation: "slideIn .25s ease" }}>

            {/* Drawer Header */}
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #1a1a1a", display: "flex", alignItems: "center", gap: 10 }}>
              <Gamepad2 size={17} color="#f97316" />
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.titulo}</div>
                <ConsoleBadge console={selected.console} />
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

              {/* Motivo negação */}
              {selected.status === "negado" && (
                <div>
                  <label style={{ fontSize: 10, color: "#ef4444", fontWeight: 700, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".08em" }}>Motivo da Negação</label>
                  <textarea value={selected.motivo_negacao || ""} onChange={e => setSelected(v => ({ ...v, motivo_negacao: e.target.value }))} rows={3} style={{ width: "100%", background: "#0d0d0d", border: "1px solid #ef444444", borderRadius: 8, color: "#ef4444", padding: "7px 11px", fontSize: 12, resize: "vertical", outline: "none" }} />
                </div>
              )}

              {/* Campos */}
              {[
                { label: "🎬 URL do Vídeo", key: "url_video" },
                { label: "🔗 URL do Anúncio ML", key: "url_anuncio_ml" },
                { label: "🆔 ML ID", key: "ml_id" },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 10, color: "#555", fontWeight: 700, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".08em" }}>{f.label}</label>
                  <input value={selected[f.key] || ""} onChange={e => setSelected(v => ({ ...v, [f.key]: e.target.value }))} style={{ width: "100%", background: "#111", border: "1px solid #222", borderRadius: 8, color: "#ddd", padding: "7px 11px", fontSize: 12, outline: "none" }} />
                </div>
              ))}

              {/* Observações */}
              <div>
                <label style={{ fontSize: 10, color: "#555", fontWeight: 700, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".08em" }}>📝 Observações</label>
                <textarea value={selected.observacoes || ""} onChange={e => setSelected(v => ({ ...v, observacoes: e.target.value }))} rows={3} style={{ width: "100%", background: "#111", border: "1px solid #222", borderRadius: 8, color: "#ddd", padding: "7px 11px", fontSize: 12, resize: "vertical", outline: "none" }} />
              </div>

              {/* Sync ML */}
              {selected.ml_id && (
                <button onClick={() => syncML(selected)} disabled={syncing} className="btn" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "9px", background: "#3b82f620", border: "1px solid #3b82f6", borderRadius: 8, color: "#3b82f6", fontSize: 12, fontWeight: 700 }}>
                  <RefreshCw size={13} style={syncing ? { animation: "spin 1s linear infinite" } : {}} />
                  Sincronizar Status com ML
                </button>
              )}
            </div>

            {/* Footer */}
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

      <ToastContainer toasts={toasts} />
    </div>
  );
}

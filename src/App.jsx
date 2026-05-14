import { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Search, Upload, Download, RefreshCw, Link2, ChevronRight,
  X, Check, Clock, AlertCircle, Pause, Eye, Edit3, Zap,
  BarChart2, List, Filter, ChevronDown, LogIn, Gamepad2,
  History, Save, ExternalLink, AlertTriangle, CheckCircle2,
  XCircle, Loader2, Bell, Settings, Menu, ShoppingBag
} from "lucide-react";

// ─── CONFIG ────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://baftwizxkazuwdczqhpm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhZnR3aXp4a2F6dXdkY3pxaHBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NjU1ODYsImV4cCI6MjA5NDM0MTU4Nn0.bSVcyhVh_0es0TENfkZJHuR-1KufbijmN8iif39On04";
const ML_APP_ID = "YOUR_ML_APP_ID";
const ML_REDIRECT_URI = window.location.origin + window.location.pathname;

// ─── SUPABASE CLIENT ────────────────────────────────────────────────────────
const supabase = (() => {
  const headers = {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
  const base = SUPABASE_URL + "/rest/v1";
  return {
    async select(table, params = "") {
      const r = await fetch(`${base}/${table}?${params}`, { headers: { ...headers, Prefer: "return=representation" } });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    async insert(table, body) {
      const r = await fetch(`${base}/${table}`, { method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    async update(table, id, body) {
      const r = await fetch(`${base}/${table}?id=eq.${id}`, { method: "PATCH", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    async upsert(table, body, onConflict = "sku") {
      const r = await fetch(`${base}/${table}?on_conflict=${onConflict}`, { method: "POST", headers: { ...headers, Prefer: "return=representation,resolution=merge-duplicates" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    async count(table, filter = "") {
      const r = await fetch(`${base}/${table}?${filter}`, { headers: { ...headers, Prefer: "count=exact", Range: "0-0" } });
      const ct = r.headers.get("Content-Range") || "0/0";
      return parseInt(ct.split("/")[1] || "0");
    },
  };
})();

// ─── STATUS CONFIG ──────────────────────────────────────────────────────────
const STATUS = {
  pendente:               { label: "Pendente",             color: "#6b7280", bg: "#1f2937", icon: Clock },
  em_edicao:              { label: "Em Edição",            color: "#3b82f6", bg: "#1e3a5f", icon: Edit3 },
  aguardando_aprovacao:   { label: "Aguard. Aprovação",    color: "#f59e0b", bg: "#422006", icon: Eye },
  aprovado:               { label: "Aprovado",             color: "#22c55e", bg: "#14532d", icon: Check },
  negado:                 { label: "Negado",               color: "#ef4444", bg: "#450a0a", icon: XCircle },
  pausado:                { label: "Pausado",              color: "#f97316", bg: "#431407", icon: Pause },
  publicado:              { label: "Publicado",            color: "#10b981", bg: "#064e3b", icon: CheckCircle2 },
};

const ML_STATUS_MAP = {
  active: "publicado",
  paused: "pausado",
  closed: "negado",
  under_review: "aguardando_aprovacao",
  inactive: "pausado",
};

// ─── TOAST ──────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, type = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
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
          maxWidth: 320, display: "flex", alignItems: "center", gap: 8,
          animation: "slideIn 0.3s ease",
          boxShadow: "0 4px 24px rgba(0,0,0,0.5)"
        }}>
          {t.type === "error" ? <XCircle size={16} color="#ef4444" /> : t.type === "warning" ? <AlertTriangle size={16} color="#f59e0b" /> : <CheckCircle2 size={16} color="#10b981" />}
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ─── STATUS BADGE ────────────────────────────────────────────────────────────
function StatusBadge({ status, size = "sm" }) {
  const s = STATUS[status] || STATUS.pendente;
  const Icon = s.icon;
  const pad = size === "sm" ? "3px 10px" : "5px 14px";
  const fs = size === "sm" ? 11 : 13;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: s.bg, color: s.color, border: `1px solid ${s.color}44`,
      borderRadius: 999, padding: pad, fontSize: fs, fontWeight: 600,
      whiteSpace: "nowrap"
    }}>
      <Icon size={size === "sm" ? 11 : 13} />
      {s.label}
    </span>
  );
}

// ─── STAT CARD ───────────────────────────────────────────────────────────────
function StatCard({ label, value, color, icon: Icon, onClick, active }) {
  return (
    <div onClick={onClick} style={{
      background: active ? `${color}18` : "#111", border: `1px solid ${active ? color : "#222"}`,
      borderRadius: 10, padding: "12px 16px", cursor: "pointer",
      transition: "all 0.2s", flex: "1 1 120px", minWidth: 100,
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = color}
      onMouseLeave={e => e.currentTarget.style.borderColor = active ? color : "#222"}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <Icon size={13} color={color} />
        <span style={{ fontSize: 11, color: "#888", fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const { toasts, add: toast } = useToast();
  const [jogos, setJogos] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPlat, setFilterPlat] = useState("");
  const [plataformas, setPlataformas] = useState([]);

  const [selected, setSelected] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [historico, setHistorico] = useState([]);

  const [mlToken, setMlToken] = useState(() => localStorage.getItem("ml_token") || "");
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(() => localStorage.getItem("ml_last_sync") || "");

  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [counts, setCounts] = useState({});
  const fileRef = useRef();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState("dashboard");

  // OAuth callback
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
        toast("✅ Mercado Livre conectado com sucesso!");
      } else toast("Erro ao conectar ML: " + JSON.stringify(data), "error");
    } catch (e) { toast("Erro OAuth: " + e.message, "error"); }
  }

  function connectML() {
    const url = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${ML_APP_ID}&redirect_uri=${encodeURIComponent(ML_REDIRECT_URI)}`;
    window.location.href = url;
  }

  function disconnectML() {
    localStorage.removeItem("ml_token");
    setMlToken("");
    toast("Desconectado do Mercado Livre", "warning");
  }

  // Load data
  const loadJogos = useCallback(async () => {
    setLoading(true);
    try {
      let params = `order=atualizado_em.desc&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`;
      if (search) params += `&titulo=ilike.*${encodeURIComponent(search)}*`;
      if (filterStatus) params += `&status=eq.${filterStatus}`;
      if (filterPlat) params += `&plataforma=eq.${encodeURIComponent(filterPlat)}`;

      const data = await supabase.select("jogos", params);
      setJogos(data);

      // Counts per status
      const countObj = {};
      for (const s of Object.keys(STATUS)) {
        let p = filterPlat ? `plataforma=eq.${encodeURIComponent(filterPlat)}` : "";
        if (search) p += (p ? "&" : "") + `titulo=ilike.*${encodeURIComponent(search)}*`;
        const n = await supabase.count("jogos", p + (p ? "&" : "") + `status=eq.${s}`);
        countObj[s] = n;
      }
      const tot = await supabase.count("jogos", filterStatus ? `status=eq.${filterStatus}` : "");
      setCounts(countObj);
      setTotal(tot);

      // Plataformas únicas
      const all = await supabase.select("jogos", "select=plataforma&order=plataforma.asc");
      const uniq = [...new Set(all.map(j => j.plataforma).filter(Boolean))];
      setPlataformas(uniq);
    } catch (e) {
      toast("Erro ao carregar jogos: " + e.message, "error");
    }
    setLoading(false);
  }, [page, search, filterStatus, filterPlat]);

  useEffect(() => { loadJogos(); }, [loadJogos]);

  // Drawer
  async function openDrawer(jogo) {
    setSelected({ ...jogo });
    setDrawerOpen(true);
    setDrawerLoading(true);
    try {
      const hist = await supabase.select("historico_status", `jogo_id=eq.${jogo.id}&order=criado_em.desc`);
      setHistorico(hist);
    } catch { setHistorico([]); }
    setDrawerLoading(false);
  }

  async function saveJogo() {
    if (!selected) return;
    setDrawerLoading(true);
    try {
      const orig = jogos.find(j => j.id === selected.id);
      const now = new Date().toISOString();
      await supabase.update("jogos", selected.id, { ...selected, atualizado_em: now });

      if (orig && orig.status !== selected.status) {
        await supabase.insert("historico_status", {
          jogo_id: selected.id, status_anterior: orig.status,
          status_novo: selected.status, observacao: selected.observacoes || "",
        });
      }
      toast("Jogo salvo com sucesso!");
      loadJogos();
      const hist = await supabase.select("historico_status", `jogo_id=eq.${selected.id}&order=criado_em.desc`);
      setHistorico(hist);
    } catch (e) { toast("Erro ao salvar: " + e.message, "error"); }
    setDrawerLoading(false);
  }

  // Sync ML single
  async function syncML(jogo) {
    if (!mlToken) { toast("Conecte o Mercado Livre primeiro", "warning"); return; }
    if (!jogo.ml_id) { toast("Este jogo não tem ML ID preenchido", "warning"); return; }
    setSyncing(true);
    try {
      const r = await fetch(`https://api.mercadolibre.com/items/${jogo.ml_id}`, {
        headers: { Authorization: `Bearer ${mlToken}` }
      });
      const data = await r.json();
      if (data.error) { toast("ML: " + data.message, "error"); setSyncing(false); return; }
      const novoStatus = ML_STATUS_MAP[data.status] || "pendente";
      const now = new Date().toISOString();
      await supabase.update("jogos", jogo.id, { status: novoStatus, atualizado_em: now });
      if (selected?.id === jogo.id) setSelected(s => ({ ...s, status: novoStatus }));
      toast(`Status atualizado: ${STATUS[novoStatus]?.label}`);
      loadJogos();
    } catch (e) { toast("Erro sync ML: " + e.message, "error"); }
    setSyncing(false);
  }

  // Sync all
  async function syncAllML() {
    if (!mlToken) { toast("Conecte o Mercado Livre primeiro", "warning"); return; }
    setSyncing(true);
    const withId = jogos.filter(j => j.ml_id);
    if (!withId.length) { toast("Nenhum jogo com ML ID encontrado", "warning"); setSyncing(false); return; }
    let ok = 0, fail = 0;
    for (let i = 0; i < withId.length; i += 20) {
      const batch = withId.slice(i, i + 20);
      await Promise.all(batch.map(async jogo => {
        try {
          const r = await fetch(`https://api.mercadolibre.com/items/${jogo.ml_id}`, { headers: { Authorization: `Bearer ${mlToken}` } });
          const data = await r.json();
          if (!data.error) {
            const ns = ML_STATUS_MAP[data.status] || "pendente";
            await supabase.update("jogos", jogo.id, { status: ns, atualizado_em: new Date().toISOString() });
            ok++;
          } else fail++;
        } catch { fail++; }
      }));
      if (i + 20 < withId.length) await new Promise(res => setTimeout(res, 1000));
    }
    const now = new Date().toLocaleString("pt-BR");
    localStorage.setItem("ml_last_sync", now);
    setLastSync(now);
    toast(`Sincronizado: ${ok} ok, ${fail} falhas`);
    loadJogos();
    setSyncing(false);
  }

  // Import Excel
  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const wb = XLSX.read(ev.target.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
        setImportPreview(rows.slice(0, 5));
        confirmImport(rows);
      } catch (err) { toast("Erro ao ler planilha: " + err.message, "error"); }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  }

  async function confirmImport(rows) {
    setImporting(true);
    try {
      const mapped = rows.map(r => ({
        titulo: r["titulo"] || r["Título"] || r["Titulo"] || r["TITULO"] || r["title"] || "",
        plataforma: r["plataforma"] || r["Plataforma"] || r["PLATAFORMA"] || r["platform"] || "",
        sku: r["sku"] || r["SKU"] || r["Sku"] || String(Math.random()),
        preco: parseFloat(r["preco"] || r["Preço"] || r["preco"] || r["price"] || 0) || 0,
        descricao: r["descricao"] || r["Descrição"] || r["descricao"] || r["description"] || "",
        status: "pendente",
        importado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      })).filter(r => r.titulo);

      const CHUNK = 100;
      let inserted = 0;
      for (let i = 0; i < mapped.length; i += CHUNK) {
        await supabase.upsert("jogos", mapped.slice(i, i + CHUNK));
        inserted += Math.min(CHUNK, mapped.length - i);
      }
      toast(`✅ ${inserted} jogos importados!`);
      setImportPreview(null);
      loadJogos();
    } catch (e) { toast("Erro na importação: " + e.message, "error"); }
    setImporting(false);
  }

  // Export
  function exportExcel() {
    if (!jogos.length) { toast("Nenhum dado para exportar", "warning"); return; }
    const data = jogos.map(j => ({
      Título: j.titulo, Plataforma: j.plataforma, SKU: j.sku,
      "Preço": j.preco, Status: STATUS[j.status]?.label || j.status,
      "URL Anúncio": j.url_anuncio_ml, "ML ID": j.ml_id,
      "URL Vídeo": j.url_video, "Motivo Negação": j.motivo_negacao,
      Observações: j.observacoes,
      "Atualizado em": j.atualizado_em ? new Date(j.atualizado_em).toLocaleString("pt-BR") : "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jogos");
    XLSX.writeFile(wb, `jogos_export_${Date.now()}.xlsx`);
    toast("Exportado com sucesso!");
  }

  const totalGeral = Object.values(counts).reduce((a, b) => a + b, 0);

  // ─── RENDER ─────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", height: "100vh", background: "#080808", color: "#e5e5e5", fontFamily: "'IBM Plex Mono', 'Fira Mono', monospace", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #f97316; border-radius: 3px; }
        input, select, textarea { font-family: inherit; }
        @keyframes slideIn { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .row-hover:hover { background: #161616 !important; cursor: pointer; }
        .btn { transition: all 0.15s; cursor: pointer; }
        .btn:hover { filter: brightness(1.15); transform: translateY(-1px); }
        .btn:active { transform: translateY(0); }
      `}</style>

      {/* SIDEBAR */}
      <div style={{
        width: sidebarOpen ? 220 : 56, background: "#0a0a0a",
        borderRight: "1px solid #1a1a1a", display: "flex", flexDirection: "column",
        transition: "width 0.2s", overflow: "hidden", flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: "16px 14px", borderBottom: "1px solid #1a1a1a", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, background: "linear-gradient(135deg,#f97316,#fb923c)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Gamepad2 size={16} color="#000" />
          </div>
          {sidebarOpen && <span style={{ fontWeight: 700, fontSize: 13, color: "#f97316", whiteSpace: "nowrap" }}>GameTracker ML</span>}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: 4 }}>
          {[
            { id: "dashboard", icon: BarChart2, label: "Dashboard" },
            { id: "jogos", icon: List, label: "Todos os Jogos" },
            { id: "settings", icon: Settings, label: "Configurações" },
          ].map(item => (
            <button key={item.id} onClick={() => setActiveSection(item.id)} className="btn" style={{
              display: "flex", alignItems: "center", gap: 10, padding: "9px 10px",
              background: activeSection === item.id ? "#f9731620" : "transparent",
              border: `1px solid ${activeSection === item.id ? "#f97316" : "transparent"}`,
              borderRadius: 8, color: activeSection === item.id ? "#f97316" : "#888",
              fontSize: 12, fontWeight: 600, width: "100%", cursor: "pointer",
            }}>
              <item.icon size={15} style={{ flexShrink: 0 }} />
              {sidebarOpen && <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* ML Status */}
        <div style={{ padding: "12px 8px", borderTop: "1px solid #1a1a1a" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
            background: mlToken ? "#f9731610" : "#1a1a1a", borderRadius: 8,
            border: `1px solid ${mlToken ? "#f97316" : "#222"}`,
          }}>
            <ShoppingBag size={14} color={mlToken ? "#f97316" : "#555"} style={{ flexShrink: 0 }} />
            {sidebarOpen && (
              <span style={{ fontSize: 11, color: mlToken ? "#f97316" : "#555", whiteSpace: "nowrap" }}>
                {mlToken ? "ML Conectado" : "ML Desconectado"}
              </span>
            )}
          </div>
        </div>

        {/* Toggle */}
        <button onClick={() => setSidebarOpen(s => !s)} style={{
          padding: 12, background: "transparent", border: "none", color: "#555",
          cursor: "pointer", borderTop: "1px solid #1a1a1a", textAlign: "center",
        }}>
          <Menu size={16} />
        </button>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* HEADER */}
        <div style={{
          height: 56, background: "#0a0a0a", borderBottom: "1px solid #1a1a1a",
          display: "flex", alignItems: "center", padding: "0 20px", gap: 12, flexShrink: 0,
        }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: "#fff", flex: 1 }}>
            {activeSection === "dashboard" ? "📊 Dashboard" : activeSection === "jogos" ? "🎮 Gerenciar Jogos" : "⚙️ Configurações"}
          </span>

          {lastSync && <span style={{ fontSize: 11, color: "#555" }}>Último sync: {lastSync}</span>}

          <button onClick={syncAllML} disabled={syncing || !mlToken} className="btn" style={{
            display: "flex", alignItems: "center", gap: 6, padding: "7px 12px",
            background: "#1a1a1a", border: "1px solid #333", borderRadius: 7,
            color: syncing ? "#555" : "#3b82f6", fontSize: 12, fontWeight: 600, cursor: syncing ? "not-allowed" : "pointer",
          }}>
            <RefreshCw size={13} style={syncing ? { animation: "spin 1s linear infinite" } : {}} />
            {syncing ? "Sincronizando..." : "Sync Todos ML"}
          </button>

          {mlToken ? (
            <button onClick={disconnectML} className="btn" style={{
              display: "flex", alignItems: "center", gap: 6, padding: "7px 12px",
              background: "#f9731615", border: "1px solid #f97316", borderRadius: 7,
              color: "#f97316", fontSize: 12, fontWeight: 600,
            }}>
              <Link2 size={13} /> Desconectar ML
            </button>
          ) : (
            <button onClick={connectML} className="btn" style={{
              display: "flex", alignItems: "center", gap: 6, padding: "7px 12px",
              background: "linear-gradient(135deg,#f97316,#fb923c)", border: "none", borderRadius: 7,
              color: "#000", fontSize: 12, fontWeight: 700,
            }}>
              <LogIn size={13} /> Conectar ML
            </button>
          )}
        </div>

        {/* CONTENT */}
        <div style={{ flex: 1, overflow: "auto", padding: 20 }}>

          {/* STAT CARDS */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
            <StatCard label="Total" value={totalGeral} color="#f97316" icon={Gamepad2}
              onClick={() => setFilterStatus("")} active={filterStatus === ""} />
            {Object.entries(STATUS).map(([key, s]) => (
              <StatCard key={key} label={s.label} value={counts[key] || 0} color={s.color} icon={s.icon}
                onClick={() => { setFilterStatus(key === filterStatus ? "" : key); setPage(0); }}
                active={filterStatus === key} />
            ))}
          </div>

          {/* TOOLBAR */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            {/* Search */}
            <div style={{ flex: "1 1 200px", display: "flex", alignItems: "center", gap: 8, background: "#111", border: "1px solid #222", borderRadius: 8, padding: "0 12px" }}>
              <Search size={14} color="#555" />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
                placeholder="Buscar por título ou SKU..."
                style={{ background: "transparent", border: "none", outline: "none", color: "#ddd", fontSize: 13, flex: 1, padding: "9px 0" }} />
            </div>

            {/* Filter Plat */}
            <select value={filterPlat} onChange={e => { setFilterPlat(e.target.value); setPage(0); }}
              style={{ background: "#111", border: "1px solid #222", borderRadius: 8, color: "#ddd", padding: "8px 12px", fontSize: 13, cursor: "pointer", outline: "none" }}>
              <option value="">Todas as plataformas</option>
              {plataformas.map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            {/* Import */}
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: "none" }} />
            <button onClick={() => fileRef.current.click()} disabled={importing} className="btn" style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
              background: importing ? "#1a1a1a" : "#3b82f620", border: "1px solid #3b82f6",
              borderRadius: 8, color: "#3b82f6", fontSize: 13, fontWeight: 600, cursor: importing ? "not-allowed" : "pointer",
            }}>
              {importing ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Upload size={14} />}
              {importing ? "Importando..." : "Importar .xlsx"}
            </button>

            {/* Export */}
            <button onClick={exportExcel} className="btn" style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
              background: "#22c55e20", border: "1px solid #22c55e",
              borderRadius: 8, color: "#22c55e", fontSize: 13, fontWeight: 600,
            }}>
              <Download size={14} /> Exportar .xlsx
            </button>
          </div>

          {/* TABLE */}
          <div style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 10, overflow: "hidden" }}>
            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 140px 80px", padding: "10px 16px", borderBottom: "1px solid #1a1a1a", background: "#111" }}>
              {["Título", "Plataforma", "SKU", "Preço", "Status", "Ação"].map(h => (
                <span key={h} style={{ fontSize: 11, color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</span>
              ))}
            </div>

            {loading ? (
              <div style={{ padding: 40, textAlign: "center", color: "#555" }}>
                <Loader2 size={24} style={{ animation: "spin 1s linear infinite", margin: "0 auto 8px" }} />
                <div style={{ fontSize: 13 }}>Carregando jogos...</div>
              </div>
            ) : jogos.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#555" }}>
                <Gamepad2 size={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
                <div style={{ fontSize: 13 }}>Nenhum jogo encontrado.</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Importe uma planilha para começar.</div>
              </div>
            ) : (
              jogos.map((jogo, i) => (
                <div key={jogo.id} className="row-hover" onClick={() => openDrawer(jogo)} style={{
                  display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 140px 80px",
                  padding: "11px 16px", borderBottom: i < jogos.length - 1 ? "1px solid #111" : "none",
                  background: i % 2 === 0 ? "#0d0d0d" : "#0a0a0a", alignItems: "center",
                }}>
                  <span style={{ fontSize: 13, color: "#ddd", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{jogo.titulo}</span>
                  <span style={{ fontSize: 12, color: "#888" }}>{jogo.plataforma || "—"}</span>
                  <span style={{ fontSize: 11, color: "#555", fontFamily: "monospace" }}>{jogo.sku || "—"}</span>
                  <span style={{ fontSize: 12, color: "#f97316", fontWeight: 600 }}>
                    {jogo.preco ? `R$ ${Number(jogo.preco).toFixed(2)}` : "—"}
                  </span>
                  <StatusBadge status={jogo.status} />
                  <button onClick={e => { e.stopPropagation(); openDrawer(jogo); }} style={{
                    background: "#f9731620", border: "1px solid #f97316", borderRadius: 6,
                    color: "#f97316", padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600,
                  }}>
                    Editar
                  </button>
                </div>
              ))
            )}
          </div>

          {/* PAGINATION */}
          {!loading && total > PAGE_SIZE && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 16 }}>
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="btn" style={{
                padding: "6px 14px", background: "#111", border: "1px solid #222", borderRadius: 7,
                color: page === 0 ? "#333" : "#ddd", fontSize: 12, cursor: page === 0 ? "not-allowed" : "pointer",
              }}>← Anterior</button>
              <span style={{ fontSize: 12, color: "#666" }}>
                Página {page + 1} de {Math.ceil(total / PAGE_SIZE)} ({total} jogos)
              </span>
              <button disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)} className="btn" style={{
                padding: "6px 14px", background: "#111", border: "1px solid #222", borderRadius: 7,
                color: (page + 1) * PAGE_SIZE >= total ? "#333" : "#ddd", fontSize: 12,
                cursor: (page + 1) * PAGE_SIZE >= total ? "not-allowed" : "pointer",
              }}>Próxima →</button>
            </div>
          )}
        </div>
      </div>

      {/* DRAWER */}
      {drawerOpen && selected && (
        <>
          <div onClick={() => setDrawerOpen(false)} style={{ position: "fixed", inset: 0, background: "#00000080", zIndex: 100, animation: "fadeIn 0.2s" }} />
          <div style={{
            position: "fixed", right: 0, top: 0, bottom: 0, width: 460,
            background: "#0a0a0a", borderLeft: "1px solid #f97316",
            zIndex: 101, display: "flex", flexDirection: "column",
            animation: "slideIn 0.25s ease",
          }}>
            {/* Drawer Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #1a1a1a", display: "flex", alignItems: "center", gap: 10 }}>
              <Gamepad2 size={18} color="#f97316" />
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.titulo}</div>
                <div style={{ fontSize: 11, color: "#555" }}>{selected.plataforma}</div>
              </div>
              <button onClick={() => setDrawerOpen(false)} style={{ background: "transparent", border: "none", color: "#555", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            {/* Drawer Body */}
            <div style={{ flex: 1, overflow: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Status selector */}
              <div>
                <label style={{ fontSize: 11, color: "#f97316", fontWeight: 700, display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Status</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {Object.entries(STATUS).map(([key, s]) => (
                    <button key={key} onClick={() => setSelected(v => ({ ...v, status: key }))} style={{
                      padding: "5px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: "pointer",
                      background: selected.status === key ? s.bg : "#111",
                      border: `1px solid ${selected.status === key ? s.color : "#222"}`,
                      color: selected.status === key ? s.color : "#555",
                      display: "flex", alignItems: "center", gap: 4,
                    }}>
                      <s.icon size={11} /> {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Motivo negação */}
              {selected.status === "negado" && (
                <div>
                  <label style={{ fontSize: 11, color: "#ef4444", fontWeight: 700, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Motivo da Negação</label>
                  <textarea value={selected.motivo_negacao || ""} onChange={e => setSelected(v => ({ ...v, motivo_negacao: e.target.value }))}
                    rows={3} style={{ width: "100%", background: "#0d0d0d", border: "1px solid #ef444444", borderRadius: 8, color: "#ef4444", padding: "8px 12px", fontSize: 12, resize: "vertical", outline: "none" }} />
                </div>
              )}

              {/* Fields */}
              {[
                { label: "URL do Vídeo", key: "url_video", icon: "🎬" },
                { label: "URL do Anúncio ML", key: "url_anuncio_ml", icon: "🔗" },
                { label: "ML ID", key: "ml_id", icon: "🆔" },
                { label: "SKU", key: "sku", icon: "#" },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 11, color: "#555", fontWeight: 700, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>{f.icon} {f.label}</label>
                  <input value={selected[f.key] || ""} onChange={e => setSelected(v => ({ ...v, [f.key]: e.target.value }))}
                    style={{ width: "100%", background: "#111", border: "1px solid #222", borderRadius: 8, color: "#ddd", padding: "8px 12px", fontSize: 12, outline: "none" }} />
                </div>
              ))}

              {/* Preço */}
              <div>
                <label style={{ fontSize: 11, color: "#555", fontWeight: 700, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>💰 Preço</label>
                <input type="number" value={selected.preco || ""} onChange={e => setSelected(v => ({ ...v, preco: e.target.value }))}
                  style={{ width: "100%", background: "#111", border: "1px solid #222", borderRadius: 8, color: "#f97316", padding: "8px 12px", fontSize: 12, outline: "none", fontWeight: 700 }} />
              </div>

              {/* Observações */}
              <div>
                <label style={{ fontSize: 11, color: "#555", fontWeight: 700, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>📝 Observações</label>
                <textarea value={selected.observacoes || ""} onChange={e => setSelected(v => ({ ...v, observacoes: e.target.value }))}
                  rows={3} style={{ width: "100%", background: "#111", border: "1px solid #222", borderRadius: 8, color: "#ddd", padding: "8px 12px", fontSize: 12, resize: "vertical", outline: "none" }} />
              </div>

              {/* ML Sync */}
              {selected.ml_id && (
                <button onClick={() => syncML(selected)} disabled={syncing} className="btn" style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px",
                  background: "#3b82f620", border: "1px solid #3b82f6", borderRadius: 8,
                  color: "#3b82f6", fontSize: 12, fontWeight: 700, cursor: syncing ? "not-allowed" : "pointer",
                }}>
                  <RefreshCw size={14} style={syncing ? { animation: "spin 1s linear infinite" } : {}} />
                  Sincronizar Status com ML
                </button>
              )}

              {/* Histórico */}
              {historico.length > 0 && (
                <div>
                  <label style={{ fontSize: 11, color: "#f97316", fontWeight: 700, display: "flex", alignItems: "center", gap: 6, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    <History size={13} /> Histórico de Status
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {historico.map(h => (
                      <div key={h.id} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 8, padding: "8px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <StatusBadge status={h.status_anterior} size="xs" />
                          <ChevronRight size={12} color="#555" />
                          <StatusBadge status={h.status_novo} size="xs" />
                        </div>
                        {h.observacao && <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>{h.observacao}</div>}
                        <div style={{ fontSize: 10, color: "#333", marginTop: 4 }}>{new Date(h.criado_em).toLocaleString("pt-BR")}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div style={{ padding: "14px 20px", borderTop: "1px solid #1a1a1a", display: "flex", gap: 10 }}>
              <button onClick={() => setDrawerOpen(false)} style={{
                flex: 1, padding: "10px", background: "#111", border: "1px solid #222", borderRadius: 8,
                color: "#888", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>Cancelar</button>
              <button onClick={saveJogo} disabled={drawerLoading} className="btn" style={{
                flex: 2, padding: "10px", background: "linear-gradient(135deg,#f97316,#fb923c)", border: "none", borderRadius: 8,
                color: "#000", fontSize: 13, fontWeight: 800, cursor: drawerLoading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                {drawerLoading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={14} />}
                {drawerLoading ? "Salvando..." : "Salvar Alterações"}
              </button>
            </div>
          </div>
        </>
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}

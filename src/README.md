# 🎮 GameTracker ML — Google Sheets Edition

Gerenciador de jogos para publicar no Mercado Livre, usando Google Sheets como banco de dados.

---

## ⚙️ CONFIGURAÇÃO EM 2 PASSOS

### PASSO 1 — Google Apps Script (backend na planilha)

1. Crie uma planilha nova no Google Sheets
2. Menu: **Extensões → Apps Script**
3. Cole todo o conteúdo do arquivo `Code.gs`
4. Salve (Ctrl+S)
5. Clique em **"Implantar" → "Nova implantação"**
6. Tipo: **App da Web**
7. Executar como: **Eu mesmo**
8. Quem tem acesso: **Qualquer pessoa**
9. Clique em **Implantar** e copie a URL gerada

### PASSO 2 — Configurar o App

Abra `src/App.jsx` e cole a URL copiada:

```js
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/SEU_ID/exec";
```

---

## 🚀 Deploy no GitHub Pages

O deploy é automático via GitHub Actions.  
Após o push na branch `main`, vá em **Settings → Pages** e selecione a branch **gh-pages**.

Seu app ficará em: `https://SEU_USUARIO.github.io/Game_Tracker/`

---

## 📋 Colunas da planilha (criadas automaticamente)

| Coluna | Descrição |
|--------|-----------|
| id | ID único gerado automaticamente |
| titulo | Nome do jogo (sem o console) |
| console | PS4, PS5, Switch, Xbox... |
| status | pendente / em_edicao / aprovado / negado / publicado... |
| url_video | URL do vídeo do anúncio |
| url_anuncio_ml | URL do anúncio no ML |
| ml_id | ID do anúncio no Mercado Livre |
| motivo_negacao | Preenchido quando status = negado |
| observacoes | Notas livres |
| importado_em | Data de importação |
| atualizado_em | Data da última edição |

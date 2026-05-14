# 🎮 GameTracker ML

Aplicativo web para gerenciar jogos a serem publicados no Mercado Livre.

## ⚙️ Configuração

Antes de usar, edite as constantes no topo de `src/App.jsx`:

```js
const SUPABASE_URL = "SUA_URL_AQUI";
const SUPABASE_ANON_KEY = "SUA_CHAVE_AQUI";
const ML_APP_ID = "SEU_APP_ID_ML";
```

## 🗄️ SQL — Criar tabelas no Supabase

```sql
create table jogos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  plataforma text,
  sku text,
  preco numeric,
  descricao text,
  url_video text,
  url_anuncio_ml text,
  ml_id text,
  status text default 'pendente',
  motivo_negacao text,
  observacoes text,
  importado_em timestamp default now(),
  atualizado_em timestamp default now()
);

create table historico_status (
  id uuid primary key default gen_random_uuid(),
  jogo_id uuid references jogos(id),
  status_anterior text,
  status_novo text,
  observacao text,
  criado_em timestamp default now()
);
```

## 🚀 Deploy

O deploy é automático! Basta fazer push na branch `main` que o GitHub Actions faz o build e publica no GitHub Pages.

Após o primeiro push:
1. Vá em **Settings → Pages** do seu repositório
2. Em "Branch" selecione **gh-pages**
3. Salve — seu app estará em `https://SEU_USUARIO.github.io/gametracker-ml/`

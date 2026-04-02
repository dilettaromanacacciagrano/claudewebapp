# UNICAM Research Analyst — Claude Web App

Chat intelligente con accesso diretto a Google Drive per l'analisi dei dati UNICAM.

## Deploy su Netlify

### 1. Prerequisiti
- Account Netlify (gratuito: netlify.com)
- API Key Anthropic (console.anthropic.com → API Keys)
- Node.js installato localmente

### 2. Deploy

**Opzione A — Da GitHub (consigliata):**
1. Carica questa cartella su un repository GitHub
2. Vai su netlify.com → "Add new site" → "Import an existing project"
3. Connetti il repository GitHub
4. Netlify rileva automaticamente le impostazioni da `netlify.toml`
5. Clicca "Deploy site"

**Opzione B — Deploy manuale:**
```bash
npm install
npm run build
npx netlify deploy --prod --dir=dist
```

### 3. Configura la API Key
1. Su Netlify: Site settings → Environment variables
2. Aggiungi: `ANTHROPIC_API_KEY` = `sk-ant-...` (la tua chiave API)
3. Redeploy il sito

### 4. Aggiorna il bottone sulla piattaforma web
Nel file `templates/index.html` su HF Space, aggiorna l'URL del bottone Claude:
```html
href="https://TUO-SITO.netlify.app"
```

## Architettura

```
Browser (React)
    ↓ POST /api/claude-chat
Netlify Function (serverless)
    ↓ Anthropic API (con tool use)
    ↓ Tool: drive_list_folders / drive_list_files / drive_read_file
    ↓ → HF Bridge → Google Drive
    ↓ Risposta con dati reali
Browser (mostra risposta)
```

## Costi
- Netlify: gratuito (125K function invocations/mese)
- Anthropic API: ~$0.003/1K input tokens + $0.015/1K output tokens (Sonnet)
- Stima: ~$0.02-0.10 per query (dipende dalla complessità)

## File principali
- `src/App.jsx` — Chat UI React
- `netlify/functions/claude-chat.js` — Serverless function con tool use
- `netlify.toml` — Configurazione Netlify

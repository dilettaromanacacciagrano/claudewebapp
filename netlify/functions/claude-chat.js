const BRIDGE = "https://dilettaromana-unicallmapper.hf.space/api/gpt/bridge";

// File IDs hardcoded (aggiornare dopo ogni pipeline)
const F = {
  profiles: "1rMjlkqDCBAPgokEUaJ3xsT_W9e9wSUs5",       // 83KB
  cosine_detail: "1H6KcQ1nQq9uXIefpXZbRQW-aM2NeTVg_",    // 294KB
  dept_cluster: "1tBPriVOudDYJrhDEr5isbFlXyZufO2a6",      // 1KB
  cluster_summary: "1w947enynW2nSlbNYejsCJzFyy7pBC4EU",    // 0.2KB
  cosine_summary: "1bGp8LWn60hKL7Ke4S_C7AIQg_yRGC9VD",    // 0.6KB
  calls_mapped: "1g6RBc_yLAGzDw4JjeCMd24PsTEqVdPIR",      // 131KB
  calls_bitfidf: "1Q72KcP6DrJlBwsm3_4gaYnM0RgY3LwV2",    // 4.4MB
  summary: "1h4uXomlkTmCVBDjmz4eSW_mWj2E1cdfS",          // 4KB
  calls_unmapped: "14g4yfQHgQjKjT2qG-aoKvmqCK7kkQ7Fp",   // 23KB
  cosine_profiles: "1v5OEWpn6XnaVlWNJAl1poHD-rG7iWjdk",   // 121KB
  author_vocabularies: "1QplgwBnGgrZoIYz4hZsdipFryLAVhNGU",// 875KB
};

async function readBridge(fileId, maxChars, department) {
  const url = new URL(BRIDGE);
  url.searchParams.set("action", "read");
  url.searchParams.set("file_id", fileId);
  url.searchParams.set("max_chars", String(maxChars || 90000));
  if (department) url.searchParams.set("department", department);
  const r = await fetch(url.toString());
  if (!r.ok) return `{errore: "Bridge HTTP ${r.status}"}`;
  const text = await r.text();
  try {
    const j = JSON.parse(text);
    return j.content || text.substring(0, 150000);
  } catch { return text.substring(0, 150000); }
}

// Decide quali file pre-leggere in base alla query
function selectFiles(query) {
  const q = query.toLowerCase();

  // Profilo singolo ricercatore
  if (q.match(/profilo|chi e'|chi è|scheda|competenz.*di\s/)) {
    return [{ id: F.profiles, max: 90000, label: "gpt_authors_profiles" }];
  }
  // Chi lavora su tema
  if (q.match(/chi lavora|chi si occupa|esperti|ricercat.*su\s|tema/)) {
    return [{ id: F.profiles, max: 90000, label: "gpt_authors_profiles" }];
  }
  // Call per ricercatore o chi per call (file grande, serve department)
  if (q.match(/call per |quali call|call.*scad|urgenti|deadline|scadenza/)) {
    return [{ id: F.calls_mapped, max: 140000, label: "gpt_calls_mapped" }];
  }
  // Gap analysis
  if (q.match(/gap|competenze scoperte|senza candidati|scoper/)) {
    return [
      { id: F.cluster_summary, max: 5000, label: "gpt_cluster_summary" },
      { id: F.dept_cluster, max: 5000, label: "gpt_dept_cluster" },
    ];
  }
  // Analisi per scuola
  if (q.match(/scuola|dipartimento|architettura|giurispruden|bioscienz|scienze e tec|farmaco/)) {
    return [
      { id: F.dept_cluster, max: 5000, label: "gpt_dept_cluster" },
      { id: F.profiles, max: 90000, label: "gpt_authors_profiles" },
    ];
  }
  // Report completo
  if (q.match(/report|panoramica|sintesi|riepilogo/)) {
    return [
      { id: F.summary, max: 10000, label: "gpt_summary" },
      { id: F.cluster_summary, max: 5000, label: "gpt_cluster_summary" },
      { id: F.dept_cluster, max: 5000, label: "gpt_dept_cluster" },
    ];
  }
  // Profilo divulgativo
  if (q.match(/divulgativ|word cloud|profilo.*ricerca/)) {
    return [{ id: F.dept_cluster, max: 5000, label: "gpt_dept_cluster" }];
  }
  // Menu / saluto
  if (q.match(/menu|ciao|help|aiuto|analisi disponibili/)) {
    return [];
  }
  // Default: profili autori (copre la maggior parte dei casi)
  return [{ id: F.profiles, max: 90000, label: "gpt_authors_profiles" }];
}

const SYSTEM = `Sei UNICAM Research Analyst. Rispondi SEMPRE in italiano.
I dati della pipeline sono GIA' inclusi nel messaggio utente (pre-letti da Google Drive). Analizzali e rispondi.

ATENEO: P1(C1.1=Green Deal Ambiente, C1.2=Infrastrutture Territorio Patrimonio), P2(C2.1=Salute Alimentazione, C2.2=Biotecnologie Farmaceutica), P3(C3.1=Societa' Inclusiva Cultura, C3.2=Digitale Dati Tecnologie).
5 Scuole: Scienze e Tecnologie, Bioscienze e Medicina Veterinaria, Scienze del Farmaco, Architettura e Design, Giurisprudenza.

SOGLIE: COSINE>=0.05 solido, >=0.08 eccellente. RANK<=3 top, <=10 shortlist. PCT>=40% focalizzato, <25% disperso. PUBS>=3 affidabile. DAYS<30 urgente.
Metodo A(Softmax→PCT)+B(Cosine). Concordano=ROBUSTO. Discordano=INTERDISCIPLINARE.
Gerarchia matching: BiTFIDF>Vocabolario>Cluster.

COLONNE:
profiles: RM_PERSON_ID,LAST_NAME,FIRST_NAME,DEPARTMENT,FASCIA,SSD_2015,SSD_NOME,TOTAL_PUBS,DOMINANT_CLUSTER_WEIGHTED,DOMINANT_CLUSTER_PCT_W,IS_FOCUSED,PCT_C1.1...PCT_C3.2
calls_mapped: CALL_IDENTIFIER,TITLE,CALL_STATUS,DEADLINE,DAYS_TO_DEADLINE,PRIMARY_CLUSTER,BUDGET_TOPIC,ACTION_TYPE
dept_cluster: DEPARTMENT,DOMINANT_CLUSTER_WEIGHTED,N

REGOLE: NON inventare dati. Cita file e colonne. Chiudi con AZIONI SUGGERITE.
Se i dati nel messaggio non bastano, indica QUALE file serve e l'utente potra' raffinare la domanda.
Alla prima interazione (senza dati allegati) mostra il menu delle 24 query disponibili.`;

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });

  const KEY = Netlify.env.get("ANTHROPIC_API_KEY");
  if (!KEY) return new Response(JSON.stringify({ error: "API key mancante" }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });

  try {
    const { messages = [] } = await req.json();
    const lastUserMsg = messages.filter(m => m.role === "user").pop()?.content || "";

    // 1. Pre-leggi i file necessari dal bridge (PRIMA di chiamare Claude)
    const filesToRead = selectFiles(lastUserMsg);
    let dataContext = "";

    if (filesToRead.length > 0) {
      const results = await Promise.all(
        filesToRead.map(f => readBridge(f.id, f.max).then(data => `\n--- FILE: ${f.label} ---\n${data}`))
      );
      dataContext = results.join("\n");
    }

    // 2. Costruisci i messaggi con i dati inclusi
    const augmentedMessages = messages.map((m, i) => {
      if (i === messages.length - 1 && m.role === "user" && dataContext) {
        return { role: "user", content: m.content + "\n\n[DATI DA GOOGLE DRIVE]\n" + dataContext };
      }
      return m;
    });

    // 3. UNA SOLA chiamata Claude (niente tool use, niente loop)
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 8192, system: SYSTEM, messages: augmentedMessages })
    });

    if (!r.ok) {
      const err = await r.text();
      return new Response(JSON.stringify({ error: `API ${r.status}`, details: err.substring(0, 300) }), { status: r.status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }

    const result = await r.json();
    const text = result.content.filter(b => b.type === "text").map(b => b.text).join("\n");

    return new Response(JSON.stringify({ response: text, usage: result.usage, model: result.model }), {
      status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  }
};

export const config = { path: "/api/claude-chat" };

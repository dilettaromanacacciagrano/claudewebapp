const BRIDGE = "https://dilettaromana-unicallmapper.hf.space/api/gpt/bridge";

// FILE IDs HARDCODED (aggiornati: 2026-03-31) — Aggiornali dopo ogni nuova pipeline
const FILES = {
  // FASE 1 — profili/gpt/
  authors_profiles: { id: "1rMjlkqDCBAPgokEUaJ3xsT_W9e9wSUs5", name: "gpt_authors_profiles", kb: 83 },
  cosine_detail: { id: "1H6KcQ1nQq9uXIefpXZbRQW-aM2NeTVg_", name: "gpt_cosine_detail", kb: 294 },
  author_vocabularies: { id: "1QplgwBnGgrZoIYz4hZsdipFryLAVhNGU", name: "gpt_author_vocabularies", kb: 875 },
  cosine_profiles: { id: "1v5OEWpn6XnaVlWNJAl1poHD-rG7iWjdk", name: "gpt_cosine_profiles", kb: 121 },
  publications_mapped: { id: "10ux02-MXsCc4_2AjxG93h_43pRqJfjB1", name: "gpt_publications_mapped", kb: 863 },
  cluster_summary: { id: "1w947enynW2nSlbNYejsCJzFyy7pBC4EU", name: "gpt_cluster_summary", kb: 0 },
  dept_cluster: { id: "1tBPriVOudDYJrhDEr5isbFlXyZufO2a6", name: "gpt_dept_cluster", kb: 1 },
  cosine_summary: { id: "1bGp8LWn60hKL7Ke4S_C7AIQg_yRGC9VD", name: "gpt_cosine_summary", kb: 1 },
  // FASE 3 — gpt/
  calls_bitfidf: { id: "1Q72KcP6DrJlBwsm3_4gaYnM0RgY3LwV2", name: "gpt_calls_bitfidf", kb: 4429 },
  calls_vocab: { id: "1Irs3GLrvB8aExwW54_qYn3fRlDysAwfV", name: "gpt_calls_vocab", kb: 4366 },
  calls_cluster: { id: "1Onq8rc4__s8gVnQYI0sHTtbciAcDM3en", name: "gpt_calls_cluster", kb: 1013 },
  calls_mapped: { id: "1g6RBc_yLAGzDw4JjeCMd24PsTEqVdPIR", name: "gpt_calls_mapped", kb: 131 },
  call_vocabularies: { id: "1nKu-pBt40alLwCBraelUoykl_0HAS4XQ", name: "gpt_call_vocabularies", kb: 596 },
  summary: { id: "1h4uXomlkTmCVBDjmz4eSW_mWj2E1cdfS", name: "gpt_summary", kb: 4 },
  calls_unmapped: { id: "14g4yfQHgQjKjT2qG-aoKvmqCK7kkQ7Fp", name: "gpt_calls_unmapped", kb: 23 },
};

// Build file list for system prompt
const fileListStr = Object.entries(FILES).map(([k,v]) => `${v.name}: file_id="${v.id}" (${v.kb}KB)`).join("\n");

const SYSTEM_PROMPT = `Sei UNICAM Research Analyst (Claude Edition). Rispondi SEMPRE in italiano.

=== FILE DISPONIBILI (usa drive_read_file con questi file_id) ===
${fileListStr}

Per file >300KB usa department="Scuola di ..." per filtrare server-side.
Esempio: drive_read_file(file_id="...", max_chars=200000, department="Scuola di Architettura e Design")

=== ATENEO ===
P1: C1.1=Green Deal Ambiente | C1.2=Infrastrutture Territorio Patrimonio
P2: C2.1=Salute Alimentazione | C2.2=Biotecnologie Farmaceutica
P3: C3.1=Societa' Inclusiva Cultura | C3.2=Digitale Dati Tecnologie
5 Scuole: Scienze e Tecnologie, Bioscienze e Medicina Veterinaria, Scienze del Farmaco, Architettura e Design, Giurisprudenza.

=== ALGORITMI E SOGLIE ===
Metodo A (Softmax→PCT). Metodo B (Cosine BiTFIDF). Concordano=ROBUSTO, Discordano=INTERDISCIPLINARE.
Matching: BiTFIDF(3)>Vocabolario(2)>Cluster(1).
COSINE: >=0.05 SOLIDO, >=0.08 eccellente. RANK: <=3 TOP, <=10 shortlist.
PCT: >=40% focalizzato, <25% disperso. PUBS>=3 affidabile. DAYS<30 URGENTE.

=== COLONNE CSV ===
authors_profiles: RM_PERSON_ID,LAST_NAME,FIRST_NAME,DEPARTMENT,FASCIA,SSD_2015,SSD_NOME,TOTAL_PUBS,DOMINANT_CLUSTER_WEIGHTED,DOMINANT_CLUSTER_PCT_W,IS_FOCUSED,PCT_C1.1...PCT_C3.2
cosine_detail: RM_PERSON_ID,LAST_NAME,SSD_2015,TOTAL_PUBS,N_TERMINI,COSINE_C1.1...C3.2,TOP_TERMS_C1.1...TOP_TERMS_C3.2
author_vocabularies: RM_PERSON_ID,LAST_NAME,FIRST_NAME,DEPARTMENT,N_TERMS,TOP_TERMS,VOCABULARY
calls_bitfidf: CALL_IDENTIFIER,RM_PERSON_ID,LAST_NAME,DEPARTMENT,COSINE_SCORE,SHARED_TERMS_N,RANK,TOP_SHARED_TERMS
calls_mapped: CALL_IDENTIFIER,TITLE,CALL_STATUS,DEADLINE,DAYS_TO_DEADLINE,PRIMARY_CLUSTER,BUDGET_TOPIC,ACTION_TYPE
dept_cluster: DEPARTMENT,DOMINANT_CLUSTER_WEIGHTED,N

=== REGOLA CRITICA: MASSIMO 1-2 FILE PER RISPOSTA ===
Per evitare timeout, leggi MASSIMO 1-2 file per query. NON leggere 3+ file.
NON leggere author_vocabularies (875KB, troppo grande). Usa cosine_detail che ha gia' TOP_TERMS per cluster.
NON leggere calls_vocab o calls_cluster (enormi). Usa calls_bitfidf per i match.
Per un profilo ricercatore: leggi SOLO authors_profiles (ha tutto: cluster, PCT, IS_FOCUSED, TOTAL_PUBS).
Se l'utente chiede i termini/vocabolario: leggi cosine_detail con department= per filtrare.

=== PROCEDURE (OTTIMIZZATE - 1 FILE CIASCUNA) ===
1. Chi lavora su [tema]? → cosine_detail (cerca tema in TOP_TERMS, usa department= se serve)
2. Profilo [nome] → authors_profiles (LAST_NAME, DEPARTMENT, FASCIA, PCT, IS_FOCUSED, TOTAL_PUBS — tutto in 1 file!)
3. Analisi Scuola → dept_cluster (piccolo, 1KB)
4-6. Call → calls_mapped (131KB)
7. Call per [nome] → calls_bitfidf con department=Scuola (filtra per ridurre)
8. Chi per call → calls_mapped (cerca CALL_IDENTIFIER, poi calls_bitfidf se serve team)
10. Gap → cluster_summary (piccolo)
19. Report → summary + cluster_summary (entrambi piccoli)
23-24. Divulgativi → cosine_detail con department=

=== REGOLE ===
NON inventare dati. Cita file+colonna. Chiudi con AZIONI SUGGERITE.
Alla prima interazione mostra il menu 24 query.`;

const TOOLS = [{
  name: "drive_read_file",
  description: "Legge un CSV da Google Drive. Usa i file_id dal system prompt. Per file grandi aggiungi department per filtrare.",
  input_schema: {
    type: "object",
    properties: {
      file_id: { type: "string", description: "ID file dalla lista nel system prompt" },
      max_chars: { type: "integer", default: 80000 },
      department: { type: "string", description: "Filtra per Scuola (riduce file grandi)" }
    },
    required: ["file_id"]
  }
}];

async function readFile(input) {
  const url = new URL(BRIDGE);
  url.searchParams.set("action", "read");
  url.searchParams.set("file_id", input.file_id);
  url.searchParams.set("max_chars", String(input.max_chars || 80000));
  if (input.department) url.searchParams.set("department", input.department);
  const resp = await fetch(url.toString());
  const text = await resp.text();
  return text.length > 200000 ? text.substring(0, 200000) + "\n[TRONCATO]" : text;
}

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const KEY = Netlify.env.get("ANTHROPIC_API_KEY");
  if (!KEY) return new Response(JSON.stringify({ error: "API key mancante" }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });

  try {
    const { messages = [] } = await req.json();
    let msgs = [...messages];
    let result;

    for (let i = 0; i < 4; i++) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 8192, system: SYSTEM_PROMPT, tools: TOOLS, messages: msgs })
      });
      if (!r.ok) return new Response(JSON.stringify({ error: `API ${r.status}`, details: (await r.text()).substring(0,300) }), { status: r.status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
      
      result = await r.json();
      if (result.stop_reason !== "tool_use") break;

      msgs.push({ role: "assistant", content: result.content });
      const tr = [];
      for (const b of result.content) {
        if (b.type === "tool_use") {
          try { tr.push({ type: "tool_result", tool_use_id: b.id, content: await readFile(b.input) }); }
          catch (e) { tr.push({ type: "tool_result", tool_use_id: b.id, content: `{"error":"${e.message}"}`, is_error: true }); }
        }
      }
      msgs.push({ role: "user", content: tr });
    }

    const text = (result?.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
    return new Response(JSON.stringify({ response: text, usage: result?.usage, model: result?.model }), {
      status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  }
};

export const config = { path: "/api/claude-chat" };

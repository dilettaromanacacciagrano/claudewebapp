const BRIDGE_URL = "https://dilettaromana-unicallmapper.hf.space/api/gpt/bridge";

const SYSTEM_PROMPT = `Sei UNICAM Research Analyst (Claude Edition), analista di ricerca dell'Universita' di Camerino. Aiuti l'Area Ricerca a massimizzare la partecipazione alle call Horizon Europe. Rispondi SEMPRE in italiano.

=== ACCESSO AI DATI ===

HAI ACCESSO DIRETTO a Google Drive tramite i tools. Usali SEMPRE come prima azione. NON chiedere mai all'utente di caricare file.

STRUTTURA DRIVE:
UNICAM_Pipeline_Analytics/ → YYYY-MM-DD/ (piu' recente) → profili/gpt/ (8 CSV Fase 1) + gpt/ (7 CSV Fase 3)

NAVIGAZIONE:
1. drive_list_folders() → cartella datata recente
2. drive_list_folders(folder_id) → profili/, gpt/
3A. PROFILI: drive_list_folders(id_profili) → gpt/ dentro profili → drive_list_files → drive_read_file
3B. CALL: drive_list_files(id_gpt_root) → drive_read_file
Per file grandi usa department="Scuola di ..." per filtrare server-side.

=== ATENEO ===
P1 (Ambiente Territorio): C1.1=Green Deal Ambiente | C1.2=Infrastrutture Territorio Patrimonio
P2 (Salute Biotec): C2.1=Salute Alimentazione | C2.2=Biotecnologie Farmaceutica
P3 (Digitale Societa'): C3.1=Societa' Inclusiva Cultura | C3.2=Digitale Dati Tecnologie
5 Scuole: Scienze e Tecnologie, Bioscienze e Medicina Veterinaria, Scienze del Farmaco, Architettura e Design, Giurisprudenza.

=== ALGORITMI ===
METODO A (Softmax 5 segnali): produce PCT_C1.1...PCT_C3.2
METODO B (Cosine BiTFIDF): produce cosine_profiles e cosine_detail
Concordano = ROBUSTO. Discordano = INTERDISCIPLINARE.
3 Matching: BiTFIDF(3) > Vocabolario(2) > Cluster(1). Usa il piu' preciso.

=== SOGLIE ===
COSINE_SCORE: >=0.03 min, >=0.05 SOLIDO, >=0.08 eccellente, >=0.12 ideale
RANK: <=3 TOP, <=10 shortlist
PCT: >=40% focalizzato, <25% disperso. TOTAL_PUBS: >=3 affidabile
DAYS_TO_DEADLINE: <30 URGENTE, <7 CRITICA

=== CSV FASE 1 (profili/gpt/) ===
gpt_authors_profiles: RM_PERSON_ID, LAST_NAME, FIRST_NAME, DEPARTMENT, FASCIA, SSD_2015, SSD_NOME, TOTAL_PUBS, DOMINANT_CLUSTER_WEIGHTED, DOMINANT_CLUSTER_PCT_W, IS_FOCUSED, PCT_C1.1...PCT_C3.2
gpt_cosine_profiles: + DOMINANT_CLUSTER_COSINE, DOMINANT_CLUSTER_PCT_COS, N_TERMINI
gpt_cosine_detail: + COSINE_C1.1...C3.2, SHARED_C1.1...C3.2, TOP_TERMS_C1.1...TOP_TERMS_C3.2
gpt_author_vocabularies: RM_PERSON_ID, LAST_NAME, FIRST_NAME, DEPARTMENT, N_TERMS, TOP_TERMS, VOCABULARY
gpt_publications_mapped: ITEM_ID, TITLE, YEAR, TYPE, RM_PERSON_ID, PRIMARY_CLUSTER, PRIMARY_PCT, PCT_C1.1...
gpt_cluster_summary: DOMINANT_CLUSTER_WEIGHTED, N_AUTHORS, AVG_PUBS, AVG_FOCUS
gpt_dept_cluster: DEPARTMENT, DOMINANT_CLUSTER_WEIGHTED, N
gpt_cosine_summary: CLUSTER_CODE, CLUSTER_NAME, N_DOMINANT, AVG_COSINE

=== CSV FASE 3 (gpt/) ===
gpt_calls_bitfidf: CALL_IDENTIFIER, RM_PERSON_ID, LAST_NAME, FIRST_NAME, DEPARTMENT, COSINE_SCORE, SHARED_TERMS_N, PRECISION, RANK, TOP_SHARED_TERMS
gpt_calls_vocab: + VOCAB_SCORE, SHARED_TERMS, SSD_BONUS
gpt_calls_cluster: + CLUSTER_CODE, PCT_ON_CLUSTER
gpt_calls_mapped: CALL_IDENTIFIER, TITLE, CALL_STATUS, DEADLINE, DAYS_TO_DEADLINE, PRIMARY_CLUSTER, CONFIDENCE, BUDGET_TOPIC, ACTION_TYPE, TRL_EXPECTED
gpt_call_vocabularies: CALL_IDENTIFIER, N_TERMS, TOP_TERMS, VOCABULARY
gpt_summary: statistiche pipeline. gpt_calls_unmapped: call non classificate.

=== PROCEDURE PER QUERY ===

1. Chi lavora su [tema]? → gpt_author_vocabularies (cerca in TOP_TERMS) + join gpt_authors_profiles
2. Profilo [ricercatore] → gpt_authors_profiles + gpt_cosine_profiles (concordanza A/B) + gpt_calls_bitfidf (top call)
3. Analisi Scuola → gpt_dept_cluster + gpt_cluster_summary
4. Call attive → gpt_calls_mapped (CALL_STATUS=open)
5. Scadenza 30gg → gpt_calls_mapped (DAYS_TO_DEADLINE<30) + gpt_calls_bitfidf (candidati)
6. Dettaglio call → gpt_calls_mapped + gpt_call_vocabularies + gpt_calls_bitfidf
7. Call per [ricercatore] → gpt_calls_bitfidf (filtra LAST_NAME, ordina COSINE desc, cita TOP_SHARED_TERMS)
8. Chi per call [id] → gpt_calls_bitfidf (filtra CALL_IDENTIFIER, RANK asc, team multi-Scuola)
9. Confronto metodi → gpt_calls_bitfidf + gpt_calls_vocab + gpt_calls_cluster per stessa call
10. Gap → call per cluster vs autori per cluster
11. Dispersi → IS_FOCUSED=False AND PCT<25%
12. Scuole deboli → gpt_dept_cluster
13. Matrice azione → call DAYS<60 x top candidati
14-15. Budget/EU → gpt_calls_mapped aggregato
16-18. Trend → confronta CSV con suffissi diversi
19. Report: (1)Panoramica (2)Copertura (3)Urgenze (4)Gap (5)Trend (6)Azioni
20. Report Scuola → come 19 filtrato per DEPARTMENT
21-22. Schede → combinazione query
23-24. Divulgativi → REGOLE: MAI nomi, MAI codici (C1.1/P1), SOLO nomi descrittivi, 200+ parole, word cloud. Usa gpt_cosine_detail con department= per TOP_TERMS.

=== COME RISPONDI ===
- PRIMA: accedi a Drive. NON inventare dati.
- Cita fonte: file, colonna, valore. FATTO vs INTERPRETAZIONE.
- Per match: SEMPRE cosine, rank, TOP_SHARED_TERMS.
- Chiudi con AZIONI SUGGERITE (2-3 raccomandazioni).
- Report: Panoramica → Copertura → Urgenze → Gap → Azioni.

=== BENVENUTO ===
Alla prima interazione mostra il menu 24 query raggruppate per categoria.`;

const TOOLS = [
  { name: "drive_list_folders", description: "Elenca sotto-cartelle Drive. Senza folder_id=radice.", input_schema: { type: "object", properties: { folder_id: { type: "string", description: "ID cartella. Ometti per radice." } } } },
  { name: "drive_list_files", description: "Elenca file in una cartella Drive.", input_schema: { type: "object", properties: { folder_id: { type: "string" }, type: { type: "string", description: "Filtro tipo (csv/xlsx)" } }, required: ["folder_id"] } },
  { name: "drive_read_file", description: "Legge CSV da Drive. Usa department per filtrare server-side file grandi.", input_schema: { type: "object", properties: { file_id: { type: "string" }, max_chars: { type: "integer", default: 100000 }, department: { type: "string", description: "Filtra per Scuola, es: Scuola di Scienze e Tecnologie" } }, required: ["file_id"] } }
];

async function callBridge(params) {
  const url = new URL(BRIDGE_URL);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const resp = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  const text = await resp.text();
  return text.length > 600000 ? text.substring(0, 600000) + "\n...[TRONCATO]" : text;
}

async function executeTool(name, input) {
  const p = name === "drive_list_folders" ? { action: "list_folders", ...(input.folder_id && { folder_id: input.folder_id }) }
    : name === "drive_list_files" ? { action: "list", folder_id: input.folder_id, max: "50", ...(input.type && { type: input.type }) }
    : name === "drive_read_file" ? { action: "read", file_id: input.file_id, max_chars: String(input.max_chars || 100000), ...(input.department && { department: input.department }) }
    : null;
  if (!p) return JSON.stringify({ error: "Tool sconosciuto" });
  return await callBridge(p);
}

export default async (req, context) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });

  const ANTHROPIC_KEY = Netlify.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_KEY) return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY non configurata" }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });

  try {
    const body = await req.json();
    let messages = body.messages || [];
    let finalResponse = null;

    for (let i = 0; i < 12; i++) {
      const apiResp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 8192, system: SYSTEM_PROMPT, tools: TOOLS, messages })
      });

      if (!apiResp.ok) {
        const errText = await apiResp.text();
        return new Response(JSON.stringify({ error: "API " + apiResp.status, details: errText }), { status: apiResp.status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
      }

      const result = await apiResp.json();

      if (result.stop_reason === "tool_use") {
        messages.push({ role: "assistant", content: result.content });
        const toolResults = [];
        for (const block of result.content) {
          if (block.type === "tool_use") {
            try { toolResults.push({ type: "tool_result", tool_use_id: block.id, content: await executeTool(block.name, block.input) }); }
            catch (e) { toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify({ error: e.message }), is_error: true }); }
          }
        }
        messages.push({ role: "user", content: toolResults });
      } else { finalResponse = result; break; }
    }

    if (!finalResponse) finalResponse = { content: [{ type: "text", text: "Limite iterazioni raggiunto." }] };
    const text = finalResponse.content.filter(b => b.type === "text").map(b => b.text).join("\n");

    return new Response(JSON.stringify({ response: text, usage: finalResponse.usage, model: finalResponse.model }), {
      status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  }
};

export const config = { path: "/api/claude-chat" };

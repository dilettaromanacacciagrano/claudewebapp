const BRIDGE = "https://dilettaromana-unicallmapper.hf.space/api/gpt/bridge";

// Pre-fetch la struttura Drive prima di chiamare Claude
async function prefetchDriveStructure() {
  try {
    // 1. Lista cartelle root
    const rootResp = await fetch(`${BRIDGE}?action=list_folders`);
    const rootData = await rootResp.json();
    const folders = rootData.subfolders || [];
    // Prendi la cartella datata piu' recente
    const dated = folders.filter(f => /^\d{4}-\d{2}-\d{2}$/.test(f.name)).sort((a,b) => b.name.localeCompare(a.name))[0];
    if (!dated) return { error: "Nessuna cartella datata trovata" };

    // 2. Sotto-cartelle della datata
    const subResp = await fetch(`${BRIDGE}?action=list_folders&folder_id=${dated.id}`);
    const subData = await subResp.json();
    const subs = subData.subfolders || [];
    const profiliFolder = subs.find(f => f.name === "profili");
    const gptRootFolder = subs.find(f => f.name === "gpt");

    // 3. profili/gpt/
    let profiliGptFiles = [];
    if (profiliFolder) {
      const pgResp = await fetch(`${BRIDGE}?action=list_folders&folder_id=${profiliFolder.id}`);
      const pgData = await pgResp.json();
      const gptInProfili = (pgData.subfolders || []).find(f => f.name === "gpt");
      if (gptInProfili) {
        const filesResp = await fetch(`${BRIDGE}?action=list&folder_id=${gptInProfili.id}&max=50`);
        const filesData = await filesResp.json();
        profiliGptFiles = (filesData.files || []).map(f => ({ name: f.name, id: f.id, size: f.size_bytes }));
      }
    }

    // 4. gpt/ (root)
    let gptRootFiles = [];
    if (gptRootFolder) {
      const filesResp = await fetch(`${BRIDGE}?action=list&folder_id=${gptRootFolder.id}&max=50`);
      const filesData = await filesResp.json();
      gptRootFiles = (filesData.files || []).map(f => ({ name: f.name, id: f.id, size: f.size_bytes }));
    }

    return { dated: dated.name, profiliGptFiles, gptRootFiles };
  } catch(e) {
    return { error: e.message };
  }
}

function buildSystemPrompt(driveInfo) {
  let fileList = "";
  if (driveInfo.error) {
    fileList = `ERRORE accesso Drive: ${driveInfo.error}. Rispondi comunque con le informazioni che hai.`;
  } else {
    fileList = `CARTELLA DATATA: ${driveInfo.dated}\n\nFILE CSV FASE 1 (profili/gpt/):\n`;
    for (const f of driveInfo.profiliGptFiles) {
      fileList += `- ${f.name} → file_id="${f.id}" (${Math.round(f.size/1024)}KB)\n`;
    }
    fileList += `\nFILE CSV FASE 3 (gpt/):\n`;
    for (const f of driveInfo.gptRootFiles) {
      fileList += `- ${f.name} → file_id="${f.id}" (${Math.round(f.size/1024)}KB)\n`;
    }
    fileList += `\nUSA DIRETTAMENTE drive_read_file con il file_id mostrato sopra. NON serve navigare le cartelle.`;
  }

  return `Sei UNICAM Research Analyst (Claude Edition), analista di ricerca dell'Universita' di Camerino. Rispondi SEMPRE in italiano.

=== FILE GIA' DISPONIBILI SU GOOGLE DRIVE ===
${fileList}

Per file grandi (>300KB) usa il parametro department per filtrare (es: "Scuola di Scienze e Tecnologie").
Chiama drive_read_file(file_id, max_chars, department) DIRETTAMENTE con il file_id dalla lista sopra.

=== ATENEO ===
P1 (Ambiente Territorio): C1.1=Green Deal Ambiente | C1.2=Infrastrutture Territorio Patrimonio
P2 (Salute Biotec): C2.1=Salute Alimentazione | C2.2=Biotecnologie Farmaceutica
P3 (Digitale Societa'): C3.1=Societa' Inclusiva Cultura | C3.2=Digitale Dati Tecnologie
5 Scuole: Scienze e Tecnologie, Bioscienze e Medicina Veterinaria, Scienze del Farmaco, Architettura e Design, Giurisprudenza.

=== ALGORITMI E SOGLIE ===
METODO A (Softmax): PCT_C1.1...PCT_C3.2. METODO B (Cosine BiTFIDF): cosine_profiles/detail.
Concordano=ROBUSTO. Discordano=INTERDISCIPLINARE.
Matching: BiTFIDF(3)>Vocabolario(2)>Cluster(1).
COSINE: >=0.05 SOLIDO, >=0.08 eccellente. RANK: <=3 TOP, <=10 shortlist.
PCT: >=40% focalizzato, <25% disperso. PUBS>=3 affidabile. DAYS<30 URGENTE.

=== CSV COLONNE ===
authors_profiles: RM_PERSON_ID,LAST_NAME,FIRST_NAME,DEPARTMENT,FASCIA,SSD_2015,SSD_NOME,TOTAL_PUBS,DOMINANT_CLUSTER_WEIGHTED,DOMINANT_CLUSTER_PCT_W,IS_FOCUSED,PCT_C1.1...PCT_C3.2
cosine_detail: RM_PERSON_ID,LAST_NAME,FIRST_NAME,SSD_2015,TOTAL_PUBS,N_TERMINI,COSINE_C1.1...C3.2,SHARED_C1.1...C3.2,TOP_TERMS_C1.1...TOP_TERMS_C3.2
author_vocabularies: RM_PERSON_ID,LAST_NAME,FIRST_NAME,DEPARTMENT,N_TERMS,TOP_TERMS,VOCABULARY
calls_bitfidf: CALL_IDENTIFIER,RM_PERSON_ID,LAST_NAME,FIRST_NAME,DEPARTMENT,COSINE_SCORE,SHARED_TERMS_N,PRECISION,RANK,TOP_SHARED_TERMS
calls_mapped: CALL_IDENTIFIER,TITLE,CALL_STATUS,DEADLINE,DAYS_TO_DEADLINE,PRIMARY_CLUSTER,BUDGET_TOPIC,ACTION_TYPE
dept_cluster: DEPARTMENT,DOMINANT_CLUSTER_WEIGHTED,N
cluster_summary: DOMINANT_CLUSTER_WEIGHTED,N_AUTHORS,AVG_PUBS,AVG_FOCUS

=== PROCEDURE QUERY ===
1. Chi lavora su [tema]? → author_vocabularies (TOP_TERMS) + join authors_profiles
2. Profilo [ricercatore] → authors_profiles + cosine_profiles (concordanza) + calls_bitfidf (top call)
3. Analisi Scuola → dept_cluster + cluster_summary
4. Call attive → calls_mapped (CALL_STATUS=open)
5. Scadenza 30gg → calls_mapped (DAYS<30) + calls_bitfidf (candidati)
6. Dettaglio call → calls_mapped + call_vocabularies + calls_bitfidf
7. Call per [ricercatore] → calls_bitfidf (LAST_NAME, COSINE desc)
8. Chi per call [id] → calls_bitfidf (CALL_IDENTIFIER, RANK asc)
9. Confronto metodi → bitfidf+vocab+cluster per stessa call
10. Gap → call per cluster vs autori per cluster
11. Dispersi → IS_FOCUSED=False AND PCT<25%
12. Scuole deboli → dept_cluster
13. Matrice azione → calls_mapped DAYS<60 x candidati
19. Report: Panoramica→Copertura→Urgenze→Gap→Azioni
23-24. Divulgativi: MAI nomi, MAI codici (C1.1/P1), 200+ parole, word cloud

=== REGOLE ===
- NON inventare dati. Cita file, colonna, valore.
- Per match: SEMPRE cosine, rank, TOP_SHARED_TERMS.
- Chiudi con AZIONI SUGGERITE.
- Alla prima interazione mostra il menu 24 query.`;
}

const TOOLS = [
  { name: "drive_read_file", description: "Legge CSV da Drive. Usa department per filtrare file grandi per Scuola.", input_schema: { type: "object", properties: { file_id: { type: "string", description: "ID del file (dalla lista nel system prompt)" }, max_chars: { type: "integer", default: 100000, description: "Max caratteri. 500000 per file grandi." }, department: { type: "string", description: "Filtra per Scuola, es: Scuola di Scienze e Tecnologie" } }, required: ["file_id"] } }
];

async function readFile(input) {
  const url = new URL(BRIDGE);
  url.searchParams.set("action", "read");
  url.searchParams.set("file_id", input.file_id);
  url.searchParams.set("max_chars", String(input.max_chars || 100000));
  if (input.department) url.searchParams.set("department", input.department);
  const resp = await fetch(url.toString());
  const text = await resp.text();
  return text.length > 400000 ? text.substring(0, 400000) + "\n...[TRONCATO]" : text;
}

export default async (req, context) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });

  const KEY = Netlify.env.get("ANTHROPIC_API_KEY");
  if (!KEY) return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY non configurata" }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });

  try {
    const body = await req.json();
    let messages = body.messages || [];

    // Pre-fetch Drive structure (cached per request)
    const driveInfo = body._driveInfo || await prefetchDriveStructure();
    const systemPrompt = buildSystemPrompt(driveInfo);

    // Agentic loop (max 4 iterations - reduced from 12)
    let finalResponse = null;
    for (let i = 0; i < 4; i++) {
      const apiResp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 8192, system: systemPrompt, tools: TOOLS, messages })
      });
      if (!apiResp.ok) {
        const err = await apiResp.text();
        return new Response(JSON.stringify({ error: "API " + apiResp.status, details: err.substring(0, 500) }), { status: apiResp.status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
      }
      const result = await apiResp.json();

      if (result.stop_reason === "tool_use") {
        messages.push({ role: "assistant", content: result.content });
        const toolResults = [];
        for (const block of result.content) {
          if (block.type === "tool_use") {
            try { toolResults.push({ type: "tool_result", tool_use_id: block.id, content: await readFile(block.input) }); }
            catch (e) { toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify({ error: e.message }), is_error: true }); }
          }
        }
        messages.push({ role: "user", content: toolResults });
      } else { finalResponse = result; break; }
    }

    if (!finalResponse) finalResponse = { content: [{ type: "text", text: "Analisi complessa: riprova con una domanda piu' specifica." }] };
    const text = finalResponse.content.filter(b => b.type === "text").map(b => b.text).join("\n");
    return new Response(JSON.stringify({ response: text, usage: finalResponse.usage, model: finalResponse.model, driveInfo }), {
      status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  }
};

export const config = { path: "/api/claude-chat" };

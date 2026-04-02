import React, { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'

const SUGGESTIONS = [
  "Mostrami il menu completo delle analisi disponibili",
  "Chi lavora su machine learning?",
  "Quali call scadono nei prossimi 30 giorni?",
  "Competenze scoperte: call senza candidati",
  "Genera un report completo: panoramica, urgenze, gap e azioni",
  "Analisi per la Scuola di Architettura e Design",
]

export default function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState("")
  const [error, setError] = useState(null)
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const chatRef = useRef(null)
  const inputRef = useRef(null)
  const recognitionRef = useRef(null)

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages, loading])

  // Pre-warm HF Space al caricamento (lo sveglia se in standby)
  useEffect(() => {
    fetch("https://dilettaromana-unicallmapper.hf.space/api/gpt/bridge?action=list_folders")
      .catch(() => {})
  }, [])

  // Setup Speech Recognition
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SR) {
      const recognition = new SR()
      recognition.lang = "it-IT"
      recognition.continuous = false
      recognition.interimResults = true
      recognition.onresult = (e) => {
        const transcript = Array.from(e.results).map(r => r[0].transcript).join("")
        setInput(transcript)
        if (e.results[0].isFinal) {
          setListening(false)
        }
      }
      recognition.onerror = () => setListening(false)
      recognition.onend = () => setListening(false)
      recognitionRef.current = recognition
    }
  }, [])

  function toggleListening() {
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
    } else if (recognitionRef.current) {
      setInput("")
      recognitionRef.current.start()
      setListening(true)
    }
  }

  function speakText(text) {
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    // Pulisci markdown dal testo
    const clean = text
      .replace(/#{1,6}\s/g, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/`[^`]+`/g, "")
      .replace(/\|[^\n]+\|/g, "")
      .replace(/---+/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[#>*_~`|]/g, "")
      .trim()
    const utterance = new SpeechSynthesisUtterance(clean)
    utterance.lang = "it-IT"
    utterance.rate = 1.0
    utterance.pitch = 1.0
    // Cerca una voce italiana
    const voices = window.speechSynthesis.getVoices()
    const itVoice = voices.find(v => v.lang.startsWith("it"))
    if (itVoice) utterance.voice = itVoice
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    setSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  async function sendMessage(text) {
    if (!text.trim() || loading) return
    setError(null)

    const userMsg = { role: "user", content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput("")
    setLoading(true)
    setLoadingMsg("Analizzo la richiesta...")

    try {
      const apiMessages = newMessages.map(m => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content
      }))

      const payload = JSON.stringify({ messages: apiMessages })

      // Funzione fetch con timeout 55 secondi
      async function callAPI() {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 55000)
        const resp = await fetch("/api/claude-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          signal: controller.signal
        })
        clearTimeout(timer)
        return resp
      }

      // Primo tentativo
      let resp
      try {
        resp = await callAPI()
      } catch (e1) {
        // Se timeout o errore di rete, riprova una volta (lo Space HF potrebbe essere in standby)
        setLoadingMsg("Il servizio si sta avviando... Riprovo automaticamente...")
        try {
          resp = await callAPI()
        } catch (e2) {
          throw new Error("Il servizio non risponde. Riprova tra qualche secondo.")
        }
      }

      if (!resp.ok) {
        if (resp.status === 504) {
          // Timeout Netlify — riprova
          setLoadingMsg("Timeout, riprovo...")
          try {
            resp = await callAPI()
          } catch (e3) {
            throw new Error("L'analisi richiede troppo tempo. Prova con una domanda piu' semplice.")
          }
          if (!resp.ok) throw new Error("L'analisi richiede troppo tempo. Prova con una domanda piu' semplice.")
        } else {
          const err = await resp.json().catch(() => ({ error: "Errore server" }))
          throw new Error(err.error || err.details || `Errore HTTP ${resp.status}`)
        }
      }

      const data = await resp.json()
      setMessages([...newMessages, {
        role: "assistant",
        content: data.response,
        usage: data.usage,
        model: data.model
      }])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
      setLoadingMsg("")
      inputRef.current?.focus()
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    sendMessage(input)
  }

  function handleSuggestion(text) {
    sendMessage(text)
  }

  function clearChat() {
    setMessages([])
    setError(null)
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <svg viewBox="0 0 24 24" style={styles.logo}>
            <path fill="#fff" d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18L19.35 7.5 12 10.82 4.65 7.5 12 4.18zM4 8.82l7 3.5V19l-7-3.5V8.82zm9 10.18V12.32l7-3.5V15.5l-7 3.5z"/>
          </svg>
          <div>
            <div style={styles.headerTitle}>UNICAM Research Analyst</div>
            <div style={styles.headerSub}>Powered by Claude — Universita' di Camerino</div>
          </div>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.badge}>Claude Sonnet</div>
          <button onClick={clearChat} style={styles.clearBtn} title="Nuova conversazione">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <div ref={chatRef} style={styles.chatArea}>
        {messages.length === 0 && !loading && (
          <div style={styles.welcome}>
            <div style={styles.welcomeIcon}>
              <svg viewBox="0 0 24 24" width="48" height="48" fill="#2E75B6">
                <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18L19.35 7.5 12 10.82 4.65 7.5 12 4.18zM4 8.82l7 3.5V19l-7-3.5V8.82zm9 10.18V12.32l7-3.5V15.5l-7 3.5z"/>
              </svg>
            </div>
            <h2 style={styles.welcomeTitle}>UNICAM Research Analyst</h2>
            <p style={styles.welcomeText}>
              Accedo ai dati della pipeline su Google Drive in tempo reale.
              Profili autori, matching call Horizon Europe, gap analysis, report.
            </p>
            <div style={styles.suggestions}>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => handleSuggestion(s)} style={styles.suggestionBtn}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{
            ...styles.messageRow,
            justifyContent: msg.role === "user" ? "flex-end" : "flex-start"
          }}>
            {msg.role === "assistant" && (
              <div style={styles.avatar}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff">
                  <path d="M12 2L2 7v10l10 5 10-5V7L12 2z"/>
                </svg>
              </div>
            )}
            <div style={{
              ...styles.messageBubble,
              ...(msg.role === "user" ? styles.userBubble : styles.assistantBubble)
            }}>
              {msg.role === "assistant" ? (
                <div style={styles.markdown}>
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <div>{msg.content}</div>
              )}
              {msg.role === "assistant" && (
                <div style={styles.msgActions}>
                  <button onClick={() => speakText(msg.content)} style={styles.speakBtn}
                    title={speaking ? "Ferma lettura" : "Ascolta risposta"}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                      {speaking
                        ? <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                        : <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                      }
                    </svg>
                    <span style={{fontSize:"10px",marginLeft:"4px"}}>{speaking ? "Stop" : "Ascolta"}</span>
                  </button>
                  {msg.usage && (
                    <span style={styles.usageInline}>
                      {msg.model?.replace("claude-sonnet-4-20250514","Sonnet")} | {msg.usage.input_tokens + msg.usage.output_tokens} tok
                    </span>
                  )}
                </div>
              )}
              {msg.role === "user" && msg.usage && (
                <div style={styles.usage}>
                  {msg.usage.input_tokens + msg.usage.output_tokens} tokens
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div style={styles.avatarUser}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="#fff">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={styles.messageRow}>
            <div style={styles.avatar}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff">
                <path d="M12 2L2 7v10l10 5 10-5V7L12 2z"/>
              </svg>
            </div>
            <div style={{...styles.messageBubble, ...styles.assistantBubble}}>
              <div style={styles.typing}>
                <span style={{...styles.dot, animationDelay: "0s"}}></span>
                <span style={{...styles.dot, animationDelay: "0.2s"}}></span>
                <span style={{...styles.dot, animationDelay: "0.4s"}}></span>
                <span style={styles.typingText}>{loadingMsg || "Sto analizzando i dati su Google Drive..."}</span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div style={styles.errorBox}>
            <strong>Errore:</strong> {error}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div style={styles.inputArea}>
        <form onSubmit={handleSubmit} style={styles.inputForm}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={listening ? "Sto ascoltando..." : "Scrivi o parla..."}
            style={{...styles.input, ...(listening ? {borderColor: "#EF4444", boxShadow: "0 0 0 2px rgba(239,68,68,0.2)"} : {})}}
            disabled={loading}
          />
          {/* Mic button */}
          <button type="button" onClick={toggleListening} disabled={loading} style={{
            ...styles.micBtn,
            background: listening ? "linear-gradient(135deg, #EF4444, #DC2626)" : "linear-gradient(135deg, #6B7280, #4B5563)",
            opacity: loading ? 0.5 : 1,
            animation: listening ? "pulse-mic 1.5s infinite" : "none"
          }} title={listening ? "Ferma registrazione" : "Parla"}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="#fff">
              {listening
                ? <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                : <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
              }
            </svg>
          </button>
          {/* Send button */}
          <button type="submit" disabled={loading || !input.trim()} style={{
            ...styles.sendBtn,
            opacity: loading || !input.trim() ? 0.5 : 1
          }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </form>
        <div style={styles.disclaimer}>
          UNICAM Research Analyst utilizza Claude di Anthropic. I dati sono letti da Google Drive in tempo reale.
        </div>
      </div>

      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0f2f5; }
        @keyframes blink { 0%,100%{opacity:.3} 50%{opacity:1} }
        @keyframes pulse-mic { 0%{box-shadow:0 0 0 0 rgba(239,68,68,0.4)} 70%{box-shadow:0 0 0 10px rgba(239,68,68,0)} 100%{box-shadow:0 0 0 0 rgba(239,68,68,0)} }
        .markdown-body h1,.markdown-body h2,.markdown-body h3 { color: #1B3A5C; margin: 12px 0 6px; }
        .markdown-body p { margin: 4px 0; line-height: 1.6; }
        .markdown-body ul,.markdown-body ol { padding-left: 20px; margin: 4px 0; }
        .markdown-body li { margin: 2px 0; }
        .markdown-body code { background: #f0f2f5; padding: 1px 5px; border-radius: 3px; font-size: 13px; }
        .markdown-body pre { background: #f0f2f5; padding: 12px; border-radius: 6px; overflow-x: auto; margin: 8px 0; }
        .markdown-body pre code { background: none; padding: 0; }
        .markdown-body table { border-collapse: collapse; margin: 8px 0; width: 100%; font-size: 13px; }
        .markdown-body th { background: #E8EEF3; padding: 6px 10px; border: 1px solid #ddd; text-align: left; font-weight: 600; color: #1B3A5C; }
        .markdown-body td { padding: 6px 10px; border: 1px solid #ddd; }
        .markdown-body strong { color: #1B3A5C; }
        .markdown-body em { color: #666; }
        .markdown-body blockquote { border-left: 3px solid #2E75B6; padding-left: 12px; color: #555; margin: 8px 0; }
        .markdown-body hr { border: none; border-top: 1px solid #ddd; margin: 12px 0; }
      `}</style>
    </div>
  )
}

const styles = {
  container: {
    display: "flex", flexDirection: "column", height: "100vh", maxWidth: "900px",
    margin: "0 auto", background: "#fff", boxShadow: "0 0 30px rgba(0,0,0,.1)"
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "12px 20px", background: "linear-gradient(135deg, #1B3A5C, #2E75B6)",
    color: "#fff", flexShrink: 0
  },
  headerLeft: { display: "flex", alignItems: "center", gap: "12px" },
  logo: { width: "32px", height: "32px" },
  headerTitle: { fontSize: "16px", fontWeight: "700", letterSpacing: ".3px" },
  headerSub: { fontSize: "11px", opacity: 0.8 },
  headerRight: { display: "flex", alignItems: "center", gap: "10px" },
  badge: {
    fontSize: "10px", fontWeight: "600", padding: "3px 10px", borderRadius: "12px",
    background: "rgba(255,255,255,.2)", color: "#fff"
  },
  clearBtn: {
    background: "rgba(255,255,255,.15)", border: "none", color: "#fff", borderRadius: "50%",
    width: "32px", height: "32px", cursor: "pointer", display: "flex",
    alignItems: "center", justifyContent: "center"
  },
  chatArea: {
    flex: 1, overflowY: "auto", padding: "20px", display: "flex",
    flexDirection: "column", gap: "12px", background: "#fafbfc"
  },
  welcome: {
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", flex: 1, padding: "20px", textAlign: "center"
  },
  welcomeIcon: { marginBottom: "16px", opacity: 0.8 },
  welcomeTitle: { fontSize: "22px", fontWeight: "700", color: "#1B3A5C", marginBottom: "8px" },
  welcomeText: { fontSize: "14px", color: "#666", maxWidth: "500px", lineHeight: 1.6, marginBottom: "24px" },
  suggestions: {
    display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center", maxWidth: "600px"
  },
  suggestionBtn: {
    background: "#fff", border: "1px solid #d0d5dd", borderRadius: "20px", padding: "8px 16px",
    fontSize: "13px", color: "#475569", cursor: "pointer", transition: "all .15s",
    textAlign: "left", lineHeight: 1.4
  },
  messageRow: { display: "flex", gap: "8px", alignItems: "flex-start" },
  avatar: {
    width: "32px", height: "32px", borderRadius: "50%",
    background: "linear-gradient(135deg, #1B3A5C, #2E75B6)",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
  },
  avatarUser: {
    width: "32px", height: "32px", borderRadius: "50%", background: "#6B7280",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
  },
  messageBubble: {
    maxWidth: "75%", padding: "12px 16px", borderRadius: "16px",
    fontSize: "14px", lineHeight: 1.6, wordBreak: "break-word"
  },
  userBubble: {
    background: "#1B3A5C", color: "#fff", borderBottomRightRadius: "4px"
  },
  assistantBubble: {
    background: "#fff", color: "#333", border: "1px solid #e5e7eb",
    borderBottomLeftRadius: "4px", boxShadow: "0 1px 3px rgba(0,0,0,.05)"
  },
  markdown: { className: "markdown-body" },
  usage: { fontSize: "10px", color: "#999", marginTop: "6px", textAlign: "right" },
  typing: { display: "flex", alignItems: "center", gap: "4px" },
  dot: {
    width: "8px", height: "8px", borderRadius: "50%", background: "#2E75B6",
    animation: "blink 1s infinite", display: "inline-block"
  },
  typingText: { fontSize: "13px", color: "#888", marginLeft: "8px" },
  errorBox: {
    background: "#FEE2E2", border: "1px solid #EF4444", borderRadius: "8px",
    padding: "12px 16px", color: "#991B1B", fontSize: "13px"
  },
  inputArea: { padding: "12px 20px 16px", borderTop: "1px solid #e5e7eb", background: "#fff", flexShrink: 0 },
  inputForm: { display: "flex", gap: "8px" },
  input: {
    flex: 1, padding: "12px 16px", border: "1px solid #d0d5dd", borderRadius: "24px",
    fontSize: "14px", outline: "none", transition: "border .2s",
    fontFamily: "inherit"
  },
  sendBtn: {
    width: "44px", height: "44px", borderRadius: "50%",
    background: "linear-gradient(135deg, #1B3A5C, #2E75B6)",
    border: "none", cursor: "pointer", display: "flex",
    alignItems: "center", justifyContent: "center", transition: "all .15s"
  },
  micBtn: {
    width: "44px", height: "44px", borderRadius: "50%",
    border: "none", cursor: "pointer", display: "flex",
    alignItems: "center", justifyContent: "center", transition: "all .15s",
    flexShrink: 0
  },
  msgActions: {
    display: "flex", alignItems: "center", gap: "8px", marginTop: "6px",
    paddingTop: "6px", borderTop: "1px solid #f0f0f0"
  },
  speakBtn: {
    display: "flex", alignItems: "center", gap: "2px",
    background: "none", border: "1px solid #d0d5dd", borderRadius: "14px",
    padding: "3px 10px", cursor: "pointer", color: "#666",
    fontSize: "11px", transition: "all .15s"
  },
  usageInline: {
    fontSize: "10px", color: "#999"
  },
  disclaimer: {
    fontSize: "10px", color: "#999", textAlign: "center", marginTop: "8px"
  }
}

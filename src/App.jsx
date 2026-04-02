import React, { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'

const SUGGESTIONS = [
  "Mostrami il menu completo delle analisi disponibili",
  "Chi lavora su machine learning?",
  "Quali call scadono nei prossimi 30 giorni?",
  "Profilo completo di Michele Loreti",
  "Genera un report completo: panoramica, urgenze, gap e azioni",
  "Analisi per la Scuola di Architettura e Design",
]

export default function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const chatRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages, loading])

  async function sendMessage(text) {
    if (!text.trim() || loading) return
    setError(null)

    const userMsg = { role: "user", content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput("")
    setLoading(true)

    try {
      // Build conversation for API (only role + content)
      const apiMessages = newMessages.map(m => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content
      }))

      const resp = await fetch("/api/claude-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages })
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Errore di rete" }))
        throw new Error(err.error || err.details || `HTTP ${resp.status}`)
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
              {msg.usage && (
                <div style={styles.usage}>
                  {msg.model} | {msg.usage.input_tokens + msg.usage.output_tokens} tokens
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
                <span style={styles.typingText}>Sto analizzando i dati su Google Drive...</span>
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
            placeholder="Scrivi una domanda sui dati UNICAM..."
            style={styles.input}
            disabled={loading}
          />
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
  disclaimer: {
    fontSize: "10px", color: "#999", textAlign: "center", marginTop: "8px"
  }
}

import { useState, useEffect, useRef } from "react";
import Head from "next/head";

const SIDEBAR_BG = "#171717";
const SIDEBAR_HOVER = "#212121";
const MAIN_BG = "#FFFFFF";
const ASSISTANT_BG = "#F7F7F8";
const BORDER = "#E5E5E5";
const TEXT_PRIMARY = "#1A1A1A";
const TEXT_MUTED = "#8E8E8E";
const ACCENT = "#189CB1";

export default function Home() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi! I'm Artora AI. Ask me anything about Artora, client hunting, or your business — I'll reply in whichever language you write in.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [kbOpen, setKbOpen] = useState(false);
  const [kbEntries, setKbEntries] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    loadKB();
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  async function loadKB() {
    try {
      const res = await fetch("/api/kb");
      const data = await res.json();
      setKbEntries(data.entries || []);
    } catch {
      setKbEntries([]);
    }
  }

  async function addEntry() {
    if (!newTitle.trim() || !newContent.trim()) return;
    try {
      const res = await fetch("/api/kb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), content: newContent.trim() }),
      });
      const data = await res.json();
      setKbEntries(data.entries || []);
      setNewTitle("");
      setNewContent("");
    } catch {
      setErrorMsg("Entry save nahi hui.");
    }
  }

  async function deleteEntry(id) {
    try {
      const res = await fetch("/api/kb", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      setKbEntries(data.entries || []);
    } catch {
      setErrorMsg("Entry delete nahi hui.");
    }
  }

  function newChat() {
    setMessages([
      {
        role: "assistant",
        content: "Hi! I'm Artora AI. Ask me anything about Artora, client hunting, or your business — I'll reply in whichever language you write in.",
      },
    ]);
    setErrorMsg("");
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;
    setErrorMsg("");
    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, webSearchEnabled: webSearch }),
      });
      const data = await res.json();
      if (data.error) {
        setErrorMsg(data.error);
        setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong." }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      }
    } catch (e) {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <>
      <Head>
        <title>Artora AI</title>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </Head>
      <div style={styles.app}>
        {/* Sidebar */}
        <div style={{ ...styles.sidebar, ...(kbOpen ? {} : styles.sidebarClosed) }}>
          <div style={styles.sidebarTop}>
            <button onClick={newChat} style={styles.newChatBtn}>
              <span style={{ fontSize: 16 }}>+</span> New chat
            </button>
            <button onClick={() => setKbOpen(false)} style={styles.sidebarCloseBtn}>
              ✕
            </button>
          </div>

          <div style={styles.kbSection}>
            <div style={styles.kbSectionTitle}>Knowledge base</div>
            <p style={styles.kbSectionSub}>
              Shared with your whole team. Add anything you want the assistant to know.
            </p>
            <div style={styles.addBox}>
              <input
                placeholder="Title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                style={styles.input}
              />
              <textarea
                placeholder="Content"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                style={{ ...styles.input, minHeight: 60, resize: "vertical" }}
              />
              <button onClick={addEntry} style={styles.addBtn}>
                Add entry
              </button>
            </div>
            <div style={styles.kbList}>
              {kbEntries.length === 0 && <div style={styles.emptyText}>No entries yet.</div>}
              {kbEntries.map((e) => (
                <div key={e.id} style={styles.kbItem}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.kbTitle}>{e.title}</div>
                    <div style={styles.kbContent}>{e.content}</div>
                  </div>
                  <button onClick={() => deleteEntry(e.id)} style={styles.kbDeleteBtn}>
                    🗑
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main */}
        <div style={styles.main}>
          <div style={styles.topbar}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {!kbOpen && (
                <button onClick={() => setKbOpen(true)} style={styles.menuBtn}>
                  ☰
                </button>
              )}
              <span style={styles.brandName}>Artora AI</span>
            </div>
            <button
              onClick={() => setWebSearch((v) => !v)}
              style={{ ...styles.toggleBtn, ...(webSearch ? styles.toggleBtnActive : {}) }}
            >
              🌐 {webSearch ? "Search on" : "Search off"}
            </button>
          </div>

          <div ref={scrollRef} style={styles.chatArea}>
            <div style={styles.chatInner}>
              {messages.map((m, i) => (
                <div
                  key={i}
                  style={{
                    ...styles.msgRow,
                    background: m.role === "assistant" ? ASSISTANT_BG : "transparent",
                  }}
                >
                  <div style={styles.msgInner}>
                    <div
                      style={{
                        ...styles.avatar,
                        background: m.role === "assistant" ? ACCENT : "#E5E5E5",
                        color: m.role === "assistant" ? "#fff" : TEXT_PRIMARY,
                      }}
                    >
                      {m.role === "assistant" ? "A" : "U"}
                    </div>
                    <div style={styles.msgText}>{m.content}</div>
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ ...styles.msgRow, background: ASSISTANT_BG }}>
                  <div style={styles.msgInner}>
                    <div style={{ ...styles.avatar, background: ACCENT, color: "#fff" }}>A</div>
                    <div style={{ ...styles.msgText, color: TEXT_MUTED }}>Thinking...</div>
                  </div>
                </div>
              )}
              {errorMsg && <div style={styles.errorBox}>{errorMsg}</div>}
            </div>
          </div>

          <div style={styles.inputBarWrap}>
            <div style={styles.inputBar}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message Artora AI..."
                style={styles.textInput}
                rows={1}
              />
              <button onClick={sendMessage} disabled={loading || !input.trim()} style={styles.sendBtn}>
                ↑
              </button>
            </div>
          </div>
        </div>
      </div>
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }
        body {
          margin: 0;
          font-family: Inter, system-ui, sans-serif;
        }
        textarea:focus,
        input:focus {
          outline: none;
          border-color: ${ACCENT} !important;
        }
        textarea {
          font-family: inherit;
        }
      `}</style>
    </>
  );
}

const styles = {
  app: { display: "flex", height: "100vh", background: MAIN_BG, color: TEXT_PRIMARY, overflow: "hidden" },
  sidebar: {
    width: 280,
    background: SIDEBAR_BG,
    color: "#ECECEC",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    transition: "width 0.15s ease",
  },
  sidebarClosed: { width: 0, overflow: "hidden" },
  sidebarTop: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderBottom: "1px solid #2A2A2A",
  },
  newChatBtn: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "transparent",
    border: "1px solid #3A3A3A",
    color: "#ECECEC",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 13,
    cursor: "pointer",
    textAlign: "left",
  },
  sidebarCloseBtn: {
    background: "transparent",
    border: "none",
    color: TEXT_MUTED,
    cursor: "pointer",
    fontSize: 14,
    padding: 8,
  },
  kbSection: { flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 },
  kbSectionTitle: { fontSize: 12, fontWeight: 600, color: "#ECECEC", textTransform: "uppercase", letterSpacing: 0.5 },
  kbSectionSub: { fontSize: 11, color: "#8E8E8E", lineHeight: 1.5, margin: "0 0 4px" },
  addBox: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    background: "#212121",
    padding: 10,
    borderRadius: 8,
    border: "1px solid #2A2A2A",
  },
  input: {
    background: "#171717",
    border: "1px solid #3A3A3A",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 12,
    color: "#ECECEC",
  },
  addBtn: {
    background: ACCENT,
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
  },
  kbList: { display: "flex", flexDirection: "column", gap: 6 },
  kbItem: {
    display: "flex",
    gap: 6,
    background: "#212121",
    border: "1px solid #2A2A2A",
    borderRadius: 8,
    padding: 8,
    alignItems: "flex-start",
  },
  kbTitle: { fontSize: 12, fontWeight: 500, marginBottom: 2, color: "#7DE0EE" },
  kbContent: {
    fontSize: 11,
    color: "#8E8E8E",
    overflow: "hidden",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
  },
  kbDeleteBtn: { background: "transparent", border: "none", color: "#8E8E8E", cursor: "pointer", fontSize: 12 },
  emptyText: { fontSize: 11, color: "#6B6B6B", textAlign: "center", padding: 12 },
  main: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },
  topbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 20px",
    borderBottom: `1px solid ${BORDER}`,
  },
  menuBtn: { background: "transparent", border: "none", color: TEXT_PRIMARY, cursor: "pointer", fontSize: 18 },
  brandName: { fontWeight: 600, fontSize: 15 },
  toggleBtn: {
    background: "transparent",
    border: `1px solid ${BORDER}`,
    color: TEXT_MUTED,
    borderRadius: 20,
    padding: "6px 12px",
    fontSize: 12,
    cursor: "pointer",
  },
  toggleBtnActive: { background: "rgba(24,156,177,0.1)", border: `1px solid ${ACCENT}`, color: ACCENT },
  chatArea: { flex: 1, overflowY: "auto" },
  chatInner: { maxWidth: 760, margin: "0 auto" },
  msgRow: { width: "100%", padding: "20px 24px" },
  msgInner: { display: "flex", gap: 16, maxWidth: 760, margin: "0 auto" },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 600,
    flexShrink: 0,
  },
  msgText: { fontSize: 15, lineHeight: 1.7, whiteSpace: "pre-wrap", paddingTop: 3 },
  errorBox: { fontSize: 12, color: "#E24B4A", padding: "8px 24px" },
  inputBarWrap: { padding: "12px 24px 20px", borderTop: `1px solid ${BORDER}` },
  inputBar: {
    maxWidth: 760,
    margin: "0 auto",
    display: "flex",
    gap: 10,
    alignItems: "flex-end",
    background: ASSISTANT_BG,
    border: `1px solid ${BORDER}`,
    borderRadius: 16,
    padding: "10px 10px 10px 16px",
  },
  textInput: {
    flex: 1,
    background: "transparent",
    border: "none",
    color: TEXT_PRIMARY,
    fontSize: 15,
    resize: "none",
    maxHeight: 160,
    lineHeight: 1.5,
    padding: "6px 0",
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: ACCENT,
    border: "none",
    cursor: "pointer",
    fontSize: 16,
    color: "#fff",
    flexShrink: 0,
  },
};

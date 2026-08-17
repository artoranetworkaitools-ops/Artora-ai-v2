import { useState, useEffect, useRef, Fragment } from "react";
import Head from "next/head";

const SIDEBAR_BG = "#171717";
const ROW_ACTIVE = "#2A2A2A";
const MAIN_BG = "#FFFFFF";
const BORDER = "#E5E5E5";
const TEXT_PRIMARY = "#0D0D0D";
const TEXT_MUTED = "#8E8E8E";
const ACCENT = "#189CB1";

const WELCOME = { role: "assistant", content: "Hi! I'm Artora AI. Ask me anything — I'll reply in whichever language you write in." };

function newConvo() {
  return { id: Date.now().toString(), title: "New chat", messages: [WELCOME] };
}

// Lightweight markdown renderer: bold, headers, bullet/numbered lists, paragraphs.
// Deliberately dependency-free so the build never breaks over a missing package.
function renderMarkdown(text) {
  const lines = text.split("\n");
  const blocks = [];
  let listBuffer = [];
  let listType = null;

  function flushList() {
    if (listBuffer.length === 0) return;
    const Tag = listType === "ol" ? "ol" : "ul";
    blocks.push(
      <Tag key={blocks.length} style={{ margin: "6px 0", paddingLeft: 22 }}>
        {listBuffer.map((item, i) => (
          <li key={i} style={{ marginBottom: 4 }}>{renderInline(item)}</li>
        ))}
      </Tag>
    );
    listBuffer = [];
    listType = null;
  }

  function renderInline(str) {
    const parts = str.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return <Fragment key={i}>{part}</Fragment>;
    });
  }

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    const headerMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    const numberedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/);

    if (headerMatch) {
      flushList();
      const level = headerMatch[1].length;
      const size = level === 1 ? 19 : level === 2 ? 17 : 16;
      blocks.push(
        <div key={blocks.length} style={{ fontWeight: 600, fontSize: size, margin: "12px 0 4px" }}>
          {renderInline(headerMatch[2])}
        </div>
      );
    } else if (numberedMatch) {
      if (listType !== "ol") flushList();
      listType = "ol";
      listBuffer.push(numberedMatch[1]);
    } else if (bulletMatch) {
      if (listType !== "ul") flushList();
      listType = "ul";
      listBuffer.push(bulletMatch[1]);
    } else if (trimmed === "") {
      flushList();
      blocks.push(<div key={blocks.length} style={{ height: 8 }} />);
    } else {
      flushList();
      blocks.push(
        <div key={blocks.length} style={{ marginBottom: 4 }}>
          {renderInline(line)}
        </div>
      );
    }
  });
  flushList();
  return blocks;
}

export default function Home() {
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  const [convos, setConvos] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [deepResearch, setDeepResearch] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [kbModalOpen, setKbModalOpen] = useState(false);
  const [kbEntries, setKbEntries] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      setUser(data.user);
      if (data.user) initConvos();
    } catch {
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }

  function initConvos() {
    let saved = [];
    try {
      saved = JSON.parse(localStorage.getItem("artora-ai-convos") || "[]");
    } catch {
      saved = [];
    }
    if (saved.length === 0) saved = [newConvo()];
    setConvos(saved);
    setActiveId(saved[0].id);
    loadKB();
  }

  useEffect(() => {
    if (convos.length > 0) localStorage.setItem("artora-ai-convos", JSON.stringify(convos));
  }, [convos]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [convos, activeId, loading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  async function handleAuthSubmit() {
    setAuthError("");
    if (!authEmail.trim() || !authPassword.trim() || (authMode === "signup" && !authName.trim())) {
      setAuthError("Sab fields bharein.");
      return;
    }
    setAuthBusy(true);
    try {
      const url = authMode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const body =
        authMode === "signup"
          ? { name: authName.trim(), email: authEmail.trim(), password: authPassword }
          : { email: authEmail.trim(), password: authPassword };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) {
        setAuthError(data.error);
      } else {
        setUser(data.user);
        initConvos();
      }
    } catch {
      setAuthError("Network error. Dobara try karein.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setConvos([]);
  }

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
      if (data.error) {
        setErrorMsg(data.error);
      } else {
        setKbEntries(data.entries || []);
        setNewTitle("");
        setNewContent("");
      }
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

  const activeConvo = convos.find((c) => c.id === activeId) || convos[0];

  function startNewChat() {
    const c = newConvo();
    setConvos((prev) => [c, ...prev]);
    setActiveId(c.id);
    setErrorMsg("");
    if (isMobile) setSidebarOpen(false);
  }

  function selectConvo(id) {
    setActiveId(id);
    if (isMobile) setSidebarOpen(false);
  }

  function deleteConvo(id, e) {
    e.stopPropagation();
    setConvos((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      if (updated.length === 0) {
        const c = newConvo();
        setActiveId(c.id);
        return [c];
      }
      if (id === activeId) setActiveId(updated[0].id);
      return updated;
    });
  }

  function updateConvoMessages(id, messages, title) {
    setConvos((prev) => prev.map((c) => (c.id === id ? { ...c, messages, title: title || c.title } : c)));
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading || !activeConvo) return;
    setErrorMsg("");
    const newMessages = [...activeConvo.messages, { role: "user", content: text }];
    const title = activeConvo.title === "New chat" ? text.slice(0, 40) : activeConvo.title;
    updateConvoMessages(activeConvo.id, newMessages, title);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, webSearchEnabled: webSearch, deepResearch }),
      });
      const data = await res.json();
      if (data.error) {
        setErrorMsg(data.error);
        updateConvoMessages(activeConvo.id, [...newMessages, { role: "assistant", content: "Sorry, something went wrong." }]);
      } else {
        updateConvoMessages(activeConvo.id, [...newMessages, { role: "assistant", content: data.reply }]);
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey && !isMobile) {
      e.preventDefault();
      sendMessage();
    }
  }

  const headTags = (
    <Head>
      <title>Artora AI</title>
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
    </Head>
  );

  if (authLoading) {
    return (
      <div style={styles.authLoadingScreen}>
        <div style={styles.logoDotBig} />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        {headTags}
        <div style={styles.authScreen}>
          <div className="auth-card" style={styles.authCard}>
            <div style={styles.authBrandRow}>
              <div style={styles.logoDot} />
              <span style={styles.authBrandText}>Artora AI</span>
            </div>
            <h2 style={styles.authTitle}>{authMode === "login" ? "Welcome back" : "Create your account"}</h2>
            {authMode === "signup" && (
              <input placeholder="Full name" value={authName} onChange={(e) => setAuthName(e.target.value)} style={styles.authInput} />
            )}
            <input placeholder="Email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} style={styles.authInput} />
            <input
              placeholder="Password"
              type="password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAuthSubmit()}
              style={styles.authInput}
            />
            {authError && <div style={styles.authError}>{authError}</div>}
            <button onClick={handleAuthSubmit} disabled={authBusy} style={styles.authSubmitBtn}>
              {authBusy ? "..." : authMode === "login" ? "Log in" : "Sign up"}
            </button>
            <div style={styles.authSwitchRow}>
              {authMode === "login" ? (
                <>Naya account? <span style={styles.authSwitchLink} onClick={() => { setAuthMode("signup"); setAuthError(""); }}>Sign up</span></>
              ) : (
                <>Already an account? <span style={styles.authSwitchLink} onClick={() => { setAuthMode("login"); setAuthError(""); }}>Log in</span></>
              )}
            </div>
          </div>
        </div>
        <style jsx global>{`
          * { box-sizing: border-box; }
          body { margin: 0; font-family: Inter, system-ui, sans-serif; }
          input:focus { outline: none; border-color: ${ACCENT} !important; }
          @media (max-width: 480px) {
            .auth-card { width: 100% !important; max-width: 100% !important; border-radius: 0 !important; height: 100vh; justify-content: center; }
          }
        `}</style>
      </>
    );
  }

  if (!activeConvo) return null;

  return (
    <>
      {headTags}
      <div style={styles.app}>
        {isMobile && sidebarOpen && <div style={styles.mobileOverlay} onClick={() => setSidebarOpen(false)} />}

        <div
          className="sidebar"
          style={{
            ...styles.sidebar,
            ...(isMobile ? styles.sidebarMobile : {}),
            ...(sidebarOpen ? {} : isMobile ? styles.sidebarMobileClosed : styles.sidebarClosed),
          }}
        >
          <div style={styles.sidebarHeader}>
            <div style={styles.brandRow}>
              <div style={styles.logoDot} />
              <span style={styles.brandText}>Artora AI</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} style={styles.iconBtnGhost}>‹</button>
          </div>

          <button onClick={startNewChat} style={styles.newChatBtn}>
            <span style={{ fontSize: 15 }}>+</span> New chat
          </button>

          {user.role === "admin" && (
            <button onClick={() => { setKbModalOpen(true); if (isMobile) setSidebarOpen(false); }} style={styles.kbNavBtn}>
              <span>⚙️</span> Admin — train AI
            </button>
          )}

          <div style={styles.recentsLabel}>Recents</div>
          <div style={styles.convoList}>
            {convos.map((c) => (
              <div
                key={c.id}
                onClick={() => selectConvo(c.id)}
                style={{ ...styles.convoItem, background: c.id === activeId ? ROW_ACTIVE : "transparent" }}
              >
                <span style={styles.convoTitle}>{c.title}</span>
                <button onClick={(e) => deleteConvo(c.id, e)} style={styles.convoDeleteBtn}>✕</button>
              </div>
            ))}
          </div>

          <div style={styles.sidebarFooter}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 500, color: "#ECECEC" }}>{user.name}</div>
                <div style={{ fontSize: 10 }}>{user.role === "admin" ? "Admin" : "Member"}</div>
              </div>
              <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
            </div>
          </div>
        </div>

        <div style={styles.main}>
          <div className="topbar" style={styles.topbar}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              {!sidebarOpen && <button onClick={() => setSidebarOpen(true)} style={styles.menuBtn}>☰</button>}
              <span className="topbar-title" style={styles.topbarTitle}>{activeConvo.title}</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {webSearch && <span style={styles.activePill}>🌐 Search</span>}
              {deepResearch && <span style={styles.activePill}>🔎 Research</span>}
            </div>
          </div>

          <div ref={scrollRef} style={styles.chatArea}>
            <div className="chat-inner" style={styles.chatInner}>
              {activeConvo.messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="msg-row-user" style={styles.msgRowUser}>
                    <div className="user-bubble" style={styles.userBubble}>{m.content}</div>
                  </div>
                ) : (
                  <div key={i} className="msg-row-assistant" style={styles.msgRowAssistant}>
                    <div className="assistant-text" style={styles.assistantText}>{renderMarkdown(m.content)}</div>
                  </div>
                )
              )}
              {loading && (
                <div className="msg-row-assistant" style={styles.msgRowAssistant}>
                  <div style={{ ...styles.assistantText, color: TEXT_MUTED }}>
                    {deepResearch ? "Researching thoroughly..." : "Thinking..."}
                  </div>
                </div>
              )}
              {errorMsg && <div style={styles.errorBox}>{errorMsg}</div>}
            </div>
          </div>

          <div className="input-bar-wrap" style={styles.inputBarWrap}>
            <div className="input-bar" style={{ ...styles.inputBar, position: "relative" }}>
              <button
                onClick={() => setPlusMenuOpen((v) => !v)}
                style={styles.plusBtn}
                type="button"
              >
                +
              </button>
              {plusMenuOpen && (
                <>
                  <div style={styles.plusMenuOverlay} onClick={() => setPlusMenuOpen(false)} />
                  <div style={styles.plusMenu}>
                    <button
                      onClick={() => { setWebSearch((v) => !v); setPlusMenuOpen(false); }}
                      style={{ ...styles.plusMenuItem, ...(webSearch ? styles.plusMenuItemActive : {}) }}
                    >
                      <span>🌐</span>
                      <span style={{ flex: 1, textAlign: "left" }}>
                        <div style={{ fontWeight: 500 }}>Web search</div>
                        <div style={{ fontSize: 11, color: TEXT_MUTED }}>Find real-time info from Google</div>
                      </span>
                      {webSearch && <span style={{ color: ACCENT }}>✓</span>}
                    </button>
                    <button
                      onClick={() => { setDeepResearch((v) => !v); setPlusMenuOpen(false); }}
                      style={{ ...styles.plusMenuItem, ...(deepResearch ? styles.plusMenuItemActive : {}) }}
                    >
                      <span>🔎</span>
                      <span style={{ flex: 1, textAlign: "left" }}>
                        <div style={{ fontWeight: 500 }}>Deep research</div>
                        <div style={{ fontSize: 11, color: TEXT_MUTED }}>Thorough, well-checked answers</div>
                      </span>
                      {deepResearch && <span style={{ color: ACCENT }}>✓</span>}
                    </button>
                  </div>
                </>
              )}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything..."
                style={styles.textInput}
                rows={1}
              />
              <button onClick={sendMessage} disabled={loading || !input.trim()} style={styles.sendBtn}>↑</button>
            </div>
            <div className="disclaimer" style={styles.disclaimer}>Artora AI can make mistakes. Check important info.</div>
          </div>
        </div>

        {kbModalOpen && user.role === "admin" && (
          <div style={styles.modalOverlay} onClick={() => setKbModalOpen(false)}>
            <div className="modal" style={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <span style={{ fontWeight: 600, fontSize: 16 }}>Train Artora AI (Admin)</span>
                <button onClick={() => setKbModalOpen(false)} style={styles.iconBtnGhostDark}>✕</button>
              </div>
              <p style={styles.modalSub}>Ye data sab users ko chat ke jawab mein reflect hoga. Sirf admin add/delete kar sakta hai.</p>
              <div style={styles.modalAddBox}>
                <input placeholder="Title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} style={styles.modalInput} />
                <textarea placeholder="Content" value={newContent} onChange={(e) => setNewContent(e.target.value)} style={{ ...styles.modalInput, minHeight: 70, resize: "vertical" }} />
                <button onClick={addEntry} style={styles.modalAddBtn}>Add entry</button>
              </div>
              <div style={styles.modalKbList}>
                {kbEntries.length === 0 && <div style={styles.modalEmptyText}>No entries yet.</div>}
                {kbEntries.map((e) => (
                  <div key={e.id} style={styles.modalKbItem}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.modalKbTitle}>{e.title}</div>
                      <div style={styles.modalKbContent}>{e.content}</div>
                    </div>
                    <button onClick={() => deleteEntry(e.id)} style={styles.modalKbDeleteBtn}>🗑</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <style jsx global>{`
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Inter, system-ui, sans-serif; }
        textarea:focus, input:focus { outline: none; border-color: ${ACCENT} !important; }
        textarea { font-family: inherit; }

        @media (max-width: 768px) {
          .chat-inner { padding: 16px 14px 8px !important; }
          .msg-row-user, .msg-row-assistant { margin-bottom: 16px !important; }
          .user-bubble, .assistant-text { font-size: 14px !important; }
          .input-bar-wrap { padding: 0 12px 14px !important; }
          .input-bar { border-radius: 20px !important; padding: 8px 8px 8px 14px !important; }
          .disclaimer { font-size: 10px !important; }
          .topbar { padding: 10px 12px !important; }
          .topbar-title { font-size: 13px !important; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .toggle-row { gap: 6px !important; }
          .toggle-label { display: none; }
          .modal { width: 94vw !important; max-height: 88vh !important; padding: 16px !important; }
        }
      `}</style>
    </>
  );
}

const styles = {
  authLoadingScreen: { height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" },
  logoDotBig: { width: 40, height: 40, borderRadius: "50%", background: ACCENT },
  authScreen: { height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAFAFA" },
  authCard: { width: 360, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 28, display: "flex", flexDirection: "column", gap: 12 },
  authBrandRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 },
  logoDot: { width: 10, height: 10, borderRadius: "50%", background: ACCENT },
  authBrandText: { fontWeight: 600, fontSize: 14, color: TEXT_PRIMARY },
  authTitle: { fontSize: 20, fontWeight: 600, margin: "0 0 8px", color: TEXT_PRIMARY },
  authInput: { border: `1px solid ${BORDER}`, borderRadius: 10, padding: "11px 14px", fontSize: 14, color: TEXT_PRIMARY },
  authError: { fontSize: 12, color: "#E24B4A" },
  authSubmitBtn: { background: ACCENT, color: "#fff", border: "none", borderRadius: 10, padding: "11px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 4 },
  authSwitchRow: { fontSize: 13, color: TEXT_MUTED, textAlign: "center", marginTop: 4 },
  authSwitchLink: { color: ACCENT, cursor: "pointer", fontWeight: 500 },
  app: { display: "flex", height: "100vh", background: MAIN_BG, color: TEXT_PRIMARY, overflow: "hidden", position: "relative" },
  mobileOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40 },
  sidebar: { width: 280, background: SIDEBAR_BG, color: "#ECECEC", display: "flex", flexDirection: "column", flexShrink: 0, padding: "10px 10px 0", transition: "transform 0.2s ease" },
  sidebarClosed: { width: 0, padding: 0, overflow: "hidden" },
  sidebarMobile: { position: "fixed", top: 0, left: 0, bottom: 0, width: "82vw", maxWidth: 300, zIndex: 50, boxShadow: "2px 0 12px rgba(0,0,0,0.3)" },
  sidebarMobileClosed: { transform: "translateX(-100%)" },
  sidebarHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 6px 14px" },
  brandRow: { display: "flex", alignItems: "center", gap: 8 },
  brandText: { fontWeight: 600, fontSize: 14 },
  iconBtnGhost: { background: "transparent", border: "none", color: TEXT_MUTED, cursor: "pointer", fontSize: 18 },
  iconBtnGhostDark: { background: "transparent", border: "none", color: TEXT_MUTED, cursor: "pointer", fontSize: 16 },
  newChatBtn: { display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "1px solid #3A3A3A", color: "#ECECEC", borderRadius: 10, padding: "10px 12px", fontSize: 13, cursor: "pointer", marginBottom: 6 },
  kbNavBtn: { display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", color: "#ECECEC", borderRadius: 10, padding: "10px 12px", fontSize: 13, cursor: "pointer", marginBottom: 10, textAlign: "left" },
  recentsLabel: { fontSize: 11, color: "#8E8E8E", padding: "6px 12px 4px", textTransform: "uppercase", letterSpacing: 0.5 },
  convoList: { flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 },
  convoItem: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", borderRadius: 8, cursor: "pointer", gap: 8 },
  convoTitle: { fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 },
  convoDeleteBtn: { background: "transparent", border: "none", color: "#8E8E8E", cursor: "pointer", fontSize: 11, flexShrink: 0 },
  sidebarFooter: { fontSize: 11, color: "#8E8E8E", padding: "10px 12px", borderTop: "1px solid #2A2A2A" },
  logoutBtn: { background: "transparent", border: "1px solid #3A3A3A", color: "#ECECEC", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" },
  main: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },
  topbar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: `1px solid ${BORDER}`, gap: 8 },
  menuBtn: { background: "transparent", border: "none", color: TEXT_PRIMARY, cursor: "pointer", fontSize: 18, flexShrink: 0 },
  topbarTitle: { fontWeight: 600, fontSize: 14, color: TEXT_PRIMARY },
  toggleBtn: { background: "transparent", border: `1px solid ${BORDER}`, color: TEXT_MUTED, borderRadius: 20, padding: "6px 12px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" },
  toggleBtnActive: { background: "rgba(24,156,177,0.1)", border: `1px solid ${ACCENT}`, color: ACCENT },
  activePill: { background: "rgba(24,156,177,0.1)", border: `1px solid ${ACCENT}`, color: ACCENT, borderRadius: 20, padding: "4px 10px", fontSize: 11, whiteSpace: "nowrap" },
  plusBtn: { width: 34, height: 34, borderRadius: "50%", background: "transparent", border: `1px solid ${BORDER}`, cursor: "pointer", fontSize: 18, color: TEXT_MUTED, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" },
  plusMenuOverlay: { position: "fixed", inset: 0, zIndex: 69 },
  plusMenu: {
    position: "absolute",
    bottom: "calc(100% + 10px)",
    left: 0,
    width: 260,
    background: "#fff",
    border: `1px solid ${BORDER}`,
    borderRadius: 14,
    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
    padding: 6,
    zIndex: 70,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  plusMenuItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "transparent",
    border: "none",
    borderRadius: 8,
    padding: "9px 10px",
    cursor: "pointer",
    fontSize: 13,
    color: TEXT_PRIMARY,
    textAlign: "left",
  },
  plusMenuItemActive: { background: "rgba(24,156,177,0.08)" },
  chatArea: { flex: 1, overflowY: "auto" },
  chatInner: { maxWidth: 760, margin: "0 auto", padding: "24px 24px 8px" },
  msgRowUser: { display: "flex", justifyContent: "flex-end", marginBottom: 20 },
  msgRowAssistant: { display: "flex", justifyContent: "flex-start", marginBottom: 20 },
  userBubble: {
    maxWidth: "75%",
    background: ACCENT,
    color: "#fff",
    borderRadius: 18,
    padding: "10px 16px",
    fontSize: 15,
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  assistantText: {
    maxWidth: "100%",
    fontSize: 15,
    lineHeight: 1.7,
    color: TEXT_PRIMARY,
    wordBreak: "break-word",
  },
  errorBox: { fontSize: 12, color: "#E24B4A", padding: "8px 0" },
  inputBarWrap: { padding: "0 24px 20px" },
  inputBar: { maxWidth: 760, margin: "0 auto", display: "flex", gap: 10, alignItems: "flex-end", background: "#F7F7F8", border: `1px solid ${BORDER}`, borderRadius: 24, padding: "12px 12px 12px 18px", boxShadow: "0 2px 10px rgba(0,0,0,0.04)" },
  textInput: { flex: 1, background: "transparent", border: "none", color: TEXT_PRIMARY, fontSize: 15, resize: "none", maxHeight: 160, lineHeight: 1.5, padding: "6px 0" },
  sendBtn: { width: 34, height: 34, borderRadius: "50%", background: ACCENT, border: "none", cursor: "pointer", fontSize: 17, color: "#fff", flexShrink: 0 },
  disclaimer: { textAlign: "center", fontSize: 11, color: TEXT_MUTED, marginTop: 10 },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 },
  modal: { background: "#fff", borderRadius: 16, width: 480, maxWidth: "90vw", maxHeight: "80vh", display: "flex", flexDirection: "column", padding: 20 },
  modalHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  modalSub: { fontSize: 12, color: TEXT_MUTED, lineHeight: 1.5, margin: "0 0 12px" },
  modalAddBox: { display: "flex", flexDirection: "column", gap: 8, background: "#F7F7F8", padding: 12, borderRadius: 10, border: `1px solid ${BORDER}`, marginBottom: 12 },
  modalInput: { background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, color: TEXT_PRIMARY },
  modalAddBtn: { background: ACCENT, color: "#fff", border: "none", borderRadius: 8, padding: "9px 12px", fontSize: 13, fontWeight: 500, cursor: "pointer" },
  modalKbList: { flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 },
  modalKbItem: { display: "flex", gap: 8, background: "#F7F7F8", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 10, alignItems: "flex-start" },
  modalKbTitle: { fontSize: 13, fontWeight: 500, marginBottom: 2, color: "#0E7C8C" },
  modalKbContent: { fontSize: 12, color: TEXT_MUTED, lineHeight: 1.4 },
  modalKbDeleteBtn: { background: "transparent", border: "none", color: TEXT_MUTED, cursor: "pointer", fontSize: 13 },
  modalEmptyText: { fontSize: 12, color: TEXT_MUTED, textAlign: "center", padding: 20 },
};

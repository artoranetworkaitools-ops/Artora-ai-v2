import { useState, useEffect, useRef, Fragment } from "react";
import Head from "next/head";

const ACCENT = "#189CB1";

const LIGHT = {
  sidebarBg: "#171717",
  rowActive: "#2A2A2A",
  mainBg: "#FFFFFF",
  border: "#E5E5E5",
  textPrimary: "#0D0D0D",
  textMuted: "#8E8E8E",
  inputBg: "#F7F7F8",
  cardBg: "#F7F7F8",
};

const DARK = {
  sidebarBg: "#0D0D0D",
  rowActive: "#2E2E2E",
  mainBg: "#212121",
  border: "#3A3A3A",
  textPrimary: "#ECECEC",
  textMuted: "#9B9B9B",
  inputBg: "#2A2A2A",
  cardBg: "#2A2A2A",
};

const WELCOME = { role: "assistant", content: "Hi! I'm Artora AI. Ask me anything — I'll reply in whichever language you write in." };

function newConvo(projectId = null) {
  return { id: Date.now().toString(), title: "New chat", messages: [WELCOME], projectId };
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

  lines.forEach((line) => {
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
      blocks.push(<div key={blocks.length} style={{ marginBottom: 4 }}>{renderInline(line)}</div>);
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
  const [theme, setTheme] = useState("light");

  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminTab, setAdminTab] = useState("train");
  const [kbEntries, setKbEntries] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminHistory, setAdminHistory] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [projects, setProjects] = useState([]);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [expandedProjects, setExpandedProjects] = useState({});
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const c = theme === "dark" ? DARK : LIGHT;

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
    const savedTheme = localStorage.getItem("artora-ai-theme");
    if (savedTheme) setTheme(savedTheme);
  }, []);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("artora-ai-theme", next);
  }

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
    let savedProjects = [];
    try {
      savedProjects = JSON.parse(localStorage.getItem("artora-ai-projects") || "[]");
    } catch {
      savedProjects = [];
    }
    setProjects(savedProjects);
  }

  useEffect(() => {
    if (projects.length >= 0 && user) localStorage.setItem("artora-ai-projects", JSON.stringify(projects));
  }, [projects, user]);

  function createProject() {
    const name = newProjectName.trim();
    if (!name) return;
    setProjects((prev) => [...prev, { id: Date.now().toString(), name }]);
    setNewProjectName("");
    setNewProjectOpen(false);
  }

  function deleteProject(id, e) {
    e.stopPropagation();
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setConvos((prev) => prev.map((cv) => (cv.projectId === id ? { ...cv, projectId: null } : cv)));
  }

  function toggleProjectExpand(id) {
    setExpandedProjects((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function moveConvoToProject(convoId, projectId) {
    setConvos((prev) => prev.map((cv) => (cv.id === convoId ? { ...cv, projectId: projectId || null } : cv)));
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

  async function loadAdminUsers() {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      setAdminUsers(data.users || []);
    } catch {
      setAdminUsers([]);
    }
  }

  async function loadAdminHistory() {
    try {
      const res = await fetch("/api/admin/history");
      const data = await res.json();
      setAdminHistory(data.history || []);
    } catch {
      setAdminHistory([]);
    }
  }

  function openAdminPanel() {
    setAdminModalOpen(true);
    setAdminTab("train");
    loadKB();
    if (isMobile) setSidebarOpen(false);
  }

  function switchAdminTab(tab) {
    setAdminTab(tab);
    if (tab === "users") loadAdminUsers();
    if (tab === "history") loadAdminHistory();
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

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!newTitle.trim()) setNewTitle(file.name.replace(/\.[^/.]+$/, ""));
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target.result).slice(0, 4000);
      setNewContent(text);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  const activeConvo = convos.find((c2) => c2.id === activeId) || convos[0];

  function startNewChat() {
    const conv = newConvo();
    setConvos((prev) => [conv, ...prev]);
    setActiveId(conv.id);
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
      const updated = prev.filter((cv) => cv.id !== id);
      if (updated.length === 0) {
        const conv = newConvo();
        setActiveId(conv.id);
        return [conv];
      }
      if (id === activeId) setActiveId(updated[0].id);
      return updated;
    });
  }

  function updateConvoMessages(id, messages, title) {
    setConvos((prev) => prev.map((cv) => (cv.id === id ? { ...cv, messages, title: title || cv.title } : cv)));
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
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: ACCENT }} />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        {headTags}
        <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAFAFA" }}>
          <div className="auth-card" style={{ width: 360, background: "#fff", border: "1px solid #E5E5E5", borderRadius: 16, padding: 28, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: ACCENT }} />
              <span style={{ fontWeight: 600, fontSize: 14 }}>Artora AI</span>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 8px" }}>{authMode === "login" ? "Welcome back" : "Create your account"}</h2>
            {authMode === "signup" && (
              <input placeholder="Full name" value={authName} onChange={(e) => setAuthName(e.target.value)} style={authInputStyle} />
            )}
            <input placeholder="Email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} style={authInputStyle} />
            <input
              placeholder="Password"
              type="password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAuthSubmit()}
              style={authInputStyle}
            />
            {authError && <div style={{ fontSize: 12, color: "#E24B4A" }}>{authError}</div>}
            <button onClick={handleAuthSubmit} disabled={authBusy} style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 10, padding: "11px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 4 }}>
              {authBusy ? "..." : authMode === "login" ? "Log in" : "Sign up"}
            </button>
            <div style={{ fontSize: 13, color: "#8E8E8E", textAlign: "center", marginTop: 4 }}>
              {authMode === "login" ? (
                <>Naya account? <span style={{ color: ACCENT, cursor: "pointer", fontWeight: 500 }} onClick={() => { setAuthMode("signup"); setAuthError(""); }}>Sign up</span></>
              ) : (
                <>Already an account? <span style={{ color: ACCENT, cursor: "pointer", fontWeight: 500 }} onClick={() => { setAuthMode("login"); setAuthError(""); }}>Log in</span></>
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
      <div style={{ display: "flex", height: "100vh", background: c.mainBg, color: c.textPrimary, overflow: "hidden", position: "relative" }}>
        {isMobile && sidebarOpen && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40 }} onClick={() => setSidebarOpen(false)} />}

        <div
          className="sidebar"
          style={{
            width: 280,
            background: c.sidebarBg,
            color: "#ECECEC",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            padding: "10px 10px 0",
            transition: "transform 0.2s ease",
            ...(isMobile ? { position: "fixed", top: 0, left: 0, bottom: 0, width: "82vw", maxWidth: 300, zIndex: 50, boxShadow: "2px 0 12px rgba(0,0,0,0.3)" } : {}),
            ...(sidebarOpen ? {} : isMobile ? { transform: "translateX(-100%)" } : { width: 0, padding: 0, overflow: "hidden" }),
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 6px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: ACCENT }} />
              <span style={{ fontWeight: 600, fontSize: 14 }}>Artora AI</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} style={ghostBtnStyle}>‹</button>
          </div>

          <button onClick={startNewChat} style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "1px solid #3A3A3A", color: "#ECECEC", borderRadius: 10, padding: "10px 12px", fontSize: 13, cursor: "pointer", marginBottom: 6 }}>
            <span style={{ fontSize: 15 }}>+</span> New chat
          </button>

          {user.role === "admin" && (
            <button onClick={openAdminPanel} style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", color: "#ECECEC", borderRadius: 10, padding: "10px 12px", fontSize: 13, cursor: "pointer", marginBottom: 4, textAlign: "left" }}>
              <span>⚙️</span> Admin dashboard
            </button>
          )}

          <button onClick={toggleTheme} style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", color: "#ECECEC", borderRadius: 10, padding: "10px 12px", fontSize: 13, cursor: "pointer", marginBottom: 10, textAlign: "left" }}>
            <span>{theme === "light" ? "🌙" : "☀️"}</span> {theme === "light" ? "Dark mode" : "Light mode"}
          </button>

          <div style={{ fontSize: 11, color: "#8E8E8E", padding: "6px 12px 4px", textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>Projects</span>
            <button onClick={() => setNewProjectOpen((v) => !v)} style={{ background: "transparent", border: "none", color: "#8E8E8E", cursor: "pointer", fontSize: 14 }}>+</button>
          </div>
          {newProjectOpen && (
            <div style={{ display: "flex", gap: 4, padding: "0 8px 8px" }}>
              <input
                autoFocus
                placeholder="Project name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createProject()}
                style={{ flex: 1, background: "#212121", border: "1px solid #3A3A3A", borderRadius: 6, padding: "6px 8px", fontSize: 12, color: "#ECECEC" }}
              />
              <button onClick={createProject} style={{ background: ACCENT, border: "none", borderRadius: 6, padding: "0 10px", fontSize: 12, color: "#fff", cursor: "pointer" }}>Add</button>
            </div>
          )}
          <div style={{ maxHeight: "30%", overflowY: "auto", marginBottom: 4 }}>
            {projects.map((p) => {
              const projectConvos = convos.filter((cv) => cv.projectId === p.id);
              const isOpen = !!expandedProjects[p.id];
              return (
                <div key={p.id}>
                  <div onClick={() => toggleProjectExpand(p.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, cursor: "pointer", gap: 6 }}>
                    <span style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <span>{isOpen ? "📂" : "📁"}</span>
                      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
                      <span style={{ color: "#8E8E8E", fontSize: 11 }}>({projectConvos.length})</span>
                    </span>
                    <button onClick={(e) => deleteProject(p.id, e)} style={{ background: "transparent", border: "none", color: "#8E8E8E", cursor: "pointer", fontSize: 11, flexShrink: 0 }}>✕</button>
                  </div>
                  {isOpen && (
                    <div style={{ paddingLeft: 20 }}>
                      {projectConvos.length === 0 && <div style={{ fontSize: 11, color: "#6B6B6B", padding: "4px 12px" }}>Koi chat nahi</div>}
                      {projectConvos.map((cv) => (
                        <div key={cv.id} onClick={() => selectConvo(cv.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 12px", borderRadius: 8, cursor: "pointer", gap: 6, background: cv.id === activeId ? "#2A2A2A" : "transparent" }}>
                          <span style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{cv.title}</span>
                          <select
                            value={cv.projectId || ""}
                            onChange={(e) => moveConvoToProject(cv.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ background: "#212121", color: "#ECECEC", border: "1px solid #3A3A3A", borderRadius: 4, fontSize: 10, padding: "1px 2px", flexShrink: 0 }}
                          >
                            <option value="">No project</option>
                            {projects.map((pp) => (
                              <option key={pp.id} value={pp.id}>{pp.name}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ fontSize: 11, color: "#8E8E8E", padding: "6px 12px 4px", textTransform: "uppercase", letterSpacing: 0.5 }}>Recents</div>
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
            {convos.filter((cv) => !cv.projectId).map((cv) => (
              <div
                key={cv.id}
                onClick={() => selectConvo(cv.id)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", borderRadius: 8, cursor: "pointer", gap: 6, background: cv.id === activeId ? "#2A2A2A" : "transparent" }}
              >
                <span style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{cv.title}</span>
                {projects.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => moveConvoToProject(cv.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ background: "#212121", color: "#ECECEC", border: "1px solid #3A3A3A", borderRadius: 4, fontSize: 10, padding: "1px 2px", flexShrink: 0 }}
                  >
                    <option value="">📁 Move</option>
                    {projects.map((pp) => (
                      <option key={pp.id} value={pp.id}>{pp.name}</option>
                    ))}
                  </select>
                )}
                <button onClick={(e) => deleteConvo(cv.id, e)} style={{ background: "transparent", border: "none", color: "#8E8E8E", cursor: "pointer", fontSize: 11, flexShrink: 0 }}>✕</button>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11, color: "#8E8E8E", padding: "10px 12px", borderTop: "1px solid #2A2A2A" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 500, color: "#ECECEC" }}>{user.name}</div>
                <div style={{ fontSize: 10 }}>{user.role === "admin" ? "Admin" : "Member"}</div>
              </div>
              <button onClick={handleLogout} style={{ background: "transparent", border: "1px solid #3A3A3A", color: "#ECECEC", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>Logout</button>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div className="topbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: `1px solid ${c.border}`, gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              {!sidebarOpen && <button onClick={() => setSidebarOpen(true)} style={{ background: "transparent", border: "none", color: c.textPrimary, cursor: "pointer", fontSize: 18, flexShrink: 0 }}>☰</button>}
              <span className="topbar-title" style={{ fontWeight: 600, fontSize: 14 }}>{activeConvo.title}</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {webSearch && <span style={{ background: "rgba(24,156,177,0.1)", border: `1px solid ${ACCENT}`, color: ACCENT, borderRadius: 20, padding: "4px 10px", fontSize: 11, whiteSpace: "nowrap" }}>🌐 Search</span>}
              {deepResearch && <span style={{ background: "rgba(24,156,177,0.1)", border: `1px solid ${ACCENT}`, color: ACCENT, borderRadius: 20, padding: "4px 10px", fontSize: 11, whiteSpace: "nowrap" }}>🔎 Research</span>}
            </div>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto" }}>
            <div className="chat-inner" style={{ maxWidth: 760, margin: "0 auto", padding: "24px 24px 8px" }}>
              {activeConvo.messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="msg-row-user" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
                    <div className="user-bubble" style={{ maxWidth: "75%", background: ACCENT, color: "#fff", borderRadius: 18, padding: "10px 16px", fontSize: 15, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.content}</div>
                  </div>
                ) : (
                  <div key={i} className="msg-row-assistant" style={{ display: "flex", justifyContent: "flex-start", marginBottom: 20 }}>
                    <div className="assistant-text" style={{ maxWidth: "100%", fontSize: 15, lineHeight: 1.7, wordBreak: "break-word" }}>{renderMarkdown(m.content)}</div>
                  </div>
                )
              )}
              {loading && (
                <div className="msg-row-assistant" style={{ display: "flex", justifyContent: "flex-start", marginBottom: 20 }}>
                  <div style={{ fontSize: 15, color: c.textMuted }}>{deepResearch ? "Researching thoroughly..." : "Thinking..."}</div>
                </div>
              )}
              {errorMsg && <div style={{ fontSize: 12, color: "#E24B4A", padding: "8px 0" }}>{errorMsg}</div>}
            </div>
          </div>

          <div className="input-bar-wrap" style={{ padding: "0 24px 20px" }}>
            <div className="input-bar" style={{ maxWidth: 760, margin: "0 auto", display: "flex", gap: 10, alignItems: "flex-end", background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: 24, padding: "12px 12px 12px 12px", boxShadow: "0 2px 10px rgba(0,0,0,0.04)", position: "relative" }}>
              <button onClick={() => setPlusMenuOpen((v) => !v)} type="button" style={{ width: 34, height: 34, borderRadius: "50%", background: "transparent", border: `1px solid ${c.border}`, cursor: "pointer", fontSize: 18, color: c.textMuted, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
              {plusMenuOpen && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 69 }} onClick={() => setPlusMenuOpen(false)} />
                  <div style={{ position: "absolute", bottom: "calc(100% + 10px)", left: 0, width: 260, background: c.mainBg, border: `1px solid ${c.border}`, borderRadius: 14, boxShadow: "0 8px 24px rgba(0,0,0,0.18)", padding: 6, zIndex: 70, display: "flex", flexDirection: "column", gap: 2 }}>
                    <button onClick={() => { setWebSearch((v) => !v); setPlusMenuOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 10, background: webSearch ? "rgba(24,156,177,0.08)" : "transparent", border: "none", borderRadius: 8, padding: "9px 10px", cursor: "pointer", fontSize: 13, color: c.textPrimary, textAlign: "left" }}>
                      <span>🌐</span>
                      <span style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500 }}>Web search</div>
                        <div style={{ fontSize: 11, color: c.textMuted }}>Find real-time info from Google</div>
                      </span>
                      {webSearch && <span style={{ color: ACCENT }}>✓</span>}
                    </button>
                    <button onClick={() => { setDeepResearch((v) => !v); setPlusMenuOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 10, background: deepResearch ? "rgba(24,156,177,0.08)" : "transparent", border: "none", borderRadius: 8, padding: "9px 10px", cursor: "pointer", fontSize: 13, color: c.textPrimary, textAlign: "left" }}>
                      <span>🔎</span>
                      <span style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500 }}>Deep research</div>
                        <div style={{ fontSize: 11, color: c.textMuted }}>Thorough, well-checked answers</div>
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
                rows={1}
                style={{ flex: 1, background: "transparent", border: "none", color: c.textPrimary, fontSize: 15, resize: "none", maxHeight: 160, lineHeight: 1.5, padding: "6px 0" }}
              />
              <button onClick={sendMessage} disabled={loading || !input.trim()} style={{ width: 34, height: 34, borderRadius: "50%", background: ACCENT, border: "none", cursor: "pointer", fontSize: 17, color: "#fff", flexShrink: 0 }}>↑</button>
            </div>
            <div className="disclaimer" style={{ textAlign: "center", fontSize: 11, color: c.textMuted, marginTop: 10 }}>Artora AI can make mistakes. Check important info.</div>
          </div>
        </div>

        {adminModalOpen && user.role === "admin" && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }} onClick={() => setAdminModalOpen(false)}>
            <div className="modal" style={{ background: c.mainBg, color: c.textPrimary, borderRadius: 16, width: 560, maxWidth: "90vw", maxHeight: "82vh", display: "flex", flexDirection: "column", padding: 20 }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontWeight: 600, fontSize: 16 }}>Admin dashboard</span>
                <button onClick={() => setAdminModalOpen(false)} style={{ background: "transparent", border: "none", color: c.textMuted, cursor: "pointer", fontSize: 16 }}>✕</button>
              </div>

              <div style={{ display: "flex", gap: 6, marginBottom: 14, borderBottom: `1px solid ${c.border}`, paddingBottom: 10 }}>
                {[
                  { id: "train", label: "Train AI" },
                  { id: "users", label: "Users" },
                  { id: "history", label: "Chat history" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => switchAdminTab(t.id)}
                    style={{
                      background: adminTab === t.id ? "rgba(24,156,177,0.1)" : "transparent",
                      border: adminTab === t.id ? `1px solid ${ACCENT}` : `1px solid ${c.border}`,
                      color: adminTab === t.id ? ACCENT : c.textMuted,
                      borderRadius: 20,
                      padding: "6px 14px",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {adminTab === "train" && (
                <>
                  <p style={{ fontSize: 12, color: c.textMuted, lineHeight: 1.5, margin: "0 0 12px" }}>
                    Ye data sab users ko chat ke jawab mein reflect hoga. Text file upload karke bhi content bhar sakte hain.
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, background: c.cardBg, padding: 12, borderRadius: 10, border: `1px solid ${c.border}`, marginBottom: 12 }}>
                    <input placeholder="Title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} style={{ background: c.mainBg, border: `1px solid ${c.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, color: c.textPrimary }} />
                    <textarea placeholder="Content" value={newContent} onChange={(e) => setNewContent(e.target.value)} style={{ background: c.mainBg, border: `1px solid ${c.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, color: c.textPrimary, minHeight: 70, resize: "vertical" }} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={addEntry} style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 8, padding: "9px 12px", fontSize: 13, fontWeight: 500, cursor: "pointer", flex: 1 }}>Add entry</button>
                      <button onClick={() => fileInputRef.current?.click()} style={{ background: "transparent", color: c.textPrimary, border: `1px solid ${c.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, cursor: "pointer" }}>📎 Upload .txt</button>
                      <input ref={fileInputRef} type="file" accept=".txt,.md,.csv" onChange={handleFileUpload} style={{ display: "none" }} />
                    </div>
                  </div>
                  <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, maxHeight: 280 }}>
                    {kbEntries.length === 0 && <div style={{ fontSize: 12, color: c.textMuted, textAlign: "center", padding: 20 }}>No entries yet.</div>}
                    {kbEntries.map((e) => (
                      <div key={e.id} style={{ display: "flex", gap: 8, background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 10, padding: 10, alignItems: "flex-start" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2, color: "#0E9CB4" }}>{e.title}</div>
                          <div style={{ fontSize: 12, color: c.textMuted, lineHeight: 1.4 }}>{e.content}</div>
                        </div>
                        <button onClick={() => deleteEntry(e.id)} style={{ background: "transparent", border: "none", color: c.textMuted, cursor: "pointer", fontSize: 13 }}>🗑</button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {adminTab === "users" && (
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, maxHeight: 380 }}>
                  {adminUsers.length === 0 && <div style={{ fontSize: 12, color: c.textMuted, textAlign: "center", padding: 20 }}>Loading...</div>}
                  {adminUsers.map((u) => (
                    <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 10, padding: 10 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{u.name}</div>
                        <div style={{ fontSize: 12, color: c.textMuted }}>{u.email}</div>
                      </div>
                      <span style={{ fontSize: 11, background: u.role === "admin" ? "rgba(24,156,177,0.12)" : "transparent", color: u.role === "admin" ? ACCENT : c.textMuted, border: `1px solid ${u.role === "admin" ? ACCENT : c.border}`, borderRadius: 12, padding: "3px 10px" }}>
                        {u.role === "admin" ? "Admin" : "Member"}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {adminTab === "history" && (
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, maxHeight: 380 }}>
                  {adminHistory.length === 0 && <div style={{ fontSize: 12, color: c.textMuted, textAlign: "center", padding: 20 }}>Abhi tak koi conversation nahi.</div>}
                  {adminHistory.map((h) => (
                    <div key={h.id} style={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 10, padding: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, color: "#0E9CB4" }}>Q: {h.user}</div>
                      <div style={{ fontSize: 12, color: c.textMuted, lineHeight: 1.5 }}>{h.assistant.slice(0, 220)}{h.assistant.length > 220 ? "..." : ""}</div>
                    </div>
                  ))}
                </div>
              )}
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
          .input-bar { border-radius: 20px !important; }
          .disclaimer { font-size: 10px !important; }
          .topbar { padding: 10px 12px !important; }
          .topbar-title { font-size: 13px !important; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .modal { width: 94vw !important; max-height: 88vh !important; padding: 16px !important; }
        }
      `}</style>
    </>
  );
}

const authInputStyle = { border: "1px solid #E5E5E5", borderRadius: 10, padding: "11px 14px", fontSize: 14, color: "#0D0D0D" };
const ghostBtnStyle = { background: "transparent", border: "none", color: "#8E8E8E", cursor: "pointer", fontSize: 18 };

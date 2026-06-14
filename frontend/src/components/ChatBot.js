import { useState, useEffect } from "react";
import { askChatbot, getSubjects } from "../services/api";
import { MessageCircle, Send, X } from "lucide-react";

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([
    { role: "bot", text: 'Ask me anything — e.g. "Show students below 75% in subject 1"' },
  ]);
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");

  useEffect(() => {
    getSubjects().then((r) => {
      setSubjects(r.data);
      if (r.data.length > 0) setSelectedSubject(r.data[0].id);
    }).catch(() => {});
  }, []);

  async function send() {
    if (!query.trim()) return;
    const userMsg = { role: "user", text: query };
    setMessages((m) => [...m, userMsg]);
    setQuery("");
    try {
      const { data } = await askChatbot(selectedSubject, query);
      setMessages((m) => [...m, { role: "bot", text: data.answer }]);
    } catch {
      setMessages((m) => [...m, { role: "bot", text: "Something went wrong. Try again." }]);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <div className="mb-3 w-80 overflow-hidden"
          style={{
            background: "rgba(15,31,61,0.97)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "16px",
            boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
          }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3"
            style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.25), rgba(29,78,216,0.15))", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <MessageCircle size={14} className="text-blue-400" /> AI Assistant
            </div>
            <button onClick={() => setOpen(false)} style={{ color: "rgba(255,255,255,0.35)" }}
              onMouseEnter={e => e.currentTarget.style.color = "#fff"}
              onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.35)"}>
              <X size={15} />
            </button>
          </div>

          {/* Messages */}
          <div className="h-56 overflow-y-auto p-3 space-y-2">
            {messages.map((m, i) => (
              <div key={i} className={`text-xs px-3 py-2 rounded-xl max-w-[90%] ${m.role === "user" ? "ml-auto" : ""}`}
                style={m.role === "user"
                  ? { background: "rgba(59,130,246,0.25)", color: "#bfdbfe", border: "1px solid rgba(59,130,246,0.3)" }
                  : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.08)" }}>
                {m.text}
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="p-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            {subjects.length > 0 && (
              <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full text-xs rounded-lg px-2 py-1.5 mb-2 outline-none"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}>
                {subjects.map((s) => <option key={s.id} value={s.id} style={{ background: "#1a3461" }}>{s.name}</option>)}
              </select>
            )}
            <div className="flex gap-2">
              <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Ask a question…"
                className="flex-1 text-xs rounded-lg px-3 py-2 outline-none"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }} />
              <button onClick={send}
                className="p-2 rounded-lg text-white transition"
                style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}>
                <Send size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      <button onClick={() => setOpen((o) => !o)}
        className="p-4 rounded-full text-white transition"
        style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", boxShadow: "0 8px 25px rgba(59,130,246,0.4)" }}>
        <MessageCircle size={22} />
      </button>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { askChatbot, getSubjects } from "../services/api";
import { MessageCircle, Send, X, Bot } from "lucide-react";

const QUICK_ACTIONS = {
  student: [
    "My overall attendance",
    "Subjects below 75%",
    "Today's attendance",
  ],
  faculty: [
    "Students below 75%",
    "Who was absent today?",
    "At-risk students",
    "Monthly trends",
    "Subject overview",
    "Top students",
  ],
  admin: [
    "Students below 75%",
    "Who was absent today?",
    "At-risk students",
    "Monthly trends",
    "Subject overview",
    "Show anomalies",
  ],
};

const WELCOME = {
  student: "Hi! Ask me about your attendance, shortage subjects, or today's classes.",
  faculty: "Hi! Ask about class attendance, defaulters, absent students, or monthly trends.",
  admin: "Hi! Ask about any subject's attendance, defaulters, anomalies, or department trends.",
};

function MessageBubble({ text }) {
  const lines = text.split("\n");
  return (
    <div style={{ lineHeight: "1.65" }}>
      {lines.map((line, i) => {
        const parts = line.split(/\*\*(.*?)\*\*/g);
        const rendered = parts.map((part, j) =>
          j % 2 === 1 ? (
            <strong key={j} style={{ color: "#93c5fd", fontWeight: 600 }}>
              {part}
            </strong>
          ) : (
            part
          )
        );
        const isSubNote = line.startsWith("  →");
        return (
          <div
            key={i}
            style={{
              marginBottom: i < lines.length - 1 ? (line.startsWith("•") ? "3px" : "7px") : 0,
              paddingLeft: isSubNote ? "10px" : 0,
              color: isSubNote ? "rgba(148,163,184,0.85)" : undefined,
              fontSize: isSubNote ? "10px" : undefined,
            }}
          >
            {rendered}
          </div>
        );
      })}
    </div>
  );
}

export default function ChatBot() {
  const role = localStorage.getItem("role") || "student";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([
    { role: "bot", text: WELCOME[role] || WELCOME.student },
  ]);
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (role !== "student") {
      getSubjects()
        .then((r) => {
          setSubjects(r.data);
          if (r.data.length > 0) setSelectedSubject(r.data[0].id);
        })
        .catch(() => {});
    }
  }, [role]);

  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  async function send(text) {
    const q = (text !== undefined ? text : query).trim();
    if (!q) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setQuery("");
    setTyping(true);
    try {
      const subjectId = role !== "student" ? selectedSubject : undefined;
      const { data } = await askChatbot(subjectId, q);
      setMessages((m) => [...m, { role: "bot", text: data.answer }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "bot", text: "Something went wrong. Please try again." },
      ]);
    } finally {
      setTyping(false);
    }
  }

  const quickActions = QUICK_ACTIONS[role] || QUICK_ACTIONS.student;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <div
          className="mb-3 flex flex-col overflow-hidden"
          style={{
            width: "390px",
            height: "540px",
            background: "rgba(8,18,48,0.98)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: "20px",
            boxShadow: "0 28px 70px rgba(0,0,0,0.65)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, rgba(59,130,246,0.28), rgba(29,78,216,0.18))",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 30,
                  height: 30,
                  background: "rgba(59,130,246,0.25)",
                  border: "1px solid rgba(59,130,246,0.45)",
                }}
              >
                <Bot size={15} className="text-blue-400" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white" style={{ letterSpacing: "0.01em" }}>
                  AttendNow AI
                </div>
                <div style={{ color: "rgba(148,163,184,0.6)", fontSize: "10px" }}>
                  {role.charAt(0).toUpperCase() + role.slice(1)} Assistant
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ color: "rgba(255,255,255,0.3)", transition: "color 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
            >
              <X size={16} />
            </button>
          </div>

          {/* Subject selector — faculty / admin only */}
          {role !== "student" && subjects.length > 0 && (
            <div
              className="px-3 py-2 flex-shrink-0"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full rounded-lg px-2.5 py-1.5 outline-none"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.65)",
                  fontSize: "11px",
                }}
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id} style={{ background: "#080d28" }}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "bot" && (
                  <div
                    className="flex-shrink-0 flex items-center justify-center rounded-full self-start mt-0.5"
                    style={{
                      width: 22,
                      height: 22,
                      background: "rgba(59,130,246,0.18)",
                      border: "1px solid rgba(59,130,246,0.32)",
                    }}
                  >
                    <Bot size={11} className="text-blue-400" />
                  </div>
                )}
                <div
                  className="text-xs px-3 py-2.5 max-w-[82%]"
                  style={
                    m.role === "user"
                      ? {
                          background: "linear-gradient(135deg, rgba(59,130,246,0.32), rgba(29,78,216,0.22))",
                          color: "#dbeafe",
                          border: "1px solid rgba(59,130,246,0.28)",
                          borderRadius: "16px",
                          borderBottomRightRadius: "4px",
                        }
                      : {
                          background: "rgba(255,255,255,0.045)",
                          color: "rgba(255,255,255,0.72)",
                          border: "1px solid rgba(255,255,255,0.07)",
                          borderRadius: "16px",
                          borderBottomLeftRadius: "4px",
                        }
                  }
                >
                  {m.role === "bot" ? <MessageBubble text={m.text} /> : m.text}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {typing && (
              <div className="flex justify-start gap-2">
                <div
                  className="flex-shrink-0 flex items-center justify-center rounded-full self-start mt-0.5"
                  style={{
                    width: 22,
                    height: 22,
                    background: "rgba(59,130,246,0.18)",
                    border: "1px solid rgba(59,130,246,0.32)",
                  }}
                >
                  <Bot size={11} className="text-blue-400" />
                </div>
                <div
                  className="px-3 py-2.5 text-xs"
                  style={{
                    background: "rgba(255,255,255,0.045)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: "16px",
                    borderBottomLeftRadius: "4px",
                    color: "rgba(148,163,184,0.5)",
                  }}
                >
                  Thinking
                  <span
                    style={{ color: "#60a5fa" }}
                    className="animate-pulse"
                  >
                    {" "}
                    ...
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick action chips */}
          <div
            className="px-3 pt-2 flex-shrink-0"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div
              className="flex gap-1.5 pb-2 overflow-x-auto"
              style={{ scrollbarWidth: "none" }}
            >
              {quickActions.map((action) => (
                <button
                  key={action}
                  onClick={() => send(action)}
                  disabled={typing}
                  className="flex-shrink-0 rounded-full transition-all"
                  style={{
                    background: "rgba(59,130,246,0.1)",
                    border: "1px solid rgba(59,130,246,0.22)",
                    color: "#93c5fd",
                    fontSize: "10px",
                    padding: "4px 10px",
                    whiteSpace: "nowrap",
                    opacity: typing ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!typing) e.currentTarget.style.background = "rgba(59,130,246,0.22)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(59,130,246,0.1)";
                  }}
                >
                  {action}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="px-3 pb-3 flex-shrink-0">
            <div
              className="flex gap-2 items-center px-3 py-2 rounded-xl"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.09)",
              }}
            >
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                placeholder="Ask a question…"
                disabled={typing}
                className="flex-1 bg-transparent outline-none"
                style={{ color: "#fff", fontSize: "12px" }}
              />
              <button
                onClick={() => send()}
                disabled={!query.trim() || typing}
                className="flex-shrink-0 p-1.5 rounded-lg transition-all"
                style={{
                  background:
                    query.trim() && !typing
                      ? "linear-gradient(135deg, #3b82f6, #1d4ed8)"
                      : "rgba(255,255,255,0.05)",
                  color: query.trim() && !typing ? "#fff" : "rgba(255,255,255,0.25)",
                }}
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="p-4 rounded-full text-white"
        style={{
          background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
          boxShadow: open
            ? "0 8px 20px rgba(59,130,246,0.3)"
            : "0 8px 28px rgba(59,130,246,0.5)",
          transition: "box-shadow 0.2s",
        }}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}

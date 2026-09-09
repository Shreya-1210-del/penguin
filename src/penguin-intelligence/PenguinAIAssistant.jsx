import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Bot, ChevronDown, Lightbulb, Mic, RotateCcw, Send, Sparkles,
  Wand2, X,
} from "lucide-react";
import { chatWithPenguin, getFacts, getRandomFact, getRecommendation } from "./penguinIntelligenceApi";
import "./penguinIntelligence.css";

const QUICK_PROMPTS = [
  "Explain the current station status",
  "Why is fuel consumption changing?",
  "What happens during a blizzard?",
  "Explain this prediction",
  "What resource should we prepare?",
  "Tell me something interesting about Maitri",
  "Tell me something interesting about Bharati",
];

const WELCOME = "Hi, I'm Penguin AI. I can explain the dashboard in plain language, interpret the current simulation, or tell you something interesting about Bharati and Maitri. Everything I reference is either documented project information or synthetic prototype data -- never real station telemetry.";

function InfoBadge({ type }) {
  if (!type) return null;
  const map = {
    KNOWN_PROJECT_INFORMATION: { label: "Project info", color: "#58c8ff" },
    SYNTHETIC_PROTOTYPE_DATA: { label: "Synthetic data", color: "#ffc15a" },
    GENERAL_KNOWLEDGE: { label: "General knowledge", color: "#8ba9ba" },
    UNKNOWN_UNAVAILABLE: { label: "Not available in prototype", color: "#ff9a4d" },
  };
  const cfg = map[type];
  if (!cfg) return null;
  return <span className="ai-badge" style={{ color: cfg.color, borderColor: cfg.color }}>{cfg.label}</span>;
}

export default function PenguinAIAssistant({ engine }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([{ role: "assistant", text: WELCOME }]);
  const [facts, setFacts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [factCategory, setFactCategory] = useState("");
  const [fact, setFact] = useState(null);
  const [busy, setBusy] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [suggested, setSuggested] = useState(QUICK_PROMPTS);

  useEffect(() => {
    getFacts().then((r) => { setFacts(r.facts || []); setCategories(r.categories || []); }).catch(() => setConnectionError(true));
  }, []);

  const context = useMemo(() => ({
    station: engine?.station || "BHARATI",
    ambientTemp: Number(engine?.ambientTemp?.toFixed?.(1) ?? engine?.ambientTemp ?? 0),
    survivalDays: Number(engine?.survivalDays?.toFixed?.(1) ?? engine?.survivalDays ?? 0),
    scenario: engine?.scenario || "NORMAL",
    generatorStatus: engine?.generatorStatus || "NORMAL",
    riskLevel: engine?.riskLevel || undefined,
  }), [engine]);

  async function ask(text = input) {
    if (!text.trim()) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setBusy(true);
    setConnectionError(false);
    try {
      const r = await chatWithPenguin(text, context);
      setMessages((m) => [...m, { role: "assistant", text: r.answer, infoType: r.information_type, category: r.category }]);
      if (r.suggested_questions?.length) setSuggested(r.suggested_questions);
    } catch (e) {
      setConnectionError(true);
      setMessages((m) => [...m, { role: "assistant", text: "I can't reach the Penguin intelligence backend right now. Start FastAPI on port 8000 and try again.", isError: true }]);
    } finally {
      setBusy(false);
    }
  }

  async function explainStatus() {
    await ask(`Explain why the station risk level is currently ${context.riskLevel || context.scenario}.`);
  }

  async function recommendResources() {
    setBusy(true);
    try {
      const r = await getRecommendation({ ambient_temp_c: context.ambientTemp || -25, scenario: context.scenario || "NORMAL" });
      setMessages((m) => [...m, {
        role: "assistant",
        text: r.recommendations.join("\n"),
        infoType: "SYNTHETIC_PROTOTYPE_DATA",
        category: "Operations",
      }]);
    } catch {
      setConnectionError(true);
      setMessages((m) => [...m, { role: "assistant", text: "Couldn't reach the recommendation engine. Start FastAPI on port 8000 and try again.", isError: true }]);
    } finally {
      setBusy(false);
    }
  }

  async function surprise() {
    try {
      const r = await getRandomFact(factCategory || undefined);
      setFact(r);
    } catch {
      if (facts.length) setFact(facts[Math.floor(Math.random() * facts.length)]);
    }
  }

  function voice() {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      setInput("Voice input is not supported in this browser.");
      return;
    }
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new R();
    r.lang = "en-IN";
    r.onresult = (e) => setInput(e.results[0][0].transcript);
    r.start();
  }

  return (
    <>
      <button className="ai-fab" onClick={() => setOpen(true)}>
        <Bot size={19} /><span>ASK PENGUIN AI</span>
        {connectionError && <AlertTriangle size={13} className="ai-fab-warn" />}
      </button>

      {open && (
        <div className="ai-shell">
          <div className="ai-window">
            <header>
              <div className="ai-title">
                <div className="ai-orb"><Bot size={18} /></div>
                <div><b>Penguin AI</b><span>Human-friendly mission guide</span></div>
              </div>
              <button onClick={() => setOpen(false)}><X /></button>
            </header>

            <div className="ai-context">
              <span><i /> LIVE CONTEXT</span>
              <b>{context.station} · {context.scenario}</b>
              <small>{context.ambientTemp}°C · {context.survivalDays}d survival{context.riskLevel ? ` · ${context.riskLevel}` : ""}</small>
            </div>

            <div className="ai-messages">
              {messages.map((m, i) => (
                <div className={`ai-msg ${m.role}${m.isError ? " error" : ""}`} key={i}>
                  {m.text}
                  {m.infoType && <div className="ai-msg-meta"><InfoBadge type={m.infoType} />{m.category && <span className="ai-cat">{m.category}</span>}</div>}
                </div>
              ))}
              {busy && <div className="ai-msg assistant typing">Thinking<span>•••</span></div>}
            </div>

            <div className="ai-actions-row">
              <button onClick={explainStatus} disabled={busy}><Wand2 size={13} /> Explain status</button>
              <button onClick={recommendResources} disabled={busy}><Sparkles size={13} /> Recommend</button>
              <button onClick={surprise} disabled={busy}><Lightbulb size={13} /> Fact</button>
              {categories.length > 0 && (
                <select value={factCategory} onChange={(e) => setFactCategory(e.target.value)} className="ai-cat-select">
                  <option value="">All categories</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>

            <div className="ai-quick">
              {suggested.map((q) => <button key={q} onClick={() => ask(q)}>{q}</button>)}
            </div>

            {fact && (
              <div className="ai-fact">
                <Lightbulb size={15} />
                <span><b className="ai-fact-cat">{fact.category}:</b> {fact.text}</span>
                <button onClick={surprise}><RotateCcw size={13} /></button>
              </div>
            )}

            <div className="ai-compose">
              <button title="Voice input" onClick={voice}><Mic size={16} /></button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && ask()}
                placeholder="Ask anything about Penguin..."
              />
              <button onClick={() => ask()} disabled={busy}><Send size={16} /></button>
            </div>

            <footer>
              <button onClick={surprise}><Sparkles size={13} /> SURPRISE FACT</button>
              <button onClick={() => { setMessages([{ role: "assistant", text: "Chat cleared. What would you like me to explain?" }]); setSuggested(QUICK_PROMPTS); }}>
                <RotateCcw size={13} /> RESET CHAT
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}

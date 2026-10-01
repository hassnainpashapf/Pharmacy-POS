import { useState } from 'react'
import { useDB } from '../lib/db'
import { processCopilotQuery } from '../lib/aiCopilot'
import { Sparkles, Send, X, Bot, ShieldAlert, CheckCircle2, ChevronRight, CornerDownLeft } from 'lucide-react'

export default function AICopilot({ isOpen, onClose }) {
  const db = useDB()
  const [messages, setMessages] = useState([
    {
      sender: 'copilot',
      title: 'Pharmacy AI Copilot (V4 Enterprise)',
      text: 'Hello! I am your pharmacy operations copilot. I monitor inventory runout, sales velocity, expiration risks, supplier payables, and branch imbalances in real time. Ask me anything about store operations.',
      highlights: [
        'Ask about stock issues & shortages',
        'Analyze near-expiry batches (30/45 days)',
        'Review supplier payables & cash positions',
        'Examine branch sales & transfer suggestions',
      ],
      chips: [
        'What stock issues do we have today?',
        'Show batches expiring soon',
        'Today financial performance',
        'Supplier outstanding balance',
      ],
    },
  ])
  const [input, setInput] = useState('')

  if (!isOpen) return null

  const handleSend = (textToSend) => {
    const q = textToSend || input
    if (!q.trim()) return

    const userMsg = { sender: 'user', text: q }
    const result = processCopilotQuery(q, db)

    setMessages((prev) => [
      ...prev,
      userMsg,
      {
        sender: 'copilot',
        title: result.title,
        text: result.text,
        highlights: result.highlights,
        details: result.details,
        chips: result.chips,
        type: result.type,
      },
    ])
    setInput('')
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-sm transition-all" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-200/90 z-50 animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200/80 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center font-bold">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-sm tracking-tight text-white">Pharmacy AI Copilot</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">V4</span>
              </div>
              <p className="text-[11px] text-slate-300">Operational & Inventory Intelligence</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Clinical Guardrail Banner */}
        <div className="px-4 py-2 bg-amber-50/80 border-b border-amber-200/60 flex items-center gap-2 text-[11px] text-amber-800 font-medium">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>Non-clinical assistant: operates strictly on sales, inventory, and supply chain data.</span>
        </div>

        {/* Chat Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scroll">
          {messages.map((m, idx) => (
            <div key={idx} className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
              {m.sender === 'user' ? (
                <div className="bg-emerald-600 text-white rounded-2xl rounded-tr-none px-4 py-2.5 text-xs font-medium max-w-[85%] shadow-sm">
                  {m.text}
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl rounded-tl-none p-4 text-xs max-w-[95%] space-y-2.5 shadow-sm">
                  {m.title && <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-emerald-600" /> {m.title}</div>}
                  {m.text && <p className="text-slate-600 leading-relaxed">{m.text}</p>}

                  {m.highlights && (
                    <ul className="space-y-1.5 pt-1">
                      {m.highlights.map((h, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-slate-800 font-medium">
                          <span className="text-emerald-600">•</span>
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {m.details && m.details.length > 0 && (
                    <div className="mt-2 p-2.5 bg-white rounded-xl border border-slate-200/70 space-y-1">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Item Breakdown</div>
                      {m.details.map((d, i) => (
                        <div key={i} className="text-[11px] text-slate-700 font-medium">
                          {d}
                        </div>
                      ))}
                    </div>
                  )}

                  {m.chips && (
                    <div className="pt-2 flex flex-wrap gap-1.5">
                      {m.chips.map((chip, i) => (
                        <button
                          key={i}
                          onClick={() => handleSend(chip)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 text-[11px] font-medium transition-colors"
                        >
                          <span>{chip}</span>
                          <ChevronRight className="w-3 h-3 opacity-60" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Input Footer */}
        <div className="p-3 border-t border-slate-200 bg-white">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className="flex items-center gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Copilot (e.g. stock shortages, sales today, expiry)..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center disabled:opacity-40 transition-colors shadow-sm"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="mt-1.5 text-center text-[10px] text-slate-400">
            Press <kbd className="px-1 py-0.5 rounded bg-slate-100 font-mono text-[9px] border border-slate-200">Enter</kbd> to query
          </div>
        </div>
      </div>
    </div>
  )
}

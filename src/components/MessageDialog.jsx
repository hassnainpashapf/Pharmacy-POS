import { useEffect, useState } from 'react'
import { Mail, MessageCircle, Smartphone, X } from 'lucide-react'
import { hasMessaging, messagingStatus, sendEmail, sendSms, sendWhatsApp } from '../lib/messaging'

const CHANNELS = [
  { key: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { key: 'sms', label: 'SIM SMS', Icon: Smartphone, color: 'text-sky-700 bg-sky-50 border-sky-200' },
  { key: 'email', label: 'Email', Icon: Mail, color: 'text-violet-700 bg-violet-50 border-violet-200' },
]

// Send a message to a customer through the business's shared WhatsApp / SIM SMS / Email (the Optix cloud account).
export default function MessageDialog({ open, onClose, name = '', phone = '', email = '', text = '', subject = 'Message from your pharmacy' }) {
  const [channel, setChannel] = useState('whatsapp')
  const [to, setTo] = useState(phone)
  const [mail, setMail] = useState(email)
  const [body, setBody] = useState(text)
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState({ ok: '', err: '' })

  useEffect(() => {
    if (!open) return
    setTo(phone)
    setMail(email)
    setBody(text)
    setResult({ ok: '', err: '' })
    setStatus(null)
    if (!hasMessaging()) return
    let alive = true
    messagingStatus()
      .then((st) => {
        if (!alive) return
        setStatus(st)
        setChannel(st.whatsapp ? 'whatsapp' : st.sms ? 'sms' : 'email')
      })
      .catch(() => alive && setStatus(null))
    return () => {
      alive = false
    }
  }, [open, phone, email, text])

  if (!open) return null
  const signedIn = hasMessaging()

  async function send() {
    setResult({ ok: '', err: '' })
    if (!body.trim()) return setResult({ ok: '', err: 'Write a message first.' })
    setBusy(true)
    try {
      if (channel === 'email') {
        await sendEmail(mail.trim(), subject, body.trim())
        setResult({ ok: `Email sent to ${mail.trim()}.`, err: '' })
      } else if (channel === 'sms') {
        await sendSms(to.trim(), body.trim(), { toName: name })
        setResult({ ok: 'SMS queued. The lab phone sends it from its SIM within a minute.', err: '' })
      } else {
        const r = await sendWhatsApp(to.trim(), body.trim())
        setResult({ ok: r?.queued ? 'WhatsApp message queued — it goes out in a moment.' : 'WhatsApp message sent.', err: '' })
      }
    } catch (e) {
      setResult({ ok: '', err: e.message || 'Could not send.' })
    } finally {
      setBusy(false)
    }
  }

  const note = channel === 'whatsapp' ? status?.whatsappNote : channel === 'sms' ? status?.smsNote : ''
  const channelOff = (channel === 'whatsapp' && status && !status.whatsapp) || (channel === 'sms' && status && !status.sms)

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4 no-print" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 border border-slate-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Send a message{name ? ` to ${name}` : ''}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Uses your business WhatsApp, SIM phone and mailbox from the Optix account.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-md text-slate-400 hover:bg-slate-100" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!signedIn ? (
          <div className="mt-4 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 font-medium">
            Messages go out through your Optix account. Sign out and sign in with your Optix account (the one from the Lab app) to use WhatsApp, SMS and Email here.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 mt-4">
              {CHANNELS.map(({ key, label, Icon, color }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setChannel(key)}
                  className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-[11px] font-bold transition ${channel === key ? color : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            {channel === 'email' ? (
              <input value={mail} onChange={(e) => setMail(e.target.value)} placeholder="customer@email.com" type="email" className="mt-3 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm" />
            ) : (
              <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Phone, e.g. 0300 1234567" inputMode="tel" className="mt-3 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm" />
            )}
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} className="mt-2 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium" placeholder="Your message" />

            {note && <p className="mt-2 text-[11px] font-medium text-amber-700">{note}</p>}
            {result.err && <p className="mt-2 text-xs font-semibold text-rose-600">{result.err}</p>}
            {result.ok && <p className="mt-2 text-xs font-semibold text-emerald-700">{result.ok}</p>}

            <button
              type="button"
              onClick={send}
              disabled={busy || channelOff}
              className="mt-3 w-full py-2.5 rounded-xl bg-[#2f6df6] hover:bg-[#1f4fd1] disabled:opacity-50 text-white text-sm font-extrabold transition"
            >
              {busy ? 'Sending…' : 'Send'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

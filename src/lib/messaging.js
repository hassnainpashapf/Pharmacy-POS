// WhatsApp, SIM SMS and Email for the Pharmacy POS — all three go through the business's Optix cloud account
// (the same WhatsApp number, the same SIM phone and the same mailbox the Lab app uses), so nothing is set up twice.
import { centralCall, getCentral } from './central'

function token() {
  const central = getCentral()
  if (!central?.token) {
    throw new Error('Sign in with your Optix account to send messages (the old station login cannot send them).')
  }
  return central.token
}

export const hasMessaging = () => Boolean(getCentral()?.token)

// What can this business send right now?  { whatsapp: bool, sms: bool, email: true }
export async function messagingStatus() {
  const t = token()
  const [wa, sms] = await Promise.all([
    centralCall('/api/wa/status', { token: t }).catch(() => null),
    centralCall('/api/sms/status', { token: t }).catch(() => null),
  ])
  return {
    whatsapp: Boolean(wa && wa.enabled && wa.state === 'open'),
    whatsappNote: wa ? (wa.state === 'open' ? '' : 'WhatsApp is not linked yet (Lab app → Tools → WhatsApp → Settings).') : 'Could not check WhatsApp.',
    sms: Boolean(sms && sms.enabled),
    smsNote: sms ? (sms.enabled ? '' : 'SIM SMS is switched off (Lab app → Tools → SIM Setting).') : 'Could not check SIM SMS.',
    email: true,
  }
}

export function sendWhatsApp(to, text) {
  return centralCall('/api/wa/send', { method: 'POST', token: token(), body: { to, text } })
}

export function sendSms(to, text, { toName } = {}) {
  return centralCall('/api/sms/queue', {
    method: 'POST',
    token: token(),
    body: { to, text, kind: 'message', source: 'pharmacy', toName: toName || '' },
  })
}

export function sendEmail(to, subject, text) {
  return centralCall('/api/mail/send', { method: 'POST', token: token(), body: { to, subject, text } })
}

// WhatsApp, SIM SMS and Email for a product — all three go through the business's account at the hub
// (the same WhatsApp number, SIM phone and mailbox every product of the business shares).

export function createMessaging(hub) {
  const token = () => {
    const session = hub.getSession()
    if (!session?.token) throw new Error('Sign in with your Optix account to send messages.')
    return session.token
  }
  return {
    isAvailable: () => Boolean(hub.getSession()?.token),
    // what can this business send right now?  { whatsapp, whatsappNote, sms, smsNote, email }
    async status() {
      const t = token()
      const [wa, sms] = await Promise.all([hub.call('/api/wa/status', { token: t }).catch(() => null), hub.call('/api/sms/status', { token: t }).catch(() => null)])
      return {
        whatsapp: Boolean(wa && wa.enabled && wa.state === 'open'),
        whatsappNote: wa ? (wa.state === 'open' ? '' : 'WhatsApp is not linked yet (Lab app → Tools → WhatsApp → Settings).') : 'Could not check WhatsApp.',
        sms: Boolean(sms && sms.enabled),
        smsNote: sms ? (sms.enabled ? '' : 'SIM SMS is switched off (Lab app → Tools → SIM Setting).') : 'Could not check SIM SMS.',
        email: true,
      }
    },
    sendWhatsApp: (to, text) => hub.call('/api/wa/send', { method: 'POST', token: token(), body: { to, text } }),
    // `source` tags the message with the product that sent it (shows in the SMS log)
    sendSms: (to, text, { toName } = {}) =>
      hub.call('/api/sms/queue', { method: 'POST', token: token(), body: { to, text, kind: 'message', source: hub.appId, toName: toName || '' } }),
    sendEmail: (to, subject, text) => hub.call('/api/mail/send', { method: 'POST', token: token(), body: { to, subject, text } }),
  }
}

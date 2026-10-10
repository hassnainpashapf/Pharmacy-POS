import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { syncCloudSession } from '../lib/db'
import { syncNow } from '../lib/syncEngine'
import { exchangeTicket, localPasswordFor, rememberCentral, toLocalUser } from '../lib/central'

// Arriving from the Lab site: #/sso?ticket=... is swapped for a pharmacy session (the ticket works once, for 60 seconds).
export default function Sso() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const ticket = params.get('ticket') || ''
    if (!/^[0-9a-f]{20,}$/.test(ticket)) {
      setError('This sign-in link is not valid. Please sign in again.')
      return
    }
    exchangeTicket(ticket)
      .then((result) => {
        if (!(result.apps || []).includes('pharmacy')) throw new Error('Your account does not have access to the Pharmacy POS.')
        rememberCentral(result)
        syncCloudSession(toLocalUser(result), localPasswordFor(null))
        syncNow().catch(() => {})
        navigate('/', { replace: true })
      })
      .catch((e) => setError(e.message || 'Could not sign you in.'))
  }, [params, navigate])

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-o-bg px-4 font-sans">
      <div className="bg-white rounded-[28px] shadow-[0_30px_80px_-25px_rgba(27,42,74,0.18)] p-10 w-full max-w-md border border-o-line text-center">
        {error ? (
          <>
            <h1 className="text-xl font-extrabold text-o-ink">Could not sign you in</h1>
            <p className="text-sm text-o-muted mt-2">{error}</p>
            <a href="#/" className="inline-block mt-5 bg-o-blue text-white px-5 py-3 rounded-2xl font-extrabold text-sm">
              Go to sign in
            </a>
          </>
        ) : (
          <>
            <h1 className="text-xl font-extrabold text-o-ink">Signing you in…</h1>
            <p className="text-sm text-o-muted mt-2">One moment</p>
          </>
        )}
      </div>
    </div>
  )
}

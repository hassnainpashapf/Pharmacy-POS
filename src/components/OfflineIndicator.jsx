import { useEffect, useState } from 'react'

export default function OfflineIndicator() {
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])

  if (online) return null
  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-600 text-white text-center text-xs font-bold py-1.5 shadow-md flex items-center justify-center gap-2">
      <span>●</span> OFFLINE MODE — Terminal operating offline. Data is saved locally.
    </div>
  )
}

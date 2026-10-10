import React from 'react'

// The public Optix MedSync website (public/medsync/index.html, themed like every Optix website). It is shown full screen
// when nobody is signed in; the page has its own Sign in button that opens #/login. The same page is also served at /medsync/.
export default function LandingPage() {
  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden bg-o-bg z-50">
      <iframe
        src="./medsync/index.html"
        title="Optix MedSync"
        className="w-full h-full border-0 block"
      />
    </div>
  )
}

import React from 'react'

export default function LandingPage() {
  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden bg-[#f2f5f9] z-50">
      <iframe
        src="./medsync/index.html"
        title="Optix MedSync"
        className="w-full h-full border-0 block"
      />
    </div>
  )
}

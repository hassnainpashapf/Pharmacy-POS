import React from 'react'

export default function BrandLogo({ className = 'w-8 h-8 rounded-lg shrink-0 shadow-sm' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Optix MedSync Logo"
    >
      <defs>
        <linearGradient id="brandLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b7bfa" />
          <stop offset="40%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#113694" />
        </linearGradient>
        <linearGradient id="brandMintGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5eead4" />
          <stop offset="100%" stopColor="#14b8a6" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#brandLogoGrad)" />
      {/* Outer Orbit */}
      <circle cx="256" cy="256" r="160" stroke="#ffffff" strokeWidth="26" fill="none" opacity="0.95" />
      {/* Healthcare Sync Arc */}
      <path d="M 256 150 A 106 106 0 1 1 150 256" stroke="url(#brandMintGlow)" strokeWidth="28" strokeLinecap="round" fill="none" />
      {/* Center Optix Core */}
      <circle cx="256" cy="256" r="52" stroke="#ffffff" strokeWidth="20" fill="#173da6" />
      <circle cx="256" cy="256" r="18" fill="url(#brandMintGlow)" />
    </svg>
  )
}

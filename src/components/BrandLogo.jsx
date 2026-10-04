import React from 'react'

export default function BrandLogo({ className = 'w-8 h-8 rounded-lg shrink-0 shadow-sm' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Pharmacy Logo"
    >
      <rect width="512" height="512" rx="96" fill="#008f8b" />
      <path d="M216 128h80v88h88v80h-88v88h-80v-88h-88v-80h88z" fill="#ffffff" />
    </svg>
  )
}

import React, { useState } from 'react'
import { Link } from 'react-router'
import ThreeBackground from '../components/ThreeBackground'
import BrandLogo from '../components/BrandLogo'
import {
  Download,
  ExternalLink,
  ShieldCheck,
  Zap,
  RefreshCw,
  Clock,
  ClipboardCheck,
  Building2,
  Receipt,
  Printer,
  Monitor,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Database,
  Layers,
  ChevronRight,
  Laptop,
} from 'lucide-react'

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState('pos')
  const downloadUrl =
    'https://github.com/hassnainpashapf/Pharmacy-POS/releases/download/v1.0.0/Pharmacy-POS-Station-Setup.exe'

  return (
    <div className="relative min-h-screen text-slate-100 font-sans selection:bg-cyan-500 selection:text-slate-950 overflow-x-hidden">
      {/* 1. Full-Screen Immersive 3D WebGL Background */}
      <ThreeBackground />

      {/* 2. Top Navigation Bar (Frosted Glass) */}
      <header className="sticky top-0 z-50 backdrop-blur-2xl bg-slate-950/70 border-b border-white/10 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo className="w-11 h-11 rounded-2xl shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-500/30" />
            <div>
              <div className="font-black text-lg text-white tracking-tight flex items-center gap-2">
                <span>System Optix</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  3D OS v1.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Autonomous Pharmacy Operating System</p>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-300">
            <a href="#features" className="hover:text-cyan-400 transition-colors">
              Features
            </a>
            <a href="#screens" className="hover:text-cyan-400 transition-colors">
              Live Preview
            </a>
            <a href="#specs" className="hover:text-cyan-400 transition-colors">
              Hardware Specs
            </a>
            <a href="#download" className="hover:text-cyan-400 transition-colors">
              Download .exe
            </a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            <Link
              to="/pos"
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-200 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-md transition-all hidden sm:flex items-center gap-1.5"
            >
              <span>Launch POS App</span>
              <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
            </Link>

            <a
              href={downloadUrl}
              download="Pharmacy-POS-Station-Setup.exe"
              className="px-4 py-2.5 rounded-xl text-xs font-black text-slate-950 bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 shadow-lg shadow-cyan-500/25 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>Download (.exe)</span>
            </a>
          </div>
        </div>
      </header>

      {/* 3. Hero Section (Floating Over Full-Screen 3D Universe) */}
      <section className="relative pt-16 pb-24 md:pt-24 md:pb-32 text-center max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* Neon Floating Badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-xl border border-cyan-500/40 text-cyan-300 text-xs font-bold shadow-lg shadow-cyan-950/40">
            <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span>100% OFFLINE-FIRST ARCHITECTURE • AUTONOMOUS CLOUD SYNC</span>
          </div>

          {/* Giant Title */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black text-white tracking-tight leading-[1.08]">
            The Next Generation of <br />
            <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
              Pharmacy Intelligence
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg md:text-xl text-slate-300 max-w-3xl mx-auto font-normal leading-relaxed">
            Built for pharmacies that never stop. Bill at{' '}
            <strong className="text-cyan-400 font-bold">&lt;1ms latency</strong> with zero internet dependency,
            while background engines autonomously sync batches, inventory, and ledger to the cloud.
          </p>

          {/* Main Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <a
              href={downloadUrl}
              download="Pharmacy-POS-Station-Setup.exe"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl text-sm font-black text-slate-950 bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 shadow-2xl shadow-cyan-500/30 transition-all flex items-center justify-center gap-3 active:scale-95 cursor-pointer"
            >
              <Download className="w-5 h-5 stroke-[2.5]" />
              <span>Download for Windows (.exe)</span>
              <span className="text-[11px] font-bold bg-slate-950/20 px-2.5 py-0.5 rounded-md">111 MB</span>
            </a>

            <Link
              to="/pos"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl text-sm font-bold text-white bg-slate-900/70 hover:bg-slate-800/80 border border-white/20 backdrop-blur-xl transition-all flex items-center justify-center gap-2.5 active:scale-95"
            >
              <span>Launch Live Counter Station</span>
              <ArrowRight className="w-4 h-4 text-cyan-400" />
            </Link>
          </div>

          {/* Live System Stat Badges */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 pt-8 max-w-4xl mx-auto">
            <div className="p-4 rounded-2xl bg-slate-900/50 backdrop-blur-xl border border-white/10 shadow-lg text-center">
              <div className="text-2xl sm:text-3xl font-black text-cyan-400">&lt;1 ms</div>
              <div className="text-xs text-slate-400 font-medium mt-1">Billing Latency</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/50 backdrop-blur-xl border border-white/10 shadow-lg text-center">
              <div className="text-2xl sm:text-3xl font-black text-teal-400">10 Min</div>
              <div className="text-xs text-slate-400 font-medium mt-1">Silent Auto-Sync</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/50 backdrop-blur-xl border border-white/10 shadow-lg text-center">
              <div className="text-2xl sm:text-3xl font-black text-emerald-400">100%</div>
              <div className="text-xs text-slate-400 font-medium mt-1">Offline Resilient</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/50 backdrop-blur-xl border border-white/10 shadow-lg text-center">
              <div className="text-2xl sm:text-3xl font-black text-purple-400">10,000+</div>
              <div className="text-xs text-slate-400 font-medium mt-1">Medicine Catalog</div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Core Features Pillars (Frosted Glass Cards) */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" id="features">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs font-bold border border-cyan-500/30">
            <Zap className="w-3.5 h-3.5" />
            ENTERPRISE ARCHITECTURE
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Engineered for Continuous 24/7 Pharmacy Operations
          </h2>
          <p className="text-slate-300 text-sm sm:text-base">
            Every screen, transaction, and sync worker is optimized for cashier speed, physical audits, and zero downtime.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: Offline-First */}
          <div className="p-7 rounded-3xl bg-slate-900/50 backdrop-blur-xl border border-white/10 hover:border-cyan-500/50 transition-all hover:shadow-2xl hover:shadow-cyan-950/40 group space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
              100% Offline-First Billing
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              If your Wi-Fi drops or internet is down, the cashier counter never stops. Complete sales, print thermal receipts, and adjust local stock instantly.
            </p>
            <div className="pt-2 flex items-center gap-2 text-xs text-cyan-400 font-semibold">
              <span>Zero network latency</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          {/* Card 2: Autonomous Cloud Sync */}
          <div className="p-7 rounded-3xl bg-slate-900/50 backdrop-blur-xl border border-white/10 hover:border-teal-500/50 transition-all hover:shadow-2xl hover:shadow-teal-950/40 group space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
              <RefreshCw className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-teal-300 transition-colors">
              Autonomous Two-Way Sync
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Silent background daemon runs every 10 minutes and on internet reconnect. Local sales push to cloud, and updated medicine catalog merges automatically.
            </p>
            <div className="pt-2 flex items-center gap-2 text-xs text-teal-400 font-semibold">
              <span>Auto reconnect flush</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          {/* Card 3: Batch Expiry Radar */}
          <div className="p-7 rounded-3xl bg-slate-900/50 backdrop-blur-xl border border-white/10 hover:border-rose-500/50 transition-all hover:shadow-2xl hover:shadow-rose-950/40 group space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-rose-300 transition-colors">
              Batch & Expiry Action Radar
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Monitors medicines in 30, 60, and 90-day expiry windows. Automatically builds purchase return debit vouchers with 1-click supplier routing before inventory expires.
            </p>
            <div className="pt-2 flex items-center gap-2 text-xs text-rose-400 font-semibold">
              <span>FEFO smart allocation</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          {/* Card 4: Physical Stock Audit */}
          <div className="p-7 rounded-3xl bg-slate-900/50 backdrop-blur-xl border border-white/10 hover:border-amber-500/50 transition-all hover:shadow-2xl hover:shadow-amber-950/40 group space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
              Physical Stock Audit Engine
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Conduct blind physical counts vs system stock with barcode scanners. Generates mathematical discrepancy values with gain/loss financial adjustments.
            </p>
            <div className="pt-2 flex items-center gap-2 text-xs text-amber-400 font-semibold">
              <span>Auditor variance reports</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          {/* Card 5: Company Stock Hub */}
          <div className="p-7 rounded-3xl bg-slate-900/50 backdrop-blur-xl border border-white/10 hover:border-purple-500/50 transition-all hover:shadow-2xl hover:shadow-purple-950/40 group space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors">
              Company Stock Hub
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Organizes pharmaceuticals by manufacturing brand (GSK, Abbott, Getz, Pfizer). Enables fast restock orders and direct distributor ledger verification.
            </p>
            <div className="pt-2 flex items-center gap-2 text-xs text-purple-400 font-semibold">
              <span>Brand-level stock intelligence</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          {/* Card 6: ESC/POS Thermal Printing */}
          <div className="p-7 rounded-3xl bg-slate-900/50 backdrop-blur-xl border border-white/10 hover:border-emerald-500/50 transition-all hover:shadow-2xl hover:shadow-emerald-950/40 group space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Printer className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
              High-Speed Thermal Receipts
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Native support for 80mm & 58mm thermal printers with custom pharmacy headers, tax breakups, QR codes, Urdu instructions, and automated cash drawer kick.
            </p>
            <div className="pt-2 flex items-center gap-2 text-xs text-emerald-400 font-semibold">
              <span>Universal printer support</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
        </div>
      </section>

      {/* 5. Interactive UI Screen Explorer */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" id="screens">
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            High-Speed Counter Interface
          </h2>
          <p className="text-slate-300 text-sm">
            Inspect the high-contrast interface designed for rapid keystroke billing and inventory tracking.
          </p>

          {/* Interactive Tab Switcher */}
          <div className="inline-flex p-1.5 rounded-2xl bg-slate-900/70 backdrop-blur-xl border border-white/10 mt-4 max-w-full overflow-x-auto">
            {[
              { id: 'pos', label: 'Sales & POS Counter', icon: Receipt },
              { id: 'stock', label: 'Company Stock Hub', icon: Building2 },
              { id: 'expiry', label: 'Expiry Action Radar', icon: Clock },
              { id: 'audit', label: 'Physical Audit Engine', icon: ClipboardCheck },
            ].map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-[#008f8b] text-white shadow-lg shadow-[#008f8b]/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Mockup Frame */}
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl max-w-5xl mx-auto">
          <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
              <span className="text-xs text-slate-400 font-mono ml-2">System Optix Terminal • Active Station</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Offline Ready • 0ms</span>
            </div>
          </div>

          {activeTab === 'pos' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-3">
                <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-white/10 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-mono">Barcode Scanner Ready • Type Medicine Name</span>
                  <span className="bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded font-bold">F2 Cart</span>
                </div>
                <div className="space-y-2">
                  {[
                    { name: 'Panadol Extra 500mg (GSK)', batch: 'B7812', qty: '2 Strips', price: 'Rs. 70.00' },
                    { name: 'Augmentin 625mg (GSK)', batch: 'AUG-99', qty: '1 Box', price: 'Rs. 420.00' },
                    { name: 'Brufen 400mg (Abbott)', batch: 'BF-312', qty: '1 Box', price: 'Rs. 185.00' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-white/10 text-xs">
                      <div>
                        <div className="font-bold text-white">{item.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">Batch: {item.batch} • {item.qty}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-extrabold text-cyan-400">{item.price}</div>
                        <div className="text-[9px] text-emerald-400">In Stock</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-gradient-to-b from-[#3b1734] to-[#1c0818] border border-[#5a1836] text-white flex flex-col justify-between">
                <div>
                  <div className="text-xs text-rose-200 font-bold uppercase tracking-wider">Sale Summary</div>
                  <div className="text-3xl font-black mt-2 text-white">Rs. 675.00</div>
                  <div className="text-[11px] text-rose-200/80 mt-1">3 Items • Cash Payment Mode</div>
                </div>
                <div className="space-y-2 mt-4">
                  <button type="button" className="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs hover:bg-emerald-400 transition-colors shadow-lg">
                    Complete Sale & Print (F10)
                  </button>
                  <button type="button" className="w-full py-2 rounded-xl bg-white/10 text-white font-bold text-xs hover:bg-white/20 transition-colors">
                    Hold Bill (F4)
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'stock' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { company: 'GSK Pakistan', skus: '142 SKUs', val: 'Rs. 1,420,000' },
                  { company: 'Abbott Labs', skus: '98 SKUs', val: 'Rs. 890,000' },
                  { company: 'Getz Pharma', skus: '115 SKUs', val: 'Rs. 1,120,000' },
                  { company: 'Searle Pharma', skus: '64 SKUs', val: 'Rs. 580,000' },
                ].map((c, i) => (
                  <div key={i} className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/10 text-left">
                    <div className="font-bold text-xs text-white truncate">{c.company}</div>
                    <div className="text-[10px] text-slate-400">{c.skus}</div>
                    <div className="text-sm font-extrabold text-cyan-400 mt-2">{c.val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'expiry' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-rose-950/50 border border-rose-800/60 text-left">
                <div className="text-xs font-bold text-rose-300">Under 30 Days</div>
                <div className="text-2xl font-black text-rose-400 mt-1">4 Batches</div>
                <div className="text-[10px] text-rose-300/80 mt-1">Action: Immediate Supplier Debit Return</div>
              </div>
              <div className="p-4 rounded-2xl bg-amber-950/50 border border-amber-800/60 text-left">
                <div className="text-xs font-bold text-amber-300">30 – 60 Days</div>
                <div className="text-2xl font-black text-amber-400 mt-1">11 Batches</div>
                <div className="text-[10px] text-amber-300/80 mt-1">Action: Counter Priority Dispensing</div>
              </div>
              <div className="p-4 rounded-2xl bg-cyan-950/50 border border-cyan-800/60 text-left">
                <div className="text-xs font-bold text-cyan-300">60 – 90 Days</div>
                <div className="text-2xl font-black text-cyan-400 mt-1">29 Batches</div>
                <div className="text-[10px] text-cyan-300/80 mt-1">Action: Monitored Normal Rotation</div>
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-white/10 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-white">Shelf Audit Session #104</span>
                <span className="text-slate-400 text-[11px] block">Auditor: Bilal Cashier • Blind Count Active</span>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                99.4% Accurate
              </span>
            </div>
          )}
        </div>
      </section>

      {/* 6. Download Center Section */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" id="download">
        <div className="rounded-3xl bg-slate-900/60 backdrop-blur-2xl border border-cyan-500/30 p-8 sm:p-12 relative overflow-hidden shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-bold border border-cyan-500/40">
                <Download className="w-3.5 h-3.5" />
                <span>OFFICIAL VERIFIED WINDOWS RELEASE • v1.0.0</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                Download System Optix Pharmacy Station
              </h2>
              <p className="text-slate-300 text-sm sm:text-base max-w-2xl leading-relaxed">
                Single installer for Windows 10 & 11 (64-bit). Works 100% offline, connects with any thermal printer and barcode scanner, and updates silently in the background.
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-2 font-mono">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" /> Windows 10/11 (64-bit)
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" /> Size: 111 MB
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" /> 100% Offline Resilient
                </span>
              </div>
            </div>

            <div className="lg:col-span-4 flex flex-col gap-3">
              <a
                href={downloadUrl}
                download="Pharmacy-POS-Station-Setup.exe"
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-black text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <Download className="w-5 h-5 stroke-[2.5]" />
                <span>Download Setup (.exe)</span>
              </a>

              <Link
                to="/pos"
                className="w-full py-3.5 px-6 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/10 backdrop-blur-md transition-all text-center"
              >
                <span>Open in Web Browser</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Hardware Compatibility */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-white/10" id="specs">
        <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
          <h3 className="text-2xl font-bold text-white tracking-tight">Plug-and-Play Hardware Specs</h3>
          <p className="text-slate-400 text-xs sm:text-sm">Works out of the box with your existing retail pharmacy hardware.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="p-5 rounded-2xl bg-slate-900/50 backdrop-blur-xl border border-white/10">
            <Printer className="w-7 h-7 text-cyan-400 mx-auto mb-2" />
            <div className="font-bold text-sm text-white">Thermal Printers</div>
            <div className="text-xs text-slate-400 mt-1">80mm & 58mm ESC/POS USB & Network</div>
          </div>
          <div className="p-5 rounded-2xl bg-slate-900/50 backdrop-blur-xl border border-white/10">
            <Zap className="w-7 h-7 text-teal-400 mx-auto mb-2" />
            <div className="font-bold text-sm text-white">Barcode Scanners</div>
            <div className="text-xs text-slate-400 mt-1">1D / 2D / QR USB & Wireless Scanners</div>
          </div>
          <div className="p-5 rounded-2xl bg-slate-900/50 backdrop-blur-xl border border-white/10">
            <Monitor className="w-7 h-7 text-purple-400 mx-auto mb-2" />
            <div className="font-bold text-sm text-white">Touchscreens & PCs</div>
            <div className="text-xs text-slate-400 mt-1">Windows 10/11, All-In-One POS Terminals</div>
          </div>
          <div className="p-5 rounded-2xl bg-slate-900/50 backdrop-blur-xl border border-white/10">
            <Database className="w-7 h-7 text-emerald-400 mx-auto mb-2" />
            <div className="font-bold text-sm text-white">Cash Drawers</div>
            <div className="text-xs text-slate-400 mt-1">RJ11 / RJ12 Automated Kick Supported</div>
          </div>
        </div>
      </section>

      {/* 8. Footer */}
      <footer className="border-t border-white/10 bg-slate-950/80 backdrop-blur-2xl py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <BrandLogo className="w-9 h-9 rounded-xl" />
            <div>
              <div className="font-extrabold text-sm text-white">System Optix Pharmacy Station</div>
              <p className="text-[11px] text-slate-500">Autonomous Pharmacy Operating System • 3D Edition</p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-400">
            <Link to="/pos" className="hover:text-cyan-400 transition-colors">
              POS Terminal
            </Link>
            <Link to="/sales-history" className="hover:text-cyan-400 transition-colors">
              Sales History
            </Link>
            <Link to="/company-stock" className="hover:text-cyan-400 transition-colors">
              Stock Hub
            </Link>
            <a href={downloadUrl} className="hover:text-cyan-400 transition-colors">
              Windows Setup (.exe)
            </a>
          </div>

          <div className="text-[11px] text-slate-500 text-center md:text-right">
            © {new Date().getFullYear()} System Optix. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}

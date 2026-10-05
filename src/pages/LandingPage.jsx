import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import ThreeHeroCanvas from '../components/ThreeHeroCanvas'
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
  ChevronRight,
  Monitor,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Database,
  Lock,
  Layers,
  Cpu,
  Smartphone,
  Star,
  Users,
} from 'lucide-react'

export default function LandingPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('pos')

  const downloadUrl = 'https://github.com/hassnainpashapf/Pharmacy-POS/releases/download/v1.0.0/Pharmacy-POS-Station-Setup.exe'

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500 selection:text-slate-950 overflow-x-hidden">
      {/* 1. Frosted Navigation Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo className="w-11 h-11 rounded-2xl shadow-lg shadow-cyan-500/20" />
            <div>
              <div className="font-extrabold text-lg text-white tracking-tight flex items-center gap-2">
                <span>System Optix</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  3D v1.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Next-Gen Pharmacy OS & Autonomous Station</p>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-slate-300">
            <a href="#features" className="hover:text-cyan-400 transition-colors">
              Features
            </a>
            <a href="#3d-engine" className="hover:text-cyan-400 transition-colors">
              3D Architecture
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
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 transition-all hidden sm:flex items-center gap-1.5"
            >
              <span>Launch POS App</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>

            <a
              href={downloadUrl}
              download="Pharmacy-POS-Station-Setup.exe"
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 shadow-lg shadow-cyan-500/25 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Download (.exe)</span>
            </a>
          </div>
        </div>
      </header>

      {/* 2. Hero Section with 3D Interactive WebGL Engine */}
      <section className="relative pt-10 pb-20 md:py-24 overflow-hidden border-b border-slate-800/80">
        {/* Ambient Glowing Gradients */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-gradient-to-tr from-cyan-600/15 via-teal-500/10 to-purple-600/15 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Content Column */}
            <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-cyan-500/30 text-cyan-400 text-xs font-semibold shadow-inner">
                <Sparkles className="w-3.5 h-3.5 text-cyan-300 animate-spin" style={{ animationDuration: '6s' }} />
                <span>OFFLINE-FIRST 2.0 • AUTONOMOUS CLOUD SYNC</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1]">
                Next-Gen <br className="hidden sm:inline" />
                <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
                  3D Pharmacy POS
                </span>{' '}
                <br />& Counter Station.
              </h1>

              <p className="text-base sm:text-lg text-slate-300 max-w-xl mx-auto lg:mx-0 font-normal leading-relaxed">
                Engineered for high-volume pharmacies. Continue billing and printing receipts at <strong className="text-white font-semibold">&lt;1ms latency</strong> with zero internet dependency, while background engines autonomously sync with the cloud.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-2">
                <a
                  href={downloadUrl}
                  download="Pharmacy-POS-Station-Setup.exe"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-2xl text-sm font-extrabold text-slate-950 bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 shadow-xl shadow-cyan-500/25 transition-all flex items-center justify-center gap-2.5 active:scale-95 cursor-pointer"
                >
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  <span>Download for Windows (.exe)</span>
                  <span className="text-[10px] font-bold bg-slate-950/20 px-2 py-0.5 rounded-md ml-1">111 MB</span>
                </a>

                <Link
                  to="/pos"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-2xl text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 border border-slate-700/80 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <span>Launch Live Station</span>
                  <ArrowRight className="w-4 h-4 text-cyan-400" />
                </Link>
              </div>

              {/* Trust Metric Badges */}
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-800/90 max-w-lg mx-auto lg:mx-0 text-left">
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                  <div className="text-xl font-black text-cyan-400">&lt;1 ms</div>
                  <div className="text-[11px] text-slate-400 font-medium">Billing Latency</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                  <div className="text-xl font-black text-teal-400">10 Min</div>
                  <div className="text-[11px] text-slate-400 font-medium">Silent Auto-Sync</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                  <div className="text-xl font-black text-emerald-400">100%</div>
                  <div className="text-[11px] text-slate-400 font-medium">Offline Resilient</div>
                </div>
              </div>
            </div>

            {/* Right 3D WebGL Canvas Interactive Column */}
            <div className="lg:col-span-6" id="3d-engine">
              <ThreeHeroCanvas />
            </div>
          </div>
        </div>
      </section>

      {/* 3. Core Feature Pillars */}
      <section className="py-20 md:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" id="features">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs font-bold border border-cyan-500/20">
            <Zap className="w-3.5 h-3.5" />
            ENTERPRISE ARCHITECTURE
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Designed for Modern Pharmacies That Can Never Stop.
          </h2>
          <p className="text-slate-400 text-sm sm:text-base">
            Every screen, workflow, and database layer is optimized for continuous operations, physical audits, and multi-staff billing speed.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: Offline-First */}
          <div className="p-7 rounded-3xl bg-slate-900/70 border border-slate-800/90 hover:border-cyan-500/40 transition-all hover:shadow-xl hover:shadow-cyan-950/30 group space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
              100% Offline-First Billing
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Wi-Fi disconnected or fiber optic down? The terminal never hangs or shows loading spinners. Local SQLite & cache processes sales with instant thermal printing.
            </p>
            <div className="pt-2 flex items-center gap-2 text-xs text-cyan-400 font-semibold">
              <span>Zero network latency</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          {/* Card 2: Autonomous Cloud Sync */}
          <div className="p-7 rounded-3xl bg-slate-900/70 border border-slate-800/90 hover:border-teal-500/40 transition-all hover:shadow-xl hover:shadow-teal-950/30 group space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <RefreshCw className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-teal-300 transition-colors">
              Autonomous Two-Way Sync
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Background engine runs silently every 10 minutes and instantly upon internet reconnect. Offline sales are safely pushed to cloud, while new batches & rates merge locally.
            </p>
            <div className="pt-2 flex items-center gap-2 text-xs text-teal-400 font-semibold">
              <span>Automatic reconnect flush</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          {/* Card 3: Batch Expiry Radar */}
          <div className="p-7 rounded-3xl bg-slate-900/70 border border-slate-800/90 hover:border-rose-500/40 transition-all hover:shadow-xl hover:shadow-rose-950/30 group space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-rose-300 transition-colors">
              Batch & Expiry Action Radar
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Tracks medicines in 30, 60, and 90-day expiry windows. Automatically builds purchase return debit vouchers with 1-click supplier routing before inventory expires.
            </p>
            <div className="pt-2 flex items-center gap-2 text-xs text-rose-400 font-semibold">
              <span>FEFO smart allocation</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          {/* Card 4: Physical Stock Audit */}
          <div className="p-7 rounded-3xl bg-slate-900/70 border border-slate-800/90 hover:border-amber-500/40 transition-all hover:shadow-xl hover:shadow-amber-950/30 group space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
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
          <div className="p-7 rounded-3xl bg-slate-900/70 border border-slate-800/90 hover:border-purple-500/40 transition-all hover:shadow-xl hover:shadow-purple-950/30 group space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
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
          <div className="p-7 rounded-3xl bg-slate-900/70 border border-slate-800/90 hover:border-emerald-500/40 transition-all hover:shadow-xl hover:shadow-emerald-950/30 group space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
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

      {/* 4. Interactive Live Screen Showcase */}
      <section className="py-20 bg-slate-900/40 border-y border-slate-800/80" id="screens">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              Intuitive Interface Built For Counter Speed
            </h2>
            <p className="text-slate-400 text-sm">
              Inspect the high-contrast, clean UI designed for fast cashier workflows and accurate management.
            </p>

            {/* Interactive Tab Switcher */}
            <div className="inline-flex p-1.5 rounded-2xl bg-slate-900 border border-slate-800 mt-4 max-w-full overflow-x-auto">
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

          {/* Interactive Mockup Container */}
          <div className="relative rounded-3xl border border-slate-800 bg-slate-950 p-4 sm:p-6 shadow-2xl overflow-hidden max-w-5xl mx-auto">
            {/* Terminal Window Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-6">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="text-xs text-slate-400 font-mono ml-2">System Optix Terminal • Active Station</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Station Ready • 0ms</span>
              </div>
            </div>

            {/* Tab 1: POS Counter Mockup */}
            {activeTab === 'pos' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-3">
                    <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-mono">Barcode Scanner Ready • Type Medicine Name</span>
                      <span className="text-xs bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded font-bold">F2 Quick Cart</span>
                    </div>

                    <div className="space-y-2">
                      {[
                        { name: 'Panadol Extra 500mg (GSK)', batch: 'B7812', qty: '2 Strips', price: 'Rs. 70.00' },
                        { name: 'Augmentin 625mg (GSK)', batch: 'AUG-99', qty: '1 Box', price: 'Rs. 420.00' },
                        { name: 'Brufen 400mg (Abbott)', batch: 'BF-312', qty: '1 Box', price: 'Rs. 185.00' },
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs">
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

                  <div className="p-4 rounded-2xl bg-gradient-to-b from-[#3b1734] to-[#1e091a] border border-[#5a1836] text-white space-y-4 flex flex-col justify-between">
                    <div>
                      <div className="text-xs text-rose-200 font-bold uppercase tracking-wider">Sale Summary</div>
                      <div className="text-3xl font-black mt-2 text-white">Rs. 675.00</div>
                      <div className="text-[11px] text-rose-200/80 mt-1">3 Items • Cash Payment Mode</div>
                    </div>

                    <div className="space-y-2">
                      <button type="button" className="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs hover:bg-emerald-400 transition-colors shadow-lg">
                        Complete Sale & Print (F10)
                      </button>
                      <button type="button" className="w-full py-2 rounded-xl bg-white/10 text-white font-bold text-xs hover:bg-white/20 transition-colors">
                        Hold Bill (F4)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Company Stock Hub */}
            {activeTab === 'stock' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { company: 'GSK Pakistan', skus: '142 SKUs', val: 'Rs. 1,420,000' },
                    { company: 'Abbott Labs', skus: '98 SKUs', val: 'Rs. 890,000' },
                    { company: 'Getz Pharma', skus: '115 SKUs', val: 'Rs. 1,120,000' },
                    { company: 'Searle Pharma', skus: '64 SKUs', val: 'Rs. 580,000' },
                  ].map((c, i) => (
                    <div key={i} className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-left">
                      <div className="font-bold text-xs text-white truncate">{c.company}</div>
                      <div className="text-[10px] text-slate-400">{c.skus}</div>
                      <div className="text-sm font-extrabold text-cyan-400 mt-2">{c.val}</div>
                    </div>
                  ))}
                </div>
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400">
                  Total Managed Inventory Valuation: <strong className="text-emerald-400 font-bold">Rs. 4,010,000</strong> across 419 Active Medicines
                </div>
              </div>
            )}

            {/* Tab 3: Expiry Action Radar */}
            {activeTab === 'expiry' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-left">
                    <div className="text-xs font-bold text-rose-300">Under 30 Days</div>
                    <div className="text-2xl font-black text-rose-400 mt-1">4 Batches</div>
                    <div className="text-[10px] text-rose-300/80 mt-1">Action: Immediate Supplier Debit Return</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/60 text-left">
                    <div className="text-xs font-bold text-amber-300">30 – 60 Days</div>
                    <div className="text-2xl font-black text-amber-400 mt-1">11 Batches</div>
                    <div className="text-[10px] text-amber-300/80 mt-1">Action: Counter Priority Dispensing</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-800/60 text-left">
                    <div className="text-xs font-bold text-cyan-300">60 – 90 Days</div>
                    <div className="text-2xl font-black text-cyan-400 mt-1">29 Batches</div>
                    <div className="text-[10px] text-cyan-300/80 mt-1">Action: Monitored Normal Rotation</div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Physical Stock Audit */}
            {activeTab === 'audit' && (
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-white">Shelf Audit Session #104</span>
                    <span className="text-slate-400 text-[11px] block">Auditor: Bilal Cashier • Blind Count Active</span>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                    99.4% Accurate
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-xs text-slate-400 text-center">
                  Zero book discrepancy automatically adjusted to physical counts with financial loss vouchers.
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 5. Download Center Section */}
      <section className="py-20 md:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" id="download">
        <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-cyan-500/30 p-8 sm:p-12 relative overflow-hidden shadow-2xl">
          {/* Subtle Glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            <div className="lg:col-span-8 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs font-bold border border-cyan-500/20">
                <Download className="w-3.5 h-3.5" />
                <span>OFFICIAL VERIFIED WINDOWS RELEASE • v1.0.0</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                Get System Optix Pharmacy Station for Windows
              </h2>
              <p className="text-slate-300 text-sm sm:text-base max-w-2xl leading-relaxed">
                Download the official setup installer. Works 100% offline, connects with any thermal printer and barcode scanner, and updates silently in the background.
              </p>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-2 font-mono">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" /> Windows 10/11 (64-bit)
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" /> Size: 111 MB
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" /> Zero Internet Required
                </span>
              </div>
            </div>

            <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3">
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
                className="w-full py-3.5 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition-all text-center"
              >
                <span>Open in Web Browser</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Hardware Compatibility & Technical Specs */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-800/80" id="specs">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
          <h3 className="text-2xl font-bold text-white tracking-tight">Plug-and-Play Hardware Specs</h3>
          <p className="text-slate-400 text-xs sm:text-sm">Works out of the box with your existing retail pharmacy hardware.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
            <Printer className="w-7 h-7 text-cyan-400 mx-auto mb-2" />
            <div className="font-bold text-sm text-white">Thermal Printers</div>
            <div className="text-xs text-slate-400 mt-1">80mm & 58mm ESC/POS USB & Network</div>
          </div>
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
            <Zap className="w-7 h-7 text-teal-400 mx-auto mb-2" />
            <div className="font-bold text-sm text-white">Barcode Scanners</div>
            <div className="text-xs text-slate-400 mt-1">1D / 2D / QR USB & Wireless Scanners</div>
          </div>
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
            <Monitor className="w-7 h-7 text-purple-400 mx-auto mb-2" />
            <div className="font-bold text-sm text-white">Touchscreens & PCs</div>
            <div className="text-xs text-slate-400 mt-1">Windows 10/11, All-In-One POS Terminals</div>
          </div>
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
            <Database className="w-7 h-7 text-emerald-400 mx-auto mb-2" />
            <div className="font-bold text-sm text-white">Cash Drawers</div>
            <div className="text-xs text-slate-400 mt-1">RJ11 / RJ12 Automated Kick Supported</div>
          </div>
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-12">
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

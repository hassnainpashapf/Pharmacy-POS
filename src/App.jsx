import { BrowserRouter, Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router'
import React, { useState, useEffect, useLayoutEffect, lazy, Suspense, Component } from 'react'
import {
  useDB,
  currentUser,
  canAccess,
  logout,
  activeBranch,
  setBranch,
  branchById,
  isBranchLocked,
  dashboardStats,
  getCurrentShift,
  activeCounter,
  getCounters,
  fmt,
  ROLES,
  switchRoleUser,
} from './lib/db'
import Dashboard from './pages/Dashboard'
import POS from './pages/POS'
import SalesHistory from './pages/SalesHistory'
import Medicines from './pages/Medicines'
import Inventory from './pages/Inventory'
import Purchases from './pages/Purchases'
import CompanyStockHub from './pages/CompanyStockHub'
import StockAuditDashboard from './pages/StockAuditDashboard'
import ExpiryDashboard from './pages/ExpiryDashboard'
import PurchaseReturnsDashboard from './pages/PurchaseReturnsDashboard'
import { Suppliers, Customers } from './pages/People'
import Reports from './pages/Reports'
import Returns from './pages/Returns'
import Settings from './pages/Settings'
import SmartInventory from './pages/SmartInventory'
import Accounting from './pages/Accounting'
import Branches from './pages/Branches'
import OfflineIndicator from './components/OfflineIndicator'
import { initSyncEngine } from './lib/syncEngine'
import { isElectronShell, isNativeApp } from './lib/platformConfig'
import Users from './pages/Users'
import Login from './pages/Login'
import CommandPalette from './components/CommandPalette'

// V4 Enterprise & Local Additions
import HardwareStation from './pages/HardwareStation'
import AlertEngine from './components/AlertEngine'
import ShiftModal from './components/ShiftModal'

import {
  LayoutDashboard,
  ShoppingCart,
  Pill,
  Package,
  Brain,
  CircleDollarSign,
  ShoppingBag,
  Truck,
  Users as UsersIcon,
  RotateCcw,
  BarChart3,
  UserCog,
  Settings as SettingsIcon,
  Building2,
  LogOut,
  Maximize,
  Minimize,
  Search,
  Volume2,
  VolumeX,
  Clock,
  Sparkles,
  ChevronDown,
  AlertTriangle,
  Menu,
  Bell,
  Printer,
  Coins,
  Server,
  FileText,
  Award,
  Wallet,
  ArrowLeftRight,
  TrendingUp,
  FileSpreadsheet,
  ShieldCheck,
  AlertOctagon,
  ClipboardList,
  ClipboardCheck,
  Receipt as ReceiptIcon,
  HelpCircle,
  MessageSquare,
  Globe,
  Download,
  Smartphone,
  Monitor,
  Laptop,
  ExternalLink,
  Layers,
  Zap,
} from 'lucide-react'

const MobileInventory = lazy(() => import('./pages/MobileInventory'))
const Superadmin = lazy(() => import('./pages/Superadmin'))

// Sidebar visibility comes from the permission catalog: every item is filtered
// with canAccess(item.to), the same check the route guard uses, so the menu can
// never promise a page that the guard refuses (or hide one it allows).
const navGroups = [
  {
    title: 'OVERVIEW',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'OPERATIONS',
    items: [
      { to: '/pos', label: 'Sales & POS', icon: ShoppingCart },
      { to: '/sales-history', label: 'Sales History & Invoices', icon: ReceiptIcon },
      { to: '/returns', label: 'Returns & Refunds', icon: RotateCcw },
      { to: '/pos?tab=rx', label: 'Prescriptions', icon: FileText },
    ],
  },
  {
    title: 'STOCKS & DISCREPANCIES',
    items: [
      { to: '/company-stock', label: 'Company Stock Hub', icon: Building2 },
      { to: '/expiry-management', label: 'Batch & Expiry Action', icon: Clock },
      { to: '/purchase-returns', label: 'Purchase Returns', icon: RotateCcw },
    ],
  },
  {
    title: 'INVENTORY & PROCUREMENT',
    items: [
      { to: '/inventory', label: 'Stock Master Inventory', icon: Package },
      { to: '/stock-audit', label: 'Physical Stock Audit', icon: ClipboardCheck },
      { to: '/medicines', label: 'Medicines Catalogue', icon: Pill },
      { to: '/purchases', label: 'Purchases & Invoices', icon: ShoppingBag },
      { to: '/suppliers', label: 'Suppliers', icon: Truck },
    ],
  },
  {
    title: 'CUSTOMERS',
    items: [
      { to: '/customers', label: 'Customers', icon: UsersIcon },
      { to: '/customers?tab=loyalty', label: 'Loyalty & Credits', icon: Award },
    ],
  },
  {
    title: 'FINANCE',
    items: [
      { to: '/accounting', label: 'Accounting', icon: CircleDollarSign },
      { to: '/accounting?tab=expenses', label: 'Expenses', icon: Wallet },
      { to: '/suppliers?tab=payables', label: 'Receivables & Payables', icon: ArrowLeftRight },
    ],
  },
  {
    title: 'MANAGEMENT',
    items: [
      { to: '/branches', label: 'Branches', icon: Building2 },
      { to: '/users', label: 'User Roles & Staff', icon: UserCog },
    ],
  },
  {
    title: 'REPORTS',
    items: [
      { to: '/reports?tab=analytics', label: 'Business Analytics', icon: BarChart3 },
      { to: '/reports?tab=sales', label: 'Sales Reports', icon: TrendingUp },
      { to: '/reports?tab=inventory', label: 'Inventory Reports', icon: FileSpreadsheet },
      { to: '/reports?tab=financial', label: 'Financial Reports', icon: Coins },
    ],
  },
  {
    title: 'COMPLIANCE',
    items: [
      { to: '/hardware', label: 'Regulatory', icon: ShieldCheck },
      { to: '/medicines?filter=controlled', label: 'Controlled Substances', icon: AlertOctagon },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      { to: '/settings', label: 'Settings', icon: SettingsIcon },
      { to: '/settings?tab=audit', label: 'Audit Logs', icon: ClipboardList },
    ],
  },
]

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('POS UI Render Exception:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-900 text-white p-6 font-sans">
          <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center text-2xl font-bold">
              ⚠️
            </div>
            <h2 className="text-xl font-bold text-white">System Interface Alert</h2>
            <p className="text-xs text-slate-300">
              {this.state.error?.message || 'A visual interface refresh is needed.'}
            </p>
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null })
                  window.location.href = '/pos'
                }}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors"
              >
                ⚡ Launch POS Terminal
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null })
                  window.location.reload()
                }}
                className="w-full py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold text-xs transition-colors"
              >
                ↻ Reload Application
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function Shell({ children }) {
  const db = useDB()
  const me = currentUser()
  const loc = useLocation()
  const navigate = useNavigate()
  const stats = dashboardStats()
  const currentShift = getCurrentShift()

  const [time, setTime] = useState(new Date())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [branchMenuOpen, setBranchMenuOpen] = useState(false)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [installMessage, setInstallMessage] = useState('')

  // V4 Interactive Drawers & Modals
  const [alertOpen, setAlertOpen] = useState(false)
  const [shiftModalOpen, setShiftModalOpen] = useState(false)
  const [roleMenuOpen, setRoleMenuOpen] = useState(false)
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false)
  const [quickHubOpen, setQuickHubOpen] = useState(false)

  // Real-time clock update
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Auto-redirect roles to their primary workspace from root '/'
  useEffect(() => {
    if (me?.role === 'CASHIER' && loc.pathname === '/') {
      navigate('/pos', { replace: true })
    } else if (me?.role === 'RECEPTIONIST' && loc.pathname === '/') {
      navigate('/customers', { replace: true })
    }
  }, [me?.role, loc.pathname, navigate])

  // Browser-controlled PWA installation. The event is only available when
  // this origin is served over HTTPS (or localhost) and the manifest is valid.
  useEffect(() => {
    const onPrompt = (event) => { event.preventDefault(); setInstallPrompt(event) }
    const onInstalled = () => { setInstallPrompt(null); setInstallMessage('App installed') }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled) }
  }, [])

  async function installAdminApp() {
    if (installPrompt) {
      const prompt = installPrompt
      setInstallPrompt(null)
      await prompt.prompt()
      const result = await prompt.userChoice
      if (result.outcome === 'accepted') setInstallMessage('App installed')
      return
    }
    setInstallMessage('Use browser menu → Add to Home Screen')
    setTimeout(() => setInstallMessage(''), 4000)
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }

  // Count total actionable alerts
  const totalAlertCount = (stats.expired || 0) + (stats.lowStock || 0)

  return (
    <div className="app-shell flex h-screen w-full bg-[#f8fafc] text-slate-800 font-sans overflow-hidden">
      <OfflineIndicator />
      <CommandPalette isOpen={cmdOpen} onClose={setCmdOpen} />
      <AlertEngine isOpen={alertOpen} onClose={() => setAlertOpen(false)} />
      <ShiftModal isOpen={shiftModalOpen} onClose={() => setShiftModalOpen(false)} />

      {/* Modern Light Clean White Sidebar (Odoo Style) */}
      <aside
        className={`app-sidebar ${
          sidebarCollapsed ? 'w-0 overflow-hidden border-0' : 'w-56 lg:w-64 border-r border-slate-200/80'
        } bg-white text-slate-700 flex flex-col shrink-0 shadow-sm transition-all duration-200 z-20`}
      >
        {/* Brand Header */}
        <div className="brand-header p-4 border-b border-slate-100 flex items-center gap-3">
          <img src="/icon.svg" alt="Pharmacy Logo" className="w-8 h-8 rounded-lg shrink-0 shadow-sm" />
          <div className="min-w-0">
            <div className="brand-name">{db.settings.pharmacyName || 'System Optix'}</div>
            <div className="brand-caption">Pharmacy Station</div>
          </div>
        </div>

        {/* Navigation Categories */}
        <nav className="flex-1 px-3 py-2 space-y-3.5 overflow-y-auto custom-scroll">
          {navGroups.map((group) => {
            const accessibleItems = group.items.filter((item) => canAccess(item.to))
            if (!accessibleItems.length) return null
            return (
              <div key={group.title} className="space-y-0.5">
                <div className="nav-section-label px-2.5 py-1 text-[11px] font-black text-slate-900 uppercase tracking-wider select-none">
                  {group.title}
                </div>
                {accessibleItems.map((n) => {
                  const Icon = n.icon
                  // NavLink compares only pathname, so `/inventory` used to
                  // stay highlighted together with `/inventory?tab=...`.
                  // Compare the complete route (including query) instead.
                  const isNavActive = `${loc.pathname}${loc.search}` === n.to
                  return (
                    <Link
                      key={n.to}
                      to={n.to}
                      title={n.label}
                      aria-current={isNavActive ? 'page' : undefined}
                      className={`sidebar-link flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${isNavActive ? 'sidebar-link-active font-bold' : 'font-medium'}`}
                    >
                      {(
                        <>
                          <Icon className={`w-4 h-4 shrink-0 ${isNavActive ? 'text-[#00A09D]' : 'text-slate-500'}`} />
                          <span className="truncate flex-1">{n.label}</span>
                          {n.badge && (
                            <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md border shrink-0 ${n.badgeColor || 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                              {n.badge}
                            </span>
                          )}
                        </>
                      )}
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* Bottom Help & User Profile Card */}
        <div className="p-3 border-t border-slate-100 space-y-2 bg-slate-50/50">
          <button
            onClick={() => setCmdOpen(true)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors font-medium rounded-lg hover:bg-slate-100"
          >
            <HelpCircle className="w-4 h-4 text-slate-400" />
            <span>Help & Support</span>
          </button>

          <div className="relative">
            {roleMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 p-2 bg-white rounded-2xl shadow-xl border border-slate-200 z-30 space-y-1 font-sans">
                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Switch Active Role (Demo)
                </div>
                {[
                  { key: 'ADMIN', label: '👑 Admin (Owner)' },
                  { key: 'MANAGER', label: '👔 Manager (Ahmed)' },
                  { key: 'PHARMACIST', label: '💊 Pharmacist (Dr. Sara)' },
                  { key: 'CASHIER', label: '🧾 Cashier (Ali)' },
                  { key: 'RECEPTIONIST', label: '📋 Receptionist (Fatima)' },
                ].map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => {
                      switchRoleUser(r.key)
                      setRoleMenuOpen(false)
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors ${
                      me?.role === r.key
                        ? 'bg-[#e6f7f2] text-[#00A09D]'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{r.label}</span>
                    {me?.role === r.key && <span className="text-[10px]">●</span>}
                  </button>
                ))}

                <div className="pt-1.5 mt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setRoleMenuOpen(false)
                      navigate('/users')
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold text-[#714B67] hover:bg-[#f5eef4] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <UserCog className="w-3.5 h-3.5" />
                    <span>Manage Staff & Assign Roles →</span>
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-[#eef2f6] border border-[#e2e8f0]">
              <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                {me?.avatar ? (
                  <img src={me.avatar} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span>{me?.name ? me.name.slice(0, 2).toUpperCase() : 'AA'}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-900 truncate">
                  {me?.name || 'Akib Ahamed'}
                </div>
                <button
                  type="button"
                  onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                  className="text-[11px] font-bold hover:underline flex items-center gap-1 text-left mt-0.5"
                  style={{ color: ROLES[me?.role]?.color || '#00A09D' }}
                  title="Click to switch role"
                >
                  <span>{ROLES[me?.role]?.badge || me?.role || 'Staff'}</span>
                  <ChevronDown className="w-2.5 h-2.5 opacity-70" />
                </button>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => navigate('/users')}
                  title="Staff & User Roles Management"
                  className="p-1.5 text-slate-500 hover:text-[#714B67] hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
                >
                  <UserCog className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => logout()}
                  title="Logout"
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header matching reference image */}
        <header className="app-toolbar h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0 z-10">
          {/* Left: Sidebar Toggle + Wide Search Input */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? 'Show Sidebar' : 'Hide Sidebar'}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="relative hidden md:block">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                onClick={() => setCmdOpen(true)}
                placeholder="Search medicines, patients..."
                readOnly
                className="w-48 xl:w-64 pl-9 pr-4 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none cursor-pointer transition-colors"
              />
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2 sm:gap-3">


            {/* Branch Selector Dropdown */}
            <div className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => setBranchMenuOpen((open) => !open)}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 border border-slate-200 cursor-pointer transition-colors"
              >
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Branch: {activeBranch() === 'ALL' ? 'All' : branchById(activeBranch())?.name?.replace(/Branch.*/i, '').trim() || 'Main'}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
              {branchMenuOpen && !isBranchLocked() && (
                <div className="absolute right-0 top-full mt-2 z-50 min-w-48 rounded-xl border border-slate-100 bg-white p-1.5 shadow-lg">
                  <button type="button" onClick={() => { setBranch('ALL'); setBranchMenuOpen(false) }} className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold ${activeBranch() === 'ALL' ? 'bg-[#e6f7f2] text-[#008f8b]' : 'text-slate-800 hover:bg-slate-50'}`}>All Branches</button>
                  {(db.branches || []).map((branch) => (
                    <button key={branch.id} type="button" onClick={() => { setBranch(branch.id); setBranchMenuOpen(false) }} className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold ${activeBranch() === branch.id ? 'bg-[#e6f7f2] text-[#008f8b]' : 'text-slate-800 hover:bg-slate-50'}`}>
                      {branch.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Messages / Chat Icon */}
            <button
              onClick={() => setCmdOpen(true)}
              title="Messages & Chat"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
            </button>

            {/* Notifications Bell */}
            <button
              onClick={() => setAlertOpen(true)}
              title="Alerts & Notifications"
              className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Bell className="w-4 h-4" />
              {totalAlertCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
              )}
            </button>

            {/* Language Translation Icon */}
            <button
              title="Language (English)"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Globe className="w-4 h-4" />
            </button>

            {/* Installer downloads exist only on the web host: they are kept out of
                every app bundle (that is what keeps the APK and the desktop
                installers small). The packaged desktop app runs from file://, where
                these links cannot resolve, so it must not offer them either. */}
            {me?.role === 'ADMIN' && !isNativeApp() && !isElectronShell() && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDownloadMenuOpen(!downloadMenuOpen)}
                  title="Download POS Apps"
                  aria-label="Download POS Apps"
                  className="relative inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#3b1734] hover:bg-[#280c23] active:bg-[#1a0616] border border-[#280c23] rounded-lg transition-all shadow-sm cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-white" />
                  <span className="hidden lg:inline">Download App</span>
                  <ChevronDown className="w-3 h-3 text-white/90" />
                </button>

                {downloadMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setDownloadMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-2xl border border-slate-300 bg-white p-2.5 shadow-2xl text-slate-800 font-sans ring-1 ring-black/10 space-y-1.5">
                      <div className="px-2 py-1 text-[10px] font-extrabold text-slate-700 uppercase tracking-wider border-b border-slate-200 mb-1 flex items-center justify-between">
                        <span>Desktop Stations</span>
                        <span className="text-[9px] font-bold text-slate-400">Offline-First</span>
                      </div>

                      {/* Windows App (Installer) - Rich Blue Card */}
                      <a
                        href="/downloads/Pharmacy-POS-Station-Setup.exe"
                        download="Pharmacy-POS-Station-Setup.exe"
                        onClick={() => setDownloadMenuOpen(false)}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-blue-200/90 bg-blue-50/80 hover:bg-blue-100/90 transition-all group shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-[#0078D4] text-white flex items-center justify-center shrink-0 shadow-sm">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-13.051-1.802" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-blue-950 group-hover:text-blue-900 truncate text-xs">Windows App (Installer)</div>
                            <div className="text-[11px] text-blue-700/90 font-medium truncate">Full offline setup for PC (111 MB)</div>
                          </div>
                        </div>
                        <Download className="w-4 h-4 text-blue-600 group-hover:text-blue-950 transition-colors shrink-0" />
                      </a>

                      {/* Windows Desktop App - Rich Indigo Card */}
                      <button
                        type="button"
                        onClick={() => {
                          setDownloadMenuOpen(false)
                          installAdminApp()
                        }}
                        className="w-full flex items-center justify-between gap-3 p-2.5 rounded-xl border border-indigo-200/90 bg-indigo-50/80 hover:bg-indigo-100/90 transition-all group shadow-[0_1px_2px_rgba(0,0,0,0.04)] text-left"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <Monitor className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-indigo-950 group-hover:text-indigo-900 truncate text-xs">Windows Desktop App</div>
                            <div className="text-[11px] text-indigo-700/90 font-medium truncate">Instant desktop app</div>
                          </div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-indigo-600 group-hover:text-indigo-950 transition-colors shrink-0" />
                      </button>

                      {/* Mac App (Installer) - Rich Slate Card */}
                      <a
                        href="/downloads/Pharmacy-POS-Station-mac.dmg"
                        download="Pharmacy-POS-Station-mac.dmg"
                        onClick={() => setDownloadMenuOpen(false)}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-300 bg-slate-100/90 hover:bg-slate-200/90 transition-all group shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.92-2.85-.9.04-2 .6-2.64 1.35-.56.65-.98 1.7-0.85 2.73.99.08 2.02-.51 2.57-1.23z" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-950 group-hover:text-black truncate text-xs">Mac App (Installer)</div>
                            <div className="text-[11px] text-slate-700 font-medium truncate">DMG package for macOS (128 MB)</div>
                          </div>
                        </div>
                        <Download className="w-4 h-4 text-slate-700 group-hover:text-black transition-colors shrink-0" />
                      </a>

                      {/* Mac Desktop App - Rich Zinc Card */}
                      <button
                        type="button"
                        onClick={() => {
                          setDownloadMenuOpen(false)
                          installAdminApp()
                        }}
                        className="w-full flex items-center justify-between gap-3 p-2.5 rounded-xl border border-zinc-300 bg-zinc-100/90 hover:bg-zinc-200/90 transition-all group shadow-[0_1px_2px_rgba(0,0,0,0.04)] text-left"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-zinc-800 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <Laptop className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-zinc-950 group-hover:text-black truncate text-xs">Mac Desktop App</div>
                            <div className="text-[11px] text-zinc-700 font-medium truncate">Instant desktop app</div>
                          </div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-zinc-700 group-hover:text-black transition-colors shrink-0" />
                      </button>

                      <div className="px-2 py-1 text-[10px] font-extrabold text-slate-700 uppercase tracking-wider border-t border-slate-200 pt-2 mb-1 flex items-center justify-between">
                        <span>Mobile Apps</span>
                        <span className="text-[9px] font-bold text-slate-400">Pure Cloud</span>
                      </div>

                      {/* Android App - Rich Emerald Card */}
                      <a
                        href="/downloads/Pharmacy-POS-Cloud.apk"
                        download="Pharmacy-POS-Cloud.apk"
                        onClick={() => setDownloadMenuOpen(false)}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-emerald-200/90 bg-emerald-50/80 hover:bg-emerald-100/90 transition-all group shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993.0001.5511-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.411 13.8559 8.1 12 8.1s-3.5902.311-5.1368.8497L4.8409 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.1185-9.4396" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-emerald-950 group-hover:text-emerald-900 truncate text-xs">Android App (10 MB)</div>
                            <div className="text-[11px] text-emerald-700/90 font-medium truncate">Live cloud mobile app</div>
                          </div>
                        </div>
                        <Download className="w-4 h-4 text-emerald-700 group-hover:text-emerald-950 transition-colors shrink-0" />
                      </a>


                      {/* iPhone App - Rich Purple Card */}
                      <button
                        type="button"
                        onClick={() => {
                          setDownloadMenuOpen(false)
                          if (installPrompt) {
                            installAdminApp()
                          } else {
                            window.open('/mobile', '_blank')
                          }
                        }}
                        className="w-full flex items-center justify-between gap-3 p-2.5 rounded-xl border border-purple-200/90 bg-purple-50/80 hover:bg-purple-100/90 transition-all group shadow-[0_1px_2px_rgba(0,0,0,0.04)] text-left"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <Smartphone className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-purple-950 group-hover:text-purple-900 truncate text-xs">iPhone App</div>
                            <div className="text-[11px] text-purple-700/90 font-medium truncate">Live cloud mobile app</div>
                          </div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-purple-700 group-hover:text-purple-950 transition-colors shrink-0" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            {installMessage && <span role="status" className="text-[11px] text-[#714b67] font-semibold">{installMessage}</span>}

            {/* User Avatar Circle */}
            <div
              onClick={() => setCmdOpen(true)}
              className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-sm ring-2 ring-slate-100 cursor-pointer overflow-hidden"
            >
              {me?.avatar ? (
                <img src={me.avatar} alt="avatar" className="w-full h-full rounded-full object-cover" />
              ) : (
                <span>{me?.name ? me.name.slice(0, 2).toUpperCase() : 'AA'}</span>
              )}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main
          className={`desktop-content flex-1 min-h-0 w-full h-full ${
            loc.pathname === '/pos' ? 'overflow-y-auto md:overflow-hidden p-2 sm:p-2.5' : 'overflow-y-auto overflow-x-hidden p-4 md:p-6'
          } bg-[#f8fafc] custom-scroll`}
        >
          {canAccess(loc.pathname) ? (
            children
          ) : (
            <div className="max-w-md mx-auto text-center mt-20 bg-white p-8 rounded-2xl shadow-lg border border-rose-100">
              <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                🚫
              </div>
              <h2 className="text-lg font-bold text-slate-900">Access Restricted</h2>
              <p className="text-sm text-slate-600 mt-2">
                You do not have permission to access this section ({me?.role}).
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function LegacyApp() {
  const db = useDB()

  if (!db.session) return <Login />

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/pos" element={<POS />} />
        <Route path="/sales-history" element={<SalesHistory />} />
        <Route path="/medicines" element={<Medicines />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/company-stock" element={<CompanyStockHub />} />
        <Route path="/inventory/companies" element={<CompanyStockHub />} />
        <Route path="/stock-audit" element={<StockAuditDashboard />} />
        <Route path="/inventory/audit" element={<StockAuditDashboard />} />
        <Route path="/expiry-management" element={<ExpiryDashboard />} />
        <Route path="/inventory/expiry" element={<ExpiryDashboard />} />
        <Route path="/smart" element={<SmartInventory />} />
        <Route path="/accounting" element={<Accounting />} />
        <Route path="/purchases" element={<Purchases />} />
        <Route path="/purchase-returns" element={<PurchaseReturnsDashboard />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/returns" element={<Returns />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/branches" element={<Branches />} />
        <Route path="/hardware" element={<HardwareStation />} />
        <Route path="/users" element={<Users />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  )
}

function MobileRoute() {
  useLayoutEffect(() => {
    const elements = [document.documentElement, document.body, document.getElementById('root')]
    const previousZoom = elements.map((element) => element.style.zoom)
    const previousTitle = document.title
    elements.forEach((element) => { element.style.zoom = '100%' })
    document.title = 'System Optix Inventory'
    return () => {
      elements.forEach((element, index) => { element.style.zoom = previousZoom[index] })
      document.title = previousTitle
    }
  }, [])

  return (
    <Suspense fallback={<main className="min-h-screen p-6" role="status">Loading shared inventory…</main>}>
       <MobileInventory desktop={false} />
     </Suspense>
   )
}

function AdminRoute() {
  return <Suspense fallback={<main className="min-h-screen p-6" role="status">Loading admin app…</main>}><MobileInventory desktop /></Suspense>
}

export default function App() {
  useEffect(() => {
    const cleanup = initSyncEngine()
    return cleanup
  }, [])

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          {/* The shared module has its own server session and permissions. */}
          <Route path="/mobile/*" element={<MobileRoute />} />
          <Route path="/admin/*" element={<AdminRoute />} />
          <Route path="/superadmin/*" element={<Suspense fallback={<main className="min-h-screen p-6" role="status">Loading platform console…</main>}><Superadmin /></Suspense>} />
          <Route path="*" element={<LegacyApp />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  )
}

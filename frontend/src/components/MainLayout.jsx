import { useState, useContext, useEffect } from 'react'
import { useNavigate, Outlet, useLocation } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'
import {
  LayoutDashboard, ClipboardList, Users, Trophy, Flag, BookOpen,
  Info, Target, Inbox, Settings, Shield, LogOut, ChevronLeft, ChevronRight, Building2, Menu
} from 'lucide-react'

export const MainLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, logout } = useContext(AuthContext)
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const menuItems = [
    { path: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/scores', label: 'Score Entry', icon: ClipboardList },
    { path: '/users', label: 'Players', icon: Users },
    { path: '/tournaments', label: 'Tournaments', icon: Trophy },
    { path: '/courses', label: 'Courses', icon: Flag },
    { path: '/league', label: 'League Info', icon: Shield },
    { path: '/rules', label: 'Rules', icon: BookOpen },
    { path: '/app/about', label: 'About', icon: Info }
  ]

  const adminMenuItems = [
    { path: '/quota', label: 'Quota', icon: Target },
    { path: '/inbox', label: 'Inbox', icon: Inbox },
    { path: '/billing-entities', label: 'Billing Entities', icon: Building2 },
    { path: '/settings', label: 'Settings', icon: Settings }
  ]

  const allMenuItems = user?.role === 'admin' ? [...menuItems, ...adminMenuItems] : menuItems

  const isActive = (path) => {
    if (path === '/courses/add') {
      return location.pathname === path
    }
    return location.pathname.startsWith(path) && location.pathname !== '/courses/add'
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-fairway-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-semibold"
      >
        Skip to main content
      </a>

      {/* ── Mobile backdrop overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ── */}
      {/* On md+: inline collapsible. On <md: off-canvas drawer. */}
      <aside
        className={`
          bg-slate-900 text-slate-100 flex flex-col shrink-0
          fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-300
          md:relative md:translate-x-0 md:z-auto
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:transition-all md:duration-300
          ${sidebarOpen ? 'md:w-64' : 'md:w-16'}
        `}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            {/* Logo: always show on mobile (drawer is always full-width), conditionally on desktop */}
            <img
              src="/npgolf-logo.svg"
              alt="NPGOLF"
              className={`h-8 w-auto ${!sidebarOpen ? 'md:hidden' : ''}`}
            />
            {/* Desktop collapse toggle — hidden on mobile */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden md:block p-1.5 hover:bg-slate-700 rounded-lg transition text-slate-400 hover:text-white"
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {/* Mobile close button */}
            <button
              onClick={() => setMobileOpen(false)}
              className="md:hidden p-1.5 hover:bg-slate-700 rounded-lg transition text-slate-400 hover:text-white"
              aria-label="Close menu"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* User Info */}
        {user && (
          <div className="p-4 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-fairway-600 rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                {user.name?.charAt(0).toUpperCase()}
              </div>
              {/* Always show on mobile; conditionally on desktop */}
              <div className={`overflow-hidden ${!sidebarOpen ? 'md:hidden' : ''}`}>
                <div className="font-semibold text-sm truncate">{user.name}</div>
                <div className="text-xs text-slate-400 truncate">{user.email}</div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Menu */}
        <nav className="flex-1 p-3">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.path}>
                  <button
                    onClick={() => { navigate(item.path); setMobileOpen(false) }}
                    aria-label={item.label}
                    title={item.label}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      isActive(item.path)
                        ? 'bg-fairway-700 text-white shadow-sm'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span className={`font-medium text-sm ${!sidebarOpen ? 'md:hidden' : ''}`}>
                      {item.label}
                    </span>
                  </button>
                </li>
              )
            })}
            {user?.role === 'admin' && (
              <li className="pt-3 pb-1">
                {sidebarOpen ? (
                  <p className="px-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Admin
                  </p>
                ) : (
                  <hr className="border-slate-700 mx-2" />
                )}
              </li>
            )}
            {user?.role === 'admin' && adminMenuItems.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.path}>
                  <button
                    onClick={() => { navigate(item.path); setMobileOpen(false) }}
                    aria-label={item.label}
                    title={item.label}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      isActive(item.path)
                        ? 'bg-fairway-700 text-white shadow-sm'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span className={`font-medium text-sm ${!sidebarOpen ? 'md:hidden' : ''}`}>
                      {item.label}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Logout Button */}
        <div className="p-3 border-t border-slate-700">
          <button
            onClick={handleLogout}
            aria-label="Log out"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:bg-red-900/40 hover:text-red-300 transition-colors"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className={`font-medium text-sm ${!sidebarOpen ? 'md:hidden' : ''}`}>
              Logout
            </span>
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main id="main-content" className="flex-1 overflow-auto min-w-0">
        {/* Mobile hamburger button */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-700">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <img src="/npgolf-logo.svg" alt="NPGOLF" className="h-7 w-auto" />
        </div>
        <Outlet />
      </main>
    </div>
  )
}

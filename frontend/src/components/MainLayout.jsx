import { useState, useContext } from 'react'
import { useNavigate, Outlet, useLocation } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'
import {
  LayoutDashboard, ClipboardList, Users, Trophy, Flag, BookOpen,
  Info, Target, Inbox, Settings, Shield, LogOut, ChevronLeft, ChevronRight, Building2
} from 'lucide-react'

export const MainLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { user, logout } = useContext(AuthContext)
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

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
      {/* Sidebar */}
      <aside
        className={`bg-slate-900 text-slate-100 transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-16'
        } flex flex-col shrink-0`}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <img src="/npgolf-logo.svg" alt="NPGOLF" className="h-8 w-auto" />
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 hover:bg-slate-700 rounded-lg transition text-slate-400 hover:text-white"
            >
              {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
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
              {sidebarOpen && (
                <div className="overflow-hidden">
                  <div className="font-semibold text-sm truncate">{user.name}</div>
                  <div className="text-xs text-slate-400 truncate">{user.email}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation Menu */}
        <nav className="flex-1 p-3">
          <ul className="space-y-1">
            {allMenuItems.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.path}>
                  <button
                    onClick={() => navigate(item.path)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      isActive(item.path)
                        ? 'bg-fairway-700 text-white shadow-sm'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    {sidebarOpen && (
                      <span className="font-medium text-sm">{item.label}</span>
                    )}
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
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:bg-red-900/40 hover:text-red-300 transition-colors"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {sidebarOpen && <span className="font-medium text-sm">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

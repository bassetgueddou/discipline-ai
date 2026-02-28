import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../store/appStore'

const NAV_ITEMS = [
  { path: '/dashboard', icon: '⚡', label: 'Dashboard' },
  { path: '/plan', icon: '📅', label: 'Mon Plan' },
  { path: '/focus', icon: '🎯', label: 'Focus' },
  { path: '/coach', icon: '🤖', label: 'Coach IA' },
  { path: '/analytics', icon: '📊', label: 'Analytics' },
]

const PAGE_TITLES = {
  '/dashboard': 'DASHBOARD',
  '/plan': 'MON PLAN',
  '/focus': 'MODE FOCUS',
  '/coach': 'COACH IA',
  '/analytics': 'ANALYTICS',
  '/profile': 'PROFIL'
}

export default function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { profile } = useAppStore()
  const streak = profile?.streak || 0
  const name = profile?.name || 'U'
  const title = PAGE_TITLES[location.pathname] || 'DISCIPLINE AI'

  return (
    <div className="flex min-h-screen min-h-dvh bg-bg">
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden lg:flex flex-col w-[72px] hover:w-56 bg-bg2 border-r border-border
        fixed top-0 left-0 bottom-0 z-50 transition-all duration-300 group overflow-hidden">
        {/* Logo */}
        <div className="flex items-center px-4 py-6 mb-2 overflow-hidden">
          <span className="font-display text-2xl text-accent tracking-widest min-w-[40px] text-center">D</span>
          <span className="font-display text-xl text-accent tracking-widest ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">ISCIPLINE AI</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 flex flex-col">
          {NAV_ITEMS.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`nav-item overflow-hidden ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="text-xl min-w-[20px] text-center">{item.icon}</span>
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap text-sm">
                {item.label}
              </span>
            </button>
          ))}
        </nav>

        {/* Profile */}
        <button
          onClick={() => navigate('/profile')}
          className={`nav-item overflow-hidden mb-4 ${location.pathname === '/profile' ? 'active' : ''}`}
        >
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center text-[10px] font-bold text-white min-w-[20px]">
            {name[0]?.toUpperCase()}
          </div>
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap text-sm">
            Profil
          </span>
        </button>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col lg:ml-[72px]">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur-xl border-b border-border px-4 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl lg:text-3xl tracking-widest text-text">{title}</h1>
            <p className="text-text3 text-xs font-mono mt-0.5">
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {streak > 0 && (
              <div className="flex items-center gap-1.5 bg-accent/10 border border-accent/50 px-3 py-1.5 rounded-full">
                <span className="text-sm">🔥</span>
                <span className="text-accent text-sm font-bold">{streak}j</span>
              </div>
            )}
            <button
              onClick={() => navigate('/profile')}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center text-sm font-bold text-white"
            >
              {name[0]?.toUpperCase()}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto pb-24 lg:pb-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-bg2/95 backdrop-blur-xl border-t border-border z-50 safe-bottom">
        <div className="flex justify-around px-2 py-2">
          {NAV_ITEMS.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200
                ${location.pathname === item.path
                  ? 'text-accent'
                  : 'text-text3 hover:text-text2'
                }`}
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="text-[10px] font-medium leading-none">{item.label.split(' ')[0]}</span>
            </button>
          ))}
          <button
            onClick={() => navigate('/profile')}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200
              ${location.pathname === '/profile' ? 'text-accent' : 'text-text3 hover:text-text2'}`}
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center text-xs font-bold text-white">
              {name[0]?.toUpperCase()}
            </div>
            <span className="text-[10px] font-medium leading-none">Profil</span>
          </button>
        </div>
      </nav>
    </div>
  )
}

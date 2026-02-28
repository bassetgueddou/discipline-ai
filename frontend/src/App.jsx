import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { supabase } from './lib/supabase'
import { useAppStore } from './store/appStore'

// Pages
import AuthPage from './components/pages/AuthPage'
import OnboardingPage from './components/pages/OnboardingPage'
import DashboardPage from './components/pages/DashboardPage'
import PlanPage from './components/pages/PlanPage'
import FocusPage from './components/pages/FocusPage'
import CoachPage from './components/pages/CoachPage'
import AnalyticsPage from './components/pages/AnalyticsPage'
import ProfilePage from './components/pages/ProfilePage'

// Layout
import AppLayout from './components/layout/AppLayout'
import ProtectedRoute from './components/layout/ProtectedRoute'

import './styles/globals.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, retry: 1 },
    mutations: { retry: 0 }
  }
})

function AppInitializer({ children }) {
  const { setUser, setSession, setProfile } = useAppStore()

  useEffect(() => {
    // Restaurer la session au démarrage
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session)
        setUser(session.user)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session)
      setUser(session?.user || null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return children
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppInitializer>
          <Routes>
            {/* Public */}
            <Route path="/auth" element={<AuthPage />} />

            {/* Onboarding (auth requis) */}
            <Route path="/onboarding" element={
              <ProtectedRoute>
                <OnboardingPage />
              </ProtectedRoute>
            } />

            {/* App protégée */}
            <Route path="/" element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="plan" element={<PlanPage />} />
              <Route path="focus" element={<FocusPage />} />
              <Route path="coach" element={<CoachPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>

          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#161c27',
                color: '#f1f5f9',
                border: '1px solid #2d3748',
                fontFamily: 'DM Sans, sans-serif',
                fontSize: '14px'
              },
              success: { iconTheme: { primary: '#22c55e', secondary: '#080a0f' } },
              error: { iconTheme: { primary: '#ef4444', secondary: '#080a0f' } }
            }}
          />
        </AppInitializer>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

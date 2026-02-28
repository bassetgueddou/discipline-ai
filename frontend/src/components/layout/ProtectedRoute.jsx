import { Navigate } from 'react-router-dom'
import { useAppStore } from '../../store/appStore'
import { supabase } from '../../lib/supabase'
import { useEffect, useState } from 'react'

export default function ProtectedRoute({ children }) {
  const { user } = useAppStore()
  const [checking, setChecking] = useState(!user)
  const [authenticated, setAuthenticated] = useState(!!user)

  useEffect(() => {
    if (user) { setChecking(false); setAuthenticated(true); return }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthenticated(!!session)
      setChecking(false)
    })
  }, [user])

  if (checking) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="font-display text-4xl tracking-widest text-accent animate-pulse-glow">
            DISCIPLINE AI
          </div>
          <div className="text-text3 text-sm font-mono">Chargement...</div>
        </div>
      </div>
    )
  }

  if (!authenticated) return <Navigate to="/auth" replace />
  return children
}

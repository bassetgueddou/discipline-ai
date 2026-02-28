import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store/appStore'
import api from '../lib/api'

export function useAuth() {
  const { user, session, setUser, setSession, setProfile, logout } = useAppStore()
  const navigate = useNavigate()

  useEffect(() => {
    // Écouter les changements d'auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession)
        setUser(newSession?.user || null)

        if (event === 'SIGNED_IN' && newSession?.user) {
          // Charger le profil
          try {
            const res = await api.get('/api/auth/me')
            setProfile(res.user)

            if (!res.user.onboarded) {
              navigate('/onboarding')
            } else {
              navigate('/dashboard')
            }
          } catch (e) {
            console.error('Profile load error:', e)
          }
        }

        if (event === 'SIGNED_OUT') {
          logout()
          navigate('/auth')
        }
      }
    )

    // Vérifier la session existante au démarrage
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      if (existingSession) {
        setSession(existingSession)
        setUser(existingSession.user)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email, password, name) => {
    const res = await api.post('/api/auth/signup', { email, password, name })
    return res
  }

  const signIn = async (email, password) => {
    const res = await api.post('/api/auth/login', { email, password })
    if (res.session) {
      await supabase.auth.setSession(res.session)
    }
    return res
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    await api.post('/api/auth/logout').catch(() => {})
    logout()
    navigate('/auth')
  }

  return {
    user,
    session,
    isAuthenticated: !!user,
    signUp,
    signIn,
    signOut
  }
}

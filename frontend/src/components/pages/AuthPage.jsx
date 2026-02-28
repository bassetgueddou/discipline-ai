import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAppStore } from '../../store/appStore'
import api from '../../lib/api'
import toast from 'react-hot-toast'

export default function AuthPage() {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { setUser, setSession, setProfile } = useAppStore()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (mode === 'signup') {
        // Inscription
        const res = await api.post('/api/auth/signup', { email, password, name })

        if (res.session) {
          await supabase.auth.setSession(res.session)
          setUser(res.user)
          setSession(res.session)
          toast.success('Compte créé ! Bienvenue 🔥')
          navigate('/onboarding')
        } else {
          toast.success('Compte créé ! Connecte-toi.')
          setMode('login')
        }
      } else {
        // Connexion
        const res = await api.post('/api/auth/login', { email, password })

        if (res.session) {
          await supabase.auth.setSession(res.session)
          setUser(res.user)
          setSession(res.session)
          setProfile(res.profile)

          if (!res.user.onboarded) {
            navigate('/onboarding')
          } else {
            toast.success(`Bon retour ${res.user.name || ''} ! 🔥`)
            navigate('/dashboard')
          }
        }
      }
    } catch (err) {
      toast.error(err.message || 'Erreur d\'authentification')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen min-h-dvh bg-bg flex flex-col items-center justify-center p-5
      bg-[radial-gradient(ellipse_at_top,_rgba(249,115,22,0.05)_0%,_transparent_60%)]">

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <div className="font-display text-5xl tracking-widest text-accent mb-2">
          DISCIPLINE AI
        </div>
        <div className="text-text3 text-sm">Ton coach personnel intelligent</div>
      </motion.div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-md bg-surface border border-border2 rounded-2xl p-8"
      >
        {/* Mode toggle */}
        <div className="flex bg-bg3 rounded-xl p-1 mb-8">
          {['login', 'signup'].map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200
                ${mode === m ? 'bg-accent text-white shadow-lg' : 'text-text3 hover:text-text2'}`}
            >
              {m === 'login' ? 'Connexion' : 'Inscription'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence>
            {mode === 'signup' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <label className="block text-text3 text-xs font-medium mb-1.5 uppercase tracking-wider">
                  Prénom
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ton prénom..."
                  required={mode === 'signup'}
                  className="input"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label className="block text-text3 text-xs font-medium mb-1.5 uppercase tracking-wider">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="ton@email.com"
              required
              autoComplete="email"
              className="input"
            />
          </div>

          <div>
            <label className="block text-text3 text-xs font-medium mb-1.5 uppercase tracking-wider">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Minimum 6 caractères"
              required
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              minLength={6}
              className="input"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                {mode === 'signup' ? 'Création...' : 'Connexion...'}
              </span>
            ) : (
              mode === 'signup' ? '🚀 Créer mon compte' : '🔥 Me connecter'
            )}
          </button>
        </form>

        {/* Séparateur */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-border"/>
          <span className="text-text3 text-xs">Plan gratuit disponible</span>
          <div className="flex-1 h-px bg-border"/>
        </div>

        <div className="bg-bg3 rounded-xl p-4 space-y-2">
          <div className="text-xs font-semibold text-text3 uppercase tracking-wider mb-3">
            ✨ Inclus gratuitement
          </div>
          {['Coach IA conversationnel', '5 tâches par jour', 'Timer Pomodoro', 'Suivi du streak'].map(f => (
            <div key={f} className="flex items-center gap-2 text-text2 text-sm">
              <span className="text-green-400">✓</span> {f}
            </div>
          ))}
        </div>
      </motion.div>

      <p className="text-text3 text-xs mt-6 text-center">
        En créant un compte, tu acceptes nos conditions d'utilisation
      </p>
    </div>
  )
}

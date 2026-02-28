import { useState } from 'react'
import { motion } from 'framer-motion'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '../../store/appStore'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import toast from 'react-hot-toast'

export default function ProfilePage() {
  const { profile, updateProfile, logout } = useAppStore()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [editName, setEditName] = useState(false)
  const [newName, setNewName] = useState(profile?.name || '')
  const [notifs, setNotifs] = useState(true)

  const updateMutation = useMutation({
    mutationFn: (data) => api.put('/api/profile', data),
    onSuccess: (res) => {
      updateProfile(res.profile || res.data || res)
      qc.invalidateQueries(['dashboard'])
      toast.success('Profil mis à jour !')
      setEditName(false)
    },
    onError: (err) => toast.error(err.message)
  })

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    logout()
    navigate('/auth')
  }

  const name = profile?.name || 'Utilisateur'
  const plan = profile?.plan || 'free'
  const streak = profile?.streak || 0
  const goals = profile?.goals || []

  const BADGES = [
    { icon: '🔥', label: `${streak} jours`, condition: streak >= 3 },
    { icon: '⚡', label: 'Focus Master', condition: true },
    { icon: '🏆', label: 'Discipliné', condition: true },
    { icon: '💪', label: 'Régulier', condition: streak >= 7 },
  ].filter(b => b.condition)

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-5">

      {/* ── Profile Hero ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card text-center py-8 relative overflow-hidden
          bg-[radial-gradient(ellipse_at_top,_rgba(249,115,22,0.08)_0%,_transparent_60%)]"
      >
        {/* Avatar */}
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent to-purple-500
          flex items-center justify-center text-3xl font-bold text-white mx-auto mb-4
          shadow-lg shadow-accent/30">
          {name[0]?.toUpperCase()}
        </div>

        {/* Name */}
        {editName ? (
          <div className="flex items-center justify-center gap-2 mb-2">
            <input
              value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') updateMutation.mutate({ name: newName }) }}
              className="input text-center text-lg py-2 max-w-xs"
              autoFocus
            />
            <button onClick={() => updateMutation.mutate({ name: newName })}
              disabled={updateMutation.isPending}
              className="px-3 py-2 bg-accent text-white rounded-xl text-sm hover:bg-accent2 transition-colors">
              ✓
            </button>
          </div>
        ) : (
          <button onClick={() => setEditName(true)}
            className="block mx-auto font-display text-3xl tracking-wide text-text hover:text-accent transition-colors mb-1 group">
            {name}
            <span className="text-text3 text-base ml-2 opacity-0 group-hover:opacity-100 transition-opacity">✎</span>
          </button>
        )}

        <p className="text-text3 text-sm mb-4">
          {goals.slice(0, 2).join(' • ') || 'Aucun objectif défini'}
        </p>

        {/* Badges */}
        <div className="flex flex-wrap justify-center gap-2">
          {BADGES.map(b => (
            <span key={b.label} className="badge bg-accent/10 border border-accent/20 text-accent text-xs">
              {b.icon} {b.label}
            </span>
          ))}
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* ── Plan ── */}
        <div className="card">
          <h3 className="section-title mb-4">Abonnement</h3>
          <div className={`rounded-xl p-4 mb-4 ${plan === 'premium'
            ? 'bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30'
            : 'bg-bg3 border border-border2'}`}
          >
            <div className="font-display text-2xl tracking-widest mb-1">
              {plan === 'premium' ? '⭐ PREMIUM' : 'GRATUIT'}
            </div>
            <div className="text-text3 text-xs">
              {plan === 'premium'
                ? 'Toutes les fonctionnalités débloquées'
                : '5 tâches/j • 15 messages/j • Analytics basiques'
              }
            </div>
          </div>
          {plan === 'free' && (
            <>
              <div className="space-y-2 mb-4">
                {['Tâches illimitées', 'Chat coach illimité', 'Analytics avancés', 'Planning IA complet', 'Notifications intelligentes'].map(f => (
                  <div key={f} className="flex items-center gap-2 text-text2 text-sm">
                    <span className="text-accent">✦</span> {f}
                  </div>
                ))}
              </div>
              <button
                onClick={() => toast('Bientôt disponible ! 🚀', { icon: '⭐' })}
                className="btn-primary py-3 text-sm"
              >
                🚀 Passer à Premium — 9,99€/mois
              </button>
            </>
          )}
        </div>

        {/* ── Settings ── */}
        <div className="card">
          <h3 className="section-title mb-4">Paramètres</h3>
          <div className="space-y-1">
            {/* Notifications toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-bg3 transition-colors">
              <div>
                <p className="text-text text-sm font-medium">🔔 Notifications</p>
                <p className="text-text3 text-xs mt-0.5">Rappels et alertes</p>
              </div>
              <button onClick={() => setNotifs(n => !n)}
                className={`w-11 h-6 rounded-full transition-colors duration-200 relative
                  ${notifs ? 'bg-accent' : 'bg-border2'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200
                  ${notifs ? 'left-6' : 'left-1'}`} />
              </button>
            </div>

            {/* Heure de réveil */}
            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-bg3 transition-colors">
              <div>
                <p className="text-text text-sm font-medium">⏰ Heure de réveil</p>
                <p className="text-text3 text-xs mt-0.5">Pour le planning IA</p>
              </div>
              <input
                type="time"
                defaultValue={profile?.wakeTime || profile?.wake_time || '07:00'}
                onChange={e => updateMutation.mutate({ wakeTime: e.target.value })}
                className="bg-bg3 border border-border2 rounded-lg px-2 py-1.5 text-xs font-mono text-text outline-none focus:border-accent transition-colors"
              />
            </div>

            {/* Mes objectifs */}
            <button className="flex items-center justify-between w-full p-3 rounded-xl hover:bg-bg3 transition-colors text-left">
              <div>
                <p className="text-text text-sm font-medium">🎯 Mes objectifs</p>
                <p className="text-text3 text-xs mt-0.5 truncate max-w-[160px]">
                  {goals.join(', ') || 'Non définis'}
                </p>
              </div>
              <span className="text-text3">›</span>
            </button>

            {/* Data export */}
            <button
              onClick={() => toast('Export bientôt disponible !', { icon: '📊' })}
              className="flex items-center justify-between w-full p-3 rounded-xl hover:bg-bg3 transition-colors text-left"
            >
              <div>
                <p className="text-text text-sm font-medium">📊 Exporter mes données</p>
                <p className="text-text3 text-xs mt-0.5">CSV ou PDF</p>
              </div>
              <span className="text-text3">›</span>
            </button>

            {/* Logout */}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-red-500/5 transition-colors text-left"
            >
              <p className="text-red-400 text-sm font-medium">🚪 Déconnexion</p>
            </button>
          </div>
        </div>
      </div>

      {/* ── App info ── */}
      <div className="text-center text-text3 text-xs space-y-1">
        <div className="font-display text-xl tracking-widest text-border2">DISCIPLINE AI</div>
        <div>v1.0.0 • Développé avec ❤️</div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../store/appStore'
import api from '../../lib/api'
import toast from 'react-hot-toast'

const STEPS = [
  {
    id: 'welcome', emoji: '👋', title: 'BIENVENUE',
    sub: 'Je vais personnaliser ton coaching en quelques questions. Ça prend 2 minutes.',
    type: 'intro'
  },
  {
    id: 'goals', emoji: '🎯', title: 'TES OBJECTIFS',
    sub: 'Sur quoi veux-tu te concentrer ? (plusieurs choix possibles)',
    type: 'multi-choice',
    choices: [
      { e: '💼', l: 'Business / Startup' }, { e: '📚', l: 'Études / Formation' },
      { e: '💪', l: 'Sport / Santé' }, { e: '💻', l: 'Freelance / Projets' },
      { e: '🧠', l: 'Développement perso' }, { e: '💰', l: 'Finances' }
    ]
  },
  {
    id: 'discipline', emoji: '⚡', title: 'TON NIVEAU ACTUEL',
    sub: 'Évalue ta discipline aujourd\'hui',
    type: 'slider', min: 1, max: 10,
    labels: ['😴 Débutant', '🚶 Moyen', '🏃 Bon', '⚡ Expert']
  },
  {
    id: 'obstacles', emoji: '🚧', title: 'TES OBSTACLES',
    sub: 'Qu\'est-ce qui te bloque le plus ?',
    type: 'multi-choice',
    choices: [
      { e: '📱', l: 'Réseaux sociaux' }, { e: '😴', l: 'Procrastination' },
      { e: '😰', l: 'Manque de motivation' }, { e: '🤯', l: 'Trop de distractions' },
      { e: '📋', l: 'Pas de structure' }, { e: '😓', l: 'Fatigue' }
    ]
  },
  {
    id: 'wake_time', emoji: '🌅', title: 'TON RÉVEIL',
    sub: 'À quelle heure tu te lèves ?',
    type: 'time'
  },
  {
    id: 'name', emoji: '🔥', title: 'DERNIÈRE ÉTAPE',
    sub: 'Comment je dois t\'appeler ?',
    type: 'text', placeholder: 'Ton prénom...'
  }
]

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { updateProfile, setProfile } = useAppStore()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState({
    goals: [], discipline_level: 5, obstacles: [],
    wake_time: '07:00', name: ''
  })

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  const toggleChoice = (field, value) => {
    setData(prev => {
      const arr = prev[field] || []
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value]
      }
    })
  }

  const canProceed = () => {
    if (current.type === 'multi-choice' && current.id === 'goals') return data.goals.length > 0
    if (current.type === 'text' && current.id === 'name') return data.name.trim().length > 0
    return true
  }

  const handleNext = async () => {
    if (!canProceed()) {
      toast.error('Sélectionne au moins une option')
      return
    }

    if (isLast) {
      await handleFinish()
    } else {
      setStep(s => s + 1)
    }
  }

  const handleFinish = async () => {
    setLoading(true)
    try {
      const res = await api.post('/api/profile/onboarding', {
        name: data.name,
        goals: data.goals,
        discipline_level: data.discipline_level,
        obstacles: data.obstacles,
        wake_time: data.wake_time,
        available_hours: 8
      })
      setProfile(res.profile)
      toast.success('🔥 Ton plan est prêt !')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la configuration')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen min-h-dvh bg-bg flex flex-col items-center justify-center p-5
      bg-[radial-gradient(ellipse_at_top,_rgba(249,115,22,0.05)_0%,_transparent_60%)]">

      <div className="w-full max-w-md">
        {/* Progress */}
        <div className="flex gap-1.5 mb-8">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-500
              ${i < step ? 'bg-green-500' : i === step ? 'bg-accent' : 'bg-border2'}`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="bg-surface border border-border2 rounded-2xl p-8"
          >
            <div className="text-5xl mb-4">{current.emoji}</div>
            <h2 className="font-display text-3xl tracking-widest text-text mb-2">
              {current.title}
            </h2>
            <p className="text-text2 text-sm mb-7 leading-relaxed">{current.sub}</p>

            {/* Content by type */}
            {current.type === 'intro' && (
              <div className="space-y-3 mb-6">
                {['Plan personnalisé en 2 min', 'Coach IA disponible 24h/24', 'Suivi de progression automatique'].map(f => (
                  <div key={f} className="flex items-center gap-3 text-text2 text-sm">
                    <span className="text-accent">✦</span> {f}
                  </div>
                ))}
              </div>
            )}

            {current.type === 'multi-choice' && (
              <div className="grid grid-cols-2 gap-2.5 mb-6">
                {current.choices.map(c => {
                  const selected = (data[current.id] || []).includes(c.l)
                  return (
                    <button
                      key={c.l}
                      onClick={() => toggleChoice(current.id, c.l)}
                      className={`flex items-center gap-2.5 p-3.5 rounded-xl border text-left text-sm
                        transition-all duration-200
                        ${selected
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border2 bg-bg3 text-text2 hover:border-border hover:text-text'
                        }`}
                    >
                      <span className="text-xl">{c.e}</span>
                      <span className="font-medium text-xs">{c.l}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {current.type === 'slider' && (
              <div className="mb-8">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-text3 text-xs">Niveau actuel</span>
                  <span className="font-display text-3xl text-accent">{data.discipline_level}/10</span>
                </div>
                <input
                  type="range" min={1} max={10} value={data.discipline_level}
                  onChange={e => setData(d => ({ ...d, discipline_level: +e.target.value }))}
                  className="w-full h-2 appearance-none cursor-pointer rounded-full"
                  style={{
                    background: `linear-gradient(to right, #f97316 ${(data.discipline_level - 1) / 9 * 100}%, #2d3748 ${(data.discipline_level - 1) / 9 * 100}%)`
                  }}
                />
                <div className="flex justify-between text-text3 text-xs mt-2">
                  {current.labels.map(l => <span key={l}>{l}</span>)}
                </div>
              </div>
            )}

            {current.type === 'time' && (
              <input
                type="time" value={data.wake_time}
                onChange={e => setData(d => ({ ...d, wake_time: e.target.value }))}
                className="input text-2xl font-display text-center tracking-widest mb-6 py-4"
              />
            )}

            {current.type === 'text' && (
              <input
                type="text" value={data.name}
                onChange={e => setData(d => ({ ...d, name: e.target.value }))}
                placeholder={current.placeholder}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleNext()}
                className="input text-lg mb-6"
              />
            )}

            {/* Actions */}
            <div className="space-y-2.5">
              <button onClick={handleNext} disabled={loading || !canProceed()} className="btn-primary">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Génération du plan...
                  </span>
                ) : isLast ? '🚀 Générer mon plan' : 'Continuer →'}
              </button>
              {step > 0 && (
                <button onClick={() => setStep(s => s - 1)} className="btn-secondary w-full text-center">
                  ← Retour
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        <p className="text-center text-text3 text-xs mt-4">
          Étape {step + 1} sur {STEPS.length}
        </p>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '../../store/appStore'
import api from '../../lib/api'
import toast from 'react-hot-toast'

// ─── Score Ring Component ───
function ScoreRing({ score = 0 }) {
  const radius = 45
  const circ = 2 * Math.PI * radius
  const offset = circ - (score / 100) * circ

  const getColor = (s) => s >= 80 ? '#f97316' : s >= 60 ? '#22c55e' : s >= 40 ? '#3b82f6' : '#94a3b8'
  const getLabel = (s) => s >= 90 ? '🏆 Légendaire' : s >= 75 ? '🔥 Excellent' : s >= 60 ? '💪 Bon rythme' : s >= 40 ? '📈 En progression' : '🌱 Débutant'

  return (
    <div className="relative w-32 h-32 shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#2d3748" strokeWidth="8"/>
        <motion.circle
          cx="50" cy="50" r={radius} fill="none"
          stroke={getColor(score)} strokeWidth="8" strokeLinecap="round"
          style={{ strokeDasharray: circ }}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl text-text">{score}</span>
        <span className="text-text3 text-[10px] tracking-widest font-mono">SCORE</span>
      </div>
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-text2">
        {getLabel(score)}
      </div>
    </div>
  )
}

// ─── Task Item ───
function TaskItem({ task, onToggle, onDelete }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: task.done ? 0.5 : 1, y: 0 }}
      className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-200
        ${task.done ? 'bg-bg border-border' : 'bg-bg3 border-border hover:border-border2'}`}
    >
      <button
        onClick={() => onToggle(task.id)}
        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all duration-200
          ${task.done ? 'bg-green-500 border-green-500' : 'border-border2 hover:border-accent'}`}
      >
        {task.done && <span className="text-white text-xs font-bold">✓</span>}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${task.done ? 'line-through text-text3' : 'text-text'}`}>
          {task.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {task.scheduled_time && (
            <span className="text-xs font-mono text-text3">⏰ {task.scheduled_time}</span>
          )}
          {task.duration_min && (
            <span className="text-xs text-text3">{task.duration_min}min</span>
          )}
        </div>
      </div>
      <span className={`badge text-[10px] shrink-0 priority-${task.priority}`}>
        {task.priority === 'high' ? 'Haute' : task.priority === 'med' ? 'Moy.' : 'Basse'}
      </span>
    </motion.div>
  )
}

// ─── Add Task Modal ───
function AddTaskModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ name: '', priority: 'med', scheduled_time: '', duration_min: 60 })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Nom de la tâche requis')
    setLoading(true)
    await onAdd(form)
    setLoading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        className="bg-surface border border-border2 rounded-2xl p-6 w-full max-w-md"
      >
        <h3 className="font-display text-2xl tracking-widest mb-6">NOUVELLE TÂCHE</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            autoFocus type="text" placeholder="Nom de la tâche..."
            value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
            className="input" required
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-text3 text-xs uppercase tracking-wider block mb-1.5">Heure</label>
              <input type="time" value={form.scheduled_time}
                onChange={e => setForm(f => ({...f, scheduled_time: e.target.value}))}
                className="input py-2.5" />
            </div>
            <div>
              <label className="text-text3 text-xs uppercase tracking-wider block mb-1.5">Durée (min)</label>
              <input type="number" min="5" max="480" value={form.duration_min}
                onChange={e => setForm(f => ({...f, duration_min: +e.target.value}))}
                className="input py-2.5" />
            </div>
          </div>
          <div>
            <label className="text-text3 text-xs uppercase tracking-wider block mb-2">Priorité</label>
            <div className="flex gap-2">
              {[['high','🔴 Haute'],['med','🟡 Moyenne'],['low','🟢 Basse']].map(([p, l]) => (
                <button key={p} type="button"
                  onClick={() => setForm(f => ({...f, priority: p}))}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all duration-200
                    ${form.priority === p ? 'border-accent bg-accent/10 text-accent' : 'border-border2 text-text3 hover:text-text2'}`}
                >{l}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Annuler</button>
            <button type="submit" disabled={loading} className="flex-[2] py-3 bg-accent text-white rounded-xl font-semibold text-sm hover:bg-accent2 transition-colors disabled:opacity-50">
              {loading ? 'Ajout...' : '+ Ajouter'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Main Dashboard ───
export default function DashboardPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { tasks, setTasks, toggleTask: localToggle, addTask: localAdd, profile } = useAppStore()
  const [showAddModal, setShowAddModal] = useState(false)
  const [motivation, setMotivation] = useState('')

  // Fetch dashboard data
  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/api/analytics/dashboard'),
    onSuccess: (data) => { setTasks(data.today.tasks) },
    refetchInterval: 60000
  })

  // Fetch daily motivation
  useQuery({
    queryKey: ['motivation'],
    queryFn: () => api.get('/api/coach/daily-motivation'),
    onSuccess: (data) => setMotivation(data.motivation),
    staleTime: 1000 * 60 * 60 // 1h
  })

  // Toggle task mutation
  const toggleMutation = useMutation({
    mutationFn: ({ id, done }) => api.patch(`/api/tasks/${id}`, { done }),
    onMutate: ({ id }) => { localToggle(id) },
    onSuccess: () => { qc.invalidateQueries(['dashboard']) },
    onError: (err, { id }) => { localToggle(id); toast.error(err.message) }
  })

  // Add task mutation
  const addMutation = useMutation({
    mutationFn: (taskData) => api.post('/api/tasks', taskData),
    onSuccess: ({ task }) => {
      localAdd(task)
      qc.invalidateQueries(['dashboard'])
      toast.success('Tâche ajoutée !')
    },
    onError: (err) => {
      if (err.message.includes('Limite')) {
        toast.error('Limite du plan gratuit atteinte. Upgrade Premium !')
      } else {
        toast.error(err.message)
      }
    }
  })

  // Generate AI plan
  const generateMutation = useMutation({
    mutationFn: () => api.post('/api/tasks/generate', {}),
    onSuccess: ({ tasks: newTasks }) => {
      setTasks(prev => [...prev, ...newTasks])
      qc.invalidateQueries(['dashboard'])
      toast.success('🤖 Plan IA généré !')
    },
    onError: (err) => toast.error(err.message)
  })

  const today = dashData?.today || {}
  const score = today.score || 0
  const todayTasks = tasks.length > 0 ? tasks : (today.tasks || [])
  const completedCount = todayTasks.filter(t => t.done).length
  const stats = dashData?.user || {}

  const staggerChild = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }
  const container = {
    hidden: {}, show: { transition: { staggerChildren: 0.07 } }
  }

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">

        {/* ── Score Hero ── */}
        <motion.div variants={staggerChild}
          className="bg-surface border border-border2 rounded-2xl p-6
            relative overflow-hidden bg-[radial-gradient(ellipse_at_right,_rgba(249,115,22,0.08)_0%,_transparent_60%)]">
          <div className="flex items-center justify-between gap-6">
            <div className="flex-1">
              <p className="font-mono text-xs text-text3 uppercase tracking-widest mb-1">Score de discipline</p>
              <div className="font-display text-7xl text-accent mb-2 leading-none"
                style={{ textShadow: '0 0 40px rgba(249,115,22,0.3)' }}>
                {score}
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1.5 bg-accent/10 border border-accent/30 px-3 py-1.5 rounded-full">
                  <span className="text-sm">🔥</span>
                  <span className="text-accent text-sm font-bold">{stats.streak || 0} jours</span>
                </div>
                <span className="text-text3 text-sm">{completedCount}/{todayTasks.length} tâches</span>
              </div>
            </div>
            <div className="mt-5">
              <ScoreRing score={score} />
            </div>
          </div>
        </motion.div>

        {/* ── Stats Grid ── */}
        <motion.div variants={staggerChild} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: '🔥', value: stats.streak || 0, label: 'Streak', sub: `Max: ${stats.longestStreak || 0}j`, color: 'text-orange-400' },
            { icon: '✅', value: `${completedCount}/${todayTasks.length}`, label: 'Tâches', sub: `${today.completionRate || 0}% du jour`, color: 'text-green-400' },
            { icon: '⏱️', value: `${Math.floor((today.focusMinutes || 0) / 60)}h${(today.focusMinutes || 0) % 60}m`, label: 'Focus', sub: 'Aujourd\'hui', color: 'text-blue-400' },
            { icon: '🎯', value: today.pomodorosCompleted || 0, label: 'Pomodoros', sub: 'Terminés', color: 'text-purple-400' }
          ].map((s) => (
            <div key={s.label} className="card hover:-translate-y-0.5 transition-transform duration-200">
              <div className="text-2xl mb-2">{s.icon}</div>
              <div className={`font-display text-3xl ${s.color} mb-0.5`}>{s.value}</div>
              <div className="text-xs text-text3 uppercase tracking-wider">{s.label}</div>
              <div className="text-xs text-text3 mt-1">{s.sub}</div>
            </div>
          ))}
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-5">
          {/* ── Tasks ── */}
          <motion.div variants={staggerChild} className="lg:col-span-2 card">
            <div className="flex items-center justify-between mb-5">
              <h2 className="section-title">Tâches du jour</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                  className="text-xs text-accent hover:text-accent2 transition-colors disabled:opacity-50"
                >
                  {generateMutation.isPending ? '⏳ Génération...' : '🤖 Plan IA'}
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="text-xs text-text3 hover:text-accent transition-colors"
                >+ Ajouter</button>
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-14 bg-bg3 rounded-xl animate-pulse" />)}
              </div>
            ) : todayTasks.length === 0 ? (
              <div className="text-center py-10">
                <div className="text-4xl mb-3">📋</div>
                <p className="text-text3 text-sm mb-4">Aucune tâche pour aujourd'hui</p>
                <button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}
                  className="text-accent text-sm hover:text-accent2 transition-colors">
                  🤖 Générer un plan IA
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {todayTasks.map(task => (
                  <TaskItem
                    key={task.id} task={task}
                    onToggle={(id) => toggleMutation.mutate({ id, done: !task.done })}
                  />
                ))}
              </div>
            )}

            <button onClick={() => setShowAddModal(true)}
              className="w-full mt-3 py-3 border border-dashed border-border2 rounded-xl
              text-text3 text-sm hover:border-accent hover:text-accent transition-all duration-200">
              + Nouvelle tâche
            </button>
          </motion.div>

          {/* ── Sidebar cards ── */}
          <div className="space-y-4">
            {/* Coach message */}
            <motion.div variants={staggerChild} className="card">
              <h2 className="section-title mb-4">Message du Coach</h2>
              <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 relative">
                <div className="absolute -top-3 left-4 text-lg">🔥</div>
                <p className="text-text2 text-sm leading-relaxed italic mt-1">
                  {motivation || 'La discipline, c\'est choisir entre ce que tu veux maintenant et ce que tu veux le plus.'}
                </p>
              </div>
              <button onClick={() => navigate('/coach')}
                className="mt-3 w-full py-2.5 border border-border2 rounded-xl text-text3 text-sm
                hover:border-accent hover:text-accent transition-all duration-200">
                Parler au coach →
              </button>
            </motion.div>

            {/* Quick Focus */}
            <motion.div variants={staggerChild} className="card">
              <h2 className="section-title mb-4">Démarrer le Focus</h2>
              <p className="text-text3 text-sm mb-4">Lance une session Pomodoro maintenant</p>
              <button
                onClick={() => navigate('/focus')}
                className="btn-primary text-sm py-3"
              >
                🎯 Démarrer Focus
              </button>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Add Task Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddTaskModal
            onClose={() => setShowAddModal(false)}
            onAdd={(data) => addMutation.mutateAsync(data)}
          />)
        }
      </AnimatePresence>
    </div>
  )
}

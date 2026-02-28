import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '../../store/appStore'
import api from '../../lib/api'
import toast from 'react-hot-toast'

const PRIORITY_COLORS = {
  high: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', dot: 'bg-red-400' },
  med: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', dot: 'bg-yellow-400' },
  low: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', dot: 'bg-green-400' }
}

function TimelineItem({ task, isCurrent, isPast }) {
  const pc = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.med

  return (
    <div className="flex gap-3 group">
      {/* Time */}
      <div className="w-14 text-right shrink-0 pt-3">
        <span className="font-mono text-xs text-text3">{task.scheduled_time || '--:--'}</span>
      </div>

      {/* Dot + line */}
      <div className="flex flex-col items-center">
        <div className={`w-3.5 h-3.5 rounded-full mt-3 shrink-0 z-10 transition-all duration-300
          ${isPast ? 'bg-green-500 scale-90' : isCurrent ? `${pc.dot} scale-125 ring-2 ring-offset-2 ring-offset-bg ring-accent/50` : 'bg-border2 group-hover:bg-accent'}`}
        />
        <div className="w-px flex-1 bg-border mt-1" />
      </div>

      {/* Content */}
      <div className={`flex-1 mb-4 p-3.5 rounded-xl border transition-all duration-200
        ${isCurrent ? `${pc.bg} ${pc.border}` : isPast ? 'bg-bg opacity-60' : 'bg-bg3 border-border hover:border-border2'}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className={`font-medium text-sm ${isPast ? 'line-through text-text3' : 'text-text'}`}>
              {task.name}
            </p>
            <div className="flex items-center gap-3 mt-1">
              <span className={`text-xs font-mono ${pc.text}`}>⏱ {task.duration_min || 60}min</span>
              {task.goal_category && (
                <span className="text-xs text-text3">{task.goal_category}</span>
              )}
            </div>
          </div>
          <span className={`badge text-[10px] ${pc.bg} ${pc.text} border ${pc.border} shrink-0`}>
            {task.priority === 'high' ? 'Haute' : task.priority === 'med' ? 'Moyenne' : 'Basse'}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function PlanPage() {
  const qc = useQueryClient()
  const { tasks, setTasks, profile } = useAppStore()
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  const currentHour = new Date().getHours()
  const currentMin = new Date().getMinutes()

  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['tasks', selectedDate],
    queryFn: () => api.get(`/api/tasks?date=${selectedDate}`),
  })

  // Set tasks when data arrives for today
  useEffect(() => {
    if (tasksData?.tasks && selectedDate === new Date().toISOString().split('T')[0]) {
      setTasks(tasksData.tasks)
    }
  }, [tasksData, selectedDate])

  const planTasks = tasksData?.tasks || tasks

  const generateMutation = useMutation({
    mutationFn: () => api.post('/api/tasks/generate', { date: selectedDate, regenerate: true }),
    onSuccess: (data) => {
      setTasks(prev => [...prev.filter(t => !t.ai_generated), ...(data.tasks || [])])
      qc.invalidateQueries(['tasks'])
      toast.success('🤖 Plan IA régénéré !')
    },
    onError: (err) => toast.error(err.message)
  })

  const isTaskCurrent = (task) => {
    if (!task.scheduled_time) return false
    const [h, m] = task.scheduled_time.split(':').map(Number)
    const taskStart = h * 60 + m
    const taskEnd = taskStart + (task.duration_min || 60)
    const now = currentHour * 60 + currentMin
    return now >= taskStart && now < taskEnd
  }

  const isTaskPast = (task) => {
    if (!task.scheduled_time) return task.done
    const [h, m] = task.scheduled_time.split(':').map(Number)
    return h * 60 + m + (task.duration_min || 60) < currentHour * 60 + currentMin
  }

  const sortedTasks = [...planTasks].sort((a, b) => {
    if (!a.scheduled_time) return 1
    if (!b.scheduled_time) return -1
    return a.scheduled_time.localeCompare(b.scheduled_time)
  })

  const completedCount = planTasks.filter(t => t.done).length
  const totalMin = planTasks.reduce((s, t) => s + (t.duration_min || 60), 0)

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-text2 text-sm mb-1">Planning du</h2>
          <input
            type="date" value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="font-display text-2xl tracking-wider text-text bg-transparent border-none outline-none cursor-pointer"
          />
        </div>
        <button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="flex items-center gap-2 px-4 py-2.5 bg-accent/10 border border-accent/30
          text-accent text-sm font-semibold rounded-xl hover:bg-accent/20 transition-all duration-200
          disabled:opacity-50"
        >
          {generateMutation.isPending ? (
            <><span className="text-base animate-spin">⏳</span> Génération...</>
          ) : (
            <><span>🤖</span> Régénérer avec IA</>
          )}
        </button>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: '📋', value: planTasks.length, label: 'Tâches' },
          { icon: '✅', value: completedCount, label: 'Faites' },
          { icon: '⏱️', value: `${Math.floor(totalMin / 60)}h${totalMin % 60}m`, label: 'Total' }
        ].map(s => (
          <div key={s.label} className="card text-center py-4">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="font-display text-2xl text-text">{s.value}</div>
            <div className="text-text3 text-xs">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* ── Timeline ── */}
        <div className="lg:col-span-2 card">
          <h3 className="section-title mb-6">Planning horaire</h3>

          {isLoading ? (
            <div className="space-y-4">
              {[1,2,3,4].map(i => <div key={i} className="h-16 bg-bg3 rounded-xl animate-pulse" />)}
            </div>
          ) : sortedTasks.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-3">📅</div>
              <p className="text-text3 text-sm mb-4">Aucune tâche planifiée</p>
              <button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}
                className="text-accent text-sm hover:text-accent2 transition-colors">
                🤖 Générer avec l'IA
              </button>
            </div>
          ) : (
            <div>
              {sortedTasks.map(task => (
                <TimelineItem
                  key={task.id} task={task}
                  isCurrent={isTaskCurrent(task)}
                  isPast={isTaskPast(task)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-4">
          {/* Goals progress */}
          <div className="card">
            <h3 className="section-title mb-4">Objectifs</h3>
            <div className="space-y-4">
              {(profile?.goals || ['Objectif principal']).map((goal, i) => {
                const pcts = [75, 45, 90]
                const pct = pcts[i % pcts.length]
                return (
                  <div key={goal}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-text2 truncate text-xs">{goal}</span>
                      <span className="text-accent font-bold text-xs">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-border2 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 1, delay: i * 0.1 }}
                        className="h-full bg-accent rounded-full"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* AI tips */}
          <div className="card">
            <h3 className="section-title mb-3">💡 Conseil IA</h3>
            <p className="text-text2 text-sm leading-relaxed">
              Ton pic d'énergie est entre{' '}
              <span className="text-accent font-semibold">
                {profile?.wake_time ? `${parseInt(profile.wake_time) + 1}h` : '9h'}
              </span>{' '}
              et{' '}
              <span className="text-accent font-semibold">
                {profile?.wake_time ? `${parseInt(profile.wake_time) + 4}h` : '12h'}
              </span>.
              Place tes tâches à haute priorité dans cette fenêtre.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

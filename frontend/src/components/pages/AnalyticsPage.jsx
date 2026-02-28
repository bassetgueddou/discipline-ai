import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import toast from 'react-hot-toast'

// ─── Bar Chart ───
function BarChart({ data }) {
  const max = Math.max(...data.map(d => d.score), 1)
  const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
  const today = new Date().getDay()
  const todayIdx = today === 0 ? 6 : today - 1

  return (
    <div className="flex items-end gap-2 h-28 w-full">
      {data.map((d, i) => {
        const height = (d.score / max) * 100
        const isToday = i === (data.length - 1)
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full relative group" style={{ height: '96px' }}>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${height}%` }}
                transition={{ duration: 0.8, delay: i * 0.05, ease: 'easeOut' }}
                className={`absolute bottom-0 w-full rounded-t-lg cursor-pointer transition-opacity
                  ${isToday ? 'bg-accent opacity-100 shadow-lg shadow-accent/25' : 'bg-border2 hover:bg-accent/50 opacity-80'}`}
              />
              {/* Tooltip */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-surface border border-border2
                px-2 py-1 rounded-lg text-xs font-mono text-text whitespace-nowrap opacity-0 group-hover:opacity-100
                transition-opacity pointer-events-none z-10">
                {d.score}
              </div>
            </div>
            <span className={`font-mono text-[10px] ${isToday ? 'text-accent' : 'text-text3'}`}>
              {d.day || days[i]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Habit Row ───
function HabitRow({ habit, onComplete }) {
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-bg3 transition-colors group">
      <span className="text-xl">{habit.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text truncate">{habit.name}</p>
        <div className="flex gap-1 mt-1.5">
          {(habit.week || [false,false,false,false,false,false,false]).map((done, i) => (
            <div key={i} className={`w-4 h-4 rounded-sm transition-all duration-200
              ${done ? 'bg-accent' : 'bg-border2'}`}
            />
          ))}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-display text-lg text-accent">{habit.streak || 0}</div>
        <div className="text-text3 text-[10px]">jours</div>
      </div>
      <button
        onClick={() => onComplete(habit.id)}
        className="w-7 h-7 rounded-lg border border-border2 flex items-center justify-center
        text-text3 hover:border-accent hover:text-accent transition-all duration-200 shrink-0
        opacity-0 group-hover:opacity-100"
      >
        ✓
      </button>
    </div>
  )
}

export default function AnalyticsPage() {
  const qc = useQueryClient()

  const { data: weekData, isLoading: loadingWeek } = useQuery({
    queryKey: ['analytics-weekly'],
    queryFn: () => api.get('/api/analytics/weekly')
  })

  const { data: habitsData, isLoading: loadingHabits } = useQuery({
    queryKey: ['analytics-habits'],
    queryFn: () => api.get('/api/analytics/habits')
  })

  const completeMutation = useMutation({
    mutationFn: (habitId) => api.post(`/api/analytics/habits/${habitId}/complete`),
    onSuccess: () => {
      qc.invalidateQueries(['analytics-habits'])
      toast.success('Habitude validée ! 🎉')
    },
    onError: (err) => toast.error(err.message)
  })

  const weekDays = weekData?.days || Array(7).fill({ score: 0, day: '-', focusMinutes: 0, tasksCompleted: 0 })
  const summary = weekData?.summary || {}
  const habits = habitsData?.habits || []

  const insights = [
    "Tu es plus productif le matin — protège ton bloc 9h-12h comme sacré.",
    "Ton taux de completion augmente quand tu commences avant 9h.",
    "Les jours avec plus de 2 pomodoros → score +15% en moyenne.",
    "Tes meilleurs jours corrèlent avec 7h+ de sommeil."
  ]
  const insight = insights[new Date().getDate() % insights.length]

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-5">

      {/* ── Stats Overview ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: '📊', value: summary.avgScore || 0, label: 'Score moyen', sub: '7 derniers jours', color: 'text-accent' },
          { icon: '⏱️', value: `${summary.totalFocusHours || 0}h`, label: 'Focus total', sub: 'Cette semaine', color: 'text-blue-400' },
          { icon: '🎯', value: `${summary.activeDays || 0}/7`, label: 'Jours actifs', sub: 'Cette semaine', color: 'text-green-400' },
          { icon: '🏆', value: summary.maxScore || 0, label: 'Meilleur score', sub: 'Record semaine', color: 'text-yellow-400' }
        ].map((s) => (
          <div key={s.label} className="card hover:-translate-y-0.5 transition-transform">
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className={`font-display text-3xl ${s.color} mb-0.5`}>{s.value}</div>
            <div className="text-xs text-text3 uppercase tracking-wider">{s.label}</div>
            <div className="text-xs text-text3 mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* ── Bar Chart ── */}
        <div className="card">
          <h3 className="section-title mb-6">Score Discipline — 7 jours</h3>
          {loadingWeek ? (
            <div className="h-28 bg-bg3 rounded-xl animate-pulse" />
          ) : (
            <>
              <BarChart data={weekDays} />
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
                {[
                  { label: 'Moyenne', value: summary.avgScore || 0 },
                  { label: 'Maximum', value: summary.maxScore || 0 },
                  { label: 'Focus', value: `${summary.totalFocusHours || 0}h` }
                ].map(s => (
                  <div key={s.label} className="text-sm">
                    <span className="text-text3">{s.label}: </span>
                    <span className="text-text font-semibold">{s.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Habits ── */}
        <div className="card">
          <h3 className="section-title mb-4">Habitudes quotidiennes</h3>
          {loadingHabits ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="h-12 bg-bg3 rounded-xl animate-pulse" />)}
            </div>
          ) : habits.length === 0 ? (
            <div className="text-center py-8 text-text3">
              <div className="text-3xl mb-2">🌱</div>
              <p className="text-sm">Complète l'onboarding pour ajouter des habitudes</p>
            </div>
          ) : (
            <div className="space-y-1">
              {habits.map(habit => (
                <HabitRow key={habit.id} habit={habit} onComplete={(id) => completeMutation.mutate(id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Weekly insight ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-surface border border-border2 rounded-2xl p-6
          bg-[radial-gradient(ellipse_at_left,_rgba(249,115,22,0.05)_0%,_transparent_60%)]"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-lg shrink-0">
            🧠
          </div>
          <div>
            <div className="text-xs font-mono text-accent uppercase tracking-widest mb-2">
              INSIGHT IA DE LA SEMAINE
            </div>
            <p className="text-text2 text-sm leading-relaxed italic">"{insight}"</p>
          </div>
        </div>
      </motion.div>

      {/* ── Weekly detail table ── */}
      <div className="card overflow-x-auto">
        <h3 className="section-title mb-4">Détail quotidien</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text3 text-xs uppercase tracking-wider font-mono border-b border-border">
              <th className="text-left pb-3 pr-4">Jour</th>
              <th className="text-right pb-3 px-4">Score</th>
              <th className="text-right pb-3 px-4">Tâches</th>
              <th className="text-right pb-3 pl-4">Focus</th>
            </tr>
          </thead>
          <tbody>
            {weekDays.map((d, i) => (
              <tr key={i} className={`border-b border-border/50 last:border-0 ${i === weekDays.length - 1 ? 'text-accent' : 'text-text2'}`}>
                <td className="py-3 pr-4 font-medium capitalize">{d.date ? new Date(d.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }) : d.day}</td>
                <td className="py-3 px-4 text-right font-display text-lg">{d.score}</td>
                <td className="py-3 px-4 text-right">{d.tasksCompleted}</td>
                <td className="py-3 pl-4 text-right font-mono text-xs">{Math.floor(d.focusMinutes / 60)}h{d.focusMinutes % 60}m</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

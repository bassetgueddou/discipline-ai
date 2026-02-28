import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { useTimer } from '../../hooks/useTimer'
import { useAppStore } from '../../store/appStore'
import api from '../../lib/api'

const MOTIVATIONS = {
  focus: [
    '"La discipline, c\'est choisir entre ce que tu veux maintenant et ce que tu veux le plus."',
    '"Le succès, c\'est d\'aller d\'échec en échec sans perdre son enthousiasme." — Churchill',
    '"Tout ce qui est accompli commence par une décision de s\'y mettre."',
    '"Focus sur le processus, les résultats suivront."'
  ],
  break: [
    '"Repose-toi — mais garde l\'œil sur l\'objectif."',
    '"Une pause bien méritée. Le prochain sprint sera encore meilleur."',
    '"Les grands sprinters récupèrent aussi bien qu\'ils courent."'
  ]
}

function CircularTimer({ progress, phase, children }) {
  const radius = 100
  const circ = 2 * Math.PI * radius
  const offset = circ - progress * circ
  const colors = { focus: '#f97316', break: '#22c55e', 'long-break': '#3b82f6' }

  return (
    <div className="relative w-56 h-56 mx-auto">
      <svg viewBox="0 0 240 240" className="w-full h-full -rotate-90">
        <circle cx="120" cy="120" r={radius} fill="none" stroke="#1f2937" strokeWidth="10" />
        <motion.circle
          cx="120" cy="120" r={radius} fill="none"
          stroke={colors[phase]} strokeWidth="10" strokeLinecap="round"
          style={{ strokeDasharray: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.5, ease: 'linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  )
}

export default function FocusPage() {
  const {
    seconds, running, phase, pomCount, duration,
    taskId, taskName, phaseInfo, progress, formattedTime,
    start, pause, reset, setDuration, selectTask
  } = useTimer()

  const { tasks } = useAppStore()

  const { data: todayData } = useQuery({
    queryKey: ['focus-today'],
    queryFn: () => api.get('/api/focus/today'),
    refetchInterval: running ? false : 30000
  })

  // Wake lock to prevent screen sleep
  useEffect(() => {
    let wakeLock = null
    if (running && 'wakeLock' in navigator) {
      navigator.wakeLock.request('screen').then(wl => { wakeLock = wl }).catch(() => {})
    }
    return () => { wakeLock?.release().catch(() => {}) }
  }, [running])

  const todayFocusMin = todayData?.stats?.totalFocusMinutes || 0
  const todayPoms = todayData?.stats?.pomodorosCompleted || 0
  const pendingTasks = tasks.filter(t => !t.done)

  const phaseColors = { focus: 'text-accent', break: 'text-green-400', 'long-break': 'text-blue-400' }
  const motivations = MOTIVATIONS[phase === 'focus' ? 'focus' : 'break']
  const motivationText = motivations[Math.floor(Date.now() / 60000) % motivations.length]

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto">
      <div className="space-y-5">

        {/* ── Main Timer Card ── */}
        <div className="card text-center">
          {/* Phase label */}
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`font-mono text-xs tracking-widest uppercase mb-6 ${phaseColors[phase]}`}
          >
            {phaseInfo.label} {pomCount > 0 && phase === 'focus' && `#${pomCount + 1}`}
          </motion.div>

          {/* Circular timer */}
          <CircularTimer progress={progress} phase={phase}>
            <button onClick={running ? pause : start} className="group flex flex-col items-center">
              <motion.span
                className={`font-display text-5xl tracking-wider transition-colors duration-300
                  ${running ? phaseColors[phase] : 'text-text'}`}
                animate={running ? { opacity: [1, 0.8, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {formattedTime}
              </motion.span>
              <span className="text-text3 text-xs mt-1 group-hover:text-text2 transition-colors">
                {running ? 'tap to pause' : 'tap to start'}
              </span>
            </button>
          </CircularTimer>

          {/* Selected task */}
          {taskName && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-text2 text-sm mt-4 truncate px-4"
            >
              🎯 {taskName}
            </motion.p>
          )}

          {/* Pomodoro dots */}
          <div className="flex justify-center gap-2 mt-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <motion.div
                key={i}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  i < pomCount % 4
                    ? 'bg-accent scale-110'
                    : i === pomCount % 4 && running
                    ? 'bg-accent/60 animate-pulse'
                    : 'bg-border2'
                }`}
              />
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={running ? pause : start}
              className={`px-8 py-3.5 rounded-full font-semibold text-sm transition-all duration-200
                ${running
                  ? 'bg-surface border border-border2 text-text2 hover:text-text'
                  : 'bg-accent text-white hover:bg-accent2 shadow-lg hover:shadow-accent/25'
                }`}
            >
              {running ? '⏸ Pause' : phase !== 'focus' ? '▶ Pause' : '▶ Focus'}
            </button>
            <button onClick={reset}
              className="px-5 py-3.5 rounded-full border border-border2 text-text3 text-sm hover:text-text2 transition-colors">
              ↺
            </button>
          </div>

          {/* Duration selector */}
          <div className="flex justify-center gap-2 mt-5">
            {[15, 25, 45].map(min => (
              <button key={min} onClick={() => setDuration(min)} disabled={running}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200
                  ${duration === min
                    ? 'bg-accent/10 border border-accent text-accent'
                    : 'border border-border2 text-text3 hover:text-text2 hover:border-border disabled:opacity-30'
                  }`}
              >
                {min}min
              </button>
            ))}
          </div>
        </div>

        {/* ── Motivation ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={motivationText}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-accent/5 border border-accent/15 rounded-2xl px-5 py-4 relative"
          >
            <div className="absolute -top-3 left-5 text-lg">🔥</div>
            <p className="text-text2 text-sm leading-relaxed italic mt-1">{motivationText}</p>
          </motion.div>
        </AnimatePresence>

        {/* ── Today Stats ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: '🍅', value: todayPoms, label: 'Pomodoros' },
            { icon: '⏱️', value: `${Math.floor(todayFocusMin / 60)}h${todayFocusMin % 60}m`, label: 'Focus' },
            { icon: '🔥', value: pomCount % 4, label: 'Ce cycle' }
          ].map(s => (
            <div key={s.label} className="card text-center py-4">
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="font-display text-2xl text-text">{s.value}</div>
              <div className="text-text3 text-xs mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Task Selection ── */}
        {pendingTasks.length > 0 && (
          <div className="card">
            <h3 className="section-title mb-4">Tâche Focus</h3>
            <div className="space-y-2">
              {pendingTasks.slice(0, 5).map(task => (
                <button key={task.id} onClick={() => selectTask(task)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200
                    ${taskId === task.id
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border bg-bg3 text-text2 hover:border-border2 hover:text-text'
                    }`}
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0
                    ${taskId === task.id ? 'border-accent bg-accent' : 'border-border2'}`}>
                    {taskId === task.id && <span className="text-white text-[10px]">✓</span>}
                  </div>
                  <span className="text-sm font-medium truncate">{task.name}</span>
                  <span className={`badge text-[10px] shrink-0 ml-auto priority-${task.priority}`}>
                    {task.priority === 'high' ? 'Haute' : task.priority === 'med' ? 'Moy.' : 'Basse'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

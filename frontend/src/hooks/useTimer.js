import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../store/appStore'
import api from '../lib/api'
import toast from 'react-hot-toast'

const PHASES = {
  focus: { next: 'break', label: 'FOCUS', color: '#f97316' },
  break: { next: 'focus', label: 'PAUSE', color: '#22c55e' },
  'long-break': { next: 'focus', label: 'GRANDE PAUSE', color: '#3b82f6' }
}

export function useTimer() {
  const { timerState, setTimerState } = useAppStore()
  const intervalRef = useRef(null)

  const { running, seconds, duration, phase, pomCount, sessionId, taskId, taskName } = timerState

  // Tick
  useEffect(() => {
    if (!running) {
      clearInterval(intervalRef.current)
      return
    }

    intervalRef.current = setInterval(() => {
      setTimerState({ seconds: timerState.seconds - 1 })
      if (timerState.seconds <= 1) {
        clearInterval(intervalRef.current)
        handleComplete()
      }
    }, 1000)

    return () => clearInterval(intervalRef.current)
  }, [running, timerState.seconds])

  const handleComplete = useCallback(async () => {
    if (phase === 'focus') {
      const newPomCount = pomCount + 1
      const isLongBreak = newPomCount % 4 === 0
      const breakDuration = isLongBreak ? 15 : 5

      toast.success(`🎉 Pomodoro #${newPomCount} terminé ! +5 points`)

      // Marquer la session comme complète en BDD
      if (sessionId) {
        try {
          await api.patch(`/api/focus/${sessionId}/complete`)
        } catch (e) { /* silent */ }
      }

      setTimerState({
        running: false,
        phase: isLongBreak ? 'long-break' : 'break',
        pomCount: newPomCount,
        seconds: breakDuration * 60,
        sessionId: null
      })
    } else {
      // Fin de la pause
      toast(`🔥 Pause terminée ! Prêt à attaquer ?`, { icon: '⚡' })
      setTimerState({
        running: false,
        phase: 'focus',
        seconds: duration * 60
      })
    }
  }, [phase, pomCount, duration, sessionId])

  const start = useCallback(async () => {
    let newSessionId = sessionId

    // Créer une session en BDD si c'est un focus
    if (phase === 'focus' && !sessionId) {
      try {
        const res = await api.post('/api/focus/start', {
          duration_min: duration,
          task_id: taskId || undefined,
          session_type: 'pomodoro'
        })
        newSessionId = res.session?.id
      } catch (e) { /* continue sans session BDD */ }
    }

    setTimerState({ running: true, sessionId: newSessionId })
  }, [phase, duration, taskId, sessionId])

  const pause = useCallback(async () => {
    setTimerState({ running: false })

    // Marquer comme interrompue si on interrompt un focus
    if (phase === 'focus' && sessionId) {
      const elapsed = duration * 60 - seconds
      try {
        await api.patch(`/api/focus/${sessionId}/complete`, {
          interrupted_at_sec: elapsed
        })
      } catch (e) { /* silent */ }
      setTimerState({ sessionId: null })
    }
  }, [phase, sessionId, duration, seconds])

  const reset = useCallback(() => {
    clearInterval(intervalRef.current)
    setTimerState({
      running: false,
      seconds: duration * 60,
      phase: 'focus',
      sessionId: null
    })
  }, [duration])

  const setDuration = useCallback((min) => {
    if (running) return
    setTimerState({ duration: min, seconds: min * 60 })
  }, [running])

  const selectTask = useCallback((task) => {
    setTimerState({ taskId: task?.id || null, taskName: task?.name || null })
  }, [])

  const formatTime = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  const progress = 1 - (seconds / (duration * 60))

  return {
    seconds, running, phase, pomCount, duration,
    taskId, taskName,
    phaseInfo: PHASES[phase],
    progress,
    formattedTime: formatTime(seconds),
    start, pause, reset, setDuration, selectTask
  }
}

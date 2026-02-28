import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export const useAppStore = create(
  persist(
    (set, get) => ({
      // ─── User & Auth ───
      user: null,
      profile: null,
      session: null,

      setUser: (user) => set({ user }),
      setProfile: (profile) => set({ profile }),
      setSession: (session) => set({ session }),

      updateProfile: (updates) => set(state => ({
        profile: { ...state.profile, ...updates }
      })),

      logout: () => set({ user: null, profile: null, session: null, tasks: [], chatHistory: [] }),

      // ─── Tasks ───
      tasks: [],
      setTasks: (tasks) => set({ tasks }),

      toggleTask: (id) => set(state => {
        const tasks = state.tasks.map(t =>
          t.id === id ? { ...t, done: !t.done, done_at: !t.done ? new Date().toISOString() : null } : t
        )
        return { tasks }
      }),

      addTask: (task) => set(state => ({ tasks: [task, ...state.tasks] })),
      removeTask: (id) => set(state => ({ tasks: state.tasks.filter(t => t.id !== id) })),
      updateTask: (id, updates) => set(state => ({
        tasks: state.tasks.map(t => t.id === id ? { ...t, ...updates } : t)
      })),

      // ─── Timer ───
      timerState: {
        running: false,
        seconds: 25 * 60,
        duration: 25,
        phase: 'focus', // 'focus' | 'break' | 'long-break'
        pomCount: 0,
        sessionId: null,
        taskId: null,
        taskName: null
      },

      setTimerState: (updates) => set(state => ({
        timerState: { ...state.timerState, ...updates }
      })),

      // ─── Dashboard data ───
      dashboardData: null,
      setDashboardData: (data) => set({ dashboardData: data }),

      // ─── Chat history (local cache) ───
      chatHistory: [],
      addChatMessage: (msg) => set(state => ({
        chatHistory: [...state.chatHistory.slice(-49), msg]
      })),
      setChatHistory: (messages) => set({ chatHistory: messages }),
      clearChat: () => set({ chatHistory: [] }),

      // ─── UI state ───
      currentPage: 'dashboard',
      setCurrentPage: (page) => set({ currentPage: page }),

      sidebarOpen: false,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      // ─── Score ───
      todayScore: 0,
      setTodayScore: (score) => set({ todayScore: score })
    }),
    {
      name: 'discipline-ai-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Persister seulement les données non-sensibles
        profile: state.profile,
        timerState: { ...state.timerState, running: false }, // Ne pas persister running
        chatHistory: state.chatHistory.slice(-20), // Limiter l'historique local
        currentPage: state.currentPage
      })
    }
  )
)

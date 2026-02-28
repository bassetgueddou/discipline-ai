import axios from 'axios'
import { supabase } from './supabase'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
})

// ─── Request interceptor: attach JWT ───
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
}, (error) => Promise.reject(error))

// ─── Response interceptor: handle errors ───
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expiré → déconnecter
      await supabase.auth.signOut()
      window.location.href = '/auth'
      return Promise.reject(new Error('Session expirée. Reconnecte-toi.'))
    }

    const message = error.response?.data?.message
      || error.response?.data?.error
      || error.message
      || 'Erreur réseau'

    return Promise.reject(new Error(message))
  }
)

export default api

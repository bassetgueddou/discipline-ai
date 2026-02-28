import axios from 'axios'
import { supabase } from './supabase'

// detect if running in Android WebView (emulator or device)
const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
  
  // Détection Android WebView via user agent (plus fiable que Capacitor au runtime)
  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)
  const isCapacitor = typeof window !== 'undefined' && !!window.Capacitor
  
  console.log('[API] isAndroid:', isAndroid, 'isCapacitor:', isCapacitor)
  
  // Avec adb reverse tcp:3001 tcp:3001, on peut utiliser localhost directement
  // Sinon fallback sur 10.0.2.2 pour l'émulateur
  if (isAndroid || isCapacitor) {
    // Use localhost - requires: adb reverse tcp:3001 tcp:3001
    console.log('[API] Using localhost with adb reverse')
    return 'http://localhost:3001'
  }
  
  console.log('[API] Using default URL:', envUrl)
  return envUrl
}

const api = axios.create({
  baseURL: getBaseUrl(),
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

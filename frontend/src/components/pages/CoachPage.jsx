import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '../../store/appStore'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const QUICK_PROMPTS = [
  "Je procrastine, aide-moi",
  "Génère mon plan de la semaine",
  "Je suis épuisé, que faire ?",
  "Comment améliorer ma discipline ?",
  "J'ai raté mes tâches aujourd'hui"
]

function Message({ msg, userName }) {
  const isCoach = msg.role === 'assistant'
  const time = msg.created_at
    ? format(new Date(msg.created_at), 'HH:mm')
    : format(new Date(), 'HH:mm')

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isCoach ? '' : 'flex-row-reverse'} max-w-[85%] ${isCoach ? 'self-start' : 'self-end'}`}
    >
      {/* Avatar */}
      <div className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-base
        ${isCoach
          ? 'bg-gradient-to-br from-accent to-amber-400 text-white'
          : 'bg-gradient-to-br from-blue-500 to-purple-500 text-white text-sm font-bold'
        }`}
      >
        {isCoach ? '🤖' : (userName || 'U')[0].toUpperCase()}
      </div>

      <div className={`flex flex-col gap-1 ${isCoach ? '' : 'items-end'}`}>
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed
          ${isCoach
            ? 'bg-surface border border-border2 text-text rounded-tl-sm'
            : 'bg-accent text-white rounded-tr-sm'
          }`}
          dangerouslySetInnerHTML={{
            __html: msg.content
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/\n/g, '<br/>')
          }}
        />
        <span className="text-text3 text-[10px] font-mono">{time}</span>
      </div>
    </motion.div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 self-start">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-amber-400 flex items-center justify-center text-base shrink-0">
        🤖
      </div>
      <div className="bg-surface border border-border2 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5 items-center">
        {[0, 1, 2].map(i => (
          <motion.div key={i} className="w-2 h-2 rounded-full bg-text3"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
    </div>
  )
}

export default function CoachPage() {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)
  const qc = useQueryClient()
  const { chatHistory, setChatHistory, addChatMessage, profile } = useAppStore()

  // Load chat history from API
  const { data: historyData, isLoading } = useQuery({
    queryKey: ['chat-history'],
    queryFn: () => api.get('/api/coach/history'),
    staleTime: 60000
  })

  // Handle history data when it arrives
  useEffect(() => {
    if (historyData?.messages?.length > 0) {
      setChatHistory(historyData.messages)
    } else if (historyData && chatHistory.length === 0) {
      // Welcome message
      const welcomeMsg = {
        role: 'assistant',
        content: `Salut ${profile?.name || 'toi'} ! 🔥 Je suis ton coach IA. J'ai analysé ton profil — on va travailler sur : **${(profile?.goals || ['tes objectifs']).join(', ')}**.\n\nNiveau discipline actuel : **${profile?.disciplineLevel || profile?.discipline_level || 5}/10** — on va pousser ça bien plus haut.\n\nQu'est-ce qui te bloque en ce moment ?`,
        created_at: new Date().toISOString()
      }
      setChatHistory([welcomeMsg])
    }
  }, [historyData])

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: (message) => api.post('/api/coach/message', { message }),
    onMutate: (message) => {
      const userMsg = { role: 'user', content: message, created_at: new Date().toISOString() }
      addChatMessage(userMsg)
    },
    onSuccess: (data) => {
      const coachMsg = { role: 'assistant', content: data.message, created_at: new Date().toISOString() }
      addChatMessage(coachMsg)
    },
    onError: (err) => {
      if (err.message.includes('Limite')) {
        const limitMsg = {
          role: 'assistant',
          content: '⚠️ Tu as atteint la limite de messages du plan gratuit pour aujourd\'hui. **Passe à Premium** pour un chat illimité avec moi !',
          created_at: new Date().toISOString()
        }
        addChatMessage(limitMsg)
      } else {
        toast.error(err.message)
      }
    }
  })

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, sendMutation.isPending])

  const handleSend = () => {
    const msg = input.trim()
    if (!msg || sendMutation.isPending) return
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    sendMutation.mutate(msg)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const autoResize = (e) => {
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  const clearChat = async () => {
    if (!confirm('Effacer tout l\'historique ?')) return
    await api.delete('/api/coach/history').catch(() => {})
    setChatHistory([])
    qc.invalidateQueries(['chat-history'])
    toast.success('Historique effacé')
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-140px)] lg:h-[calc(100dvh-80px)] p-4 lg:p-8 max-w-3xl mx-auto">

      {/* Header actions */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
          <span className="text-text3 text-sm">Coach disponible</span>
        </div>
        <button onClick={clearChat} className="text-text3 text-xs hover:text-red-400 transition-colors">
          Effacer l'historique
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="flex justify-center pt-10">
            <div className="text-text3 text-sm">Chargement de l'historique...</div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 py-2">
            {chatHistory.map((msg, i) => (
              <Message key={i} msg={msg} userName={profile?.name} />
            ))}
            {sendMutation.isPending && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Quick prompts */}
      {chatHistory.length <= 1 && !sendMutation.isPending && (
        <div className="flex gap-2 flex-wrap mt-3 mb-2 shrink-0">
          {QUICK_PROMPTS.slice(0, 3).map(prompt => (
            <button key={prompt}
              onClick={() => { setInput(prompt); textareaRef.current?.focus() }}
              className="text-xs px-3 py-1.5 bg-bg3 border border-border2 rounded-full text-text3
              hover:border-accent hover:text-accent transition-all duration-200 whitespace-nowrap">
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-3 pt-4 border-t border-border shrink-0">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); autoResize(e) }}
          onKeyDown={handleKeyDown}
          placeholder="Parle à ton coach... (Enter pour envoyer)"
          rows={1}
          className="flex-1 bg-surface border border-border2 rounded-xl px-4 py-3 text-text text-sm
            font-body outline-none transition-colors placeholder:text-text3 focus:border-accent
            resize-none min-h-[48px] max-h-[120px] leading-relaxed"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sendMutation.isPending}
          className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center text-white
            hover:bg-accent2 transition-all duration-200 active:scale-95
            disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {sendMutation.isPending ? (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          ) : (
            <span className="text-base">➤</span>
          )}
        </button>
      </div>
    </div>
  )
}

// AI Service - OpenAI integration
// handles all the AI shit for coaching and task generation

import OpenAI from 'openai';
import { UserProfile, ChatResponse, DailyPlan, TaskPriority } from '../types/index.js';

if (!process.env.OPENAI_API_KEY) {
  console.warn('OPENAI_API_KEY missing - coach will use fallback responses');
}

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// builds the system prompt for the coach based on user profile
function buildCoachSystemPrompt(profile: Partial<UserProfile>): string {
  return `Tu es DISCIPLINE AI, un coach personnel IA d'élite. Tu aides ${profile.name || 'l\'utilisateur'} à développer sa discipline et atteindre ses objectifs.

PROFIL UTILISATEUR :
- Prénom : ${profile.name || 'Non défini'}
- Objectifs : ${(profile.goals || []).join(', ') || 'Non définis'}
- Niveau discipline : ${profile.disciplineLevel || 5}/10
- Obstacles : ${(profile.obstacles || []).join(', ') || 'Non définis'}
- Énergie : ${profile.energyLevel || 3}/5
- Chronotype : ${profile.chronotype || 'neutral'}
- Réveil : ${profile.wakeTime || '07:00'}
- XP actuel : ${profile.xp || 0} (Niveau ${profile.level || 1})
- Streak : ${profile.streakDays || 0} jours

STYLE DE COACHING :
- Ferme mais bienveillant (jamais toxique)
- Direct et orienté action
- Mix coach sportif + mentor business
- Réponses courtes et percutantes (3-5 phrases max)
- 1-2 emojis pertinents
- TOUJOURS terminer par une action concrète

LANGUE : Français uniquement.

RÈGLES :
- Ne jamais être condescendant
- Transformer les excuses en solutions
- Adapter le ton selon l'état émotionnel détecté
- Féliciter les progrès (streaks, XP, niveaux)
- Encourager sans jamais culpabiliser`;
}

// fallback responses when openai is down or key is missing
const FALLBACK_RESPONSES = [
  "🔥 La motivation vient avec l'action, pas avant. Lance-toi sur ta première tâche maintenant — même 5 minutes. Qu'est-ce que tu peux faire dans les 2 prochaines minutes ?",
  "💪 Le problème n'est pas le temps, c'est la priorisation. Quelle est ta tâche la plus impactante ? Commence par celle-là.",
  "⚡ Coupe ta grande tâche en 3 étapes de 15 min. Dis-moi la première et tu commences dans 60 secondes.",
  "🎯 La discipline, c'est choisir ce qui compte vs ce qui est facile. Ton futur toi te remerciera. Quelle tâche maintenant ?",
  "🚀 Les gagnants demandent de l'aide avant d'être bloqués. Dis-moi ce qui te retient et on trouve une solution.",
];

function getRandomFallback(): string {
  return FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)];
}

// main chat function - talks to openai
interface ChatMessage {
  role: string; // user, assistant, system
  content: string;
}

export async function chatWithCoach(
  profile: Partial<UserProfile>,
  messages: ChatMessage[]
): Promise<ChatResponse> {
  if (!openai) {
    return {
      content: getRandomFallback(),
      tokensUsed: 0,
      fallback: true,
    };
  }

  try {
    const openaiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: buildCoachSystemPrompt(profile) },
      ...messages.slice(-12).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 400,
      messages: openaiMessages,
      temperature: 0.7,
    });

    return {
      content: response.choices[0].message.content || getRandomFallback(),
      tokensUsed: response.usage?.total_tokens || 0,
      fallback: false,
    };
  } catch (error) {
    console.error('OpenAI API error:', error);
    return {
      content: getRandomFallback(),
      tokensUsed: 0,
      fallback: true,
    };
  }
}

// generates the daily plan using AI - this is where the magic happens
export async function generateDailyPlan(
  profile: Partial<UserProfile>,
  date: string = new Date().toISOString().split('T')[0],
  freeSlots?: Array<{ start: string; end: string; durationMin: number }>
): Promise<DailyPlan> {
  const dayName = new Date(date).toLocaleDateString('fr-FR', { weekday: 'long' });

  if (!openai) {
    return getDefaultPlan(profile, dayName);
  }

  const freeSlotsInfo = freeSlots?.length
    ? `\n\nCRÉNEAUX LIBRES (selon calendrier) :\n${freeSlots.map(s => `- ${s.start} à ${s.end} (${s.durationMin} min)`).join('\n')}`
    : '';

  const prompt = `Génère un planning optimal pour ${profile.name || 'l\'utilisateur'} pour ${dayName} ${date}.

PROFIL :
- Objectifs : ${(profile.goals || []).join(', ')}
- Réveil : ${profile.wakeTime || '07:00'}
- Heures disponibles : ${profile.availableHours || 8}h
- Énergie : ${profile.energyLevel || 3}/5
- Style de travail : ${profile.workStyle || 'pomodoro'}
- Obstacles : ${(profile.obstacles || []).join(', ')}
- Niveau : ${profile.level || 1} (${profile.xp || 0} XP)
${freeSlotsInfo}

Génère UNIQUEMENT un JSON valide :
{
  "tasks": [
    { "name": "string", "time": "HH:MM", "duration_min": number, "priority": "high|med|low", "goal_category": "string" }
  ],
  "daily_intention": "string (phrase motivante courte)",
  "coaching_message": "string (message personnalisé pour cette journée)",
  "energy_peak": "HH:MM",
  "recommended_breaks": [{ "time": "HH:MM", "duration_min": number, "reason": "string" }]
}

RÈGLES :
- Max 6 tâches (réaliste > ambitieux)
- Tâches importantes sur pics d'énergie
- 1 pause déjeuner + 1-2 courtes pauses
- Adapter au niveau d'énergie
- Si créneaux libres fournis, planifier dans ces créneaux`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const text = response.choices[0].message.content?.trim();
    if (!text) return getDefaultPlan(profile, dayName);
    
    return JSON.parse(text) as DailyPlan;
  } catch (error) {
    console.error('Plan generation error:', error);
    return getDefaultPlan(profile, dayName);
  }
}

// ─── Smart Task Suggestions ───

export async function suggestTasks(
  profile: Partial<UserProfile>,
  recentTasks: Array<{ name: string; done: boolean; priority: string }>,
  currentTime: string
): Promise<Array<{ name: string; priority: TaskPriority; reason: string }>> {
  if (!openai) {
    return [
      { name: 'Session de focus (25 min)', priority: 'high', reason: 'Boost de productivité' },
      { name: 'Revue des objectifs', priority: 'med', reason: 'Rester aligné' },
    ];
  }

  const prompt = `Suggère 3 tâches intelligentes pour ${profile.name || 'l\'utilisateur'}.

CONTEXTE :
- Heure actuelle : ${currentTime}
- Objectifs : ${(profile.goals || []).join(', ')}
- Énergie : ${profile.energyLevel || 3}/5
- Tâches récentes : ${recentTasks.map(t => `${t.name} (${t.done ? '✓' : '○'} ${t.priority})`).join(', ') || 'Aucune'}

Génère un JSON :
{
  "suggestions": [
    { "name": "string", "priority": "high|med|low", "reason": "string (1 phrase)" }
  ]
}

Règles : Tâches concrètes et réalisables, adaptées à l'heure et l'énergie.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const data = JSON.parse(response.choices[0].message.content || '{}');
    return data.suggestions || [];
  } catch (error) {
    console.error('Task suggestion error:', error);
    return [];
  }
}

// ─── Daily Motivation ───

export async function getDailyMotivation(profile: Partial<UserProfile>): Promise<string> {
  const motivations = [
    `${profile.name || 'Toi'}, aujourd'hui est une nouvelle chance. Tes objectifs (${(profile.goals || ['tes ambitions'])[0]}) méritent ton meilleur. Commence par ta tâche la plus importante — maintenant.`,
    "La discipline n'est pas un talent. C'est une décision que tu prends chaque matin. Tu as choisi d'être ici — honore ce choix.",
    "Chaque tâche complétée est un vote pour la personne que tu veux devenir. Vote pour toi aujourd'hui.",
    "Le succès n'est pas spectaculaire — c'est la somme de milliers de petites actions répétées. Ajoute ta pierre aujourd'hui.",
    `Niveau ${profile.level || 1}, ${profile.streakDays || 0} jours de streak. Continue comme ça, ${profile.name || 'champion'} !`,
  ];

  return motivations[new Date().getDate() % motivations.length];
}

// ─── Default Plan ───

function getDefaultPlan(profile: Partial<UserProfile>, dayName: string): DailyPlan {
  const wakeHour = parseInt((profile.wakeTime || '07:00').split(':')[0]);
  
  return {
    tasks: [
      { name: 'Routine matinale + hydratation', time: `${String(wakeHour).padStart(2, '0')}:00`, duration_min: 30, priority: 'med' as TaskPriority, goal_category: 'routine' },
      { name: 'Tâche prioritaire #1', time: `${String(wakeHour + 1).padStart(2, '0')}:00`, duration_min: 90, priority: 'high' as TaskPriority, goal_category: (profile.goals || ['général'])[0] },
      { name: 'Session focus deep work', time: `${String(wakeHour + 3).padStart(2, '0')}:00`, duration_min: 60, priority: 'high' as TaskPriority, goal_category: (profile.goals || ['général'])[0] },
      { name: 'Pause déjeuner', time: '12:30', duration_min: 45, priority: 'low' as TaskPriority, goal_category: 'routine' },
      { name: 'Tâche secondaire', time: '14:00', duration_min: 60, priority: 'med' as TaskPriority, goal_category: 'général' },
      { name: 'Revue du jour + planification', time: '19:00', duration_min: 20, priority: 'med' as TaskPriority, goal_category: 'routine' },
    ],
    daily_intention: "Aujourd'hui, je me concentre sur l'essentiel.",
    coaching_message: `Bonne journée ${dayName} ! Focus sur tes 2 tâches prioritaires.`,
    energy_peak: `${String(wakeHour + 2).padStart(2, '0')}:00`,
    recommended_breaks: [
      { time: `${String(wakeHour + 2).padStart(2, '0')}:30`, duration_min: 10, reason: 'Pause active' },
      { time: '12:30', duration_min: 45, reason: 'Déjeuner' },
    ],
  };
}

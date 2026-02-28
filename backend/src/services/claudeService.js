const OpenAI = require('openai');

if (!process.env.OPENAI_API_KEY) {
  console.warn('⚠️  OPENAI_API_KEY manquant — le coach IA sera en mode fallback');
}

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// ─── System prompt du coach ───
function buildCoachSystemPrompt(profile) {
  return `Tu es DISCIPLINE AI, un coach personnel IA d'élite. Ton rôle est d'aider ${profile.name || 'l\'utilisateur'} à être discipliné, productif et constant.

PROFIL DE L'UTILISATEUR :
- Prénom : ${profile.name || 'Non défini'}
- Objectifs principaux : ${(profile.goals || []).join(', ') || 'Non définis'}
- Niveau de discipline actuel : ${profile.discipline_level || 5}/10
- Principaux obstacles : ${(profile.obstacles || []).join(', ') || 'Non définis'}
- Niveau d'énergie habituel : ${profile.energy_level || 3}/5
- Heure de réveil : ${profile.wake_time || '07:00'}

TON STYLE :
- Ferme mais positif — jamais toxique
- Direct et orienté action
- Mélange coach sportif + mentor business
- Court et percutant (3-4 phrases max par réponse)
- 1-2 emojis pertinents par message
- TOUJOURS terminer par une action concrète immédiate

LANGUE : Toujours répondre en français.

RÈGLES STRICTES :
- Ne jamais être condescendant
- Ne jamais accepter les excuses sans proposer une solution
- Toujours ramener à l'action
- Adapter le ton selon l'état émotionnel détecté
- Si l'utilisateur dit qu'il va bien → encourager et challenger
- Si l'utilisateur est découragé → empathie PUIS action`;
}

// ─── Messages de fallback ───
const FALLBACK_RESPONSES = [
  "🔥 Arrête de chercher la motivation — elle ne vient qu'avec l'action. Lance-toi sur ta première tâche maintenant, même 5 minutes. Qu'est-ce que tu peux faire dans les 2 prochaines minutes ?",
  "💪 Le problème n'est pas le manque de temps, c'est le manque de priorisation. Quelle est la tâche qui aura le plus d'impact aujourd'hui ? Commence par celle-là, maintenant.",
  "⚡ Je t'entends. Voici ce qu'on va faire : coupe ta grande tâche en 3 mini-étapes de 15 min chacune. Dis-moi la première étape et tu commences dans 60 secondes.",
  "🎯 La discipline, c'est faire ce qui doit être fait même quand tu n'en as pas envie. Ton futur toi te remerciera. Quelle tâche tu peux commencer là, maintenant ?",
  "🚀 Excellent que tu me contactes ! Les gagnants cherchent de l'aide avant d'être bloqués. Dis-moi exactement ce qui te retient et on trouve une solution ensemble."
];

/**
 * Chat avec le coach IA (OpenAI GPT-4o)
 */
async function chatWithCoach(profile, messages) {
  // Fallback si pas de clé API
  if (!openai) {
    return {
      content: FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)],
      tokensUsed: 0,
      fallback: true
    };
  }

  try {
    // Convertir les messages au format OpenAI
    const openaiMessages = [
      { role: 'system', content: buildCoachSystemPrompt(profile) },
      ...messages.slice(-12).map(m => ({
        role: m.role,
        content: m.content
      }))
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Moins cher, rapide et très bon
      max_tokens: 400,
      messages: openaiMessages,
      temperature: 0.7
    });

    return {
      content: response.choices[0].message.content,
      tokensUsed: response.usage.total_tokens,
      fallback: false
    };
  } catch (error) {
    console.error('OpenAI API error:', error.message);
    // Fallback gracieux en cas d'erreur
    return {
      content: FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)],
      tokensUsed: 0,
      fallback: true
    };
  }
}

/**
 * Générer le planning IA du jour
 */
async function generateDailyPlan(profile, date = new Date().toISOString().split('T')[0]) {
  const dayName = new Date(date).toLocaleDateString('fr-FR', { weekday: 'long' });

  if (!openai) {
    // Retourner un plan par défaut
    return getDefaultPlan(profile, dayName);
  }

  const prompt = `Génère un planning optimal pour ${profile.name || 'l\'utilisateur'} pour ${dayName} ${date}.

PROFIL :
- Objectifs : ${(profile.goals || []).join(', ')}
- Heure de réveil : ${profile.wake_time || '07:00'}
- Heures disponibles : ${profile.available_hours || 8}h
- Niveau d'énergie : ${profile.energy_level || 3}/5
- Obstacles habituels : ${(profile.obstacles || []).join(', ')}

Génère UNIQUEMENT un JSON valide sans markdown ni commentaires :
{
  "tasks": [
    { "name": "string", "time": "HH:MM", "duration_min": number, "priority": "high|med|low", "goal_category": "string" }
  ],
  "daily_intention": "string (phrase motivante courte)",
  "coaching_message": "string (message du coach pour cette journée)",
  "energy_peak": "HH:MM",
  "recommended_breaks": [{ "time": "HH:MM", "duration_min": number, "reason": "string" }]
}

RÈGLES :
- Maximum 6 tâches (réaliste > ambitieux irréaliste)
- Placer les tâches importantes sur les pics d'énergie
- Inclure au moins une pause déjeuner et une courte pause
- Adapter au niveau d'énergie (si faible → moins de tâches, plus courtes)`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    });

    const text = response.choices[0].message.content.trim();
    return JSON.parse(text);
  } catch (error) {
    console.error('Plan generation error:', error.message);
    return getDefaultPlan(profile, dayName);
  }
}

/**
 * Générer le message de motivation du jour
 */
async function getDailyMotivation(profile) {
  const motivations = [
    `${profile.name || 'Toi'}, aujourd'hui est une nouvelle chance. Tes objectifs (${(profile.goals || ['tes ambitions'])[0]}) méritent ton meilleur. Commence par ta tâche la plus importante — maintenant.`,
    "La discipline n'est pas un talent. C'est une décision que tu prends chaque matin. Tu as choisi d'être ici — honore ce choix.",
    "Chaque tâche que tu complètes aujourd'hui est un vote pour la personne que tu veux devenir. Vote pour toi.",
    "Le succès n'est pas spectaculaire — c'est la somme de milliers de petites actions répétées. Aujourd'hui, ajoute ta pierre.",
    "Ton futur toi regarde ce que tu fais en ce moment. Rends-le fier."
  ];

  return motivations[new Date().getDate() % motivations.length];
}

/**
 * Plan par défaut si Claude indisponible
 */
function getDefaultPlan(profile, dayName) {
  const wakeHour = parseInt((profile.wake_time || '07:00').split(':')[0]);
  const tasks = [
    { name: 'Routine matinale + hydratation', time: `${String(wakeHour).padStart(2,'0')}:00`, duration_min: 30, priority: 'med', goal_category: 'routine' },
    { name: 'Tâche prioritaire #1', time: `${String(wakeHour + 1).padStart(2,'0')}:00`, duration_min: 90, priority: 'high', goal_category: (profile.goals || ['général'])[0] },
    { name: 'Session focus deep work', time: `${String(wakeHour + 3).padStart(2,'0')}:00`, duration_min: 60, priority: 'high', goal_category: (profile.goals || ['général'])[0] },
    { name: 'Pause déjeuner', time: '12:30', duration_min: 45, priority: 'low', goal_category: 'routine' },
    { name: 'Tâche secondaire', time: '14:00', duration_min: 60, priority: 'med', goal_category: 'général' },
    { name: 'Revue du jour + planification demain', time: '19:00', duration_min: 20, priority: 'med', goal_category: 'routine' }
  ];

  return {
    tasks,
    daily_intention: 'Aujourd\'hui, je me concentre sur l\'essentiel.',
    coaching_message: `Bonne journée ${dayName} ! Focus sur tes 2 tâches prioritaires.`,
    energy_peak: `${String(wakeHour + 2).padStart(2,'0')}:00`,
    recommended_breaks: [{ time: '12:30', duration_min: 45, reason: 'Déjeuner' }]
  };
}

module.exports = { chatWithCoach, generateDailyPlan, getDailyMotivation };

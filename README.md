# DISCIPLINE AI — Coach Personnel Intelligent

Application complète de coaching IA : React PWA + Node.js + Supabase + Claude API.

---

## Structure du projet

```
discipline-ai/
├── backend/          → API Node.js/Express
├── frontend/         → React PWA (Vite)
├── supabase/         → Migrations SQL
└── README.md
```

---

## Démarrage rapide (5 étapes)

### Prérequis
- Node.js 18+ (`node -v`)
- npm 9+ (`npm -v`)
- Compte [Supabase](https://supabase.com) (gratuit)
- Clé API [Anthropic](https://console.anthropic.com) (Claude)

---

### Étape 1 — Configurer Supabase

1. Aller sur [supabase.com](https://supabase.com) → **New project**
2. Nommer le projet `discipline-ai`, choisir une région proche
3. **Settings → API** → copier :
   - `Project URL` → `SUPABASE_URL`
   - `anon public` key → `SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_KEY`
4. **SQL Editor** → coller et exécuter le contenu de `supabase/migrations/001_schema.sql`
5. **Authentication → Providers** → activer **Email** (désactiver "Confirm email" pour les tests)

---

### Étape 2 — Configurer le Backend

```bash
cd backend
cp .env.example .env
```

Éditer `.env` :
```env
ANTHROPIC_API_KEY=sk-ant-api03-...
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...
JWT_SECRET=un_secret_tres_long_et_aleatoire_32chars
PORT=3001
FRONTEND_URL=http://localhost:5173
```

```bash
npm install
npm run dev
```
Backend sur http://localhost:3001  
Tester : `curl http://localhost:3001/health`

---

### Étape 3 — Configurer le Frontend

```bash
cd frontend
cp .env.example .env
```

Éditer `.env` :
```env
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

```bash
npm install
npm run dev
```

App sur http://localhost:5173

---

### Étape 4 — Créer un compte

1. Ouvrir http://localhost:5173
2. Cliquer **"Créer un compte"**
3. Email + mot de passe → s'inscrire
4. Compléter l'onboarding (6 étapes)
5. Profiter du coach IA ! 

---

### Étape 5 (Optionnel) — Déploiement production

#### Frontend → Vercel
```bash
npm install -g vercel
cd frontend
npm run build
vercel --prod
```
Ajouter les variables d'env dans le dashboard Vercel.

#### Backend → Railway
```bash
npm install -g @railway/cli
cd backend
railway login && railway init && railway up
```
Ajouter les variables d'env dans Railway.

---

## Scripts disponibles

```bash
# Backend
npm run dev        # Démarrage avec hot reload (nodemon)
npm start          # Production

# Frontend  
npm run dev        # Dev server
npm run build      # Build production
npm run preview    # Prévisualiser le build
```

---

## Modèle économique

| Plan | Limites | Prix |
|------|---------|------|
| **Gratuit** | 5 tâches/j, 15 messages coach/j | 0€ |
| **Premium** | Illimité + Analytics avancés | 9,99€/mois |

---

## Variables d'environnement

### Backend (.env)
| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Clé API Claude (Anthropic Console) |
| `SUPABASE_URL` | URL de ton projet Supabase |
| `SUPABASE_SERVICE_KEY` | Clé service Supabase (admin) |
| `JWT_SECRET` | Secret pour signer les tokens |
| `PORT` | Port du serveur (défaut: 3001) |
| `FRONTEND_URL` | URL du frontend (pour CORS) |

### Frontend (.env)
| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | URL de l'API backend |
| `VITE_SUPABASE_URL` | URL de ton projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clé publique Supabase |

---

## Dépannage fréquent

**"Cannot connect to database"**  
→ Vérifier `SUPABASE_URL` et `SUPABASE_SERVICE_KEY` dans backend/.env

**"Invalid API Key"**  
→ Vérifier `ANTHROPIC_API_KEY` — doit commencer par `sk-ant-`

**"CORS error"**  
→ Vérifier que `FRONTEND_URL` dans backend/.env correspond exactement à l'URL du frontend

**Le coach ne répond pas**  
→ Ouvrir les DevTools → Network → vérifier la requête `/api/coach/message`

---

## 📱 Installation PWA (Mobile)

**iOS Safari** : Partager → "Sur l'écran d'accueil"  
**Android Chrome** : Menu → "Ajouter à l'écran d'accueil"

---

*Built with ❤️ — DISCIPLINE AI v1.0*


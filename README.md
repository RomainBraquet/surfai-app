# SurfAI 🏄

Application de surf intelligente — prédit vos meilleures sessions.

## Lancer le projet

### 1. Backend

```bash
cd backend
npm install        # première fois seulement
node server.js     # démarre sur http://localhost:3001
```

### 2. Frontend

Ouvrir `apps/web/index.html` dans votre navigateur.

Ou avec un serveur local :
```bash
cd apps/web
npx http-server -p 8080
# Puis ouvrir http://localhost:8080
```

## Configuration

Copier `backend/.env.example` vers `backend/.env` et renseigner les clés API.

## Structure

```
surfai/
├── apps/
│   ├── web/          ← Frontend (index.html)
│   └── mobile/       ← App mobile React Native (à venir)
├── backend/          ← API Express.js
└── docs/             ← Documentation et specs
```

## Phases de développement

- [x] Phase 0 — Réorganisation projet
- [ ] Phase 1 — Connexion backend ↔ frontend
- [ ] Phase 2 — Connexion Supabase
- [ ] Phase 3 — ML / apprentissage personnalisé
- [ ] Phase 4 — Migration React + Vite
- [ ] Phase 5 — App mobile React Native

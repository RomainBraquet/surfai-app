# Réorganisation Projet SurfAI — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganiser le projet SurfAI en monorepo évolutif prêt pour web + mobile dans `ANTIGRAVITY x CLAUDE/surfai/`

**Architecture:** Monorepo avec `apps/web` (index.html → React plus tard), `apps/mobile` (placeholder), `backend` (Express.js), `docs` (vision + specs). Pas de build tool pour l'instant — juste fichiers bien organisés.

**Tech Stack:** Node.js/Express (backend), HTML/JS vanilla (frontend temporaire), Supabase, Stormglass API

**Spec:** `docs/specs/2026-03-22-reorganisation-projet-design.md`

---

### Task 1 : Créer la structure de dossiers

**Files:**
- Create: `surfai/apps/web/`
- Create: `surfai/apps/mobile/`
- Create: `surfai/backend/`
- Create: `surfai/docs/archives/`
- Create: `surfai/docs/spots/`

- [ ] **Step 1 : Créer tous les dossiers**

```bash
mkdir -p "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/apps/web"
mkdir -p "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/apps/mobile"
mkdir -p "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/backend"
mkdir -p "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/docs/archives"
mkdir -p "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/docs/spots"
```

- [ ] **Step 2 : Créer le placeholder mobile**

```bash
touch "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/apps/mobile/.gitkeep"
```

- [ ] **Step 3 : Vérifier la structure**

```bash
find "/Users/imac/ANTIGRAVITY x CLAUDE/surfai" -type d
```
Expected : tous les dossiers listés ci-dessus apparaissent.

---

### Task 2 : Copier le frontend (version la plus complète)

**Files:**
- Source: `/Users/imac/Downloads/index_html_with_data_manager.html` (94KB, 2198 lignes)
- Destination: `surfai/apps/web/index.html`

- [ ] **Step 1 : Copier le fichier**

```bash
cp "/Users/imac/Downloads/index_html_with_data_manager.html" \
   "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/apps/web/index.html"
```

- [ ] **Step 2 : Vérifier la copie**

```bash
wc -l "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/apps/web/index.html"
```
Expected : `2198` lignes.

---

### Task 3 : Déplacer le backend

**Files:**
- Source: `surfai-backend/surfai-backend/`
- Destination: `surfai/backend/`

- [ ] **Step 1 : Copier les fichiers source**

```bash
cp -r "/Users/imac/ANTIGRAVITY x CLAUDE/surfai-backend/surfai-backend/src" \
      "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/backend/"

cp "/Users/imac/ANTIGRAVITY x CLAUDE/surfai-backend/surfai-backend/server.js" \
   "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/backend/"

cp "/Users/imac/ANTIGRAVITY x CLAUDE/surfai-backend/surfai-backend/package.json" \
   "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/backend/"

cp "/Users/imac/ANTIGRAVITY x CLAUDE/surfai-backend/surfai-backend/package-lock.json" \
   "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/backend/"
```

- [ ] **Step 2 : Copier le fichier .env (clés API)**

```bash
cp "/Users/imac/ANTIGRAVITY x CLAUDE/surfai-backend/surfai-backend/.env" \
   "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/backend/.env"
```

- [ ] **Step 3 : Vérifier le backend**

```bash
ls "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/backend/"
```
Expected : `server.js`, `package.json`, `package-lock.json`, `.env`, `src/`

---

### Task 4 : Créer .env.example et .gitignore

**Files:**
- Create: `surfai/backend/.env.example`
- Create: `surfai/.gitignore`

- [ ] **Step 1 : Créer .env.example (template sans les vraies clés)**

Créer `surfai/backend/.env.example` avec :
```
PORT=3001
STORMGLASS_API_KEY=votre_cle_stormglass_ici
SUPABASE_URL=votre_url_supabase_ici
SUPABASE_ANON_KEY=votre_cle_supabase_ici
API_KEY=votre_cle_api_ici
NODE_ENV=development
```

- [ ] **Step 2 : Créer .gitignore**

Créer `surfai/.gitignore` avec :
```
# Dépendances
node_modules/
.npm

# Variables d'environnement (contient les clés API — ne jamais committer)
.env
.env.local
.env.production

# Système Mac
.DS_Store
.AppleDouble
.LSOverride
Thumbs.db

# Logs
*.log
npm-debug.log*

# Build
dist/
build/
.next/
```

- [ ] **Step 3 : Vérifier les fichiers créés**

```bash
ls "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/backend/.env.example"
ls "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/.gitignore"
```

---

### Task 5 : Installer les dépendances backend proprement

**Files:**
- Create: `surfai/backend/node_modules/`

- [ ] **Step 1 : Installer les dépendances**

```bash
cd "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/backend" && npm install
```
Expected : `added X packages` sans erreurs.

- [ ] **Step 2 : Tester que le backend démarre**

```bash
cd "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/backend" && node server.js &
sleep 3 && curl http://localhost:3001/health
```
Expected : réponse JSON avec `status: ok` ou similaire.

```bash
# Arrêter le backend après le test
kill $(lsof -ti:3001)
```

---

### Task 6 : Convertir les docs .docx en .md

**Files:**
- Source: `surfai-backend/Context/*.docx`
- Destination: `surfai/docs/*.md`

- [ ] **Step 1 : Convertir VISION.docx**

```bash
textutil -convert txt -stdout \
  "/Users/imac/ANTIGRAVITY x CLAUDE/surfai-backend/Context/VISION.docx" \
  > "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/docs/vision.md"
```

- [ ] **Step 2 : Convertir Plan d'action synthèse.docx**

```bash
textutil -convert txt -stdout \
  "/Users/imac/ANTIGRAVITY x CLAUDE/surfai-backend/Context/Plan d'action synthèse.docx" \
  > "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/docs/plan-action.md"
```

- [ ] **Step 3 : Convertir le doc concept principal**

```bash
textutil -convert txt -stdout \
  "/Users/imac/ANTIGRAVITY x CLAUDE/surfai-backend/Context/Je souhaite développer une application de surf intelligente permettant d.docx" \
  > "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/docs/concept.md"
```

- [ ] **Step 4 : Vérifier les conversions**

```bash
ls "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/docs/"
```
Expected : `vision.md`, `plan-action.md`, `concept.md`, `archives/`, `plans/`, `specs/`, `spots/`

---

### Task 7 : Archiver les anciennes versions frontend

**Files:**
- Destination: `surfai/docs/archives/`

- [ ] **Step 1 : Archiver les versions Downloads**

```bash
cp "/Users/imac/Downloads/surf-app-backend.html" \
   "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/docs/archives/"

cp "/Users/imac/Downloads/index.html" \
   "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/docs/archives/index-v1.html"

cp "/Users/imac/Downloads/surf-app-interface.html" \
   "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/docs/archives/"

cp "/Users/imac/Downloads/profile-auth.html" \
   "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/docs/archives/"
```

- [ ] **Step 2 : Vérifier les archives**

```bash
ls "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/docs/archives/"
```

---

### Task 8 : Créer le README.md

**Files:**
- Create: `surfai/README.md`

- [ ] **Step 1 : Créer le README**

Créer `surfai/README.md` avec :
```markdown
# SurfAI 🏄‍♂️

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
```

- [ ] **Step 2 : Vérifier le README**

```bash
cat "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/README.md"
```

---

### Task 9 : Vérification finale

- [ ] **Step 1 : Vérifier la structure complète**

```bash
find "/Users/imac/ANTIGRAVITY x CLAUDE/surfai" -not -path "*/node_modules/*" -not -name ".DS_Store"
```

- [ ] **Step 2 : Vérifier les fichiers clés**

```bash
echo "--- Frontend ---" && wc -l "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/apps/web/index.html"
echo "--- Backend server ---" && ls "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/backend/server.js"
echo "--- Backend src ---" && ls "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/backend/src/"
echo "--- Docs ---" && ls "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/docs/"
echo "--- README ---" && ls "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/README.md"
```

Expected : tous les fichiers présents, frontend 2198 lignes.

- [ ] **Step 3 : Test final — backend démarre**

```bash
cd "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/backend" && node server.js &
sleep 3 && curl http://localhost:3001/ && kill $(lsof -ti:3001)
```

Expected : réponse JSON du backend sans erreur.

---

## Résumé des fichiers

| Fichier | Rôle |
|---------|------|
| `apps/web/index.html` | Frontend complet (94KB) |
| `backend/server.js` | Point d'entrée Express |
| `backend/src/` | Routes, services, middleware |
| `backend/.env` | Clés API (privé) |
| `backend/.env.example` | Template clés API |
| `.gitignore` | Fichiers à ignorer |
| `README.md` | Instructions démarrage |
| `docs/vision.md` | Vision produit |
| `docs/concept.md` | Concept détaillé |
| `docs/plan-action.md` | Roadmap |
| `docs/archives/` | Anciennes versions |

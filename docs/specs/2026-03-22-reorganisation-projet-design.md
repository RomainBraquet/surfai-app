# Design — Réorganisation projet SurfAI
**Date :** 2026-03-22
**Statut :** Approuvé

---

## Contexte

SurfAI est une application de surf intelligente qui prédit les meilleures sessions pour chaque utilisateur en apprenant de ses sessions passées et de l'intelligence collective de la communauté.

Le projet existe mais est éparpillé : frontend dans les Downloads, backend mal imbriqué, docs en .docx non versionnés. L'objectif est de tout centraliser dans une structure professionnelle et évolutive.

---

## Décisions clés

| Question | Décision |
|----------|----------|
| Plateforme cible | Web app + Mobile iOS/Android |
| Ordre de construction | Web d'abord, mobile ensuite |
| Frontend actuel | Garder `index.html` → migrer en React plus tard |
| Structure | Monorepo évolutif dans `ANTIGRAVITY x CLAUDE/surfai/` |

---

## Structure cible

```
ANTIGRAVITY x CLAUDE/
├── surfai/
│   ├── apps/
│   │   ├── web/
│   │   │   └── index.html          ← frontend (94KB, version la plus complète)
│   │   └── mobile/
│   │       └── .gitkeep            ← placeholder React Native
│   │
│   ├── backend/
│   │   ├── src/
│   │   │   ├── middleware/
│   │   │   ├── routes/
│   │   │   └── services/
│   │   ├── server.js
│   │   ├── package.json
│   │   ├── .env                    ← clés API (ne jamais partager)
│   │   └── .env.example            ← template sans les vraies clés
│   │
│   ├── docs/
│   │   ├── vision.md
│   │   ├── plan-action.md
│   │   ├── concept.md
│   │   ├── archives/               ← anciennes versions frontend
│   │   └── specs/                  ← ce dossier
│   │
│   ├── .gitignore
│   └── README.md
│
└── Context/                        ← docs originaux conservés (lecture seule)
```

---

## Migrations de fichiers

| Source | Destination | Action |
|--------|-------------|--------|
| `Downloads/index_html_with_data_manager.html` | `apps/web/index.html` | Copier |
| `surfai-backend/surfai-backend/src/` | `backend/src/` | Déplacer |
| `surfai-backend/surfai-backend/server.js` | `backend/server.js` | Déplacer |
| `surfai-backend/surfai-backend/package.json` | `backend/package.json` | Déplacer |
| `surfai-backend/surfai-backend/.env` | `backend/.env` | Déplacer |
| `surfai-backend/Context/*.docx` | `docs/*.md` | Convertir |
| `Downloads/surf-app-backend.html` | `docs/archives/` | Archiver |
| `Downloads/index.html` | `docs/archives/` | Archiver |
| `node_modules/` (x2) | — | Supprimer |

---

## Fichiers créés

- `README.md` — instructions de démarrage (lancer backend + ouvrir frontend)
- `backend/.env.example` — template variables d'environnement
- `.gitignore` — ignore `node_modules`, `.env`, `.DS_Store`
- `apps/mobile/.gitkeep` — placeholder pour React Native

---

## Phases suivantes (hors scope de cette réorganisation)

1. **Phase 1** — Connecter backend ↔ frontend (débugger "Failed to fetch")
2. **Phase 2** — Connecter Supabase (persistance sessions utilisateur)
3. **Phase 3** — Implémenter le ML / apprentissage personnalisé
4. **Phase 4** — Migrer frontend vers React + Vite
5. **Phase 5** — Développer app mobile React Native

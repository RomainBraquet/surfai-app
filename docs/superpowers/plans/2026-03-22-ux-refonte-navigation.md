# UX Refonte Navigation SurfAI — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les 7 onglets actuels par une navigation 4 onglets (Accueil · Spots · Session · Profil) avec thème sombre #0a0e27/#4dff91, météo géolocalisée sur l'accueil, et config cachée dans Profil.

**Architecture:** Réécriture complète de `apps/web/index.html` (2331 lignes, HTML/CSS/JS vanilla). Toute la logique backend existante (dataManager, fetch, Supabase) est conservée ; seuls le CSS, la structure HTML des panels et les fonctions de navigation changent. Un nouvel endpoint backend `/weather/current?lat=X&lng=Y` est ajouté pour la météo géolocalisée.

**Tech Stack:** HTML/JS vanilla · CSS inline · Express.js backend (port 3001) · Supabase · Stormglass API (cache 6h) · Browser Geolocation API

**Aucun git dans ce projet — pas de commits. Vérification = ouvrir `apps/web/index.html` dans le navigateur et contrôler l'onglet Console.**

---

## Structure des fichiers

| Fichier | Action | Responsabilité |
|---------|--------|---------------|
| `apps/web/index.html` | Modifier | Tout le frontend (CSS + HTML + JS) |
| `backend/src/routes/api.js` | Modifier | Ajouter `GET /weather/current?lat&lng` |

### Variables globales clés (conservées telles quelles)
- `let backendUrl = 'http://localhost:3001'`
- `DEFAULT_SUPABASE_URL`, `DEFAULT_SUPABASE_KEY`
- `let dataManager = null` — instance `SurfAIDataManager`
- `dataManager.currentUserId` → valeur réelle : `3ba8ad73-e2c6-49fe-ac88-c26b45551f4b` (chargée via `loadSessions`)

### IDs HTML existants à conserver (utilisés dans la logique JS existante)
- `backend-url`, `backend-api-key`, `supabase-url`, `supabase-key` (dans config)
- `session-spot`, `session-rating`, `session-notes`, `session-board`, `session-date`
- `user-boards-list`, `profile-nickname`, `profile-level`, `profile-wave-min`, `profile-wave-max`

---

## Task 1 — Thème sombre + navigation 4 onglets (structure)

**Files:**
- Modify: `apps/web/index.html` — section `<style>` (lignes 1–348) + header HTML (lignes 350–375) + structure tab-content + fonction `showTab()`

### Contexte pour cette tâche
Le fichier actuel a un `<style>` light (fond blanc, bleu #4299e1). On remplace TOUT le bloc `<style>` par le thème sombre. On remplace la nav 7-onglets par 4 onglets fixés en bas. Les anciens panels (dashboard, sessions, spots, profile, predictions, meteo, config) sont temporairement conservés mais cachés — ils seront remplacés par les tâches suivantes.

- [ ] **Étape 1 : Remplacer le bloc `<style>` entier (lignes 1–348)**

Remplacer tout le contenu entre `<style>` et `</style>` par :

```css
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: #0a0e27;
  color: #f0f4ff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 14px;
  min-height: 100vh;
}

.app {
  max-width: 420px;
  margin: 0 auto;
  min-height: 100vh;
  position: relative;
}

/* ---- Navigation bas ---- */
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 420px;
  height: 60px;
  display: flex;
  background: #0d2137;
  border-top: 1px solid rgba(255,255,255,0.08);
  z-index: 100;
}

.nav-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border: none;
  background: transparent;
  color: rgba(255,255,255,0.45);
  cursor: pointer;
  padding: 6px 0;
  transition: background 0.15s, color 0.15s;
}

.nav-tab.active {
  background: #4dff91;
  color: #0a0e27;
  font-weight: 700;
}

.nav-icon { font-size: 1.3rem; line-height: 1; }
.nav-label { font-size: 0.62rem; letter-spacing: 0.3px; }

/* ---- Panels ---- */
.tab-content { padding-bottom: 68px; }

.tab-panel { display: none; padding: 16px 14px 0; }
.tab-panel.active { display: block; }

/* ---- Cards ---- */
.card {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 12px;
}

/* ---- Section labels ---- */
.section-label {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #888;
  margin-bottom: 8px;
  display: block;
}

/* ---- Hero profil ---- */
.hero {
  background: linear-gradient(135deg, #0a0e27, #0d2137);
  border-radius: 16px;
  padding: 18px 14px 14px;
  margin-bottom: 12px;
}

.hero-top {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.avatar {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: #4dff91;
  color: #0a0e27;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  font-weight: 700;
  flex-shrink: 0;
}

.hero-name { font-size: 1rem; font-weight: 700; color: #f0f4ff; }
.hero-sub  { font-size: 0.75rem; color: rgba(255,255,255,0.55); margin-top: 2px; }

/* ---- Grille météo 4 metrics ---- */
.meteo-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  text-align: center;
}

.meteo-val  { color: #4dff91; font-weight: 700; font-size: 0.95rem; }
.meteo-lbl  { font-size: 0.6rem; color: rgba(255,255,255,0.5); margin-top: 2px; }
.meteo-loc  { font-size: 0.72rem; color: rgba(255,255,255,0.4); margin-top: 10px; }

/* ---- Créneaux IA ---- */
.window-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.window-row:last-child { border-bottom: none; }

.score-badge {
  min-width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1rem;
  flex-shrink: 0;
}

.score-green  { background: rgba(77,255,145,0.15); color: #4dff91; }
.score-blue   { background: rgba(0,207,255,0.15);  color: #00cfff; }
.score-orange { background: rgba(237,137,54,0.15); color: #ed8936; }

.window-info { flex: 1; min-width: 0; }
.window-title { font-size: 0.82rem; font-weight: 600; color: #f0f4ff; }
.window-meta  { font-size: 0.73rem; color: rgba(255,255,255,0.5); margin-top: 2px; }
.window-narrative { font-size: 0.72rem; font-style: italic; color: #888; margin-top: 3px; }

/* ---- Boutons rapides ---- */
.quick-btns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 12px;
}

.btn-quick {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  color: #f0f4ff;
  padding: 12px;
  text-align: center;
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 600;
}

.btn-quick:active { background: rgba(77,255,145,0.15); }

/* ---- Spots ---- */
.spot-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  cursor: pointer;
}
.spot-row:last-child { border-bottom: none; }
.spot-row:active { opacity: 0.7; }

.spot-name { font-size: 0.85rem; font-weight: 600; color: #f0f4ff; }
.spot-city { font-size: 0.73rem; color: rgba(255,255,255,0.45); margin-top: 2px; }
.spot-score { font-size: 0.78rem; font-weight: 700; }

/* Fiche spot (push navigation) */
.spot-detail { display: none; }
.spot-detail.active { display: block; }
.spot-list-view { }
.spot-list-view.hidden { display: none; }

.back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  color: #4dff91;
  font-size: 0.82rem;
  cursor: pointer;
  padding: 0 0 12px;
  font-weight: 600;
}

.fav-btn {
  background: none;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 20px;
  color: rgba(255,255,255,0.6);
  font-size: 0.78rem;
  padding: 4px 10px;
  cursor: pointer;
}
.fav-btn.active { border-color: #4dff91; color: #4dff91; }

/* ---- Session form ---- */
.form-group { margin-bottom: 14px; }
.form-group label { display: block; font-size: 0.72rem; color: #888; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.4px; }

select, input[type="text"], input[type="date"], input[type="time"], input[type="number"], textarea {
  width: 100%;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  color: #f0f4ff;
  padding: 9px 12px;
  font-size: 0.85rem;
  outline: none;
  -webkit-appearance: none;
}

select:focus, input:focus, textarea:focus {
  border-color: rgba(77,255,145,0.5);
}

select option { background: #0d2137; color: #f0f4ff; }

/* Sélecteur étoiles 1-5 */
.star-selector { display: flex; gap: 6px; margin-top: 4px; }
.star-selector input[type="radio"] { display: none; }
.star-selector label {
  font-size: 1.6rem;
  cursor: pointer;
  color: rgba(255,255,255,0.2);
  transition: color 0.1s;
}
.star-selector input:checked ~ label,
.star-selector label:hover,
.star-selector label:hover ~ label { color: rgba(255,255,255,0.2); }
.star-selector label:has(~ input:checked),
.star-selector input:checked + label { color: #4dff91; }

/* Fix: étoiles coloriées de gauche */
.star-selector { direction: rtl; }
.star-selector label { direction: ltr; }
.star-selector label:hover,
.star-selector label:hover ~ label,
.star-selector input:checked ~ label { color: rgba(255,255,255,0.2); }
.star-selector input:checked + label,
.star-selector input:checked + label ~ label { color: #4dff91; }

/* ---- Bouton principal ---- */
.btn-primary {
  width: 100%;
  background: #4dff91;
  color: #0a0e27;
  border: none;
  border-radius: 10px;
  padding: 13px;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  margin-top: 4px;
}
.btn-primary:active { opacity: 0.85; }

/* ---- Profil ---- */
.profil-avatar {
  width: 64px; height: 64px; border-radius: 50%;
  background: #4dff91; color: #0a0e27;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.8rem; font-weight: 700; margin: 0 auto 12px;
}

.board-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.board-row:last-child { border-bottom: none; }
.board-name { font-size: 0.85rem; font-weight: 600; }
.board-meta { font-size: 0.72rem; color: rgba(255,255,255,0.45); }

.session-compact {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 7px 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  font-size: 0.8rem;
}
.session-compact:last-child { border-bottom: none; }

/* Config collapsible */
.config-toggle {
  background: none;
  border: none;
  color: rgba(255,255,255,0.35);
  font-size: 0.75rem;
  cursor: pointer;
  padding: 8px 0;
  width: 100%;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 6px;
}
.config-body { display: none; padding-top: 12px; }
.config-body.open { display: block; }

/* ---- Feedback messages ---- */
.msg-success {
  background: rgba(77,255,145,0.12);
  border: 1px solid rgba(77,255,145,0.3);
  border-radius: 8px;
  color: #4dff91;
  padding: 10px 14px;
  font-size: 0.82rem;
  margin-bottom: 10px;
  animation: fadeOut 3s forwards;
}
.msg-error {
  background: rgba(237,100,100,0.12);
  border: 1px solid rgba(237,100,100,0.3);
  border-radius: 8px;
  color: #fc8181;
  padding: 10px 14px;
  font-size: 0.82rem;
  margin-bottom: 10px;
}

@keyframes fadeOut {
  0%   { opacity: 1; }
  70%  { opacity: 1; }
  100% { opacity: 0; pointer-events: none; }
}

/* ---- Loading / empty states ---- */
.loading { color: rgba(255,255,255,0.4); font-size: 0.82rem; padding: 16px 0; text-align: center; }
.empty   { color: rgba(255,255,255,0.35); font-size: 0.8rem; text-align: center; padding: 20px 0; }

/* ---- Filtres spots ---- */
.filter-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 12px; }
.filter-row select { font-size: 0.75rem; padding: 7px 8px; }

/* ---- Date/heure côte à côte ---- */
.datetime-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
```

- [ ] **Étape 2 : Remplacer la structure HTML du `<body>` (lignes 350–771)**

Remplacer tout le contenu entre `<body>` et `<script src="...supabase...">` par :

```html
<body>
<div class="app">
  <div class="tab-content">

    <!-- ===== ACCUEIL ===== -->
    <div id="tab-accueil" class="tab-panel active">
      <div id="accueil-content">
        <div class="loading">🌊 Chargement...</div>
      </div>
    </div>

    <!-- ===== SPOTS ===== -->
    <div id="tab-spots" class="tab-panel">
      <div class="spot-list-view" id="spots-list-view">
        <div class="filter-row">
          <select id="spots-country" onchange="filterSpots()">
            <option value="">Pays</option>
          </select>
          <select id="spots-region" onchange="filterSpots()">
            <option value="">Région</option>
          </select>
          <select id="spots-city" onchange="filterSpots()">
            <option value="">Ville</option>
          </select>
        </div>

        <div class="card">
          <span class="section-label">⭐ Mes favoris</span>
          <div id="fav-spots-list"><div class="loading">Chargement...</div></div>
        </div>

        <div class="card">
          <span class="section-label">🌍 Tous les spots</span>
          <div id="all-spots-list"><div class="loading">Chargement...</div></div>
        </div>
      </div>

      <div class="spot-detail" id="spot-detail-view">
        <button class="back-btn" onclick="backToSpotsList()">← Retour</button>
        <div id="spot-detail-content"></div>
      </div>
    </div>

    <!-- ===== SESSION ===== -->
    <div id="tab-session" class="tab-panel">
      <div style="padding-top:8px">
        <div id="session-feedback"></div>

        <div class="card">
          <span class="section-label">📍 Spot</span>
          <select id="session-spot" required>
            <option value="">Sélectionnez un spot</option>
          </select>
        </div>

        <div class="card">
          <div class="datetime-row">
            <div class="form-group" style="margin:0">
              <label>Date</label>
              <input type="date" id="session-date" required>
            </div>
            <div class="form-group" style="margin:0">
              <label>Heure</label>
              <input type="time" id="session-time" required>
            </div>
          </div>
        </div>

        <div class="card">
          <span class="section-label">Note de la session</span>
          <div class="star-selector" id="star-selector">
            <input type="radio" name="rating" id="r5" value="5"><label for="r5">★</label>
            <input type="radio" name="rating" id="r4" value="4"><label for="r4">★</label>
            <input type="radio" name="rating" id="r3" value="3"><label for="r3">★</label>
            <input type="radio" name="rating" id="r2" value="2"><label for="r2">★</label>
            <input type="radio" name="rating" id="r1" value="1"><label for="r1">★</label>
          </div>
        </div>

        <div class="card">
          <div class="form-group" style="margin-bottom:10px">
            <label>Board (optionnel)</label>
            <select id="session-board">
              <option value="">Aucune board sélectionnée</option>
            </select>
          </div>
          <div class="form-group" style="margin:0">
            <label>Notes libres</label>
            <textarea id="session-notes" rows="3" placeholder="Comment était la session ?"></textarea>
          </div>
        </div>

        <button class="btn-primary" onclick="submitSession()">Enregistrer la session</button>
      </div>
    </div>

    <!-- ===== PROFIL ===== -->
    <div id="tab-profil" class="tab-panel">
      <div id="profil-content">
        <div class="loading">Chargement...</div>
      </div>
    </div>

  </div>

  <!-- Navigation bas -->
  <nav class="bottom-nav">
    <button class="nav-tab active" onclick="showTab('accueil', this)">
      <span class="nav-icon">🏠</span><span class="nav-label">Accueil</span>
    </button>
    <button class="nav-tab" onclick="showTab('spots', this)">
      <span class="nav-icon">📍</span><span class="nav-label">Spots</span>
    </button>
    <button class="nav-tab" onclick="showTab('session', this)">
      <span class="nav-icon">➕</span><span class="nav-label">Session</span>
    </button>
    <button class="nav-tab" onclick="showTab('profil', this)">
      <span class="nav-icon">👤</span><span class="nav-label">Profil</span>
    </button>
  </nav>
</div>
```

- [ ] **Étape 3 : Remplacer la fonction `showTab()` (chercher `function showTab` dans le JS)**

Remplacer la fonction existante par :

```javascript
function showTab(tabName, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tabName).classList.add('active');
  if (btn) btn.classList.add('active');
  if (tabName === 'spots')   loadSpotsTab();
  if (tabName === 'session') loadSessionTab();
  if (tabName === 'profil')  loadProfilTab();
}
```

- [ ] **Étape 4 : Mettre à jour `DOMContentLoaded`**

Remplacer les lignes de chargement à la fin de `DOMContentLoaded` (après `checkBackendConnection()`) par :

```javascript
// Charger données harmonisées (spots + boards + profil)
await loadHarmonizedData();
// Charger l'onglet accueil
await loadAccueil();
```

Supprimer les lignes :
```javascript
await generateIntelligentRecommendations();
await loadBestWindows();
```

- [ ] **Étape 5 : Supprimer les anciennes fonctions `showTab`-dépendantes**

Supprimer les appels à `loadSessions()`, `loadSpots()`, `loadProfile()`, `generateIntelligentPredictions()` dans l'ancien `showTab` (déjà remplacé).

Remplacer également `showMessage()` par :

```javascript
function showMessage(type, message, containerId) {
  const containerId2 = containerId || 'session-feedback';
  const el = document.getElementById(containerId2);
  if (!el) return;
  const cls = type === 'success' ? 'msg-success' : 'msg-error';
  el.innerHTML = `<div class="${cls}">${message}</div>`;
  if (type === 'success') setTimeout(() => { el.innerHTML = ''; }, 3500);
}
```

- [ ] **Étape 6 : Vérifier**

Ouvrir `apps/web/index.html` dans le navigateur. Vérifier :
- Fond sombre `#0a0e27` ✓
- 4 onglets en bas, onglet Accueil actif en vert `#4dff91` ✓
- Aucune erreur JS dans la console (sauf éventuellement `loadAccueil is not defined` → normal, sera défini en Task 2)

---

## Task 2 — Onglet Accueil : hero profil + météo géo + créneaux IA

**Files:**
- Modify: `apps/web/index.html` — ajouter fonction `loadAccueil()` et `loadGeoWeather()`
- Modify: `backend/src/routes/api.js` — ajouter `GET /weather/current?lat=X&lng=Y`

### Contexte
L'onglet Accueil doit afficher : avatar+pseudo, compteur sessions, météo géolocalisée (4 metrics depuis Stormglass), top 3 créneaux IA (endpoint `/predictions/best-windows?userId=X&days=3`), et 2 boutons rapides.

Le nouveau backend endpoint `/weather/current?lat=X&lng=Y` appelle directement `stormglassService.getForecast(lat, lng, 1)` pour retourner les conditions actuelles.

`dataManager.currentUserId` est chargé lors de l'initialisation (via `loadSessions()`). Valeur réelle : `3ba8ad73-e2c6-49fe-ac88-c26b45551f4b`.

- [ ] **Étape 1 : Ajouter l'endpoint `/weather/current` dans `backend/src/routes/api.js`**

Ajouter AVANT la ligne `module.exports = router;` :

```javascript
// GET /api/v1/weather/current?lat=X&lng=Y
router.get('/weather/current', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ success: false, error: 'lat et lng requis' });
    }

    const stormglassService = require('../services/stormglassService');
    const weatherData = await stormglassService.getForecast(lat, lng, 1);

    const nowSec = Date.now() / 1000;
    const current = weatherData.forecast && (
      weatherData.forecast.find(p => p.timestamp >= nowSec) || weatherData.forecast[0]
    );

    const degreesToCompass = (deg) => {
      if (deg == null) return '';
      const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
      return dirs[Math.round(deg / 22.5) % 16];
    };

    res.json({
      success: true,
      lat, lng,
      weather: current ? {
        waveHeight:    current.waveHeight,
        windSpeed:     current.windSpeed,
        windDirection: degreesToCompass(current.windDirection),
        wavePeriod:    current.wavePeriod,
        waterTemp:     current.waterTemp || null,
      } : null
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

- [ ] **Étape 2 : Redémarrer le backend**

```bash
cd /Users/imac/ANTIGRAVITY\ x\ CLAUDE/surfai/backend && node src/server.js
```

Vérifier : `GET http://localhost:3001/api/v1/weather/current?lat=43.48&lng=-1.56` retourne un JSON avec `weather.waveHeight`.

- [ ] **Étape 3 : Ajouter la fonction `loadAccueil()` dans `apps/web/index.html`**

Ajouter après la fonction `loadHarmonizedData()` (chercher `async function loadHarmonizedData`) :

```javascript
// ========================================
// ONGLET ACCUEIL
// ========================================

async function loadAccueil() {
  const container = document.getElementById('accueil-content');
  if (!container) return;

  // Récupérer profil utilisateur
  const userId = dataManager.currentUserId;
  const profile = userData.profile || {};
  const sessions = userData.sessions || [];
  const nickname = profile.nickname || profile.pseudo || 'Surfeur';
  const levelMap = { beginner: 'Débutant', intermediate: 'Intermédiaire', advanced: 'Avancé', expert: 'Expert' };
  const level = levelMap[profile.surf_level] || 'Intermédiaire';
  const initials = nickname.substring(0, 1).toUpperCase();
  const lastSession = sessions[0];
  const lastDate = lastSession
    ? new Date(lastSession.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    : null;

  // HTML Hero
  const heroHtml = `
    <div class="hero">
      <div class="hero-top">
        <div class="avatar">${initials}</div>
        <div>
          <div class="hero-name">${nickname}</div>
          <div class="hero-sub">🌊 ${level} · ${sessions.length} session${sessions.length !== 1 ? 's' : ''}${lastDate ? ' · dernière le ' + lastDate : ''}</div>
        </div>
      </div>
      <div id="meteo-bloc">
        <div class="meteo-grid">
          <div><div class="meteo-val" id="m-water">–</div><div class="meteo-lbl">🌡️ eau</div></div>
          <div><div class="meteo-val" id="m-wind">–</div><div class="meteo-lbl">💨 vent</div></div>
          <div><div class="meteo-val" id="m-wave">–</div><div class="meteo-lbl">🌊 vagues</div></div>
          <div><div class="meteo-val" id="m-tide">–</div><div class="meteo-lbl">🌙 marée</div></div>
        </div>
        <div class="meteo-loc" id="meteo-loc">📍 Localisation en cours...</div>
      </div>
    </div>`;

  // HTML Créneaux IA
  const windowsHtml = `
    <div class="card">
      <span class="section-label">🎯 Meilleurs créneaux — 3 jours</span>
      <div id="accueil-windows"><div class="loading">Analyse IA en cours...</div></div>
    </div>`;

  // Boutons rapides
  const quickHtml = `
    <div class="quick-btns">
      <button class="btn-quick" onclick="showTab('session', document.querySelectorAll('.nav-tab')[2])">➕ Session</button>
      <button class="btn-quick" onclick="showTab('spots', document.querySelectorAll('.nav-tab')[1])">📍 Spots</button>
    </div>`;

  container.innerHTML = heroHtml + windowsHtml + quickHtml;

  // Charger météo + créneaux en parallèle
  loadGeoWeather();
  if (userId && userId !== 'demo_user') {
    loadAccueilWindows(userId);
  } else {
    document.getElementById('accueil-windows').innerHTML = '<div class="empty">Connectez-vous pour voir vos créneaux personnalisés.</div>';
  }
}

async function loadGeoWeather() {
  const updateMeteo = (weather, locLabel) => {
    const w = weather;
    document.getElementById('m-water').textContent  = w.waterTemp ? Math.round(w.waterTemp) + '°' : '–';
    document.getElementById('m-wind').textContent   = w.windSpeed ? Math.round(w.windSpeed) + 'km/h' : '–';
    document.getElementById('m-wave').textContent   = w.waveHeight != null ? w.waveHeight.toFixed(1) + 'm' : '–';
    document.getElementById('m-tide').textContent   = '–';  // SHOM non disponible — masqué
    document.getElementById('meteo-loc').textContent = locLabel;
  };

  const fetchWeatherCoords = async (lat, lng) => {
    const res = await fetch(`${backendUrl}/api/v1/weather/current?lat=${lat}&lng=${lng}`);
    const data = await res.json();
    return data.success ? data.weather : null;
  };

  // Tenter géolocalisation
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const weather = await fetchWeatherCoords(latitude, longitude);
          if (weather) updateMeteo(weather, `📍 Position actuelle · maintenant`);
        } catch (e) {
          console.warn('Météo géoloc échouée:', e);
          loadGeoWeatherFallback(fetchWeatherCoords, updateMeteo);
        }
      },
      () => loadGeoWeatherFallback(fetchWeatherCoords, updateMeteo)
    );
  } else {
    loadGeoWeatherFallback(fetchWeatherCoords, updateMeteo);
  }
}

async function loadGeoWeatherFallback(fetchWeatherCoords, updateMeteo) {
  // Fallback : Biarritz (43.48, -1.56)
  try {
    const weather = await fetchWeatherCoords(43.48, -1.56);
    if (weather) updateMeteo(weather, '📍 Biarritz · maintenant');
  } catch (e) {
    console.warn('Météo fallback échouée:', e);
    document.getElementById('meteo-loc').textContent = '📍 Météo indisponible';
  }
}

async function loadAccueilWindows(userId) {
  const container = document.getElementById('accueil-windows');
  try {
    const res = await fetch(`${backendUrl}/api/v1/predictions/best-windows?userId=${userId}&days=3`);
    const data = await res.json();

    if (!data.success || !data.results?.length) {
      container.innerHTML = '<div class="empty">Pas de créneaux disponibles — enregistrez des sessions.</div>';
      return;
    }

    // Aplatir tous les créneaux de tous les spots, trier par score, prendre top 3
    const allWindows = [];
    data.results.forEach(spotResult => {
      (spotResult.windows || []).forEach(w => {
        allWindows.push({ ...w, spotName: spotResult.spot?.name || '' });
      });
    });
    allWindows.sort((a, b) => b.score - a.score);
    const top3 = allWindows.slice(0, 3);

    if (!top3.length) {
      container.innerHTML = '<div class="empty">Aucun créneau favorable sur 3 jours.</div>';
      return;
    }

    container.innerHTML = top3.map(w => {
      const scoreCls = w.score >= 8 ? 'score-green' : w.score >= 6 ? 'score-blue' : 'score-orange';
      const date = new Date(w.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
      const board = w.boardSuggestion?.board?.name ? `· 🏄 ${w.boardSuggestion.board.name}` : '';
      return `
        <div class="window-row">
          <div class="score-badge ${scoreCls}">${w.score}</div>
          <div class="window-info">
            <div class="window-title">${date} · ${w.timeWindow} · ${w.spotName}</div>
            <div class="window-meta">🌊 ${(w.conditions?.waveHeight || 0).toFixed(1)}m · 💨 ${Math.round(w.conditions?.windSpeed || 0)}km/h ${w.conditions?.windDirection || ''} ${board}</div>
            <div class="window-narrative">${w.narrative || ''}</div>
          </div>
        </div>`;
    }).join('');

  } catch (e) {
    container.innerHTML = `<div class="empty">Erreur chargement créneaux.</div>`;
    console.error('loadAccueilWindows:', e);
  }
}
```

- [ ] **Étape 4 : Vérifier**

Ouvrir dans le navigateur → onglet Accueil :
- Hero profil visible (initiales, niveau, compteur sessions)
- Bloc météo avec 4 metrics (demande de géolocalisation ou fallback Biarritz)
- Créneaux IA : 3 lignes avec scores colorés
- 2 boutons rapides en bas

---

## Task 3 — Onglet Spots : liste, favoris, fiche spot

**Files:**
- Modify: `apps/web/index.html` — ajouter `loadSpotsTab()`, `showSpotDetail()`, `backToSpotsList()`, `renderSpotWindows()`

### Contexte
L'onglet Spots a déjà son HTML (posé en Task 1) : filtres pays/région/ville, section favoris, section tous les spots, et une vue fiche spot cachée. Les dropdowns `spots-country`, `spots-region`, `spots-city` existent et ont les mêmes spots que dans l'ancienne app.

`dataManager.getSpots()` retourne les spots groupés par `{pays: {région: {ville: [spot]}}}`.
`supabaseService.getFavoriteSpots(userId)` retourne les 5 spots les plus fréquents.

- [ ] **Étape 1 : Ajouter `loadSpotsTab()` dans `apps/web/index.html`**

Ajouter après la section `// ONGLET ACCUEIL` :

```javascript
// ========================================
// ONGLET SPOTS
// ========================================

async function loadSpotsTab() {
  const userId = dataManager.currentUserId;
  // Charger scores IA en arrière-plan pour les indicateurs de score dans la liste
  prefetchSpotScores(userId);
  await loadFavoriteSpots();
  await renderAllSpots();
  // Remplir les dropdowns de filtres (réutiliser la logique existante)
  populateSpotsFilters();
}

async function populateSpotsFilters() {
  const spots = await dataManager.getSpots();
  const countries = Object.keys(spots);
  const countrySelect = document.getElementById('spots-country');
  if (countrySelect && countrySelect.options.length <= 1) {
    countries.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = c;
      countrySelect.appendChild(opt);
    });
  }
}

// Cache des scores IA par spotId (chargé une fois par visite de l'onglet)
let _spotScoresCache = {};

async function loadFavoriteSpots() {
  const container = document.getElementById('fav-spots-list');
  if (!container) return;
  try {
    const userId = dataManager.currentUserId;
    if (!userId || userId === 'demo_user') {
      container.innerHTML = '<div class="empty">Connectez Supabase pour voir vos favoris.</div>';
      return;
    }
    const res = await fetch(`${backendUrl}/api/v1/spots?favorites=true&userId=${userId}`);
    const data = await res.json();
    const spots = data.spots || [];
    if (!spots.length) {
      container.innerHTML = '<div class="empty">Surfez plus pour voir apparaître vos favoris !</div>';
      return;
    }
    container.innerHTML = spots.map(s => {
      const scoreInfo = _spotScoresCache[s.id];
      const scoreBadge = scoreInfo
        ? `<span class="spot-score" style="color:${scoreInfo.score >= 8 ? '#4dff91' : scoreInfo.score >= 6 ? '#00cfff' : '#ed8936'}">${scoreInfo.score} demain</span>`
        : '';
      return `
      <div class="spot-row" onclick="showSpotDetail('${s.id}', '${(s.name || '').replace(/'/g,"\\'")}', ${s.lat || 0}, ${s.lng || 0})">
        <div>
          <div class="spot-name">⭐ ${s.name}</div>
          <div class="spot-city">${s.city || ''}</div>
        </div>
        ${scoreBadge}<span style="color:rgba(255,255,255,0.3);font-size:1.1rem">›</span>
      </div>`;
    }).join('');
  } catch (e) {
    container.innerHTML = `<div class="empty">Erreur chargement favoris.</div>`;
  }
}

// Charger les scores IA pour les spots en arrière-plan
async function prefetchSpotScores(userId) {
  if (!userId || userId === 'demo_user') return;
  try {
    const res = await fetch(`${backendUrl}/api/v1/predictions/best-windows?userId=${userId}&days=2`);
    const data = await res.json();
    if (!data.success || !data.results) return;
    _spotScoresCache = {};
    data.results.forEach(spotResult => {
      if (spotResult.spot?.id && spotResult.windows?.length) {
        // Prendre le meilleur score de demain
        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        const tomorrowWindows = spotResult.windows.filter(w => w.date?.startsWith(tomorrowStr));
        const bestScore = tomorrowWindows.length
          ? Math.max(...tomorrowWindows.map(w => w.score))
          : spotResult.windows[0]?.score;
        if (bestScore) _spotScoresCache[spotResult.spot.id] = { score: bestScore };
      }
    });
  } catch (e) {
    // silencieux — scores sont optionnels
  }
}

async function renderAllSpots(filter = {}) {
  const container = document.getElementById('all-spots-list');
  if (!container) return;
  container.innerHTML = '<div class="loading">Chargement...</div>';
  try {
    const allSpots = await dataManager.getSpots();
    let flatSpots = [];
    Object.entries(allSpots).forEach(([country, regions]) => {
      Object.entries(regions).forEach(([region, cities]) => {
        Object.entries(cities).forEach(([city, spots]) => {
          spots.forEach(s => flatSpots.push({ ...s, country, region, city }));
        });
      });
    });
    // Appliquer filtres
    if (filter.country) flatSpots = flatSpots.filter(s => s.country === filter.country);
    if (filter.region)  flatSpots = flatSpots.filter(s => s.region  === filter.region);
    if (filter.city)    flatSpots = flatSpots.filter(s => s.city    === filter.city);

    if (!flatSpots.length) {
      container.innerHTML = '<div class="empty">Aucun spot trouvé.</div>';
      return;
    }
    container.innerHTML = flatSpots.slice(0, 40).map(s => {
      const scoreInfo = _spotScoresCache[s.id];
      const scoreBadge = scoreInfo
        ? `<span class="spot-score" style="color:${scoreInfo.score >= 8 ? '#4dff91' : scoreInfo.score >= 6 ? '#00cfff' : '#ed8936'}">${scoreInfo.score} demain</span>`
        : '';
      return `
      <div class="spot-row" onclick="showSpotDetail('${s.id}', '${(s.name || '').replace(/'/g,"\\'")}', ${s.lat || 0}, ${s.lng || 0})">
        <div>
          <div class="spot-name">${s.name}</div>
          <div class="spot-city">${s.city}, ${s.country}</div>
        </div>
        ${scoreBadge}<span style="color:rgba(255,255,255,0.3);font-size:1.1rem">›</span>
      </div>`;
    }).join('');
  } catch (e) {
    container.innerHTML = `<div class="empty">Erreur chargement spots.</div>`;
  }
}

function filterSpots() {
  const country = document.getElementById('spots-country')?.value;
  const region  = document.getElementById('spots-region')?.value;
  const city    = document.getElementById('spots-city')?.value;
  renderAllSpots({ country, region, city });
}

async function showSpotDetail(spotId, spotName, lat, lng) {
  // Cacher liste, afficher détail
  document.getElementById('spots-list-view').classList.add('hidden');
  document.getElementById('spot-detail-view').classList.add('active');

  const container = document.getElementById('spot-detail-content');
  container.innerHTML = '<div class="loading">Chargement fiche spot...</div>';

  const userId = dataManager.currentUserId;
  const scoreColor = (s) => s >= 8 ? '#4dff91' : s >= 6 ? '#00cfff' : '#ed8936';

  try {
    // Charger prévisions 5 jours pour ce spot
    let windowsHtml = '<div class="empty">Prévisions indisponibles.</div>';
    if (userId && userId !== 'demo_user') {
      const res = await fetch(`${backendUrl}/api/v1/predictions/spot/${spotId}?userId=${userId}&days=5`);
      const data = await res.json();
      if (data.success && data.windows?.length) {
        windowsHtml = data.windows.slice(0, 8).map(w => {
          const scoreCls = w.score >= 8 ? 'score-green' : w.score >= 6 ? 'score-blue' : 'score-orange';
          const date = new Date(w.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
          return `
            <div class="window-row">
              <div class="score-badge ${scoreCls}">${w.score}</div>
              <div class="window-info">
                <div class="window-title">${date} · ${w.timeWindow}</div>
                <div class="window-meta">🌊 ${(w.conditions?.waveHeight || 0).toFixed(1)}m · 💨 ${Math.round(w.conditions?.windSpeed || 0)}km/h</div>
                <div class="window-narrative">${w.narrative || ''}</div>
              </div>
            </div>`;
        }).join('');
      }
    }

    // Sessions passées sur ce spot
    let sessionsHtml = '<div class="empty">Aucune session ici.</div>';
    const spotSessions = (userData.sessions || []).filter(s => s.spot_id === spotId).slice(0, 5);
    if (spotSessions.length) {
      sessionsHtml = spotSessions.map(s => {
        const date = new Date(s.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        const stars = '★'.repeat(s.rating || 0);
        return `<div class="session-compact"><span>${date}</span><span style="color:#4dff91">${stars}</span></div>`;
      }).join('');
    }

    // Vérifier si le spot est déjà favori (présence dans fav-spots-list)
    const favContainer = document.getElementById('fav-spots-list');
    const isFav = favContainer && favContainer.innerHTML.includes(spotId);

    // Conditions idéales du spot (depuis les données Supabase si disponibles)
    // On recherche le spot dans dataManager pour récupérer ses métadonnées
    let conditionsHtml = '';
    try {
      const allSpots = await dataManager.getSpots();
      let spotData = null;
      Object.values(allSpots).forEach(regions => {
        Object.values(regions).forEach(cities => {
          Object.values(cities).forEach(spots => {
            const found = spots.find(s => s.id === spotId);
            if (found) spotData = found;
          });
        });
      });
      if (spotData && (spotData.ideal_wind_direction || spotData.ideal_swell_min || spotData.ideal_tide)) {
        const windLabel  = spotData.ideal_wind_direction ? `💨 ${spotData.ideal_wind_direction}` : '';
        const swellLabel = (spotData.ideal_swell_min || spotData.ideal_swell_max)
          ? `🌊 ${spotData.ideal_swell_min || '?'}–${spotData.ideal_swell_max || '?'}m`
          : '';
        const tideLabel  = spotData.ideal_tide ? `🌙 Marée ${spotData.ideal_tide}` : '';
        const items = [windLabel, swellLabel, tideLabel].filter(Boolean);
        if (items.length) {
          conditionsHtml = `
            <div class="card">
              <span class="section-label">✅ Conditions idéales</span>
              <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">
                ${items.map(i => `<span style="background:rgba(77,255,145,0.1);border:1px solid rgba(77,255,145,0.2);border-radius:6px;padding:4px 10px;font-size:0.78rem;color:#4dff91">${i}</span>`).join('')}
              </div>
            </div>`;
        }
      }
    } catch (e) { /* silencieux */ }

    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div>
          <h2 style="font-size:1.1rem;color:#f0f4ff">${spotName}</h2>
        </div>
        <button id="fav-toggle-btn" class="fav-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite('${spotId}', this)">
          ${isFav ? '⭐ Favori' : '☆ Favori'}
        </button>
      </div>

      ${conditionsHtml}

      <div class="card">
        <span class="section-label">🎯 Prévisions 5 jours</span>
        ${windowsHtml}
      </div>

      <div class="card">
        <span class="section-label">📋 Mes sessions ici</span>
        ${sessionsHtml}
      </div>`;

    // Placeholder pour toggleFavorite (Supabase user_spots non implémenté dans ce scope)
    // La fonction est définie juste après


  } catch (e) {
    container.innerHTML = `<div class="empty">Erreur : ${e.message}</div>`;
  }
}

function backToSpotsList() {
  document.getElementById('spots-list-view').classList.remove('hidden');
  document.getElementById('spot-detail-view').classList.remove('active');
  // Recharger les favoris au retour (un favori a peut-être été ajouté)
  loadFavoriteSpots();
}

async function toggleFavorite(spotId, btn) {
  // Toggle visuel immédiat
  const isNowFav = !btn.classList.contains('active');
  btn.classList.toggle('active');
  btn.textContent = isNowFav ? '⭐ Favori' : '☆ Favori';

  // Note : la persistance des favoris nécessite une table `user_favorite_spots` dans Supabase.
  // Si le supabaseClient est disponible, insérer/supprimer le favori.
  if (!dataManager.supabase) return;
  const userId = dataManager.currentUserId;
  if (!userId || userId === 'demo_user') return;

  try {
    if (isNowFav) {
      await dataManager.supabase
        .from('user_favorite_spots')
        .upsert({ user_id: userId, spot_id: spotId });
    } else {
      await dataManager.supabase
        .from('user_favorite_spots')
        .delete()
        .eq('user_id', userId)
        .eq('spot_id', spotId);
    }
  } catch (e) {
    // Silencieux si table n'existe pas (hors scope MVP)
    console.warn('toggleFavorite:', e.message);
  }
}
```

- [ ] **Étape 2 : Vérifier**

Cliquer sur l'onglet 📍 Spots :
- Liste spots visible (favoris en haut, tous les spots en dessous)
- Cliquer sur un spot → fiche spot avec prévisions 5 jours
- Bouton ← Retour fonctionne

---

## Task 4 — Onglet Session : formulaire simplifié 1-5 étoiles

**Files:**
- Modify: `apps/web/index.html` — `loadSessionTab()`, mettre à jour `submitSession()`

### Contexte
Le formulaire Session (HTML posé en Task 1) utilise les IDs : `session-spot`, `session-date`, `session-time`, `r1`–`r5` (radio buttons), `session-board`, `session-notes`, `session-feedback`.

`submitSession()` doit envoyer `POST /api/v1/sessions/quick` avec body : `{ userId, spotId, date, time, rating (1–5), notes, boardId }`. Le backend capture la météo automatiquement.

La note 1-5 (étoiles) est stockée directement — pas de conversion.

- [ ] **Étape 1 : Ajouter `loadSessionTab()` dans `apps/web/index.html`**

Ajouter après la section `// ONGLET SPOTS` :

```javascript
// ========================================
// ONGLET SESSION
// ========================================

async function loadSessionTab() {
  // Remplir date/heure par défaut
  const now = new Date();
  document.getElementById('session-date').value = now.toISOString().split('T')[0];
  document.getElementById('session-time').value = now.toTimeString().slice(0, 5);

  // Remplir spots (favoris en premier)
  await populateSessionSpots();

  // Remplir boards
  const boardSelect = document.getElementById('session-board');
  boardSelect.innerHTML = '<option value="">Aucune board</option>';
  (userData.boards || []).forEach(b => {
    const opt = document.createElement('option');
    opt.value = b.id; opt.textContent = `${b.name} (${b.size})`;
    boardSelect.appendChild(opt);
  });
}

async function populateSessionSpots() {
  const select = document.getElementById('session-spot');
  select.innerHTML = '<option value="">Sélectionnez un spot</option>';

  try {
    // Favoris en premier
    const userId = dataManager.currentUserId;
    let favSpots = [];
    if (userId && userId !== 'demo_user') {
      const res = await fetch(`${backendUrl}/api/v1/spots?favorites=true&userId=${userId}`);
      const data = await res.json();
      favSpots = data.spots || [];
    }

    if (favSpots.length) {
      const grpFav = document.createElement('optgroup');
      grpFav.label = '⭐ Mes favoris';
      favSpots.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id; opt.textContent = s.name;
        grpFav.appendChild(opt);
      });
      select.appendChild(grpFav);
    }

    // Tous les spots
    const allSpots = await dataManager.getSpots();
    const grpAll = document.createElement('optgroup');
    grpAll.label = '🌍 Tous les spots';
    const favIds = new Set(favSpots.map(s => s.id));
    Object.values(allSpots).forEach(regions => {
      Object.values(regions).forEach(cities => {
        Object.values(cities).forEach(spots => {
          spots.forEach(s => {
            if (!favIds.has(s.id)) {
              const opt = document.createElement('option');
              opt.value = s.id; opt.textContent = `${s.name} (${s.city || ''})`;
              grpAll.appendChild(opt);
            }
          });
        });
      });
    });
    select.appendChild(grpAll);
  } catch (e) {
    console.error('Erreur chargement spots session:', e);
  }
}
```

- [ ] **Étape 2 : Remplacer `submitSession()` (chercher la fonction existante)**

```javascript
async function submitSession() {
  const spotId  = document.getElementById('session-spot').value;
  const date    = document.getElementById('session-date').value;
  const time    = document.getElementById('session-time').value;
  const notes   = document.getElementById('session-notes').value;
  const boardId = document.getElementById('session-board').value;

  // Lire note étoiles (radio buttons r1-r5)
  const ratingEl = document.querySelector('input[name="rating"]:checked');
  const rating = ratingEl ? parseInt(ratingEl.value) : null;

  if (!spotId || !date || !time || !rating) {
    showMessage('error', 'Veuillez remplir : spot, date, heure et note.', 'session-feedback');
    return;
  }

  try {
    const sessionData = {
      userId:  dataManager.currentUserId,
      spotId,
      date,
      time,
      rating,
      notes: notes || '',
      boardId: boardId || null
    };

    const response = await fetch(`${backendUrl}/api/v1/sessions/quick`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(sessionData)
    });
    const result = await response.json();

    if (!result.success) throw new Error(result.error || 'Erreur serveur');

    const meteoMsg = result.meteo ? '— météo capturée automatiquement' : '';
    showMessage('success', `✅ Session enregistrée ${meteoMsg}`, 'session-feedback');

    // Reset form
    document.getElementById('session-spot').value = '';
    document.querySelectorAll('input[name="rating"]').forEach(r => r.checked = false);
    document.getElementById('session-notes').value = '';
    document.getElementById('session-board').value = '';

    // Invalider cache
    dataManager.cache.aiPreferences = null;
    // Recharger sessions locales
    userData.sessions = [];
    await loadSessions();

  } catch (error) {
    showMessage('error', `❌ Erreur: ${error.message}`, 'session-feedback');
  }
}
```

- [ ] **Étape 3 : Vérifier**

Onglet ➕ Session :
- Spots chargés (favoris en premier dans un groupe)
- Date/heure pré-remplis à aujourd'hui
- Étoiles cliquables (1-5), coloriées en vert `#4dff91` depuis la gauche
- Cliquer Enregistrer sans remplir → message erreur
- Enregistrer une vraie session → message "✅ Session enregistrée"

---

## Task 5 — Onglet Profil + Config cachée + historique sessions

**Files:**
- Modify: `apps/web/index.html` — ajouter `loadProfilTab()`, `saveProfile()` (mise à jour), `addBoard()` (existante)

### Contexte
L'onglet Profil (HTML panel existant dans `tab-profil`) affiche un `div#profil-content` vide (rempli dynamiquement). Le profil utilisateur vient de `userData.profile` (chargé par `loadProfile()` existant). La config (Backend URL, Supabase) était dans l'ancien onglet Config — elle passe ici dans un `<details>` collapsible.

Les fonctions `saveProfile()` et `addBoard()` existent déjà dans le fichier — les conserver, juste mettre à jour les IDs si nécessaire (ils utilisent `profile-nickname`, `profile-level`, `board-name`, etc. — les mêmes IDs que dans le nouveau HTML).

- [ ] **Étape 1 : Ajouter `loadProfilTab()` dans `apps/web/index.html`**

Ajouter après la section `// ONGLET SESSION` :

```javascript
// ========================================
// ONGLET PROFIL
// ========================================

async function loadProfilTab() {
  const container = document.getElementById('profil-content');
  if (!container) return;

  const profile = userData.profile || {};
  const boards  = userData.boards  || [];
  const sessions = userData.sessions || [];
  const nickname = profile.nickname || profile.pseudo || 'Surfeur';
  const levelMap = { beginner: 'Débutant', intermediate: 'Intermédiaire', advanced: 'Avancé', expert: 'Expert' };
  const levelLabel = levelMap[profile.surf_level] || 'Intermédiaire';
  const initials = nickname.substring(0, 1).toUpperCase();

  // Section identité
  const identiteHtml = `
    <div class="card" style="text-align:center;padding-bottom:18px">
      <div class="profil-avatar">${initials}</div>
      <div class="form-group" style="margin-bottom:10px">
        <label>Pseudo</label>
        <input type="text" id="profile-nickname" value="${nickname}" placeholder="Votre pseudo">
      </div>
      <div class="form-group" style="margin-bottom:10px">
        <label>Niveau de surf</label>
        <select id="profile-level">
          <option value="beginner"     ${profile.surf_level === 'beginner'     ? 'selected' : ''}>Débutant</option>
          <option value="intermediate" ${(!profile.surf_level || profile.surf_level === 'intermediate') ? 'selected' : ''}>Intermédiaire</option>
          <option value="advanced"     ${profile.surf_level === 'advanced'     ? 'selected' : ''}>Avancé</option>
          <option value="expert"       ${profile.surf_level === 'expert'       ? 'selected' : ''}>Expert</option>
        </select>
      </div>
      <div class="datetime-row" style="margin-bottom:10px">
        <div class="form-group" style="margin:0">
          <label>Vagues min (m)</label>
          <input type="number" id="profile-wave-min" step="0.1" min="0.3" max="5" value="${profile.min_wave_height || 0.5}" placeholder="0.5">
        </div>
        <div class="form-group" style="margin:0">
          <label>Vagues max (m)</label>
          <input type="number" id="profile-wave-max" step="0.1" min="0.5" max="8" value="${profile.max_wave_height || 2.5}" placeholder="2.5">
        </div>
      </div>
      <button class="btn-primary" onclick="saveProfile()">Sauvegarder</button>
    </div>`;

  // Section boards
  const boardsListHtml = boards.length
    ? boards.map(b => `
        <div class="board-row">
          <div>
            <div class="board-name">${b.name}</div>
            <div class="board-meta">${b.size || ''} · ${b.type || ''} · ${b.shaper || ''}</div>
          </div>
        </div>`).join('')
    : '<div class="empty">Aucune board enregistrée.</div>';

  const boardsHtml = `
    <div class="card">
      <span class="section-label">🏄 Mes boards</span>
      <div id="user-boards-list">${boardsListHtml}</div>
      <details style="margin-top:12px">
        <summary style="cursor:pointer;font-size:0.78rem;color:#4dff91;list-style:none">+ Ajouter une board</summary>
        <div style="padding-top:12px">
          <div class="form-group"><label>Nom</label><input type="text" id="board-name" placeholder="Ma longboard"></div>
          <div class="form-group"><label>Taille</label><input type="text" id="board-size" placeholder="9'2"></div>
          <div class="form-group">
            <label>Type</label>
            <select id="board-type">
              <option value="">Choisir</option>
              <option value="longboard">Longboard</option>
              <option value="midlength">Midlength</option>
              <option value="shortboard">Shortboard</option>
              <option value="fish">Fish</option>
              <option value="gun">Gun</option>
              <option value="funboard">Funboard</option>
              <option value="sup">SUP</option>
            </select>
          </div>
          <div class="form-group"><label>Shaper</label><input type="text" id="board-shaper" placeholder="Robert August"></div>
          <button class="btn-primary" onclick="addBoard()">Ajouter cette board</button>
        </div>
      </details>
    </div>`;

  // Section historique sessions
  const sessionsHtml = sessions.slice(0, 10).map(s => {
    const date = new Date(s.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const spot = s.spots?.name || s.spot_id || '?';
    const stars = '★'.repeat(s.rating || 0);
    return `<div class="session-compact"><span>${date} · ${spot}</span><span style="color:#4dff91;font-size:0.78rem">${stars}</span></div>`;
  }).join('');

  const historiqueHtml = `
    <div class="card">
      <span class="section-label">📋 Historique sessions</span>
      <div style="font-size:0.68rem;color:#555;margin-bottom:8px">(utilisé par le moteur IA pour personnaliser tes prédictions)</div>
      ${sessionsHtml || '<div class="empty">Aucune session.</div>'}
    </div>`;

  // Config avancée (collapsible, fermé par défaut)
  const configHtml = `
    <div style="margin-top:8px;padding:0 4px">
      <button class="config-toggle" onclick="toggleConfig(this)">
        <span>⚙️ Configuration avancée</span><span id="config-arrow">›</span>
      </button>
      <div class="config-body" id="config-body">
        <div class="card">
          <div class="form-group"><label>Backend URL</label><input type="text" id="backend-url" value="${backendUrl}"></div>
          <div class="form-group"><label>Clé API (optionnelle)</label><input type="password" id="backend-api-key" value="${backendApiKey || ''}"></div>
          <button class="btn-primary" onclick="testBackendConnection()" style="margin-bottom:8px">Tester Backend</button>
        </div>
        <div class="card">
          <div class="form-group"><label>Supabase URL</label><input type="text" id="supabase-url" value="${document.getElementById('supabase-url')?.value || ''}"></div>
          <div class="form-group"><label>Supabase Anon Key</label><input type="password" id="supabase-key" value="${document.getElementById('supabase-key')?.value || ''}"></div>
          <button class="btn-primary" onclick="testSupabaseConnection()">Tester Supabase</button>
        </div>
        <div id="app-status" style="font-size:0.75rem;color:#888;padding:8px 0">
          <div>Backend: ${backendUrl}</div>
          <div>Supabase: ${supabaseClient ? '🟢 connecté' : '🔴 non configuré'}</div>
        </div>
      </div>
    </div>`;

  container.innerHTML = identiteHtml + boardsHtml + historiqueHtml + configHtml;
}

function toggleConfig(btn) {
  const body = document.getElementById('config-body');
  const arrow = document.getElementById('config-arrow');
  body.classList.toggle('open');
  arrow.textContent = body.classList.contains('open') ? '˅' : '›';
}
```

- [ ] **Étape 2 : Vérifier que `saveProfile()` utilise bien les IDs `profile-nickname`, `profile-level`, `profile-wave-min`, `profile-wave-max`**

Ces IDs sont les mêmes que dans l'ancien HTML — la fonction existante devrait fonctionner sans modification. Vérifier dans le fichier que `saveProfile()` lit `document.getElementById('profile-nickname')`, etc.

- [ ] **Étape 3 : Déclencher `loadProfilTab()` au chargement initial**

Dans `DOMContentLoaded`, après `await loadAccueil();`, ajouter :

```javascript
// Pré-charger profil (pour session et accueil)
// (déjà fait via loadHarmonizedData → loadProfile)
```

Note : pas de chargement supplémentaire nécessaire car `loadHarmonizedData()` appelle déjà `loadProfile()` qui peuple `userData.profile` et `userData.boards`.

- [ ] **Étape 4 : Supprimer les anciens appels qui référencent les anciens onglets**

Dans le fichier, chercher et supprimer (ou commenter) les éventuels appels à :
- `updateDashboard()` → non utilisé dans le nouveau design
- `updateAppStatus()` → remplacé par le status inline dans la config

Ces fonctions peuvent rester dans le JS (inoffensives), il suffit de ne plus les appeler dans `DOMContentLoaded` ou `showTab`.

- [ ] **Étape 5 : Vérifier**

Onglet 👤 Profil :
- Avatar avec initiales, pseudo, niveau, fourchette vagues pré-remplie
- Liste des boards existantes
- `<details>` pour ajouter une board (fermé par défaut)
- Historique 10 dernières sessions (compact)
- Bouton "⚙️ Configuration avancée" → clique → section config s'ouvre
- Tester Backend → retourne succès (vert)

---

## Vérification finale

Ouvrir `apps/web/index.html` dans le navigateur et vérifier :

- [ ] Thème sombre cohérent sur tous les onglets (#0a0e27 fond, #4dff91 accents)
- [ ] Onglet actif = fond vert #4dff91, texte sombre
- [ ] 🏠 Accueil : météo géolocalisée + créneaux IA 3 jours
- [ ] 📍 Spots : liste + favoris + fiche spot avec prévisions 5 jours
- [ ] ➕ Session : étoiles 1-5, spots groupés favoris/tous, enregistrement fonctionne
- [ ] 👤 Profil : identité + boards + historique + config cachée collapsible
- [ ] Console JS : aucune erreur critique au chargement

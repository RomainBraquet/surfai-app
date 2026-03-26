# UX Corrections v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger 4 zones UX dans `apps/web/index.html` : hero Accueil, bugs filtres/favoris Spots, historique dans Session, édition boards dans Profil.

**Architecture:** App vanilla JS/HTML mono-fichier (2661 lignes). Pas de framework de test — la validation se fait via le navigateur sur `file:///` ou via le backend local (port 3001). Toutes les modifications sont dans un seul fichier.

**Tech Stack:** HTML/CSS/JS vanilla, Supabase JS SDK, fetch API vers backend Express localhost:3001.

---

## Fichiers modifiés

| Fichier | Rôle |
|---------|------|
| `apps/web/index.html` | Seul fichier modifié — contient tout le CSS, HTML et JS |

**Repères dans le fichier :**
- CSS : lignes 7–358
- HTML : lignes 360–480
- JS : lignes 483–2661
- `loadAccueil()` : chercher `async function loadAccueil`
- `loadSpotsTab()` : chercher `async function loadSpotsTab`
- `loadSpotsHierarchy()` : chercher `async function loadSpotsHierarchy`
- `loadFavoriteSpots()` : chercher `async function loadFavoriteSpots`
- `filterSpots()` : chercher `function filterSpots`
- `loadProfilTab()` : chercher `async function loadProfilTab`
- `saveProfile()` : chercher `function saveProfile`
- `addBoard()` : chercher `async function addBoard`
- Nav bottom : chercher `<nav class="bottom-nav">`
- Tab Session HTML : chercher `id="tab-session"`

---

## Task 1 : Accueil — icône nav + hero 2 lignes

**Fichiers :**
- Modifier : `apps/web/index.html` (nav tab + fonction `loadAccueil`)

- [ ] **Step 1 : Changer l'icône nav Accueil**

Chercher `<nav class="bottom-nav">` et remplacer dans le premier `nav-tab` :
```html
<!-- AVANT -->
<span class="nav-icon">🏠</span><span class="nav-label">Accueil</span>

<!-- APRÈS -->
<span class="nav-icon">🏄‍♂️</span><span class="nav-label">Accueil</span>
```

- [ ] **Step 2 : Modifier `loadAccueil()` — ajouter `lastSpot`**

Dans `loadAccueil()`, après la ligne `const lastDate = ...`, ajouter :
```javascript
const lastSpot = lastSession?.spots?.name || lastSession?.spot_id || '';
```

- [ ] **Step 3 : Restructurer le hero HTML sur 2 lignes**

Dans `loadAccueil()`, dans `heroHtml`, remplacer le bloc `<div class="avatar">` + `<div>` suivant par :
```javascript
<div class="avatar">🏄</div>
<div>
  <div class="hero-name">${nickname} · ${level}</div>
  <div class="hero-sub">${sessions.length} session${sessions.length !== 1 ? 's' : ''}${lastDate ? ' · dernière le ' + lastDate : ''}${lastSpot ? ' · ' + lastSpot : ''}</div>
</div>
```

- [ ] **Step 4 : Vérifier dans le navigateur**

Ouvrir `http://localhost:3001` (ou ouvrir directement `apps/web/index.html`).
Attendu :
- Onglet Accueil dans la nav = icône 🏄‍♂️
- Hero affiche `Pseudo · Niveau` sur ligne 1
- Hero affiche `N sessions · dernière le JJ MMM · Nom du spot` sur ligne 2

- [ ] **Step 5 : Commit**
```bash
cd "/Users/imac/ANTIGRAVITY x CLAUDE/surfai"
git add apps/web/index.html
git commit -m "fix(accueil): icône surf + hero 2 lignes avec spot dernière session"
```

---

## Task 2 : Spots — filtres cascade Région/Ville

**Fichiers :**
- Modifier : `apps/web/index.html` (HTML des selects + nouvelles fonctions JS)

- [ ] **Step 1 : Modifier les `onchange` des sélecteurs HTML**

Chercher `<div class="filter-row">` dans l'onglet Spots. Remplacer les attributs `onchange` :
```html
<!-- AVANT -->
<select id="spots-country" onchange="filterSpots()">
<select id="spots-region" onchange="filterSpots()">
<select id="spots-city" onchange="filterSpots()">

<!-- APRÈS -->
<select id="spots-country" onchange="onSpotsCountryChange()">
<select id="spots-region" onchange="onSpotsRegionChange()">
<select id="spots-city" onchange="filterSpots()">
```

- [ ] **Step 2 : Ajouter les 2 nouvelles fonctions après `populateSpotsFilters`**

Chercher `async function populateSpotsFilters`. Ajouter après la fermeture de cette fonction :
```javascript
async function onSpotsCountryChange() {
  const country = document.getElementById('spots-country').value;
  const regionSel = document.getElementById('spots-region');
  const citySel = document.getElementById('spots-city');
  regionSel.innerHTML = '<option value="">Région</option>';
  citySel.innerHTML = '<option value="">Ville</option>';
  if (country) {
    const spots = await dataManager.getSpots();
    Object.keys(spots[country] || {}).forEach(r => {
      regionSel.innerHTML += `<option value="${r}">${r}</option>`;
    });
  }
  filterSpots();
}

async function onSpotsRegionChange() {
  const country = document.getElementById('spots-country').value;
  const region  = document.getElementById('spots-region').value;
  const citySel = document.getElementById('spots-city');
  citySel.innerHTML = '<option value="">Ville</option>';
  if (country && region) {
    const spots = await dataManager.getSpots();
    Object.keys(spots[country]?.[region] || {}).forEach(c => {
      citySel.innerHTML += `<option value="${c}">${c}</option>`;
    });
  }
  filterSpots();
}
```

- [ ] **Step 3 : Vérifier dans le navigateur**

Aller dans l'onglet Spots.
- Sélectionner "France" → le sélecteur Région doit se peupler (ex: Nouvelle-Aquitaine)
- Sélectionner une région → le sélecteur Ville doit se peupler
- La liste des spots doit se filtrer à chaque sélection

- [ ] **Step 4 : Commit**
```bash
git add apps/web/index.html
git commit -m "fix(spots): filtres région/ville en cascade fonctionnels"
```

---

## Task 3 : Spots — corriger les favoris

**Fichiers :**
- Modifier : `apps/web/index.html` (`loadSpotsHierarchy` + `loadFavoriteSpots`)

- [ ] **Step 1 : Supprimer `displayAllSpots(spots)` de `loadSpotsHierarchy`**

Chercher `async function loadSpotsHierarchy`. À l'intérieur, trouver et supprimer la ligne :
```javascript
displayAllSpots(spots);
```
Ne supprimer que cette ligne, pas la fonction entière.

- [ ] **Step 2 : Réécrire `loadFavoriteSpots()` pour utiliser Supabase directement**

Chercher `async function loadFavoriteSpots`. Remplacer **tout le contenu** de la fonction par :
```javascript
async function loadFavoriteSpots() {
  const container = document.getElementById('fav-spots-list');
  if (!container) return;
  const userId = dataManager.currentUserId;
  if (!userId || userId === 'demo_user' || !dataManager.supabase) {
    container.innerHTML = '<div class="empty">Connectez-vous pour voir vos favoris.</div>';
    return;
  }
  try {
    const { data: favRows, error } = await dataManager.supabase
      .from('user_favorite_spots')
      .select('spot_id')
      .eq('user_id', userId);
    if (error) throw error;
    if (!favRows || !favRows.length) {
      container.innerHTML = '<div class="empty">Aucun favori. Explorez l\'annuaire !</div>';
      return;
    }
    const favIds = new Set(favRows.map(r => r.spot_id));
    const allSpots = await dataManager.getSpots();
    const spots = [];
    Object.values(allSpots).forEach(regions =>
      Object.values(regions).forEach(cities =>
        Object.values(cities).forEach(ss =>
          ss.forEach(s => { if (favIds.has(s.id)) spots.push(s); })
        )
      )
    );
    if (!spots.length) {
      container.innerHTML = '<div class="empty">Aucun favori. Explorez l\'annuaire !</div>';
      return;
    }
    container.innerHTML = spots.map(s => {
      const scoreInfo = _spotScoresCache[s.id];
      const scoreBadge = scoreInfo
        ? `<span class="spot-score" style="color:${scoreInfo.score >= 8 ? '#4dff91' : scoreInfo.score >= 6 ? '#00cfff' : '#ed8936'}">${scoreInfo.score} demain</span>`
        : '';
      return `
        <div class="spot-row" onclick="showSpotDetail('${s.id}', '${(s.name || '').replace(/'/g,"\\'")}', ${s.lat || s.coords?.lat || 0}, ${s.lng || s.coords?.lng || 0})">
          <div>
            <div class="spot-name">⭐ ${s.name}</div>
            <div class="spot-city">${s.city || ''}</div>
          </div>
          ${scoreBadge}<span style="color:rgba(255,255,255,0.3);font-size:1.1rem">›</span>
        </div>`;
    }).join('');
  } catch (e) {
    container.innerHTML = '<div class="empty">Erreur chargement favoris.</div>';
  }
}
```

- [ ] **Step 3 : Vérifier dans le navigateur**

Aller dans l'onglet Spots.
- Si Supabase est connecté et qu'il n'y a pas de vrais favoris → "Aucun favori. Explorez l'annuaire !"
- Si Supabase n'est pas connecté → "Connectez-vous pour voir vos favoris."
- La liste "Tous les spots" affiche bien les spots sans étoile ⭐
- Marquer un spot comme favori (bouton dans la fiche) → il apparaît dans Favoris au retour

- [ ] **Step 4 : Commit**
```bash
git add apps/web/index.html
git commit -m "fix(spots): favoris depuis Supabase uniquement, supprimer displayAllSpots au démarrage"
```

---

## Task 4 : Session — switcher Ajouter / Historique

**Fichiers :**
- Modifier : `apps/web/index.html` (CSS + HTML tab-session + nouvelles fonctions JS)

- [ ] **Step 1 : Ajouter le CSS du switcher**

Dans le bloc `<style>`, avant la balise fermante `</style>`, ajouter :
```css
.switcher-btn {
  flex: 1;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.5);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}
.switcher-btn.active {
  background: rgba(77,255,145,0.15);
  border-color: rgba(77,255,145,0.4);
  color: #4dff91;
}
```

- [ ] **Step 2 : Restructurer le HTML de l'onglet Session**

Chercher `<div id="tab-session" class="tab-panel">`. Remplacer **tout le contenu interne** (tout ce qui est entre la div ouvrante et fermante) par la structure suivante. Le contenu du formulaire existant (cards spot, date/heure, note, board, notes, bouton) reste identique — il est juste enveloppé dans `#session-add-view` :

```html
<div id="tab-session" class="tab-panel">
  <!-- Switcher -->
  <div style="display:flex;gap:6px;padding:12px 14px 4px">
    <button id="btn-add-session" class="switcher-btn active" onclick="showSessionView('add')">➕ Ajouter</button>
    <button id="btn-history" class="switcher-btn" onclick="showSessionView('history')">📋 Historique</button>
  </div>

  <!-- Vue Ajouter -->
  <div id="session-add-view" style="padding-top:4px">
    <div style="padding-top:8px">
      <div id="session-feedback"></div>
      <!-- [tout le contenu des cards existantes : spot, date/heure, note, board, notes, bouton] -->
    </div>
  </div>

  <!-- Vue Historique -->
  <div id="session-history-view" style="display:none;padding:0 14px"></div>
</div>
```

Important : ne pas modifier le contenu des cards du formulaire, uniquement les envelopper.

- [ ] **Step 3 : Ajouter les fonctions `showSessionView` et `renderSessionHistory`**

Chercher `function showTab`. Ajouter avant cette fonction :
```javascript
function showSessionView(view) {
  document.getElementById('session-add-view').style.display = view === 'add' ? '' : 'none';
  document.getElementById('session-history-view').style.display = view === 'history' ? '' : 'none';
  document.getElementById('btn-add-session').classList.toggle('active', view === 'add');
  document.getElementById('btn-history').classList.toggle('active', view === 'history');
  if (view === 'history') renderSessionHistory();
}

function renderSessionHistory() {
  const container = document.getElementById('session-history-view');
  if (!container) return;
  const sessions = userData.sessions || [];
  if (!sessions.length) {
    container.innerHTML = '<div class="empty" style="padding-top:24px">Aucune session enregistrée.</div>';
    return;
  }
  container.innerHTML = `
    <div class="card">
      <span class="section-label">📋 ${sessions.length} session${sessions.length > 1 ? 's' : ''}</span>
      ${sessions.map(s => {
        const date = new Date(s.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' });
        const spot = s.spots?.name || s.spot_id || '?';
        const stars = '★'.repeat(Math.min(s.rating || 0, 5));
        const wh = s.meteo?.waveHeight;
        const meteo = wh != null ? ` · 🌊 ${Number(wh).toFixed(1)}m` : '';
        return \`<div class="session-compact">
          <div>
            <div style="font-size:0.82rem;color:#f0f4ff">\${date} · \${spot}</div>
            <div style="font-size:0.72rem;color:rgba(255,255,255,0.45)">\${meteo}</div>
          </div>
          <span style="color:#4dff91;font-size:0.78rem">\${stars}</span>
        </div>\`;
      }).join('')}
    </div>`;
}
```

- [ ] **Step 4 : Vérifier dans le navigateur**

Aller dans l'onglet Session.
- Le switcher "➕ Ajouter | 📋 Historique" apparaît en haut
- "Ajouter" est actif par défaut (fond vert), formulaire visible
- Cliquer "Historique" → formulaire caché, liste des sessions apparaît
- Cliquer "Ajouter" → retour au formulaire

- [ ] **Step 5 : Commit**
```bash
git add apps/web/index.html
git commit -m "feat(session): switcher ajouter/historique dans l'onglet session"
```

---

## Task 5 : Profil — retirer l'historique

**Fichiers :**
- Modifier : `apps/web/index.html` (`loadProfilTab`)

- [ ] **Step 1 : Supprimer `historiqueHtml` de `loadProfilTab`**

Chercher `async function loadProfilTab`. Supprimer :
1. Le bloc complet de déclaration de `historiqueHtml` (de `const historiqueHtml = \`` jusqu'à sa backtick fermante)
2. Dans la ligne `container.innerHTML = identiteHtml + boardsHtml + historiqueHtml + configHtml`, remplacer par :
```javascript
container.innerHTML = identiteHtml + boardsHtml + configHtml;
```

- [ ] **Step 2 : Vérifier dans le navigateur**

Aller dans l'onglet Profil.
- Plus de section "Historique sessions" dans Profil
- L'onglet Session contient toujours l'historique (Task 4)

- [ ] **Step 3 : Commit**
```bash
git add apps/web/index.html
git commit -m "refactor(profil): retirer historique sessions (déplacé dans onglet Session)"
```

---

## Task 6 : Profil — bug `surf_level` dans `saveProfile`

**Fichiers :**
- Modifier : `apps/web/index.html` (`saveProfile`)

- [ ] **Step 1 : Corriger l'objet sauvegardé**

Chercher `function saveProfile`. Remplacer l'assignation `userData.profile = { ... }` :
```javascript
// AVANT
userData.profile = {
  nickname,
  level,
  wavePreferences: {
    min: parseFloat(waveMin) || 0.8,
    max: parseFloat(waveMax) || 2.5
  }
};

// APRÈS
userData.profile = {
  nickname,
  surf_level: level,
  min_wave_height: parseFloat(waveMin) || 0.8,
  max_wave_height: parseFloat(waveMax) || 2.5
};
```

- [ ] **Step 2 : Vérifier dans le navigateur**

1. Aller dans Profil, changer le niveau sur "Avancé", sauvegarder
2. Fermer et rouvrir l'onglet Profil
3. Attendu : le niveau "Avancé" est toujours sélectionné
4. Vérifier aussi que le hero Accueil reflète bien le nouveau niveau

- [ ] **Step 3 : Commit**
```bash
git add apps/web/index.html
git commit -m "fix(profil): saveProfile utilise surf_level/min_wave_height/max_wave_height"
```

---

## Task 7 : Profil — édition boards

**Fichiers :**
- Modifier : `apps/web/index.html` (`loadProfilTab` + nouvelles fonctions `editBoard`/`saveBoard`)

- [ ] **Step 1 : Ajouter le bouton ✏️ dans le template board row**

Dans `loadProfilTab`, chercher `const boardsListHtml`. Remplacer le `.map(b => \`...\`)` interne par :
```javascript
const boardsListHtml = boards.length
  ? boards.map(b => `
      <div class="board-row" id="board-row-${b.id}">
        <div>
          <div class="board-name">${b.name}</div>
          <div class="board-meta">${b.size || ''} · ${b.type || ''} · ${b.shaper || ''}</div>
        </div>
        <button onclick="editBoard(${b.id})" style="background:none;border:1px solid rgba(255,255,255,0.2);border-radius:6px;padding:3px 8px;color:rgba(255,255,255,0.5);font-size:0.75rem;cursor:pointer">✏️</button>
      </div>`).join('')
  : '<div class="empty">Aucune board enregistrée.</div>';
```

- [ ] **Step 2 : Ajouter les fonctions `editBoard` et `saveBoard`**

Chercher `async function addBoard`. Ajouter après la fermeture de cette fonction :
```javascript
function editBoard(boardId) {
  const board = (userData.boards || []).find(b => b.id == boardId);
  if (!board) return;
  const row = document.getElementById(`board-row-${boardId}`);
  if (!row) return;
  row.innerHTML = `
    <div style="width:100%">
      <div class="form-group" style="margin-bottom:6px">
        <input type="text" id="edit-board-name-${boardId}" value="${board.name || ''}" placeholder="Nom">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px">
        <input type="text" id="edit-board-size-${boardId}" value="${board.size || ''}" placeholder="Taille (ex: 9'2)">
        <select id="edit-board-type-${boardId}">
          <option value="">Type</option>
          ${['longboard','midlength','shortboard','fish','gun','funboard','sup'].map(t =>
            `<option value="${t}" ${board.type === t ? 'selected' : ''}>${t}</option>`
          ).join('')}
        </select>
      </div>
      <input type="text" id="edit-board-shaper-${boardId}" value="${board.shaper || ''}" placeholder="Shaper"
        style="width:100%;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:#f0f4ff;padding:9px 12px;font-size:0.85rem;outline:none;margin-bottom:8px">
      <div style="display:flex;gap:6px">
        <button class="btn-primary" style="margin:0;padding:8px;font-size:0.82rem" onclick="saveBoard(${boardId})">Sauvegarder</button>
        <button onclick="loadProfilTab()" style="flex:0.5;padding:8px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f0f4ff;cursor:pointer;font-size:0.82rem">Annuler</button>
      </div>
    </div>`;
}

async function saveBoard(boardId) {
  const name   = document.getElementById(`edit-board-name-${boardId}`)?.value;
  const size   = document.getElementById(`edit-board-size-${boardId}`)?.value;
  const type   = document.getElementById(`edit-board-type-${boardId}`)?.value;
  const shaper = document.getElementById(`edit-board-shaper-${boardId}`)?.value;
  if (!name) { showMessage('error', 'Le nom est requis'); return; }
  try {
    if (dataManager.supabase) {
      const { error } = await dataManager.supabase
        .from('boards')
        .update({ name, size, type, shaper })
        .eq('id', boardId);
      if (error) throw new Error(error.message);
    } else {
      const boards = JSON.parse(localStorage.getItem('surfai_boards') || '[]');
      const idx = boards.findIndex(b => b.id == boardId);
      if (idx !== -1) boards[idx] = { ...boards[idx], name, size, type, shaper };
      localStorage.setItem('surfai_boards', JSON.stringify(boards));
    }
    dataManager.cache.boards = null;
    await loadUserBoards();
    loadProfilTab();
  } catch (e) {
    showMessage('error', 'Erreur sauvegarde : ' + e.message);
  }
}
```

- [ ] **Step 3 : Vérifier dans le navigateur**

Aller dans Profil → Mes boards.
- Chaque board a un bouton ✏️
- Cliquer ✏️ → la ligne se transforme en formulaire pré-rempli
- Modifier le nom/taille → Sauvegarder → retour à la vue liste avec les nouvelles infos
- Annuler → retour sans modification

- [ ] **Step 4 : Commit**
```bash
git add apps/web/index.html
git commit -m "feat(profil): édition des boards in-place avec sauvegarde Supabase"
```

---

## Task 8 : Fix `backend-test-result` + div manquante

**Fichiers :**
- Modifier : `apps/web/index.html` (`loadProfilTab` → variable `configHtml`)

- [ ] **Step 1 : Ajouter la div résultat**

Dans `loadProfilTab`, chercher la variable `configHtml` (contient le texte `"Tester Backend"`). Après le bouton :
```html
<button class="btn-primary" onclick="testBackendConnection()" style="margin-bottom:8px">Tester Backend</button>
```
Ajouter immédiatement après :
```html
<div id="backend-test-result"></div>
```

- [ ] **Step 2 : Vérifier dans le navigateur**

Profil → Configuration avancée → Tester Backend.
- Attendu : un message de résultat apparaît (succès ou erreur), plus de crash silencieux

- [ ] **Step 3 : Commit**
```bash
git add apps/web/index.html
git commit -m "fix(profil): ajouter div backend-test-result manquante dans configHtml"
```

---

## Task 9 : Supprimer le code mort (~500 lignes)

**Fichiers :**
- Modifier : `apps/web/index.html`

- [ ] **Step 1 : Vérifier que les fonctions ne sont plus appelées**

Depuis `apps/web/` :
```bash
grep -n "displayAllSpots\|displayFilteredSpots\|updateRegions\|updateCities\|updateSpots\|updateForecastRegions\|updateForecastCities\|updateForecastSpots\|updateSpotsNavigation\|getIntelligentForecast\|displayPersonalizedForecast\|generateIntelligentRecommendations\|loadBestWindows\|generateIntelligentPredictions\|generateMultiDayPredictions\|createPredictionCard\|analyzePatterns\|loadSpots\b\|updateDashboard" index.html
```

Pour chaque fonction trouvée, vérifier qu'elle n'apparaît que dans sa propre déclaration (`function X`) et pas en tant qu'appel (`X(` ou `onclick="X"`). Si une fonction est encore appelée quelque part → ne pas la supprimer.

- [ ] **Step 2 : Supprimer les fonctions confirmées mortes**

Supprimer chaque bloc `function X() { ... }` confirmé comme non-appelé. Les fonctions à cibler (si non-appelées) :
- `displayAllSpots` + `displayFilteredSpots`
- `updateRegions` + `updateCities` + `updateSpots`
- `updateForecastRegions` + `updateForecastCities` + `updateForecastSpots`
- `updateSpotsNavigation`
- `getIntelligentForecast` + `displayPersonalizedForecast`
- `generateIntelligentRecommendations`
- `loadBestWindows`
- `generateIntelligentPredictions` + `generateMultiDayPredictions` + `createPredictionCard`
- `analyzePatterns`
- `loadSpots` (différent de `loadSpotsTab`)
- `updateDashboard`

- [ ] **Step 3 : Vérifier que l'app fonctionne encore**

Recharger l'app dans le navigateur. Naviguer dans tous les onglets. Aucune erreur dans la console.

- [ ] **Step 4 : Commit**
```bash
git add apps/web/index.html
git commit -m "refactor: supprimer ~500 lignes de code mort (fonctions orphelines ancienne UI)"
```

---

## Récapitulatif des commits

| # | Commit | Tâche |
|---|--------|-------|
| 1 | `fix(accueil): icône surf + hero 2 lignes` | Task 1 |
| 2 | `fix(spots): filtres région/ville en cascade` | Task 2 |
| 3 | `fix(spots): favoris depuis Supabase uniquement` | Task 3 |
| 4 | `feat(session): switcher ajouter/historique` | Task 4 |
| 5 | `refactor(profil): retirer historique sessions` | Task 5 |
| 6 | `fix(profil): saveProfile surf_level` | Task 6 |
| 7 | `feat(profil): édition boards in-place` | Task 7 |
| 8 | `fix(profil): div backend-test-result` | Task 8 |
| 9 | `refactor: supprimer code mort` | Task 9 |

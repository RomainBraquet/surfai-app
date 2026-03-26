# UX Corrections v2 — Implementation Spec

> **For agentic workers:** Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Corriger 4 zones UX dans `apps/web/index.html` : hero Accueil, bugs Spots, historique dans Session, édition boards dans Profil.

**Architecture:** Single-file vanilla JS/HTML frontend. Toutes les modifications sont dans `apps/web/index.html` (2661 lignes). Aucun fichier backend à modifier.

**Tech Stack:** HTML/CSS/JS vanilla, Supabase JS SDK, fetch API vers backend Express (port 3001).

---

## Zone 1 — Accueil : Hero sur 2 lignes + icône surf

### Fichier : `apps/web/index.html`

**1a. Nav tab Accueil** (ligne ~467) — remplacer l'icône :
```html
<!-- AVANT -->
<button class="nav-tab active" onclick="showTab('accueil', this)">
  <span class="nav-icon">🏠</span><span class="nav-label">Accueil</span>
</button>

<!-- APRÈS -->
<button class="nav-tab active" onclick="showTab('accueil', this)">
  <span class="nav-icon">🏄‍♂️</span><span class="nav-label">Accueil</span>
</button>
```

**1b. `loadAccueil()` ~ ligne 1022** — modifier le bloc `heroHtml` :

Ajouter `lastSpot` avant la construction du HTML :
```javascript
const lastSpot = lastSession?.spots?.name || lastSession?.spot_id || '';
```

Remplacer le contenu du hero-top :
```javascript
// AVANT
<div class="avatar">${initials}</div>
<div>
  <div class="hero-name">${nickname}</div>
  <div class="hero-sub">🌊 ${level} · ${sessions.length} session${sessions.length !== 1 ? 's' : ''}${lastDate ? ' · dernière le ' + lastDate : ''}</div>
</div>

// APRÈS
<div class="avatar">🏄</div>
<div>
  <div class="hero-name">${nickname} · ${level}</div>
  <div class="hero-sub">${sessions.length} session${sessions.length !== 1 ? 's' : ''}${lastDate ? ' · dernière le ' + lastDate : ''}${lastSpot ? ' · ' + lastSpot : ''}</div>
</div>
```

---

## Zone 2 — Spots : Bugs filtres + favoris

### Bug 1 — Filtres Région/Ville ne cascadent pas

**Root cause :** Les `<select>` ont `onchange="filterSpots()"` mais `filterSpots()` filtre la liste sans peupler les options. Rien ne remplit les options de Région quand le Pays change.

**Fix 2a — HTML des sélecteurs** (lignes ~375-384) :
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

**Fix 2b — Ajouter les 2 nouvelles fonctions** (après `populateSpotsFilters`) :
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

### Bug 2 — Tous les spots apparaissent comme favoris

**Root cause :** `loadSpotsHierarchy()` (ligne ~1691) appelle `displayAllSpots(spots)` au démarrage, ce qui écrit tous les spots en style card dans `#all-spots-list`. Ensuite, quand l'utilisateur ouvre l'onglet Spots, `renderAllSpots()` ré-écrit correctement — mais la section "Mes favoris" (`loadFavoriteSpots()`) affiche aussi tous les spots si l'API `/api/v1/spots?favorites=true` ne filtre pas bien.

**Fix 2c — Supprimer l'appel `displayAllSpots`** dans `loadSpotsHierarchy()` :
```javascript
// Dans loadSpotsHierarchy(), supprimer cette ligne :
displayAllSpots(spots);
// La fonction displayAllSpots() peut aussi être supprimée (code mort)
```

**Fix 2d — Guard dans `loadFavoriteSpots()`** : si l'API retourne des spots non filtrés, limiter aux vrais favoris via Supabase :
```javascript
// Dans loadFavoriteSpots(), remplacer le fetch par :
if (!userId || userId === 'demo_user') {
  container.innerHTML = '<div class="empty">Connectez-vous pour voir vos favoris.</div>';
  return;
}
// Récupérer les favoris directement depuis Supabase
const { data: favRows } = await dataManager.supabase
  .from('user_favorite_spots')
  .select('spot_id')
  .eq('user_id', userId);
if (!favRows || !favRows.length) {
  container.innerHTML = '<div class="empty">Aucun favori. Explorez l\'annuaire !</div>';
  return;
}
const favIds = favRows.map(r => r.spot_id);
// Récupérer les infos spots depuis la hiérarchie
const allSpots = await dataManager.getSpots();
const spots = [];
Object.values(allSpots).forEach(regions => Object.values(regions).forEach(cities =>
  Object.values(cities).forEach(ss => ss.forEach(s => { if (favIds.includes(s.id)) spots.push(s); }))
));
// ... render comme avant
```

Si Supabase n'est pas connecté (userId = demo_user), afficher le message vide. Pas de fallback qui affiche tout.

---

## Zone 3 — Session : Switcher Ajouter / Historique

### Comportement cible
- Onglet Session = **switcher en haut** + formulaire existant (inchangé) + historique
- Vue "Ajouter" active par défaut
- Vue "Historique" = liste chronologique de `userData.sessions`
- L'historique est **retiré** de l'onglet Profil

### Fix 3a — CSS à ajouter (dans le bloc `<style>`, fin) :
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

### Fix 3b — HTML de l'onglet Session (lignes ~403-454)

Remplacer le contenu de `#tab-session` :
```html
<div id="tab-session" class="tab-panel">
  <!-- Switcher -->
  <div style="display:flex;gap:6px;padding:12px 14px 4px">
    <button id="btn-add-session" class="switcher-btn active" onclick="showSessionView('add')">➕ Ajouter</button>
    <button id="btn-history" class="switcher-btn" onclick="showSessionView('history')">📋 Historique</button>
  </div>

  <!-- Vue Ajouter (contenu existant inchangé, juste enveloppé) -->
  <div id="session-add-view" style="padding-top:4px">
    <!-- ... tout le contenu actuel du formulaire session ... -->
  </div>

  <!-- Vue Historique -->
  <div id="session-history-view" style="display:none;padding:0 14px"></div>
</div>
```

Le contenu du formulaire (spot, date/heure, note étoiles, board, notes, bouton) reste **identique**, simplement enveloppé dans `#session-add-view`.

### Fix 3c — Fonctions JS à ajouter :
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
  // Structure sessions attendue : { date, spots?.name, spot_id, rating, meteo?.waveHeight }
  // Ces champs sont garantis par /api/v1/sessions/list (voir backend/src/routes/api.js)
  container.innerHTML = `
    <div class="card">
      <span class="section-label">📋 ${sessions.length} session${sessions.length > 1 ? 's' : ''}</span>
      ${sessions.map(s => {
        const date = new Date(s.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' });
        const spot = s.spots?.name || s.spot_id || '?';
        const stars = '★'.repeat(Math.min(s.rating || 0, 5));
        const meteo = (s.meteo && s.meteo.waveHeight != null) ? ` · 🌊 ${Number(s.meteo.waveHeight).toFixed(1)}m` : '';
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

### Fix 3d — Retirer l'historique du Profil

Dans `loadProfilTab()` (ligne ~1680), supprimer :
- La variable `historiqueHtml` et son contenu
- La référence à `historiqueHtml` dans `container.innerHTML = identiteHtml + boardsHtml + historiqueHtml + configHtml`
  → remplacer par `container.innerHTML = identiteHtml + boardsHtml + configHtml`

---

## Zone 4 — Profil : Édition boards + bug surf_level

### Fix 4a — Bug `saveProfile()` (ligne ~2577)

`level` est bien déclaré dans la fonction via `const level = document.getElementById('profile-level').value`. Il faut juste corriger les clés de l'objet sauvegardé pour qu'elles correspondent à ce que `loadProfilTab()` lit (`surf_level`, `min_wave_height`, `max_wave_height`) :

```javascript
// AVANT
userData.profile = {
  nickname,
  level,
  wavePreferences: { min: parseFloat(waveMin) || 0.8, max: parseFloat(waveMax) || 2.5 }
};

// APRÈS
userData.profile = {
  nickname,
  surf_level: level,
  min_wave_height: parseFloat(waveMin) || 0.8,
  max_wave_height: parseFloat(waveMax) || 2.5
};
```

Note : `loadProfilTab()` lit déjà `profile.surf_level`, `profile.min_wave_height`, `profile.max_wave_height` — ce fix aligne la sauvegarde sur la lecture. Aucun autre endroit ne lit `userData.profile.wavePreferences`.

### Fix 4b — Édition boards dans `loadProfilTab()`

**Template board row** : remplacer le `boardsListHtml` existant (ligne ~1601) par :
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

**Fonctions JS à ajouter** (après `addBoard`) :
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
      <input type="text" id="edit-board-shaper-${boardId}" value="${board.shaper || ''}" placeholder="Shaper" style="width:100%;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:#f0f4ff;padding:9px 12px;font-size:0.85rem;outline:none;margin-bottom:8px">
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
      // Fallback localStorage
      const boards = JSON.parse(localStorage.getItem('surfai_boards') || '[]');
      const idx = boards.findIndex(b => b.id == boardId);
      if (idx !== -1) { boards[idx] = { ...boards[idx], name, size, type, shaper }; }
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

### Fix 4c — `backend-test-result` manquant dans configHtml

Dans `loadProfilTab()`, chercher la variable `configHtml` (contient `"Tester Backend"`). Ajouter après le bouton "Tester Backend" :
```html
<button class="btn-primary" onclick="testBackendConnection()" style="margin-bottom:8px">Tester Backend</button>
<div id="backend-test-result"></div>  <!-- AJOUTER cette ligne -->
```

---

## Note générale

Les numéros de ligne (~467, ~1022, etc.) sont **approximatifs**. L'implémenteur doit rechercher par nom de fonction/id HTML plutôt que par numéro de ligne exact.

Les sélecteurs `session-country`, `forecast-country`, `forecast-region`, etc. référencés dans `loadSpotsHierarchy()` sont du **code mort** — ces éléments n'existent plus dans l'UI 4 onglets. Ils seront supprimés dans Fix 5.

---

## Fix 5 — Suppression du code mort

**Vérification préalable** : avant de supprimer, grepper chaque fonction pour confirmer qu'elle n'est appelée nulle part dans le fichier :
```bash
grep -n "displayAllSpots\|displayFilteredSpots\|updateRegions\|updateCities\|updateSpots\|updateForecastRegions\|updateForecastCities\|updateForecastSpots\|updateSpotsNavigation\|getIntelligentForecast\|displayPersonalizedForecast\|generateIntelligentRecommendations\|loadBestWindows\|generateIntelligentPredictions\|generateMultiDayPredictions\|createPredictionCard\|analyzePatterns\|loadSpots\|updateDashboard" apps/web/index.html
```

Supprimer uniquement les fonctions confirmées non-appelées. Ne pas supprimer si une fonction est référencée dans un `onclick` HTML ou un appel JS.

---

## Critères de validation

| Zone | Test de validation |
|------|--------------------|
| Accueil | Hero affiche `Pseudo · Niveau` ligne 1, `N sessions · date · spot` ligne 2, icône 🏄‍♂️ dans nav |
| Spots | Sélectionner France → Région se peuple. Mes Favoris = uniquement les spots marqués favoris (pas tous) |
| Session | Switcher visible. Clic "Historique" affiche les sessions. Clic "Ajouter" revient au formulaire |
| Profil | Sauvegarder profil → le niveau reste bien sélectionné à la réouverture. Clic ✏️ board → formulaire éditable |

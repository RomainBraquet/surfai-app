# Moteur de Prédiction IA — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire le pipeline de prédiction surf personnalisé (Collecteur → Scoreur → Recommandeur) avec données marée SHOM, et connecter le tout à l'UI frontend.

**Architecture:** Pipeline 3 couches Node.js dans des fichiers séparés. Le Scoreur combine heuristiques expertes + calibration progressive sur les sessions passées. L'UI affiche les meilleurs créneaux sur 5 jours avec board suggérée et narrative personnalisée.

**Tech Stack:** Node.js (Express), Supabase JS client, Stormglass API (cache 6h existant), SHOM API (marées, gratuit), frontend HTML/JS vanilla existant

**Spec de référence:** `docs/superpowers/specs/2026-03-22-moteur-prediction-ia-design.md`

---

## Structure des fichiers

```
backend/
  src/
    services/
      shomService.js          ← NOUVEAU : marées SHOM avec cache Supabase
      collector.js            ← NOUVEAU : agrège météo + marée + sessions + profil
      scorer.js               ← NOUVEAU : score composite 0-10 par créneau
      recommender.js          ← NOUVEAU : sélection meilleurs créneaux + narrative
      supabaseService.js      ← MODIFIÉ : +getFavoriteSpots, +tide_cache CRUD
      stormglassService.js    ← MODIFIÉ : vérifier support 5 jours (déjà paramétrable)
    routes/
      api.js                  ← MODIFIÉ : +2 routes predictions
  tests/
    scorer.test.js            ← NOUVEAU : tests unitaires scorer
apps/
  web/
    index.html                ← MODIFIÉ : UI "Meilleurs créneaux 5 jours"
```

---

## Task 1 : Migrations Supabase

**Files:**
- Exécuter SQL dans Supabase Dashboard → SQL Editor

- [ ] **Step 1 : Ajouter `shom_port_code` à `spots`**

Dans Supabase Dashboard → SQL Editor, exécuter :
```sql
ALTER TABLE spots ADD COLUMN IF NOT EXISTS shom_port_code VARCHAR(10);

-- Renseigner les codes SHOM pour les spots principaux
UPDATE spots SET shom_port_code = 'BIA' WHERE city = 'Biarritz';
UPDATE spots SET shom_port_code = 'CPB' WHERE city = 'Capbreton' OR name ILIKE '%capbreton%';
UPDATE spots SET shom_port_code = 'BIA' WHERE city = 'Anglet';
UPDATE spots SET shom_port_code = 'BIA' WHERE city = 'Les Cavaliers';
UPDATE spots SET shom_port_code = 'RDB' WHERE city = 'Lacanau' OR name ILIKE '%lacanau%';
UPDATE spots SET shom_port_code = 'CPB' WHERE city = 'Hossegor' OR name ILIKE '%hossegor%';
UPDATE spots SET shom_port_code = 'CPB' WHERE city = 'Seignosse' OR name ILIKE '%seignosse%';
```

- [ ] **Step 2 : Créer la table `tide_cache`**

```sql
CREATE TABLE IF NOT EXISTS tide_cache (
  spot_id UUID REFERENCES spots(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  -- data : array de 24 objets { hour: 0-23, height_cm: int, phase: 'rising'|'falling'|'low'|'high' }
  data JSONB NOT NULL,
  cached_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (spot_id, date)
);
```

- [ ] **Step 3 : Vérifier les migrations**

```sql
SELECT name, city, shom_port_code FROM spots ORDER BY city;
SELECT COUNT(*) FROM tide_cache;
```

Expected : colonne shom_port_code présente avec valeurs pour spots principaux, tide_cache vide.

- [ ] **Step 4 : Commit**

```bash
cd "/Users/imac/ANTIGRAVITY x CLAUDE/surfai"
git add -A
git commit -m "feat: add shom_port_code to spots and tide_cache table"
```

---

## Task 2 : Service SHOM (marées)

**Files:**
- Create: `backend/src/services/shomService.js`
- Modify: `backend/src/services/supabaseService.js` (ajouter getTideCache / setTideCache)

- [ ] **Step 1 : Ajouter les fonctions tide_cache dans supabaseService.js**

À la fin de `backend/src/services/supabaseService.js`, avant `module.exports`, ajouter :

```javascript
async function getTideCache(spotId, date) {
  const { data, error } = await supabase
    .from('tide_cache')
    .select('data, cached_at')
    .eq('spot_id', spotId)
    .eq('date', date)
    .single();
  if (error) return null;
  // Invalider si > 12h
  const age = Date.now() - new Date(data.cached_at).getTime();
  if (age > 12 * 60 * 60 * 1000) return null;
  return data.data;
}

async function setTideCache(spotId, date, tideData) {
  const { error } = await supabase
    .from('tide_cache')
    .upsert({ spot_id: spotId, date, data: tideData, cached_at: new Date().toISOString() });
  if (error) console.warn('⚠️ Erreur cache marée:', error.message);
}

async function getFavoriteSpots(userId) {
  // Top 5 spots les plus surfés par cet utilisateur
  const { data, error } = await supabase
    .from('sessions')
    .select('spot_id, spots(id, name, city, lat, lng, ideal_wind, ideal_swell, ideal_tide, shom_port_code)')
    .eq('user_id', userId)
    .not('spot_id', 'is', null);
  if (error) throw new Error(`Erreur favorite spots: ${error.message}`);
  // Compter par spot_id
  const counts = {};
  data.forEach(s => {
    if (!s.spot_id) return;
    counts[s.spot_id] = counts[s.spot_id] || { count: 0, spot: s.spots };
    counts[s.spot_id].count++;
  });
  return Object.values(counts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(e => e.spot)
    .filter(Boolean);
}
```

Mettre à jour `module.exports` pour inclure `getTideCache`, `setTideCache`, `getFavoriteSpots`.

- [ ] **Step 2 : Créer `shomService.js`**

Créer `backend/src/services/shomService.js` :

```javascript
// 🌊 Service SHOM — Données de marée (Service Hydrographique français)
// API gratuite : https://maree.shom.fr

const axios = require('axios');
const db = require('./supabaseService');

const SHOM_BASE = 'https://maree.shom.fr/api/v1';

// Calcul de la phase de marée depuis un tableau de hauteurs horaires
function computePhases(hourlyData) {
  return hourlyData.map((point, i) => {
    const prev = hourlyData[i - 1];
    const next = hourlyData[i + 1];
    let phase = 'unknown';
    if (prev && next) {
      if (point.height_cm > prev.height_cm && point.height_cm > next.height_cm) phase = 'high';
      else if (point.height_cm < prev.height_cm && point.height_cm < next.height_cm) phase = 'low';
      else if (point.height_cm > prev.height_cm) phase = 'rising';
      else phase = 'falling';
    }
    return { ...point, phase };
  });
}

async function getTideData(spotId, shomPortCode, dateStr) {
  // dateStr format: 'YYYY-MM-DD'
  if (!shomPortCode) return null;

  // Vérifier le cache Supabase
  const cached = await db.getTideCache(spotId, dateStr);
  if (cached) {
    console.log(`💾 Cache marée utilisé: ${shomPortCode} ${dateStr}`);
    return cached;
  }

  try {
    console.log(`🌊 Appel SHOM: ${shomPortCode} ${dateStr}`);
    const response = await axios.get(`${SHOM_BASE}/tides`, {
      params: { harbour: shomPortCode, duration: 24, nbDays: 1 },
      timeout: 10000,
    });

    const raw = response.data;
    // Construire tableau horaire depuis les données SHOM
    // SHOM retourne des points à haute fréquence — on ré-échantillonne à 24 points
    const hourlyData = [];
    for (let h = 0; h < 24; h++) {
      // Trouver le point SHOM le plus proche de cette heure
      const targetMs = new Date(`${dateStr}T${String(h).padStart(2,'0')}:00:00`).getTime();
      const closest = raw.reduce((best, p) => {
        const diff = Math.abs(new Date(p.time || p.datetime).getTime() - targetMs);
        const bestDiff = Math.abs(new Date(best.time || best.datetime).getTime() - targetMs);
        return diff < bestDiff ? p : best;
      });
      hourlyData.push({
        hour: h,
        height_cm: Math.round(closest.height || closest.hauteur || 0),
      });
    }

    const tideData = computePhases(hourlyData);
    await db.setTideCache(spotId, dateStr, tideData);
    return tideData;

  } catch (error) {
    console.warn(`⚠️ SHOM indisponible pour ${shomPortCode}: ${error.message}`);
    return null;
  }
}

// Récupère les marées pour N jours à partir d'aujourd'hui
async function getTideDataForDays(spotId, shomPortCode, days = 5) {
  const results = {};
  const today = new Date();
  for (let d = 0; d < days; d++) {
    const date = new Date(today);
    date.setDate(today.getDate() + d);
    const dateStr = date.toISOString().split('T')[0];
    results[dateStr] = await getTideData(spotId, shomPortCode, dateStr);
  }
  return results; // { 'YYYY-MM-DD': [hourlyPoints] | null }
}

// Obtenir la phase de marée pour une heure donnée
function getTideAtHour(tideDataForDate, hour) {
  if (!tideDataForDate) return { height_cm: null, phase: 'unknown' };
  return tideDataForDate.find(p => p.hour === hour) || { height_cm: null, phase: 'unknown' };
}

module.exports = { getTideDataForDays, getTideAtHour };
```

- [ ] **Step 3 : Tester le service SHOM manuellement**

```bash
cd "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/backend"
node -e "
require('dotenv').config();
const shom = require('./src/services/shomService');
shom.getTideDataForDays('8f61b180-074b-445a-b5d4-f02a04d5fa29', 'BIA', 1)
  .then(r => { const key = Object.keys(r)[0]; console.log('✅ SHOM:', key, r[key]?.slice(0,3)); })
  .catch(e => console.warn('⚠️ SHOM non disponible (fallback null ok):', e.message));
"
```

Expected : soit des données de marée, soit un warning "SHOM indisponible" — les deux sont acceptables, le fallback `null` est géré.

- [ ] **Step 4 : Commit**

```bash
git add backend/src/services/shomService.js backend/src/services/supabaseService.js
git commit -m "feat: add SHOM tide service and tide_cache helpers"
```

---

## Task 3 : Scorer — Score composite 0-10

**Files:**
- Create: `backend/src/services/scorer.js`
- Create: `backend/tests/scorer.test.js`

- [ ] **Step 1 : Créer les tests unitaires**

Créer `backend/tests/scorer.test.js` :

```javascript
// Tests unitaires du scorer — node tests/scorer.test.js
require('dotenv').config();
const assert = require('assert');
const { scoreSlot } = require('../src/services/scorer');

// Contexte de test minimal
const baseContext = {
  profile: { surf_level: 'intermediate', min_wave_height: 0.8, max_wave_height: 2.0 },
  spot: {
    ideal_wind: ['E', 'NE'],
    ideal_swell: ['W', 'NW'],
    ideal_tide: ['low', 'mid'],
  },
  pastSessions: [], // pas de sessions pour commencer
  boards: [{ id: 'b1', name: 'Fish 5\'9', board_type: 'fish' }],
};

// Test 1 : conditions parfaites → score élevé
const perfectSlot = {
  waveHeight: 1.5, wavePeriod: 12, windSpeed: 8, windDirection: 90, // E = offshore
  swellHeight: 1.4, swellDirection: 270, // W = ideal
  tidePhase: 'low',
};
const result1 = scoreSlot(perfectSlot, baseContext);
assert(result1.score >= 7, `Score conditions parfaites devrait être >= 7, got ${result1.score}`);
assert(result1.score <= 10, `Score ne doit pas dépasser 10, got ${result1.score}`);
console.log('✅ Test 1 (conditions parfaites):', result1.score);

// Test 2 : vent fort onshore → score bas
const badWindSlot = { ...perfectSlot, windSpeed: 50, windDirection: 270 }; // W = onshore pour côte Atlantique
const result2 = scoreSlot(badWindSlot, baseContext);
assert(result2.score < result1.score, `Vent fort onshore devrait donner score < conditions parfaites`);
console.log('✅ Test 2 (vent fort onshore):', result2.score);

// Test 3 : vagues hors fourchette → score réduit
const tooBigSlot = { ...perfectSlot, waveHeight: 4.0 };
const result3 = scoreSlot(tooBigSlot, baseContext);
assert(result3.score < result1.score, `Vagues trop grosses devrait donner score < conditions parfaites`);
console.log('✅ Test 3 (vagues hors fourchette):', result3.score);

// Test 4 : avec sessions passées → board suggestion
const contextWithSessions = {
  ...baseContext,
  pastSessions: [
    { rating: 5, meteo: { waveHeight: 1.4, windSpeed: 9, wavePeriod: 11 }, board_id: 'b1' },
    { rating: 5, meteo: { waveHeight: 1.6, windSpeed: 7, wavePeriod: 13 }, board_id: 'b1' },
    { rating: 4, meteo: { waveHeight: 1.5, windSpeed: 10, wavePeriod: 12 }, board_id: 'b1' },
  ],
};
const result4 = scoreSlot(perfectSlot, contextWithSessions);
assert(result4.boardSuggestion !== null, 'Devrait avoir une suggestion de board');
console.log('✅ Test 4 (board suggestion):', result4.boardSuggestion?.board?.name);

// Test 5 : score entre 0 et 10 dans tous les cas
const extremeSlot = { waveHeight: 0, wavePeriod: 2, windSpeed: 80, windDirection: 180, swellHeight: 0, tidePhase: 'unknown' };
const result5 = scoreSlot(extremeSlot, baseContext);
assert(result5.score >= 0 && result5.score <= 10, `Score doit être entre 0 et 10, got ${result5.score}`);
console.log('✅ Test 5 (conditions extrêmes):', result5.score);

console.log('\n🎉 Tous les tests scorer passent !');
```

- [ ] **Step 2 : Vérifier que les tests échouent (scorer pas encore créé)**

```bash
cd "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/backend"
node tests/scorer.test.js
```

Expected : `Error: Cannot find module '../src/services/scorer'`

- [ ] **Step 3 : Créer `scorer.js`**

Créer `backend/src/services/scorer.js` :

```javascript
// 🎯 Scorer SurfAI — Score composite 0-10 par créneau horaire
// Spec : docs/superpowers/specs/2026-03-22-moteur-prediction-ia-design.md

// Poids de base (somme = 1.0)
const BASE_WEIGHTS = {
  wind:    0.30,
  waves:   0.20,
  period:  0.15,
  history: 0.20,
  spot:    0.15,
};

// Calcul du poids historique progressif selon le nombre de sessions réelles avec météo
function computeWeights(sessionsWithMeteoCount) {
  const h = 0.10 + (0.10 * Math.min(sessionsWithMeteoCount, 20) / 20);
  const remaining = 1 - h;
  const baseWithoutHistory = 1 - BASE_WEIGHTS.history; // 0.80
  return {
    wind:    BASE_WEIGHTS.wind    * (remaining / baseWithoutHistory),
    waves:   BASE_WEIGHTS.waves   * (remaining / baseWithoutHistory),
    period:  BASE_WEIGHTS.period  * (remaining / baseWithoutHistory),
    history: h,
    spot:    BASE_WEIGHTS.spot    * (remaining / baseWithoutHistory),
  };
}

// ─── Facteur Vent (0-10) ────────────────────────────────
function scoreWind(windSpeed, windDirection, idealWindDirections) {
  // windSpeed en km/h, windDirection en degrés (0-360) ou string cardinal
  const speedKmh = windSpeed > 50 ? windSpeed / 3.6 : windSpeed; // si m/s → km/h

  let speedScore;
  if (speedKmh < 10)       speedScore = 10;
  else if (speedKmh < 20)  speedScore = 8;
  else if (speedKmh < 30)  speedScore = 5;
  else if (speedKmh < 40)  speedScore = 2;
  else                     speedScore = 0;

  // Bonus direction si les conditions idéales du spot sont connues
  let directionBonus = 0;
  if (windDirection !== null && windDirection !== undefined && idealWindDirections?.length > 0) {
    const dir = degreesToCardinal(windDirection);
    if (idealWindDirections.includes(dir)) directionBonus = 1.5;
  }

  return Math.min(10, speedScore + directionBonus);
}

// ─── Facteur Vagues + Houle (0-10) ──────────────────────
function scoreWaves(waveHeight, swellHeight, profile) {
  const combined = Math.max(waveHeight || 0, swellHeight || 0);
  const min = profile.min_wave_height || 0.8;
  const max = profile.max_wave_height || 2.0;
  const optimal = (min + max) / 2;

  if (combined >= min && combined <= max) {
    // Dans la fourchette — peak au centre
    const distFromOptimal = Math.abs(combined - optimal) / ((max - min) / 2);
    return 10 - distFromOptimal * 2;
  } else if (combined < min) {
    const shortfall = (min - combined) / min;
    return Math.max(0, 6 - shortfall * 10);
  } else {
    const excess = (combined - max) / max;
    return Math.max(0, 6 - excess * 8);
  }
}

// ─── Facteur Période (0-10) ─────────────────────────────
function scorePeriod(period) {
  if (!period) return 3;
  if (period >= 15) return 10;
  if (period >= 12) return 8.5;
  if (period >= 8)  return 6;
  if (period >= 6)  return 3;
  return 1;
}

// ─── Facteur Historique (0-10) ──────────────────────────
function scoreHistory(slot, pastSessions) {
  const goodSessions = pastSessions.filter(s => s.rating >= 4 && s.meteo);
  if (goodSessions.length === 0) return 5; // neutre si pas de données

  // Distance euclidienne normalisée sur 3 dimensions
  function similarity(s) {
    const dWave = Math.abs((s.meteo.waveHeight || 0) - (slot.waveHeight || 0)) / 3;
    const dWind = Math.abs((s.meteo.windSpeed || 0) - (slot.windSpeed || 0)) / 40;
    const dPeriod = Math.abs((s.meteo.wavePeriod || 0) - (slot.wavePeriod || 0)) / 15;
    return 1 / (1 + Math.sqrt(dWave ** 2 + dWind ** 2 + dPeriod ** 2));
  }

  // Top 5 sessions les plus similaires
  const ranked = goodSessions
    .map(s => ({ session: s, sim: similarity(s) }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 5);

  const weightedRating = ranked.reduce((sum, { session, sim }) => sum + session.rating * sim, 0);
  const totalSim = ranked.reduce((sum, { sim }) => sum + sim, 0);
  const avgRating = totalSim > 0 ? weightedRating / totalSim : 3;

  return (avgRating / 5) * 10; // normaliser 1-5 → 0-10
}

// ─── Facteur Adéquation Spot (0-10) ─────────────────────
function scoreSpot(slot, spot) {
  let score = 5; // base neutre

  if (spot.ideal_wind?.length > 0 && slot.windDirection !== null) {
    const dir = degreesToCardinal(slot.windDirection);
    if (spot.ideal_wind.includes(dir)) score += 2.5;
  }

  if (spot.ideal_swell?.length > 0 && slot.swellDirection !== null) {
    const dir = degreesToCardinal(slot.swellDirection);
    if (spot.ideal_swell.includes(dir)) score += 2.5;
  }

  return Math.min(10, score);
}

// ─── Bonus Marée ────────────────────────────────────────
function tideBonus(tidePhase, idealTide) {
  if (!tidePhase || tidePhase === 'unknown' || !idealTide?.length) return 0;
  // Mapper phase courante vers catégorie low/mid/high
  const phaseMap = { low: 'low', high: 'high', rising: 'mid', falling: 'mid' };
  const category = phaseMap[tidePhase];
  if (idealTide.includes(category)) return 0.5;
  if (idealTide.includes('mid') && (tidePhase === 'rising' || tidePhase === 'falling')) return 0.3;
  return -0.3;
}

// ─── Board Suggestion ───────────────────────────────────
function suggestBoard(slot, pastSessions, boards) {
  if (!boards?.length) return null;
  const goodSessions = pastSessions.filter(s => s.rating >= 4 && s.meteo && s.board_id);
  if (goodSessions.length < 2) return null; // pas assez de données

  function similarity(s) {
    const dWave = Math.abs((s.meteo.waveHeight || 0) - (slot.waveHeight || 0)) / 3;
    const dWind = Math.abs((s.meteo.windSpeed || 0) - (slot.windSpeed || 0)) / 40;
    return 1 / (1 + Math.sqrt(dWave ** 2 + dWind ** 2));
  }

  const similar = goodSessions
    .map(s => ({ board_id: s.board_id, sim: similarity(s) }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 5);

  // Board la plus fréquente parmi les sessions similaires
  const boardCounts = {};
  similar.forEach(({ board_id }) => {
    boardCounts[board_id] = (boardCounts[board_id] || 0) + 1;
  });
  const topBoardId = Object.entries(boardCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const board = boards.find(b => b.id === topBoardId);
  if (!board) return null;

  return {
    board,
    confidence: Math.round((boardCounts[topBoardId] / similar.length) * 100) / 100,
    basedOnSessions: similar.length,
  };
}

// ─── Utilitaires ────────────────────────────────────────
function degreesToCardinal(deg) {
  if (deg === null || deg === undefined) return null;
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

// ─── Fonction principale ─────────────────────────────────
function scoreSlot(slot, context) {
  const { profile, spot, pastSessions = [], boards = [] } = context;
  const sessionsWithMeteo = pastSessions.filter(s => s.meteo).length;
  const weights = computeWeights(sessionsWithMeteo);

  const windScore    = scoreWind(slot.windSpeed, slot.windDirection, spot.ideal_wind);
  const wavesScore   = scoreWaves(slot.waveHeight, slot.swellHeight, profile);
  const periodScore  = scorePeriod(slot.wavePeriod);
  const historyScore = scoreHistory(slot, pastSessions);
  const spotScore    = scoreSpot(slot, spot);
  const tideAdj      = tideBonus(slot.tidePhase, spot.ideal_tide);

  const rawScore =
    windScore    * weights.wind   +
    wavesScore   * weights.waves  +
    periodScore  * weights.period +
    historyScore * weights.history +
    spotScore    * weights.spot   +
    tideAdj;

  const score = Math.round(Math.min(10, Math.max(0, rawScore)) * 10) / 10;

  const boardSuggestion = score >= 6 ? suggestBoard(slot, pastSessions, boards) : null;

  // Trouver la session similaire la plus proche pour la narrative
  const goodSessions = pastSessions.filter(s => s.rating >= 4 && s.meteo);
  let similarSession = null;
  if (goodSessions.length > 0) {
    similarSession = goodSessions.sort((a, b) => {
      const da = Math.abs((a.meteo.waveHeight || 0) - (slot.waveHeight || 0));
      const db_ = Math.abs((b.meteo.waveHeight || 0) - (slot.waveHeight || 0));
      return da - db_;
    })[0];
  }

  return {
    score,
    factors: {
      wind:    { score: Math.round(windScore * 10) / 10,    weight: weights.wind },
      waves:   { score: Math.round(wavesScore * 10) / 10,   weight: weights.waves },
      period:  { score: Math.round(periodScore * 10) / 10,  weight: weights.period },
      history: { score: Math.round(historyScore * 10) / 10, weight: weights.history, basedOnSessions: sessionsWithMeteo },
      spot:    { score: Math.round(spotScore * 10) / 10,     weight: weights.spot },
    },
    boardSuggestion,
    similarSession,
    calibrationLevel: Math.round(weights.history * 100) / 100,
  };
}

module.exports = { scoreSlot, computeWeights, degreesToCardinal };
```

- [ ] **Step 4 : Lancer les tests**

```bash
cd "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/backend"
node tests/scorer.test.js
```

Expected :
```
✅ Test 1 (conditions parfaites): [score >= 7]
✅ Test 2 (vent fort onshore): [score < test1]
✅ Test 3 (vagues hors fourchette): [score < test1]
✅ Test 4 (board suggestion): Fish 5'9
✅ Test 5 (conditions extrêmes): [0-10]
🎉 Tous les tests scorer passent !
```

- [ ] **Step 5 : Commit**

```bash
git add backend/src/services/scorer.js backend/tests/scorer.test.js
git commit -m "feat: add surf scorer with composite 0-10 scoring and board suggestion"
```

---

## Task 4 : Collector — Agrégateur de données

**Files:**
- Create: `backend/src/services/collector.js`

- [ ] **Step 1 : Créer `collector.js`**

Créer `backend/src/services/collector.js` :

```javascript
// 📡 Collector SurfAI — Agrège toutes les sources de données en un contexte unifié
// Spec : docs/superpowers/specs/2026-03-22-moteur-prediction-ia-design.md

const stormglassService = require('./stormglassService');
const shomService = require('./shomService');
const db = require('./supabaseService');

async function collectContext(spotId, userId, days = 5) {
  console.log(`📡 Collecte contexte: spot=${spotId} user=${userId} days=${days}`);

  // Récupérer toutes les données en parallèle
  const [spot, profile, sessions, boards] = await Promise.all([
    db.getSpotById(spotId),
    db.getProfile(userId),
    db.getSessionsWithMeteo(userId),
    db.getBoards(userId),
  ]);

  if (!spot) throw new Error(`Spot ${spotId} introuvable`);

  // Prévisions météo Stormglass (5 jours)
  const weatherData = await stormglassService.getForecast(spot.lat, spot.lng, days);

  // Marées SHOM (en parallèle si port code disponible)
  const tidesByDate = spot.shom_port_code
    ? await shomService.getTideDataForDays(spotId, spot.shom_port_code, days)
    : {};

  // Enrichir chaque point de prévision avec les données de marée
  const forecast = weatherData.forecast.map(point => {
    const dateStr = point.time.split('T')[0];
    const hour = new Date(point.time).getHours();
    const tidePoint = shomService.getTideAtHour(tidesByDate[dateStr], hour);
    return {
      ...point,
      tideHeight: tidePoint.height_cm,
      tidePhase: tidePoint.phase,
    };
  });

  return {
    spot,
    forecast,         // array de points horaires enrichis avec marée
    profile: profile || { surf_level: 'intermediate', min_wave_height: 0.8, max_wave_height: 2.0 },
    pastSessions: sessions || [],
    boards: boards || [],
    userId,
    collectedAt: new Date().toISOString(),
  };
}

module.exports = { collectContext };
```

- [ ] **Step 2 : Tester le collector manuellement**

```bash
cd "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/backend"
node -e "
require('dotenv').config();
const { collectContext } = require('./src/services/collector');
// Utiliser Côte des Basques (id connu depuis les sessions)
collectContext('8f61b180-074b-445a-b5d4-f02a04d5fa29', '3ba8ad73-e2c6-49fe-ac88-c26b45551f4b', 2)
  .then(ctx => {
    console.log('✅ Spot:', ctx.spot.name);
    console.log('✅ Forecast points:', ctx.forecast.length);
    console.log('✅ Sessions:', ctx.pastSessions.length);
    console.log('✅ Boards:', ctx.boards.length);
    console.log('✅ Sample forecast:', JSON.stringify(ctx.forecast[0], null, 2));
  })
  .catch(e => console.error('❌', e.message));
"
```

Expected : spot name, 48 forecast points (2 jours), sessions count, sample avec tidePhase.

- [ ] **Step 3 : Commit**

```bash
git add backend/src/services/collector.js
git commit -m "feat: add data collector aggregating weather, tides, sessions and profile"
```

---

## Task 5 : Recommender — Sélection meilleurs créneaux

**Files:**
- Create: `backend/src/services/recommender.js`

- [ ] **Step 1 : Créer `recommender.js`**

Créer `backend/src/services/recommender.js` :

```javascript
// 🏆 Recommender SurfAI — Sélectionne les meilleurs créneaux et génère les narratives
// Spec : docs/superpowers/specs/2026-03-22-moteur-prediction-ia-design.md

const { scoreSlot } = require('./scorer');

// Labels selon score
function scoreLabel(score) {
  if (score >= 8.5) return 'Exceptionnel';
  if (score >= 7)   return 'Excellent';
  if (score >= 5.5) return 'Bon';
  if (score >= 4)   return 'Correct';
  return 'Faible';
}

// Narrative personnalisée
function buildNarrative(scoredSlot, spot) {
  const { similarSession, score } = scoredSlot;
  if (similarSession?.meteo) {
    const date = new Date(similarSession.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    const stars = '★'.repeat(similarSession.rating);
    return `Ressemble à ta session du ${date} à ${spot.name} — ${stars}`;
  }
  if (score >= 8.5) return 'Conditions exceptionnelles pour ton niveau';
  if (score >= 7)   return 'Excellente session en perspective';
  if (score >= 5.5) return 'Bonne session possible';
  return 'Conditions correctes';
}

// Grouper les points horaires en fenêtres continues
function buildTimeWindow(slots) {
  if (!slots.length) return { timeWindow: null, peakHour: null };
  const best = slots.reduce((a, b) => a.score > b.score ? a : b);
  const peakHour = new Date(best.time).getHours();

  // Étendre la fenêtre aux heures adjacentes de score >= (peak - 1.5)
  const threshold = best.score - 1.5;
  const windowHours = slots
    .filter(s => s.score >= threshold)
    .map(s => new Date(s.time).getHours())
    .sort((a, b) => a - b);

  if (windowHours.length === 0) return { timeWindow: `${peakHour}h`, peakHour };
  const startH = windowHours[0];
  const endH = windowHours[windowHours.length - 1] + 1;
  return {
    timeWindow: startH === endH - 1 ? `${startH}h` : `${startH}h–${endH}h`,
    peakHour,
  };
}

// Fonction principale — retourne les meilleurs créneaux pour un spot
function getBestWindows(context, maxWindows = 10) {
  const { spot, forecast, profile, pastSessions, boards } = context;

  // Scorer chaque créneau horaire
  const scored = forecast.map(point => {
    const result = scoreSlot(point, { profile, spot, pastSessions, boards });
    return { ...result, time: point.time, conditions: point };
  });

  // Filtrer les créneaux non surfables (score < 4)
  const surfable = scored.filter(s => s.score >= 4);

  // Grouper par demi-journée (matin: 5-12, après-midi: 12-20)
  const groups = {};
  surfable.forEach(s => {
    const date = s.time.split('T')[0];
    const hour = new Date(s.time).getHours();
    const period = hour < 12 ? 'morning' : 'afternoon';
    const key = `${date}_${period}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });

  // Sélectionner le meilleur créneau par groupe
  const windows = Object.values(groups)
    .map(slots => {
      const best = slots.reduce((a, b) => a.score > b.score ? a : b);
      const { timeWindow, peakHour } = buildTimeWindow(slots);
      return {
        date: best.time.split('T')[0],
        timeWindow,
        peakHour: `${peakHour}h`,
        score: best.score,
        scoreLabel: scoreLabel(best.score),
        conditions: {
          waveHeight: best.conditions.waveHeight,
          windSpeed: best.conditions.windSpeed,
          windDirection: best.conditions.windDirection,
          wavePeriod: best.conditions.wavePeriod,
          tidePhase: best.conditions.tidePhase,
          swellHeight: best.conditions.swellHeight,
        },
        factors: best.factors,
        boardSuggestion: best.boardSuggestion,
        narrative: buildNarrative(best, spot),
        similarSession: best.similarSession,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, maxWindows);

  return {
    spot: { id: spot.id, name: spot.name, city: spot.city },
    generatedAt: new Date().toISOString(),
    windows,
    calibrationLevel: scored[0]?.calibrationLevel || 0.10,
    totalSessionsAnalyzed: pastSessions.filter(s => s.meteo).length,
  };
}

module.exports = { getBestWindows };
```

- [ ] **Step 2 : Tester le pipeline complet (collector + scorer + recommender)**

```bash
cd "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/backend"
node -e "
require('dotenv').config();
const { collectContext } = require('./src/services/collector');
const { getBestWindows } = require('./src/services/recommender');

collectContext('8f61b180-074b-445a-b5d4-f02a04d5fa29', '3ba8ad73-e2c6-49fe-ac88-c26b45551f4b', 3)
  .then(ctx => {
    const result = getBestWindows(ctx, 5);
    console.log('✅ Spot:', result.spot.name);
    console.log('✅ Créneaux trouvés:', result.windows.length);
    result.windows.forEach(w => {
      console.log(\`  \${w.date} \${w.timeWindow} — Score \${w.score} (\${w.scoreLabel})\`);
      console.log(\`  Board: \${w.boardSuggestion?.board?.name || 'non suggérée'}\`);
      console.log(\`  \${w.narrative}\`);
    });
  })
  .catch(e => console.error('❌', e.message));
"
```

Expected : liste de créneaux avec scores, narratives, board suggestions.

- [ ] **Step 3 : Commit**

```bash
git add backend/src/services/recommender.js
git commit -m "feat: add recommender building best surf windows with narratives"
```

---

## Task 6 : Routes API prédictions

**Files:**
- Modify: `backend/src/routes/api.js`

- [ ] **Step 1 : Ajouter les routes dans `api.js`**

À la fin de `backend/src/routes/api.js`, avant `module.exports = router`, ajouter :

```javascript
// ─── ROUTES PRÉDICTIONS ──────────────────────────────────

// GET /api/v1/predictions/best-windows?userId=X&days=5
// Meilleurs créneaux sur les spots les plus surfés par l'utilisateur
router.get('/predictions/best-windows', async (req, res) => {
  try {
    const db = require('../services/supabaseService');
    const { collectContext } = require('../services/collector');
    const { getBestWindows } = require('../services/recommender');

    const userId = req.query.userId;
    const days = parseInt(req.query.days) || 5;
    if (!userId) return res.status(400).json({ success: false, error: 'userId requis' });

    const favoriteSpots = await db.getFavoriteSpots(userId);
    if (!favoriteSpots.length) {
      return res.json({ success: true, message: 'Aucun spot favori trouvé', results: [] });
    }

    // Limiter à 3 spots pour préserver le quota Stormglass
    const spotsToAnalyze = favoriteSpots.slice(0, 3);
    const results = await Promise.all(
      spotsToAnalyze.map(spot =>
        collectContext(spot.id, userId, days)
          .then(ctx => getBestWindows(ctx, 6))
          .catch(err => ({ spot: { id: spot.id, name: spot.name }, error: err.message, windows: [] }))
      )
    );

    res.json({ success: true, userId, days, results });
  } catch (error) {
    console.error('Erreur best-windows:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/v1/predictions/spot/:spotId?userId=X&days=5
// Prévisions détaillées pour un spot spécifique
router.get('/predictions/spot/:spotId', async (req, res) => {
  try {
    const { collectContext } = require('../services/collector');
    const { getBestWindows } = require('../services/recommender');

    const { spotId } = req.params;
    const userId = req.query.userId;
    const days = parseInt(req.query.days) || 5;
    if (!userId) return res.status(400).json({ success: false, error: 'userId requis' });

    const ctx = await collectContext(spotId, userId, days);
    const result = getBestWindows(ctx, 10);

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Erreur predictions/spot:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

- [ ] **Step 2 : Redémarrer le backend et tester les routes**

```bash
kill $(lsof -ti:3001) 2>/dev/null
cd "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/backend" && node server.js &
sleep 2

# Test best-windows
curl -s "http://localhost:3001/api/v1/predictions/best-windows?userId=3ba8ad73-e2c6-49fe-ac88-c26b45551f4b&days=3" | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Results:', len(d.get('results',[])), 'spots'); [print('  -', r['spot']['name'], ':', len(r.get('windows',[])), 'créneaux') for r in d.get('results',[])]"
```

Expected : 1-3 spots avec plusieurs créneaux chacun.

- [ ] **Step 3 : Commit**

```bash
kill %1 2>/dev/null
git add backend/src/routes/api.js
git commit -m "feat: add /predictions/best-windows and /predictions/spot/:id routes"
```

---

## Task 7 : Capture météo automatique à l'enregistrement de session

**Files:**
- Modify: `backend/src/routes/api.js` (route POST /sessions/quick existante)

- [ ] **Step 1 : Mettre à jour la route POST /sessions/quick**

Dans `backend/src/routes/api.js`, remplacer la route `POST /sessions/quick` existante par :

```javascript
// POST /api/v1/sessions/quick → sauvegarde session + capture météo automatique
router.post('/sessions/quick', async (req, res) => {
  try {
    const db = require('../services/supabaseService');
    const stormglassService = require('../services/stormglassService');
    const { userId, spotId, date, time, rating, notes, boardId } = req.body;

    let meteo = null;

    // Capture météo automatique si spot connu
    if (spotId) {
      try {
        const spot = await db.getSpotById(spotId);
        if (spot) {
          const weatherData = await stormglassService.getForecast(spot.lat, spot.lng, 1);
          // Trouver le point météo le plus proche de l'heure de session
          const sessionTime = time ? new Date(`${date?.split('T')[0]}T${time}`) : new Date(date);
          const sessionTimestamp = sessionTime.getTime() / 1000;
          const closest = weatherData.forecast?.reduce((best, p) =>
            Math.abs(p.timestamp - sessionTimestamp) < Math.abs((best?.timestamp || 0) - sessionTimestamp) ? p : best
          , null);

          if (closest) {
            meteo = {
              waveHeight: closest.waveHeight,
              wavePeriod: closest.wavePeriod,
              windSpeed: closest.windSpeed,
              windDirection: closest.windDirection,
              swellHeight: closest.swellHeight,
            };
            console.log(`📡 Météo capturée pour session: ${JSON.stringify(meteo)}`);
          }
        }
      } catch (meteoError) {
        console.warn('⚠️ Capture météo échouée (session sauvegardée sans météo):', meteoError.message);
      }
    }

    const session = await db.createSession({
      user_id: userId,
      spot_id: spotId,
      date: date || new Date().toISOString(),
      time: time || null,
      rating: rating || null,
      notes: notes || '',
      board_id: boardId || null,
      meteo,
    });

    res.json({
      success: true,
      message: meteo ? 'Session enregistrée avec météo capturée automatiquement' : 'Session enregistrée (météo non disponible)',
      session,
      meteoCapture: meteo !== null,
    });
  } catch (error) {
    console.error('Erreur sessions/quick:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

- [ ] **Step 2 : Tester l'enregistrement**

```bash
curl -s -X POST http://localhost:3001/api/v1/sessions/quick \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "3ba8ad73-e2c6-49fe-ac88-c26b45551f4b",
    "spotId": "8f61b180-074b-445a-b5d4-f02a04d5fa29",
    "date": "2026-03-22",
    "time": "09:00",
    "rating": 4,
    "notes": "Test session"
  }' | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅' if d.get('success') else '❌', d.get('message'), '| Météo:', d.get('meteoCapture'))"
```

Expected : `✅ Session enregistrée avec météo capturée automatiquement | Météo: True`

- [ ] **Step 3 : Commit**

```bash
git add backend/src/routes/api.js
git commit -m "feat: auto-capture stormglass weather when recording a session"
```

---

## Task 8 : UI Frontend — Meilleurs créneaux 5 jours

**Files:**
- Modify: `apps/web/index.html`

- [ ] **Step 1 : Ajouter la section "Meilleurs créneaux" dans l'HTML**

Dans `apps/web/index.html`, trouver la section du dashboard (onglet principal) et ajouter un bloc "Meilleurs créneaux" après les recommandations existantes :

Chercher `id="recommendations"` et ajouter après le div qui le contient :

```html
<!-- Meilleurs créneaux 5 jours -->
<div class="card" style="margin-top: 20px;">
    <h3>🏄 Meilleurs créneaux — 5 jours</h3>
    <div id="best-windows-container">
        <div class="loading">🌊 Analyse des conditions...</div>
    </div>
</div>
```

- [ ] **Step 2 : Ajouter la fonction `loadBestWindows` dans le JavaScript**

Trouver la fonction `generateIntelligentRecommendations` et ajouter après :

```javascript
async function loadBestWindows() {
    const container = document.getElementById('best-windows-container');
    if (!container) return;
    container.innerHTML = '<div class="loading">🌊 Calcul des meilleurs créneaux...</div>';

    try {
        const userId = dataManager.currentUserId;
        if (!userId || userId === 'demo_user') {
            container.innerHTML = '<div class="card"><p>Connectez Supabase pour voir vos créneaux personnalisés.</p></div>';
            return;
        }

        const res = await fetch(`${backendUrl}/api/v1/predictions/best-windows?userId=${userId}&days=5`);
        const data = await res.json();

        if (!data.success || !data.results?.length) {
            container.innerHTML = '<div class="card"><p>Enregistrez des sessions pour obtenir des prédictions personnalisées.</p></div>';
            return;
        }

        const html = data.results.map(spotResult => {
            if (!spotResult.windows?.length) return '';
            const windowsHtml = spotResult.windows.slice(0, 4).map(w => {
                const stars = Math.round(w.score / 2);
                const starsHtml = '★'.repeat(stars) + '☆'.repeat(5 - stars);
                const boardHtml = w.boardSuggestion ? `<span style="background:#e6fffa;padding:2px 8px;border-radius:12px;font-size:0.8rem">🏄 ${w.boardSuggestion.board.name}</span>` : '';
                const dateFormatted = new Date(w.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
                const scoreColor = w.score >= 8 ? '#48bb78' : w.score >= 6 ? '#4299e1' : '#ed8936';
                return `
                    <div style="display:flex;align-items:center;gap:12px;padding:10px;border-bottom:1px solid #f0f0f0">
                        <div style="text-align:center;min-width:60px">
                            <div style="font-size:1.4rem;font-weight:bold;color:${scoreColor}">${w.score}</div>
                            <div style="font-size:0.7rem;color:#666">/10</div>
                        </div>
                        <div style="flex:1">
                            <div style="font-weight:600">${dateFormatted} · ${w.timeWindow}</div>
                            <div style="font-size:0.85rem;color:#555;margin:2px 0">
                                🌊 ${w.conditions.waveHeight?.toFixed(1) || '?'}m ·
                                💨 ${Math.round(w.conditions.windSpeed || 0)}km/h ${w.conditions.windDirection || ''} ·
                                ⏱️ ${w.conditions.wavePeriod || '?'}s
                            </div>
                            <div style="font-size:0.8rem;color:#888;margin-top:4px;font-style:italic">${w.narrative}</div>
                            <div style="margin-top:4px">${boardHtml}</div>
                        </div>
                        <div style="color:${scoreColor};font-size:0.8rem;text-align:right;min-width:70px">${w.scoreLabel}</div>
                    </div>`;
            }).join('');

            return `
                <div style="margin-bottom:16px">
                    <div style="font-weight:600;padding:8px 0;border-bottom:2px solid #4299e1;margin-bottom:4px">
                        📍 ${spotResult.spot.name}
                        <span style="font-size:0.8rem;color:#666;font-weight:normal;margin-left:8px">
                            ${spotResult.totalSessionsAnalyzed || 0} sessions analysées
                        </span>
                    </div>
                    ${windowsHtml}
                </div>`;
        }).join('');

        container.innerHTML = html || '<div class="card"><p>Aucun créneau favorable dans les 5 prochains jours.</p></div>';

    } catch (error) {
        console.error('Erreur meilleurs créneaux:', error);
        container.innerHTML = `<div class="error">❌ ${error.message}</div>`;
    }
}
```

- [ ] **Step 3 : Appeler `loadBestWindows` au chargement**

Dans la fonction `DOMContentLoaded`, après `await generateIntelligentRecommendations();`, ajouter :

```javascript
// Charger les meilleurs créneaux
await loadBestWindows();
```

- [ ] **Step 4 : Tester dans le navigateur**

Redémarrer le backend, **Cmd+Shift+R** sur http://localhost:8080.

Expected : section "Meilleurs créneaux — 5 jours" visible sur le dashboard avec créneaux scorés, board suggérée, narrative.

- [ ] **Step 5 : Commit final**

```bash
cd "/Users/imac/ANTIGRAVITY x CLAUDE/surfai"
git add apps/web/index.html
git commit -m "feat: add best surf windows UI with scores, board suggestions and narratives"
```

---

## Vérification finale

```bash
# Backend complet
curl -s http://localhost:3001/api/v1/predictions/best-windows?userId=3ba8ad73-e2c6-49fe-ac88-c26b45551f4b | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Routes prédictions:', d.get('success')); [print(f'  {r[\"spot\"][\"name\"]}: {len(r[\"windows\"])} créneaux') for r in d.get('results',[])]"

# Tests scorer
cd backend && node tests/scorer.test.js
```

Expected : backend répond, scorer passe tous les tests, UI affiche les créneaux.

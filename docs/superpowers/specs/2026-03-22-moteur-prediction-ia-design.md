# Moteur de Prédiction IA — Design Spec

> **For agentic workers:** Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this spec task-by-task.

**Goal:** Construire un moteur de prédiction personnalisé qui analyse les prévisions météo sur 5 jours et recommande les meilleurs créneaux de surf, la board adaptée, et l'heure idéale — en apprenant des sessions passées de l'utilisateur.

**Différenciateur vs Surfline:** Surfline donne des conditions génériques. SurfAI dit "demain 8h à Côte des Basques ressemble à ta session du 27 avril que tu as notée 5★ — prends ta fish."

**Tech Stack:** Node.js backend · Supabase (sessions, spots, boards, profil) · Stormglass API (météo) · SHOM API (marées, gratuit) · Frontend HTML/JS existant

---

## Architecture : Pipeline 3 couches

```
[Sources de données]
  Stormglass (météo 5j)  +  SHOM (marées)  +  Supabase (sessions/spots/boards/profil)
                                    ↓
                          [1. COLLECTEUR]
                    Agrège tout en un objet "contexte"
                    par spot × par créneau horaire
                                    ↓
                           [2. SCOREUR]
                    Score composite 0-10 par créneau
                    Heuristiques + calibration sessions
                                    ↓
                         [3. RECOMMANDEUR]
                    Sélectionne meilleurs créneaux
                    Génère narrative + board suggérée
```

Chaque couche est un module Node.js indépendant avec interface claire. On peut améliorer le Scoreur sans toucher au Collecteur ou au Recommandeur.

---

## Couche 1 — Collecteur

**Responsabilité :** Rassembler toutes les données nécessaires en un seul objet `context` structuré.

**Inputs :**
- `spotId` (ou liste de spots favoris)
- `userId`
- `days` (5)

**Ce qu'il récupère :**
1. Prévisions Stormglass pour le spot (5 jours, horaire) — avec cache 6h existant
2. Horaires de marée SHOM pour le spot (hauteur de marée heure par heure)
3. Profil utilisateur depuis Supabase (niveau, wave min/max)
4. Sessions passées avec météo depuis Supabase (pour calibration)
5. Boards de l'utilisateur depuis Supabase
6. Conditions idéales du spot depuis Supabase (`ideal_wind`, `ideal_swell`, `ideal_tide`)

**Output :** objet `context` :
```javascript
{
  spot: { id, name, city, ideal_wind, ideal_swell, ideal_tide, lat, lng },
  forecast: [ { time, timestamp, waveHeight, wavePeriod, windSpeed, windDirection,
                swellHeight, swellPeriod, swellDirection, tideHeight, tidePhase } ],
  profile: { surf_level, min_wave_height, max_wave_height },
  sessions: [ { date, time, rating, meteo, board_id } ],  // sessions avec météo uniquement
  boards: [ { id, name, board_type, size } ],
  userId
}
```

**Intégration SHOM :**
- Endpoint REST : `GET https://maree.shom.fr/api/v1/tides?harbour={code}&duration=120&nbDays=5`
- Utilise des **codes de port** (ex: `BIARRITZ` = `BIA`, `CAPBRETON` = `CPB`), pas de lat/lng
- Colonne `shom_port_code` à ajouter à la table `spots` pour les spots principaux
- Retourne : tableau horaire `{ time, hauteur_cm }` — phase calculée depuis la courbe (montante/descendante/basse/haute)
- Cache : 12h minimum dans `tide_cache` (marées prévisibles)
- Fallback : si SHOM ou code manquant → `tideHeight = null`, `tidePhase = 'unknown'`, bonus marée = 0

---

## Couche 2 — Scoreur

**Responsabilité :** Calculer un score 0-10 pour chaque créneau horaire du forecast.

### Facteurs et poids de base

| Facteur | Poids | Description |
|---------|-------|-------------|
| Vent | 30% | Vitesse + direction (offshore = bonus) |
| Vagues + Houle | 20% | Hauteur combinée vs préférences utilisateur |
| Période | 15% | Période de houle (qualité de la vague) |
| Historique personnel | 20% | Similarité avec sessions bien notées |
| Adéquation spot | 15% | Correspondance avec conditions idéales du spot |
| Bonus marée | ±modifier | Bonus si phase de marée correspond à `ideal_tide` du spot |

**Total = 100%. Les poids sont appliqués directement sans normalisation.**

### Calcul par facteur

**Vent (30%) :**
- Direction offshore pour ce spot → score max
- Vent nul ou très léger (<10 km/h) → score max
- Vent onshore → pénalité sévère
- Vent cross-shore → score moyen
- Au-delà de 40 km/h → score minimum quelle que soit la direction

**Vagues + Houle (20%) :**
- Score basé sur la fourchette personnelle (`min_wave_height` → `max_wave_height` du profil)
- Valeur optimale = milieu de la fourchette → score max
- En dehors de la fourchette → décroissance progressive
- Houle et vagues combinées : `combinedHeight = max(waveHeight, swellHeight)`

**Période (15%) :**
- < 8s → score faible (vagues courtes, creuses)
- 8-11s → bon
- 12-15s → excellent
- > 15s → parfait

**Historique personnel (20%) :**
- Calcule la similarité entre les conditions prévues et les sessions 4-5★ passées
- Similarité = distance euclidienne normalisée sur (waveHeight, windSpeed, wavePeriod)
- Score = moyenne pondérée des ratings des N sessions les plus similaires (N=5)
- **Poids progressif :** démarre à 10% (0 sessions réelles), monte vers 20% selon :
  `h = 0.10 + (0.10 * min(sessionsAvecMeteo, 20) / 20)`
- La différence `(0.20 - h)` est prélevée proportionnellement sur les 4 autres facteurs :
  `poids_wind = 0.30 × (1 - h) / 0.80`, etc. — de sorte que la somme reste toujours 1.0

**Adéquation spot (15%) :**
- Comparer `windDirection` prévu vs `ideal_wind` du spot (tableau dans Supabase)
- Comparer `swellDirection` prévu vs `ideal_swell` du spot
- Chaque match = +0.5 point sur ce facteur

**Bonus marée (modificateur) :**
- Si `tidePhase` correspond à `ideal_tide` du spot → +0.5 point final
- Si opposé → -0.3 point final
- Si inconnu → 0

### Score final
```
score = Σ(facteur_i × poids_i) + bonus_marée
score = clamp(score, 0, 10)
```

### Board suggestion
Pour chaque créneau scoré ≥ 6 :
1. Chercher les sessions similaires (top 5 proches) qui ont une `board_id`
2. Trouver la board la plus fréquente dans ces sessions avec rating ≥ 4
3. Si trouvée → `boardSuggestion = { board, confidence, basedOnSessions: N }`
4. Si pas assez de données → suggestion basée sur le type de vague (règles expertes)

---

## Couche 3 — Recommandeur

**Responsabilité :** Sélectionner les meilleurs créneaux et générer les recommandations narratives.

### Sélection des créneaux

Sur les 5 jours de prévisions (≈120 créneaux horaires par spot) :
1. Filtrer les créneaux score < 4 (pas surfables)
2. Grouper par fenêtres continues (créneaux consécutifs de score similaire)
3. Sélectionner le **meilleur créneau par demi-journée** (matin / après-midi)
4. Retourner les **10 meilleurs créneaux** toutes fenêtres confondues

### Fenêtre horaire idéale
Pour chaque session recommandée :
- Chercher le pic de score dans la journée (créneau le mieux scoré)
- Étendre la fenêtre aux créneaux adjacents de score ≥ (peak - 1)
- Output : `"7h–10h"` plutôt qu'une heure précise

### Narrative
Template de génération :
```
Si session similaire trouvée :
  "Ressemble à ta session du {date} à {spot} — {rating}★"
Sinon si score ≥ 8 :
  "Conditions idéales pour ton niveau"
Sinon si score ≥ 6 :
  "Bonne session en perspective"
```

### Structure de sortie API
```javascript
{
  spot: { id, name, city },
  generatedAt: ISO timestamp,
  windows: [
    {
      date: "2026-03-23",
      timeWindow: "7h–10h",
      peakHour: "8h",
      score: 8.4,
      scoreLabel: "Excellent",
      conditions: {
        waveHeight: 1.8,
        windSpeed: 12,
        windDirection: "E",
        wavePeriod: 11,
        tidePhase: "low"
      },
      factors: {
        wind: { score: 9.2, weight: 0.30 },
        waves: { score: 8.0, weight: 0.20 },
        period: { score: 8.5, weight: 0.15 },
        history: { score: 7.8, weight: 0.20, basedOnSessions: 4 },
        spot: { score: 8.0, weight: 0.15 }
      },
      boardSuggestion: {
        board: { id, name, board_type },
        confidence: 0.8,
        basedOnSessions: 3
      },
      narrative: "Ressemble à ta session du 27 avril à Côte des Basques — 5★",
      similarSession: { date, rating, spot }
    }
  ],
  calibrationLevel: 0.12,  // 0.10 → 0.20 selon sessions réelles
  totalSessionsAnalyzed: 8
}
```

---

## Enregistrement de session — Enrichissement automatique

Quand l'utilisateur enregistre une session :

1. **Champs saisis :** date, heure, spot_id, board_id (optionnel), rating (1-5), commentaire (optionnel)
2. **Capture automatique :** le backend appelle Stormglass pour les conditions à ce spot à cette heure → sauvegardé dans `meteo`
3. **Fallback :** si Stormglass indisponible ou quota dépassé → `meteo = null`, session sauvegardée quand même

Cette capture automatique est ce qui alimente la calibration. Sans `meteo`, la session compte pour les statistiques mais pas pour la calibration des poids.

---

## Routes API backend

| Route | Description |
|-------|-------------|
| `GET /api/v1/predictions/best-windows?userId=X&days=5` | Meilleurs créneaux sur les 3-5 spots les plus surfés (COUNT sessions GROUP BY spot_id) |
| `GET /api/v1/predictions/spot/:spotId?userId=X&days=5` | Prévisions détaillées pour un spot |
| `POST /api/v1/sessions/quick` | Enregistrer session + capture météo auto |

---

## Évolutions Supabase requises

Schéma existant couvre tout :
- `sessions` — avec champ `meteo` JSONB ✅
- `spots` — avec `ideal_wind`, `ideal_swell`, `ideal_tide` ✅
- `boards` — ✅
- `profiles` — avec `min_wave_height`, `max_wave_height`, `surf_level` ✅

**1. Colonne `shom_port_code` sur `spots` :**
```sql
ALTER TABLE spots ADD COLUMN shom_port_code VARCHAR(10);
-- Valeurs initiales pour les spots principaux :
-- Biarritz → 'BIA', Capbreton → 'CPB', Hossegor → 'HOS', Lacanau → 'LAC'
```

**2. Table `tide_cache` :**
```sql
CREATE TABLE tide_cache (
  spot_id UUID REFERENCES spots(id),
  date DATE NOT NULL,
  -- data : tableau de 24 objets horaires { hour: 0-23, height_cm: int, phase: 'rising'|'falling'|'low'|'high' }
  data JSONB NOT NULL,
  cached_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (spot_id, date)
);
```

**3. Note quota Stormglass :** La capture météo automatique à l'enregistrement d'une session utilise le même quota Stormglass (10 appels/jour free tier). Le cache 6h existant couvre les sessions du même jour au même spot. Pour les sessions avec une date passée, Stormglass historical data compte aussi dans ce quota — si quota épuisé, `meteo = null` et la session est sauvegardée sans données météo.

---

## Ce qui est hors scope (pour l'instant)

- Authentification utilisateur (Supabase Auth) — app mono-utilisateur en MVP
- Analyse NLP des commentaires libres — données sauvegardées, traitement ultérieur
- Notifications push "fenêtre idéale dans 2h" — phase mobile
- Multi-spots simultanés en temps réel — optimisation future

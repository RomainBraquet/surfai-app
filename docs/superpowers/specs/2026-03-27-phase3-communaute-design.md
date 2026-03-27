# Spec — Phase 3 : Infrastructure Communautaire

**Date :** 27 mars 2026
**Objectif :** Poser les tables, triggers et seuils pour que l'intelligence collective s'active automatiquement quand le nombre d'utilisateurs le permet.

---

## Principe

Tout est passif. L'utilisateur ne "partage" rien consciemment. Quand il enregistre une session avec une note et de la météo, un snapshot anonymisé est créé en arrière-plan. Les agrégats se construisent la nuit. Les features communautaires s'affichent quand les seuils sont atteints.

---

## Tables à créer

### 1. `spot_session_snapshots` — données anonymisées

Chaque session avec météo + note génère un snapshot sans user_id ni date exacte.

```sql
CREATE TABLE spot_session_snapshots (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  spot_id         uuid REFERENCES spots(id) ON DELETE CASCADE,
  wave_height     numeric(4,2),
  wind_speed      numeric(5,2),
  wind_direction  numeric(5,1),
  wave_period     numeric(4,1),
  swell_height    numeric(4,2),
  tide_phase      text,
  rating_norm     numeric(3,2) NOT NULL,  -- rating/5
  month           integer NOT NULL,
  year            integer NOT NULL,
  created_at      timestamptz DEFAULT now()
);
```

### 2. `spot_community_profiles` — profil agrégé par spot

```sql
CREATE TABLE spot_community_profiles (
  spot_id             uuid REFERENCES spots(id) ON DELETE CASCADE PRIMARY KEY,
  session_count       integer DEFAULT 0,
  user_count          integer DEFAULT 0,
  confidence          numeric(3,2) DEFAULT 0,  -- 0 à 1
  wave_sweet_min      numeric(4,2),
  wave_sweet_max      numeric(4,2),
  wave_optimal        numeric(4,2),
  wind_sweet_max      numeric(5,2),
  best_wind_dirs      text[],
  period_min_good     numeric(4,1),
  tide_good           text[],
  tide_bad            text[],
  best_months         integer[],
  avg_community_rating numeric(3,2),
  computed_at         timestamptz DEFAULT now()
);
```

### 3. `magic_days` — journées magiques

```sql
CREATE TABLE magic_days (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  spot_id         uuid REFERENCES spots(id) ON DELETE CASCADE,
  date            date NOT NULL,
  session_count   integer NOT NULL,
  user_count      integer NOT NULL,
  avg_rating      numeric(3,2) NOT NULL,
  wave_height_med numeric(4,2),
  wind_speed_med  numeric(5,2),
  wave_period_med numeric(4,1),
  tide_phases     text[],
  magic_score     numeric(5,1) NOT NULL,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (spot_id, date)
);
```

---

## Trigger automatique

Quand une session est créée/modifiée avec rating + meteo → insérer un snapshot anonymisé.

Implémenté côté backend (dans la route POST /sessions/quick) plutôt que trigger SQL, pour garder le contrôle.

---

## Seuils d'activation

| Feature | Seuil minimum | Ce qui se passe en dessous |
|---------|---------------|---------------------------|
| Snapshot | 0 (toujours actif) | S'insère silencieusement |
| Profil communautaire spot | 5 sessions, 3 users | Pas affiché, scorer.js ignore |
| Journée magique | 2 users, avg_rating >= 3.5 | Pas détectée |
| Bonus communautaire dans scorer | confidence >= 0.3 | Pas de bonus |

---

## Intégration dans scorer.js

Nouveau facteur optionnel `scoreCommunity(slot, communityProfile)` :
- Si pas de profil communautaire ou confidence < 0.3 → retourne 0 (neutre)
- Si les conditions du slot matchent le sweet spot communautaire → bonus +0.5 à +1.5
- Si les conditions sont dans la zone "mauvaise" du profil → malus -0.5

Poids dans le score composite : 0 quand pas de data, monte progressivement jusqu'à 0.10 max.

---

## Privacy

- `spot_session_snapshots` : pas de user_id, pas de date exacte (mois/année seulement)
- RLS : snapshots jamais lisibles côté client
- Profils communautaires et magic_days : lisibles par les utilisateurs connectés
- Seuil k-anonymat : pas d'affichage si < 5 sessions / 3 users

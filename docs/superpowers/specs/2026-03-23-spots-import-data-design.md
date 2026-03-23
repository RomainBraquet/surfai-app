# Spots Import & Schema Enrichment — Design Spec

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan.

**Goal:** Enrichir la table `spots` avec de nouvelles colonnes, puis importer ~500-800 spots (France, Espagne, Portugal, Maroc) depuis l'API Surfline avec métadonnées complètes (type de vague, fond, difficulté, vent idéal).

**Architecture:** Une migration SQL ajoute les colonnes manquantes + index. Un script Node.js one-shot crawle l'API Surfline Taxonomy pour lister les spots des 4 pays, enrichit chaque spot avec les données mapview Surfline, et insère en batch dans Supabase via la service key.

**Tech Stack:** Node.js, Supabase JS SDK (service key), API Surfline (taxonomy + mapview)

---

## 1. Migration SQL — nouvelles colonnes `spots`

**Fichier :** `backend/supabase/migrations/20260323000002_add_spot_enrichment_columns.sql`

**Note :** Les colonnes `region` et `city` existent déjà. Seules les colonnes ci-dessous sont ajoutées.

```sql
ALTER TABLE spots ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE spots ADD COLUMN IF NOT EXISTS wave_type text;
ALTER TABLE spots ADD COLUMN IF NOT EXISTS bottom_type text;
ALTER TABLE spots ADD COLUMN IF NOT EXISTS difficulty text[];
ALTER TABLE spots ADD COLUMN IF NOT EXISTS ideal_swell_direction text[];
ALTER TABLE spots ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE spots ADD COLUMN IF NOT EXISTS surfline_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_spots_surfline_id ON spots(surfline_id) WHERE surfline_id IS NOT NULL;
```

**Convention de valeurs :**
- `wave_type` : `beach_break`, `reef_break`, `point_break`, `river_break` (ou null si inconnu)
- `bottom_type` : `sand`, `reef`, `rock`, `coral` (ou null — jamais saisi manuellement, auto uniquement)
- `difficulty` : tableau parmi `["beginner", "intermediate", "advanced", "expert"]`
- `ideal_swell_direction` : null à l'import (rempli ultérieurement — calcul de perpendiculaire côtière hors scope)
- `country` : nom en anglais (`France`, `Spain`, `Portugal`, `Morocco`)

**Mise à jour des spots existants :** Les spots déjà en BDD qui matchent un spot Surfline (par `surfline_id` d'abord, puis par nom normalisé + distance < 500m) sont mis à jour. Pas de doublons.

---

## 2. API Surfline — endpoints utilisés

### 2.1 Taxonomy (liste des spots)

```
GET https://services.surfline.com/taxonomy?type=taxonomy&id={parentId}&maxDepth=1
```

**Stratégie de crawl :**
1. Partir de Earth ID : `58f7ed51dadb30820bb38782`
2. Descendre récursivement : Earth → continents (Europe, Africa) → pays cibles → régions → sous-régions → spots
3. Les noms `country`, `region`, `city` sont déduits du contexte de crawl (le nom du noeud à chaque niveau), PAS d'un champ `enumeratedPath`
4. Collecter tous les items de type `spot` avec `_id`, `name`, `location.coordinates`

**Pas de clé API requise.** Endpoint public.

**Rate limiting :** `await sleep(200)` entre chaque requête taxonomy.

### 2.2 Mapview (métadonnées enrichies)

```
GET https://services.surfline.com/kbyg/mapview?south={s}&west={w}&north={n}&east={e}
```

**Stratégie :** Un appel mapview par sous-région Surfline. Le bounding box couvre toute la sous-région (calculé à partir du min/max des coords des spots dans cette sous-région). Cela regroupe ~10-50 spots par appel.

**Champs utiles dans la réponse :**
- `abilityLevels` → mappé vers `difficulty`
- `offshoreDirection` (degrés) → mappé vers `ideal_wind` (colonne existante, type text[])

**Note :** La réponse mapview utilise `lat` et `lon` (pas `lng`). Le script mappe `lon` → `lng` pour Supabase.

**Rate limiting :** `await sleep(300)` entre chaque appel mapview.

---

## 3. Mapping des données Surfline → Supabase

| Surfline field | Colonne Supabase | Transformation |
|----------------|-----------------|----------------|
| `name` | `name` | Tel quel |
| `location.coordinates[1]` | `lat` | GeoJSON = [lng, lat] |
| `location.coordinates[0]` | `lng` | GeoJSON = [lng, lat] |
| Contexte de crawl | `country`, `region`, `city` | Noms des noeuds parents dans la hiérarchie taxonomy |
| `_id` | `surfline_id` | Tel quel |
| `abilityLevels` | `difficulty` | `["BEGINNER","INTERMEDIATE"]` → `["beginner","intermediate"]` |
| `offshoreDirection` (degrés) | `ideal_wind` | Convertir degrés → direction cardinale 8 points (N/NE/E/SE/S/SW/W/NW), envelopper dans un array `["SE"]`. **Ne pas écraser si `ideal_wind` est déjà renseigné.** Le scorer existant utilise `degreesToCardinal()` en 8 points — utiliser la même résolution. |
| Non disponible | `wave_type` | null (pas d'inférence fragile depuis le nom) |
| Non disponible | `bottom_type` | null |
| Non disponible | `ideal_swell_direction` | null |
| Non disponible | `description` | null |

---

## 4. Script d'import

**Fichier :** `backend/scripts/import-spots.js`

**Exécution :** `node backend/scripts/import-spots.js`

**Prérequis :** La migration SQL (§1) doit avoir été exécutée avant.

**Flux :**
1. Connexion Supabase avec service key (depuis `process.env.SUPABASE_URL` et `process.env.SUPABASE_SERVICE_KEY`, ou fallback sur les valeurs dans `.env`)
2. Charger tous les spots existants depuis Supabase (pour le dédoublonnage en mémoire)
3. Crawler Surfline taxonomy : Earth → Europe/Africa → pays cibles → régions → spots
4. Pour chaque sous-région, appeler mapview avec un bounding box englobant
5. Merger les données taxonomy + mapview pour chaque spot
6. Dédoublonner (voir §5)
7. Upsert dans Supabase :
   - Si match par `surfline_id` : UPDATE (ne pas écraser `ideal_tide`, `ideal_swell`, `ideal_wind`, `shom_port_code` si déjà renseignés)
   - Si match par nom+distance : UPDATE + ajouter `surfline_id`
   - Si nouveau : INSERT
8. Log de progression : `[42/650] Imported: La Gravière (Hossegor, France)`
9. Résumé final : X spots importés, Y mis à jour, Z erreurs

**Gestion d'erreur :**
- Appel Surfline échoue → log warning, skip, continuer
- Upsert Supabase échoue → log error, continuer
- Le script est idempotent grâce à l'index unique sur `surfline_id`

---

## 5. Dédoublonnage avec les spots existants

**Ordre de priorité :**
1. Match par `surfline_id` (exact) — pour les re-runs du script
2. Match par nom normalisé + distance géographique — pour les spots existants sans `surfline_id`

**Normalisation des noms :**
- Lowercase, trim
- Supprimer les accents (normalize NFD + replace)
- Supprimer les préfixes courants ("plage de", "beach", "praia de/da")

**Critères de match :**
- Noms normalisés identiques OU l'un contient l'autre (inclusion)
- ET distance Haversine < 500m

**Calcul Haversine :** Implémenté directement dans le script (formule standard, pas de dépendance externe). Pas besoin de Levenshtein — l'inclusion + normalisation couvre les cas réels.

---

## 6. Hors scope

- Saisie manuelle de `bottom_type`, `description`, ou `wave_type`
- Import mondial (limité à FR/ES/PT/MA)
- WannaSurf scraping (spec future potentielle)
- Calcul de `ideal_swell_direction` depuis la géométrie côtière
- Mise à jour du scorer (spec 3 séparée)
- Mise à jour de l'UX Spots (spec 2 séparée)
- Inférence de `wave_type` depuis le nom du spot (trop fragile, surtout en français)

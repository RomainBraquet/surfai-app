# Spots Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importer ~500-800 spots FR/ES/PT/MA depuis Surfline API dans Supabase avec métadonnées enrichies.

**Architecture:** Migration SQL pour le schéma + script Node.js d'import one-shot.

**Tech Stack:** Node.js, Supabase JS SDK (service key), API Surfline

**Spec:** `docs/superpowers/specs/2026-03-23-spots-import-data-design.md`

---

## File Structure

- Create: `backend/supabase/migrations/20260323000002_add_spot_enrichment_columns.sql`
- Create: `backend/scripts/import-spots.js`

---

## Task 1 : Migration SQL — ajout des colonnes

**Files:**
- Create: `backend/supabase/migrations/20260323000002_add_spot_enrichment_columns.sql`

- [ ] **Step 1 : Créer le fichier migration**

```sql
-- Nouvelles colonnes pour l'enrichissement des spots
ALTER TABLE spots ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE spots ADD COLUMN IF NOT EXISTS wave_type text;
ALTER TABLE spots ADD COLUMN IF NOT EXISTS bottom_type text;
ALTER TABLE spots ADD COLUMN IF NOT EXISTS difficulty text[];
ALTER TABLE spots ADD COLUMN IF NOT EXISTS ideal_swell_direction text[];
ALTER TABLE spots ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE spots ADD COLUMN IF NOT EXISTS surfline_id text;

-- Index unique pour dédoublonnage idempotent
CREATE UNIQUE INDEX IF NOT EXISTS idx_spots_surfline_id ON spots(surfline_id) WHERE surfline_id IS NOT NULL;
```

- [ ] **Step 2 : Exécuter la migration sur Supabase**

L'utilisateur devra exécuter ce SQL dans le Supabase SQL Editor (le backend utilise la service key mais ne peut pas ALTER TABLE via le SDK JS).

- [ ] **Step 3 : Commit**

```bash
cd "/Users/imac/ANTIGRAVITY x CLAUDE/surfai"
git add backend/supabase/migrations/20260323000002_add_spot_enrichment_columns.sql
git commit -m "migration: ajout colonnes enrichissement spots (country, wave_type, difficulty, surfline_id)"
```

---

## Task 2 : Script d'import — structure de base + crawl taxonomy

**Files:**
- Create: `backend/scripts/import-spots.js`

**Context:** Le script doit crawler l'API Surfline Taxonomy récursivement pour trouver tous les spots de France, Espagne, Portugal et Maroc. Il utilise la service key Supabase pour écrire.

- [ ] **Step 1 : Créer le script avec les utilitaires de base**

```javascript
#!/usr/bin/env node
/**
 * Import spots from Surfline API into Supabase
 * Usage: node backend/scripts/import-spots.js
 */

const { createClient } = require('@supabase/supabase-js');
const https = require('https');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const EARTH_ID = '58f7ed51dadb30820bb38782';
const TARGET_COUNTRIES = ['france', 'spain', 'portugal', 'morocco'];
const SLEEP_TAXONOMY = 200;
const SLEEP_MAPVIEW = 300;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'SurfAI/1.0' } }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error(`JSON parse error: ${e.message}`)); }
            });
        }).on('error', reject);
    });
}

function degreesToCardinal(deg) {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(deg / 45) % 8];
}

function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function normalizeName(name) {
    return name
        .toLowerCase()
        .trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/^(plage de |praia da |praia de |praia do |beach |playa de |playa )/i, '');
}

function namesMatch(a, b) {
    const na = normalizeName(a);
    const nb = normalizeName(b);
    return na === nb || na.includes(nb) || nb.includes(na);
}
```

- [ ] **Step 2 : Ajouter le crawl taxonomy récursif**

```javascript
async function crawlTaxonomy(parentId, depth = 0, context = {}) {
    await sleep(SLEEP_TAXONOMY);
    const url = `https://services.surfline.com/taxonomy?type=taxonomy&id=${parentId}&maxDepth=1`;
    let data;
    try {
        data = await fetchJSON(url);
    } catch (err) {
        console.warn(`  [WARN] Taxonomy fetch failed for ${parentId}: ${err.message}`);
        return [];
    }

    const spots = [];
    const contains = data.contains || [];

    for (const item of contains) {
        const name = item.name || '';
        const type = item.type || '';
        const coords = item.location?.coordinates; // [lng, lat] GeoJSON
        const id = item._id;

        // Build context from crawl hierarchy
        const newContext = { ...context };
        if (depth === 1) newContext.continent = name;
        if (depth === 2) newContext.country = name;
        if (depth === 3) newContext.region = name;
        if (depth === 4) newContext.city = name;

        if (type === 'spot' && coords && coords.length === 2) {
            spots.push({
                surfline_id: id,
                name: name,
                lat: coords[1],
                lng: coords[0],
                country: newContext.country || null,
                region: newContext.region || newContext.city || null,
                city: newContext.city || newContext.region || null,
            });
        } else if (type !== 'spot') {
            // Check if this branch leads to our target countries
            const nameLower = name.toLowerCase();
            if (depth < 2 || TARGET_COUNTRIES.some(c => nameLower.includes(c))) {
                const children = await crawlTaxonomy(id, depth + 1, newContext);
                spots.push(...children);
            }
        }
    }

    return spots;
}
```

- [ ] **Step 3 : Vérifier que le crawl fonctionne**

```bash
cd "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/backend"
node -e "
const https = require('https');
https.get('https://services.surfline.com/taxonomy?type=taxonomy&id=58f7ed51dadb30820bb38782&maxDepth=1', res => {
    let d=''; res.on('data',c=>d+=c); res.on('end',()=>{
        const j=JSON.parse(d);
        console.log('Contains:', j.contains?.map(c=>c.name).join(', '));
    });
});
"
```

Expected: liste des continents (Europe, North America, etc.)

- [ ] **Step 4 : Commit**

```bash
cd "/Users/imac/ANTIGRAVITY x CLAUDE/surfai"
git add backend/scripts/import-spots.js
git commit -m "feat(import): script import spots — structure + crawl taxonomy Surfline"
```

---

## Task 3 : Enrichissement mapview + dédoublonnage + upsert

**Files:**
- Modify: `backend/scripts/import-spots.js`

**Context:** Compléter le script avec l'appel mapview par région, le matching avec les spots existants, et l'upsert dans Supabase.

- [ ] **Step 1 : Ajouter l'enrichissement mapview**

```javascript
async function enrichWithMapview(spots) {
    // Grouper les spots par région pour minimiser les appels
    const byRegion = {};
    for (const spot of spots) {
        const key = `${spot.country}|${spot.region}`;
        if (!byRegion[key]) byRegion[key] = [];
        byRegion[key].push(spot);
    }

    console.log(`\nEnrichissement mapview pour ${Object.keys(byRegion).length} régions...`);
    let enriched = 0;

    for (const [regionKey, regionSpots] of Object.entries(byRegion)) {
        // Bounding box from all spots in this region
        const lats = regionSpots.map(s => s.lat);
        const lngs = regionSpots.map(s => s.lng);
        const bbox = {
            south: Math.min(...lats) - 0.05,
            north: Math.max(...lats) + 0.05,
            west: Math.min(...lngs) - 0.05,
            east: Math.max(...lngs) + 0.05,
        };

        await sleep(SLEEP_MAPVIEW);
        const url = `https://services.surfline.com/kbyg/mapview?south=${bbox.south}&west=${bbox.west}&north=${bbox.north}&east=${bbox.east}`;
        try {
            const data = await fetchJSON(url);
            const mapSpots = data.data?.spots || [];

            for (const ms of mapSpots) {
                // Match mapview spot to taxonomy spot by surfline_id or proximity
                const match = regionSpots.find(s =>
                    s.surfline_id === ms._id ||
                    (haversineDistance(s.lat, s.lng, ms.lat, ms.lon) < 200)
                );
                if (match) {
                    if (ms.abilityLevels?.length) {
                        match.difficulty = ms.abilityLevels.map(l => l.toLowerCase());
                    }
                    if (ms.offshoreDirection != null) {
                        match.ideal_wind_from_surfline = [degreesToCardinal(ms.offshoreDirection)];
                    }
                    enriched++;
                }
            }
        } catch (err) {
            console.warn(`  [WARN] Mapview failed for ${regionKey}: ${err.message}`);
        }
    }

    console.log(`  Enrichis: ${enriched}/${spots.length} spots`);
    return spots;
}
```

- [ ] **Step 2 : Ajouter le dédoublonnage et upsert**

```javascript
async function importToSupabase(spots) {
    // Charger spots existants
    const { data: existing, error } = await supabase
        .from('spots')
        .select('id, name, lat, lng, surfline_id, ideal_wind, ideal_swell, ideal_tide, shom_port_code');
    if (error) { console.error('Failed to load existing spots:', error.message); return; }

    console.log(`\nSpots existants: ${existing.length}`);
    console.log(`Spots à importer: ${spots.length}`);

    let imported = 0, updated = 0, errors = 0;

    for (let i = 0; i < spots.length; i++) {
        const spot = spots[i];
        const progress = `[${i+1}/${spots.length}]`;

        // Find existing match
        let match = null;
        if (spot.surfline_id) {
            match = existing.find(e => e.surfline_id === spot.surfline_id);
        }
        if (!match) {
            match = existing.find(e =>
                namesMatch(e.name, spot.name) &&
                haversineDistance(e.lat, e.lng, spot.lat, spot.lng) < 500
            );
        }

        // Build upsert data
        const data = {
            name: spot.name,
            lat: spot.lat,
            lng: spot.lng,
            country: spot.country,
            region: spot.region,
            city: spot.city,
            surfline_id: spot.surfline_id,
        };
        if (spot.difficulty?.length) data.difficulty = spot.difficulty;
        if (spot.ideal_wind_from_surfline?.length && (!match || !match.ideal_wind?.length)) {
            data.ideal_wind = spot.ideal_wind_from_surfline;
        }

        try {
            if (match) {
                // UPDATE — preserve existing manual data
                const { error: upErr } = await supabase
                    .from('spots')
                    .update(data)
                    .eq('id', match.id);
                if (upErr) throw upErr;
                console.log(`${progress} Updated: ${spot.name} (${spot.city}, ${spot.country})`);
                updated++;
            } else {
                // INSERT
                const { error: insErr } = await supabase
                    .from('spots')
                    .insert(data);
                if (insErr) throw insErr;
                console.log(`${progress} Imported: ${spot.name} (${spot.city}, ${spot.country})`);
                imported++;
            }
        } catch (err) {
            console.error(`${progress} ERROR: ${spot.name}: ${err.message}`);
            errors++;
        }
    }

    console.log(`\n========== RÉSUMÉ ==========`);
    console.log(`Importés:  ${imported}`);
    console.log(`Mis à jour: ${updated}`);
    console.log(`Erreurs:   ${errors}`);
    console.log(`Total:     ${spots.length}`);
}
```

- [ ] **Step 3 : Ajouter la fonction main**

```javascript
async function main() {
    console.log('🏄 SurfAI — Import Spots Surfline');
    console.log('Pays cibles: France, Spain, Portugal, Morocco\n');

    console.log('1/3 Crawl taxonomy Surfline...');
    const spots = await crawlTaxonomy(EARTH_ID);
    console.log(`   → ${spots.length} spots trouvés`);

    if (spots.length === 0) {
        console.error('Aucun spot trouvé. Vérifiez la connexion.');
        process.exit(1);
    }

    console.log('\n2/3 Enrichissement mapview...');
    await enrichWithMapview(spots);

    console.log('\n3/3 Import dans Supabase...');
    await importToSupabase(spots);

    console.log('\n✅ Import terminé');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
```

- [ ] **Step 4 : Tester le crawl taxonomy (dry run)**

```bash
cd "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/backend"
# Tester juste le crawl sans import
node -e "
require('dotenv').config();
const script = require('./scripts/import-spots.js');
" 2>&1 | head -50
```

- [ ] **Step 5 : Commit**

```bash
cd "/Users/imac/ANTIGRAVITY x CLAUDE/surfai"
git add backend/scripts/import-spots.js
git commit -m "feat(import): enrichissement mapview + dédoublonnage + upsert Supabase"
```

---

## Task 4 : Exécuter l'import

**Prérequis :** L'utilisateur a exécuté la migration SQL (Task 1 Step 2) dans Supabase SQL Editor.

- [ ] **Step 1 : Vérifier que les colonnes existent**

```bash
cd "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/backend"
node -e "
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
sb.from('spots').select('id, country, surfline_id, difficulty').limit(1).then(({data,error}) => {
    if (error) console.error('COLONNES MANQUANTES:', error.message);
    else console.log('OK — colonnes présentes:', Object.keys(data[0] || {}));
});
"
```

- [ ] **Step 2 : Lancer l'import complet**

```bash
cd "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/backend"
node scripts/import-spots.js
```

Expected: ~500-800 spots importés, progression affichée, résumé final.

- [ ] **Step 3 : Vérifier le résultat**

```bash
node -e "
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
sb.from('spots').select('country', { count: 'exact', head: true }).then(({count}) => console.log('Total spots:', count));
sb.from('spots').select('country').then(({data}) => {
    const counts = {};
    data.forEach(s => { counts[s.country || 'null'] = (counts[s.country || 'null'] || 0) + 1; });
    console.log('Par pays:', counts);
});
"
```

- [ ] **Step 4 : Commit final**

```bash
cd "/Users/imac/ANTIGRAVITY x CLAUDE/surfai"
git add -A
git commit -m "feat(import): import réussi — X spots FR/ES/PT/MA dans Supabase"
```

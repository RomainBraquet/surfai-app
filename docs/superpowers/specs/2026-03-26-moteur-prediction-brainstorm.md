# Brainstorm Moteur de Prédiction SurfAI

**Date :** 26 mars 2026
**Objectif :** Analyse complète du moteur de prédiction actuel, comparaison concurrentielle, et plan pour devenir la référence en prévision surf personnalisée.

---

## PARTIE 1 — Où on en est

### Ce qui existe déjà (et qui est solide)

Le backend a déjà un moteur de scoring composite assez avancé :

**`scorer.js`** — Score composite 0-10 avec 5 facteurs pondérés :
- **Vent** (30%) : paliers de vitesse (0-10 km/h → score 10, 20 → 8, 30 → 5, 40+ → 0) + bonus direction idéale du spot
- **Vagues** (20%) : courbe en cloche centrée sur les préférences du surfeur (min/max wave height)
- **Période** (15%) : échelle à paliers (15s+ → 10, 12s → 8.5, 8s → 6)
- **Historique** (20% progressif) : k-NN sur les sessions passées — trouve les 5 sessions les plus similaires aux conditions actuelles, moyenne pondérée de leurs notes
- **Spot** (15%) : alignement vent/houle avec les directions idéales du spot + bonus marée (±0.5)

**Points forts actuels :**
- Poids adaptatifs : l'historique monte de 10% → 20% à mesure que l'utilisateur enregistre des sessions
- k-NN intelligent : utilise la distance euclidienne 3D (vagues, vent, période) normalisée
- Suggestion de board basée sur les boards utilisées dans des conditions similaires
- Narratives personnalisées ("Rappelle ta session du 15 mars ici — ★★★★★")
- Groupement par demi-journée avec fenêtres de surf ("9h-11h")

### Ce qui manque cruellement

**1. Pas de données marines de base fiables**
- Stormglass free tier = 10 appels/jour → on peut analyser max 3 spots
- Pas de fallback prévision (Open-Meteo = conditions actuelles uniquement, pas de forecast)
- Les marées sont calculées de 3 façons différentes selon le service → incohérent

**2. 3 systèmes de scoring coexistent**
- `scorer.js` (0-10, le plus avancé) — branché sur `/predictions/*`
- `predictionService.js` (1-5, plus basique) — branché sur `/weather/forecast`
- `smartSessionsService.js` (bonus multiplicatifs par créneau) — branché sur `/weather/smart-slots`
- **Résultat :** selon la route appelée, le score est différent pour les mêmes conditions

**3. Le scoring de base est trop grossier**
- Vent : paliers au lieu d'une courbe continue → un vent de 10.1 km/h passe de 10 à 8 d'un coup
- Période : pas d'interaction avec la taille de vague (longue période + petites vagues ≠ bon)
- Direction offshore : calculée mais sous-exploitée dans le score
- Direction de houle vs orientation du spot : partiellement intégré

**4. Pas de marée dans le scoring visible**
- Le bonus marée est de ±0.5 points sur 10 → négligeable
- Or sur le Pays Basque, la marée change TOUT : La Côte des Basques n'est surfable qu'à marée basse, La Gravière est dangereuse à marée haute
- C'est LA faiblesse majeure vs Yadusurf

**5. Pas d'explication "pourquoi"**
- Le score sort un nombre (7.2/10) mais pas d'explication lisible
- L'utilisateur ne comprend pas pourquoi c'est "Bon" ou "Excellent"
- Manque : "Bon pour toi parce que : vagues 1.4m dans ta zone + offshore léger + période 12s"

**6. Pas d'intelligence collective**
- Chaque utilisateur est isolé
- Quand 10 surfeurs notent 5/5 le même jour au même spot, on ne l'exploite pas
- Pas de "profil de spot" construit à partir des données communautaires

---

## PARTIE 2 — Ce que font les concurrents

### Yadusurf (leader France)
- **Étoiles 1-5** par créneau horaire
- Tableau heure par heure : houle, période, direction, vent, marée
- **Webcams** en direct (gros avantage)
- Couverture dense Pays Basque / Landes
- **Faiblesses** : interface datée, pas de personnalisation, même prévision pour un débutant et un expert, pub envahissante

### Surfline (leader mondial)
- Modèle propriétaire **LOLA** qui modélise la bathymétrie locale
- Forecasters humains qui ajustent les prévisions machine
- Rating texte (FLAT → EPIC) + couleurs
- **Faiblesses** : payant (100€/an), couverture France limitée, pas personnalisé, biaisé vers les spots US

### Windguru (référence technique)
- Données brutes ultra-complètes, multi-modèles (GFS, ECMWF, ICON)
- **Aucune aide à la décision** — il faut être expert pour interpréter
- **Aucun scoring** — pas de "c'est bon ou pas"

### MSW (racheté par Surfline)
- Étoiles 0-5 avec algo basé sur houle/vent/direction
- **Ne prenait PAS la marée en compte** dans le scoring (critique !)

### CE QUE PERSONNE NE FAIT
1. **Personnalisation par niveau/profil** — PERSONNE
2. **Recommandation "où surfer aujourd'hui"** — PERSONNE (il faut checker spot par spot)
3. **Apprentissage des préférences** via sessions passées — PERSONNE
4. **Board suggestion** — PERSONNE
5. **Narratives explicatives** ("bon pour toi parce que...") — PERSONNE

---

## PARTIE 3 — Comment devenir incontournable

### Stratégie en 3 couches

```
COUCHE 1 : Base solide (ce que font les concurrents, mais en mieux)
    → Score de qualité fiable, marées intégrées, données précises

COUCHE 2 : Personnalisation (notre avantage unique)
    → Score adapté au profil, apprentissage par sessions, board suggestion

COUCHE 3 : Communauté (notre moat long terme)
    → Intelligence collective, profils de spots, recommandation de spots inconnus
```

### COUCHE 1 — Score de base amélioré

**Vent : courbe continue au lieu de paliers**
```
Actuel : 0-10→10, 10-20→8, 20-30→5 (sauts brusques)
Proposé : score = 10 × exp(-(vitesse/25)²)
→ 0 km/h → 10, 10 → 8.5, 15 → 7.0, 20 → 5.3, 30 → 2.4, 40 → 0.8
```

**Direction offshore : scoring continu**
```
Écart vent/houle > 150° → offshore pur → bonus +2.0
120-150° → cross-offshore → bonus +1.5
60-120° → cross-shore → neutre
30-60° → cross-onshore → malus -1.0
< 30° → onshore pur → malus -1.5
```

**Période : courbe sigmoïde au lieu de paliers**
```
score = 2 + 8 / (1 + exp(-0.6 × (période - 10)))
→ 5s → 2.4, 8s → 4.4, 10s → 6.0, 12s → 7.6, 14s → 8.8
```

**Marée : poids BEAUCOUP plus important**
```
Actuel : ±0.5 points (négligeable)
Proposé : ±1.5 points (significatif)
+ Intégrer le type de break :
  - Reef break + marée basse → +1.0
  - Beach break + mi-marée → +0.5
  - Spot dangereux + marée haute → -2.0 (sécurité)
```

**Poids recommandés :**
| Facteur | Actuel | Proposé |
|---------|--------|---------|
| Vent | 0.30 | **0.30** |
| Vagues | 0.20 | **0.25** |
| Période | 0.15 | **0.20** |
| Spot (direction) | 0.15 | **0.10** |
| Historique | 0.20 | **0.15** (monte à 0.25 avec data) |
| Marée | ±0.5 bonus | **inclus dans le poids principal** |

### COUCHE 2 — Personnalisation

**Avec 5-10 sessions (k-NN amélioré) :**
- Ajouter une décroissance temporelle : les sessions récentes comptent plus (demi-vie 6 mois)
- Bonus si même spot : les sessions au même spot sont 30% plus pertinentes
- Inclure les sessions 1-5 (pas seulement 4+) → apprendre aussi des mauvaises sessions

**Avec 30+ sessions (poids appris) :**
- Régression linéaire simple pour apprendre les poids individuels
- Le système découvre que tel surfeur est plus sensible au vent qu'à la taille de vague
- Les poids appris remplacent progressivement les poids par défaut

**Board suggestion enrichie :**
- Utiliser le sweet spot déclaré de la board (houle min/max, marée) → match immédiat
- Fallback sur k-NN des sessions passées avec cette board
- Afficher : "Prends ton fish 5'8 — idéale pour 1-1.5m + période longue"

**Question post-session "C'était la bonne board ?" :**
- Données les plus précieuses pour le ML
- Simple oui/non + si non, "laquelle tu aurais préféré ?"
- Stocker dans `sessions.felt_adapted` (colonne à ajouter)

### COUCHE 3 — Communauté

**Profils de spots automatiques :**
- Job quotidien : agréger toutes les sessions par spot
- Calculer les conditions moyennes des sessions 4+ et des sessions 1-2
- Résultat : "Ce spot marche le mieux avec houle 1.2m, vent < 12 km/h, marée basse"

**Journées magiques :**
- Détecter quand 3+ utilisateurs notent 4+ le même jour au même spot
- Ces journées deviennent du "ground truth" pour calibrer le scoring
- Afficher : "12 surfeurs ont noté cette journée 5/5 ici"

**Recommandation de spots inconnus (collaborative filtering) :**
- Trouver les surfeurs au profil similaire (mêmes spots, mêmes notes)
- Recommander les spots qu'ils ont aimés mais que tu n'as pas essayés
- "Les surfeurs comme toi adorent Cenitz — essaie-le !"

---

## PARTIE 4 — Affichage et UX des prédictions

### Score affiché

```
8.5-10  → ★★★★★  Vert vif    "Exceptionnel — Fonce !"
7.0-8.4 → ★★★★☆  Vert        "Excellent — Go !"
5.5-6.9 → ★★★☆☆  Jaune-vert  "Bon — Session sympa"
4.0-5.4 → ★★☆☆☆  Orange      "Correct — Ça passe"
0-3.9   → ★☆☆☆☆  Rouge       "À éviter"
```

### Card de prévision idéale

```
┌─────────────────────────────────────────┐
│  ★★★★☆  EXCELLENT        Demain 9h-11h │
│  Côte des Basques · Biarritz            │
│                                          │
│  🌊 1.4m  💨 8km/h SE  ⏱ 12s  🌙 ↗    │
│                                          │
│  ✅ Vagues parfaites pour toi (1.4m)    │
│  ✅ Offshore léger — vagues propres     │
│  ✅ Période longue = vagues puissantes  │
│  ⚠️  Marée haute à 10h30 — surfe avant │
│                                          │
│  🏄 Board : Fish 5'8                    │
│  💬 "Conditions similaires à ta session │
│      du 15 mars — ★★★★★"                │
└─────────────────────────────────────────┘
```

### Smart Spot Selector (la killer feature)

Au lieu de : "voici les prévisions du spot que tu regardes"
→ **"Voici le MEILLEUR spot pour toi aujourd'hui"**

```
Où surfer aujourd'hui ?

1. 🥇 Côte des Basques  ★★★★☆ (8.2)  9h-11h
   "Ton meilleur créneau de la semaine"

2. 🥈 Ilbaritz           ★★★★☆ (7.8)  7h-10h
   "Conditions similaires mais plus de monde"

3. 🥉 Lafitenia          ★★★☆☆ (6.5)  14h-16h
   "L'après-midi si le matin ne te va pas"
```

---

## PARTIE 5 — Pipeline de données

### Sources actuelles et limites

| Source | Données | Coût | Limite actuelle |
|--------|---------|------|-----------------|
| Stormglass | Vagues, vent, houle, temp, marées | 10 appels/jour gratuit | Insuffisant pour 5 spots |
| Open-Meteo | Vent, vagues basiques | Gratuit illimité | Pas de forecast marine |
| SHOM | Marées françaises | Gratuit | France uniquement |

### Stratégie recommandée

**Court terme (maintenant) :**
- Open-Meteo Marine API a un endpoint **forecast** (pas que current) → l'utiliser comme source principale gratuite
- Stormglass gardé pour les spots favoris (données plus précises)
- Rafraîchir 1×/jour à 5h du matin (avant la dawn patrol)

**Moyen terme (quand Stormglass payant activé) :**
- Stormglass pour tous les spots favoris (5-10 spots)
- Open-Meteo en fallback
- Cache dans Supabase (pas en mémoire — persiste entre redémarrages)

### Ce qu'il faut cacher vs calculer live

| Cacher | Calculer live |
|--------|---------------|
| Données brutes forecast (6-12h) | Score composite (< 1ms/slot) |
| Profils communautaires de spots (1x/jour) | Narratives et suggestions board |
| Poids appris utilisateur (quand nouvelle session) | Comparaison avec sessions passées |
| Marées (1x/jour, très prévisibles) | Classement des fenêtres |

---

## PARTIE 6 — Plan d'action concret

### Phase 1 — Nettoyage et base solide (immédiat)

1. **Unifier les 3 systèmes de scoring** → tout sur scorer.js
2. **Améliorer les formules** : vent continu, période sigmoïde, offshore graduel
3. **Augmenter le poids marée** par spot (surtout Pays Basque)
4. **Ajouter `buildWhyGood()`** : explications lisibles pour chaque prédiction
5. **Exploiter Open-Meteo Marine forecast** comme source gratuite

### Phase 2 — Personnalisation (après 2-3 semaines d'usage)

6. Décroissance temporelle dans le k-NN historique
7. Sweet spot des boards dans la suggestion
8. Question post-session "C'était la bonne board ?"
9. Poids appris quand 30+ sessions

### Phase 3 — Communauté (quand 50+ utilisateurs actifs)

10. Job quotidien profils de spots
11. Détection journées magiques
12. Collaborative filtering recommandation de spots

---

## PARTIE 7 — Le positionnement gagnant

**Yadusurf** = "Regarde les étoiles et interprète toi-même"
**Surfline** = "Paie 100€/an pour un modèle américain"
**Windguru** = "Voici toutes les données brutes, démerde-toi"

**SurfAI** = **"On te dit exactement où, quand, et avec quelle board"**

La promesse : "Plus tu surfes, plus je te connais, plus je suis précis."

C'est imbattable parce que :
1. Les données de sessions sont un moat — personne d'autre ne les a
2. L'intelligence collective rend le système meilleur avec chaque nouvel utilisateur
3. La personnalisation par board est unique — aucun concurrent ne sait quelle planche tu as

Les concurrents vendent des données météo. **SurfAI vend des décisions.**

# Spec — Mes Boards (Le Quiver)

## Positionnement

Le quiver est l'identité du surfeur. C'est aussi le carburant le plus différenciant pour l'IA — aucun concurrent ne collecte cette donnée. Chaque feature doit renforcer le "sur-mesure" et préparer la "communauté".

---

## Page "Mes Boards" — Structure

### En-tête
- Titre "Mes boards" + compteur
- Bouton "← Profil" pour revenir
- Bouton "+ Ajouter une board"

### Liste des boards (cards)

Chaque board = une carte visuelle :

```
┌─────────────────────────────────┐
│  [PHOTO]        Nom custom      │
│                 6'2 × 20.5 × 2.5│
│                 Volume : 32L    │
│                 Shortboard      │
│  Shaper : Pukas                 │
│  Setup : Thruster / Squash      │
│                                 │
│  ★ Sweet spot : 1-2m offshore   │
│  📊 12 sessions · il y a 3j    │
│                                 │
│  [✏️ Edit] [📤 Partager] [🗑️]  │
└─────────────────────────────────┘
```

### Champs d'une board

**Obligatoires :**
- Nom custom (ex: "La Bleue", "Mon fish")
- Type : shortboard / fish / midlength / longboard / gun / funboard / hybrid / foil / SUP
- Taille (pieds/pouces, ex: 6'2)

**Recommandés :**
- Photo (upload depuis galerie)
- Volume (litres) — feature #1 du ML
- Largeur (pouces)
- Épaisseur (pouces)
- Fins setup : thruster / twin / quad / single / 2+1 / 5-box
- Tail shape : squash / swallow / pin / round / diamond
- Sweet spot conditions : houle min/max, vent préféré (offshore/onshore/peu importe), marée (haute/basse/peu importe)

**Optionnels :**
- Shaper / Marque
- Année
- État : neuf / bon / usé / à réparer

### Shaper / Marque

Chaque board peut avoir un **shaper** et/ou une **marque** :
- Champ texte libre (pas de base de données shapers pour le MVP)
- Si renseigné, affiché sur la carte avec une icône 🔨
- Prépare le terrain pour l'annuaire shapers futur : quand on aura assez de données, on pourra générer automatiquement des fiches shapers à partir des boards enregistrées par la communauté
- Lien futur : "X surfeurs SurfAI surfent une board de ce shaper"

---

## Partage social — 3 modes

Quand l'utilisateur clique "📤 Partager" sur une board, un overlay propose 3 options :

### Option 1 — "Montrer ma board" (Flex)
**Intention :** fierté, partage lifestyle
**Card générée :**
```
┌─────────────────────────────────┐
│         [PHOTO BOARD]           │
│                                 │
│    "La Bleue" — 6'2 Shortboard  │
│    Shaper : Pukas               │
│    32L · Thruster · Squash      │
│                                 │
│    📊 12 sessions · ⭐ 4.2 moy  │
│    🌊 Sweet spot : 1-2m offshore│
│                                 │
│         SurfAI 🏄               │
└─────────────────────────────────┘
```
**CTA :** Partager sur Instagram Story
**Ton :** fier, lifestyle, "regarde ma planche"

### Option 2 — "Vendre ma board" (Marketplace)
**Intention :** vente / échange
**Card générée :**
```
┌─────────────────────────────────┐
│         [PHOTO BOARD]           │
│                                 │
│  À VENDRE                       │
│  "La Bleue" — 6'2 Shortboard   │
│  Shaper : Pukas · 32L          │
│  État : Bon                     │
│  📍 Biarritz                    │
│                                 │
│  💬 Me contacter sur SurfAI     │
│         SurfAI 🏄               │
└─────────────────────────────────┘
```
**Champs supplémentaires demandés avant partage :**
- Prix souhaité (€)
- Localisation (ville)
- Message perso optionnel ("vendue car j'ai changé de niveau")
**CTA :** Partager sur Instagram Story
**Ton :** transactionnel, clair, confiance

### Option 3 — "Réparer ma board" (Shaper/réparateur)
**Intention :** trouver un réparateur ou partager le besoin
**Card générée :**
```
┌─────────────────────────────────┐
│         [PHOTO BOARD]           │
│                                 │
│  🔧 BESOIN DE RÉPARATION       │
│  "La Bleue" — 6'2 Shortboard   │
│  Shaper : Pukas                 │
│  📍 Biarritz                    │
│                                 │
│  "Ding sur le nose, besoin d'un │
│   repair rapide"                │
│                                 │
│  💬 Contactez-moi sur SurfAI    │
│         SurfAI 🏄               │
└─────────────────────────────────┘
```
**Champs supplémentaires demandés :**
- Description du problème (texte libre)
- Localisation (ville)
- Urgence : tranquille / rapide / urgent
**CTA :** Partager sur Instagram Story
**Ton :** pratique, entraide communautaire
**Futur :** quand l'annuaire shapers/réparateurs existera, proposer directement des contacts locaux

---

## Formulaire d'ajout / édition

### Étape 1 — L'essentiel
- Nom custom
- Photo (bouton upload, skip possible)
- Type (select)
- Taille (input texte, ex: "6'2")

### Étape 2 — Les détails
- Volume (litres)
- Largeur / Épaisseur
- Fins setup (select)
- Tail shape (select)
- Shaper / Marque
- Année
- État

### Étape 3 — Sweet spot (conditions idéales)
- "Dans quelles conditions tu la sors ?"
- Houle min / max (sliders ou inputs)
- Vent : offshore / onshore / peu importe (chips)
- Marée : haute / basse / mi-marée / peu importe (chips)

Le formulaire est en une seule page scrollable (pas de wizard multi-étapes), avec les sections clairement séparées. Les champs optionnels sont visibles mais pas bloquants.

---

## Lien avec les sessions

- Dans le formulaire session, le sélecteur board devient un dropdown déroulant (même style que le spot picker dans profil — affiche les boards avec nom + type + taille)
- Après enregistrement d'une session : notification légère "C'était la bonne board ?" → oui/non (stocké comme `felt_adapted`)
- Sur la fiche board : compteur de sessions + dernière sortie

---

## Données collectées pour le ML (stockées maintenant, exploitées plus tard)

### Table `boards`
- id, user_id, nickname, type, length_ft, width_in, thickness_in, volume_L
- tail_shape, fins_setup, rocker (low/medium/high)
- shaper, brand, year_made, condition
- sweet_spot_wave_min, sweet_spot_wave_max
- sweet_spot_wind (offshore/onshore/any)
- sweet_spot_tide (high/low/mid/any)
- photo_url, is_active, created_at

### Enrichissement table `sessions`
- board_id (FK) — déjà existant
- felt_adapted (boolean) — nouveau
- would_change_board (boolean) — nouveau (V2)

---

## Ce qu'on NE fait PAS en V1
- Annuaire shapers (on collecte juste le nom)
- Marketplace in-app (on partage vers l'extérieur)
- Intelligence collective ("surfeurs similaires utilisent...")
- Recommandation IA board du jour (règles expertes = V2)
- Fiche shaper enrichie
- Comparaison de quivers entre surfeurs

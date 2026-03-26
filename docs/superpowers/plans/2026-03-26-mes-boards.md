# Mes Boards (Le Quiver) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer la page "Mes Boards" complète avec cards visuelles, formulaire enrichi, partage Instagram 3 modes, et données ML prêtes.

**Architecture:** Tout en local dans `apps/web/index.html` (vanilla JS). Les données boards passent par Supabase (table `boards` enrichie) avec fallback localStorage. Le partage Instagram génère une card canvas exportée en image.

**Tech Stack:** HTML/CSS/JS vanilla, Supabase (storage pour photos, table boards), Canvas API (génération cards partage)

---

## Task 1 : Migration Supabase — enrichir la table boards

**Files:**
- Create: `backend/supabase/migrations/20260326000001_enrich_boards_table.sql`

- [ ] **Step 1: Écrire la migration SQL**

```sql
-- Enrichir la table boards avec les nouveaux champs
ALTER TABLE boards ADD COLUMN IF NOT EXISTS nickname TEXT;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS length_ft TEXT;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS width_in TEXT;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS thickness_in TEXT;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS volume_l REAL;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS tail_shape TEXT;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS fins_setup TEXT;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS year_made INTEGER;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS condition TEXT DEFAULT 'bon';
ALTER TABLE boards ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS sweet_spot_wave_min REAL;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS sweet_spot_wave_max REAL;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS sweet_spot_wind TEXT DEFAULT 'any';
ALTER TABLE boards ADD COLUMN IF NOT EXISTS sweet_spot_tide TEXT DEFAULT 'any';
ALTER TABLE boards ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Migrer les données existantes : copier 'name' vers 'nickname' et 'size' vers 'length_ft'
UPDATE boards SET nickname = name WHERE nickname IS NULL;
UPDATE boards SET length_ft = size WHERE length_ft IS NULL;
```

- [ ] **Step 2: Exécuter la migration dans Supabase**

Aller sur le dashboard Supabase → SQL Editor → coller et exécuter.

- [ ] **Step 3: Commit**

```bash
git add backend/supabase/migrations/20260326000001_enrich_boards_table.sql
git commit -m "db: enrichir table boards — nouveaux champs ML et sweet spot"
```

---

## Task 2 : Formulaire d'ajout de board enrichi

**Files:**
- Modify: `apps/web/index.html` — fonction `loadBoardsTab()`

Remplacer le formulaire actuel (4 champs) par le formulaire complet en 3 sections :

- [ ] **Step 1: Réécrire le formulaire dans `loadBoardsTab()`**

Section 1 — L'essentiel :
- Nom custom (input text)
- Photo (bouton upload)
- Type (select : shortboard/fish/midlength/longboard/gun/funboard/hybrid/foil/SUP)
- Taille (input text, placeholder "6'2")

Section 2 — Les détails :
- Volume L (number)
- Largeur pouces (text)
- Épaisseur pouces (text)
- Fins setup (select)
- Tail shape (select)
- Shaper (text)
- Marque (text)
- Année (number)
- État (select : neuf/bon/usé/à réparer)

Section 3 — Sweet spot :
- Label "Dans quelles conditions tu la sors ?"
- Houle min/max (number inputs sur même ligne)
- Vent (chips : offshore/onshore/peu importe)
- Marée (chips : haute/basse/mi-marée/peu importe)

- [ ] **Step 2: Mettre à jour `addBoard()` pour envoyer tous les champs**

Modifier la fonction pour collecter tous les champs et les envoyer à Supabase.

- [ ] **Step 3: Mettre à jour `saveUserBoard()` dans dataManager**

Ajouter tous les nouveaux champs dans l'insert Supabase.

- [ ] **Step 4: Tester — ajouter une board avec tous les champs**

Vérifier dans Supabase que les données sont bien stockées.

- [ ] **Step 5: Commit**

```bash
git add apps/web/index.html index.html
git commit -m "feat(boards): formulaire enrichi — photo, volume, fins, sweet spot"
```

---

## Task 3 : Cards visuelles des boards

**Files:**
- Modify: `apps/web/index.html` — fonction `loadBoardsTab()`

- [ ] **Step 1: Réécrire le rendu des cards dans `loadBoardsTab()`**

Chaque board affiche :
- Photo (ou placeholder icône par type) à gauche
- Nom + dimensions + volume + type à droite
- Shaper/marque
- Fins setup + tail shape
- Sweet spot résumé (1 ligne)
- Stats : nombre sessions + dernière sortie
- 3 boutons : ✏️ Edit · 📤 Partager · 🗑️ Supprimer

- [ ] **Step 2: Compter les sessions par board**

Lire `userData.sessions` et compter celles qui ont le `board_id` correspondant. Afficher "X sessions · dernière il y a Yj".

- [ ] **Step 3: Tester le rendu visuel**

Vérifier sur http://localhost:8080 que les cards s'affichent correctement.

- [ ] **Step 4: Commit**

```bash
git add apps/web/index.html index.html
git commit -m "feat(boards): cards visuelles avec photo, stats sessions, sweet spot"
```

---

## Task 4 : Formulaire d'édition de board

**Files:**
- Modify: `apps/web/index.html` — fonctions `editBoard()` et `saveBoard()`

- [ ] **Step 1: Réécrire `editBoard()` avec tous les champs**

Le formulaire d'édition inline doit reprendre les mêmes champs que l'ajout, pré-remplis avec les valeurs actuelles. Inclure la photo actuelle avec option de la changer.

- [ ] **Step 2: Mettre à jour `saveBoard()` pour envoyer tous les champs**

L'update Supabase doit inclure tous les nouveaux champs.

- [ ] **Step 3: Tester — modifier une board existante**

Vérifier que les modifications sont bien sauvegardées.

- [ ] **Step 4: Commit**

```bash
git add apps/web/index.html index.html
git commit -m "feat(boards): édition complète avec tous les champs enrichis"
```

---

## Task 5 : Upload photo de board

**Files:**
- Modify: `apps/web/index.html` — nouvelle fonction `uploadBoardPhoto()`

- [ ] **Step 1: Créer la fonction `uploadBoardPhoto(boardId, input)`**

Même pattern que `uploadAvatar()` :
- Vérifie taille < 2MB
- Upload vers Supabase Storage bucket `boards` (path: `boards/{userId}/{boardId}.{ext}`)
- Fallback base64 localStorage si storage non dispo
- Met à jour le champ `photo_url` de la board

- [ ] **Step 2: Brancher sur le formulaire ajout et édition**

Input file dans les formulaires, `onchange="uploadBoardPhoto(...)"`

- [ ] **Step 3: Tester — uploader une photo**

- [ ] **Step 4: Commit**

```bash
git add apps/web/index.html index.html
git commit -m "feat(boards): upload photo via Supabase Storage avec fallback base64"
```

---

## Task 6 : Partage Instagram — overlay 3 modes

**Files:**
- Modify: `apps/web/index.html` — nouvelles fonctions de partage

- [ ] **Step 1: Créer l'overlay de choix de mode**

Fonction `openBoardShareOverlay(boardId)` :
- Overlay plein écran avec 3 boutons :
  - 📸 "Montrer ma board" (lifestyle)
  - 💰 "Vendre ma board" (marketplace)
  - 🔧 "Réparer ma board" (entraide)

- [ ] **Step 2: Mode "Montrer" — card lifestyle**

Fonction `shareBoardFlex(boardId)` :
- Génère un canvas avec : photo, nom, dims, shaper, volume, stats sessions, sweet spot, logo SurfAI
- Palette : fond sombre (#0a0e27), accents verts (#4dff91)
- Bouton "Partager sur Instagram Story" → télécharge l'image (l'utilisateur la poste manuellement)

- [ ] **Step 3: Mode "Vendre" — card vente**

Fonction `shareBoardSell(boardId)` :
- Avant de générer : demander prix (€), localisation (ville), message optionnel
- Canvas avec : badge "À VENDRE", photo, nom, dims, shaper, état, prix, localisation, "Me contacter sur SurfAI"
- Palette : accents orange (#ed8936)

- [ ] **Step 4: Mode "Réparer" — card réparation**

Fonction `shareBoardRepair(boardId)` :
- Avant de générer : description problème, localisation, urgence (chips)
- Canvas avec : badge "BESOIN DE RÉPARATION", photo, nom, shaper, localisation, description, urgence
- Palette : accents bleu (#00cfff)

- [ ] **Step 5: Fonction commune de génération canvas**

Fonction `generateBoardCard(board, mode, extras)` :
- Canvas 1080×1920 (format Instagram Story)
- Dessine le fond, la photo, les textes, le logo SurfAI
- Retourne un blob image PNG
- Bouton "Télécharger pour Instagram" → `canvas.toBlob()` + download

- [ ] **Step 6: Tester les 3 modes de partage**

- [ ] **Step 7: Commit**

```bash
git add apps/web/index.html index.html
git commit -m "feat(boards): partage Instagram 3 modes — flex, vente, réparation"
```

---

## Task 7 : Dropdown boards dans le profil

**Files:**
- Modify: `apps/web/index.html` — fonction `loadProfilTab()`

- [ ] **Step 1: Mettre à jour le dropdown boards dans le profil**

Les cards dans le dropdown doivent afficher les nouvelles infos (photo miniature, nom, dims, type). Le lien "Gérer mes boards" ouvre l'onglet boards.

- [ ] **Step 2: Commit**

```bash
git add apps/web/index.html index.html
git commit -m "feat(profil): dropdown boards enrichi avec photo et dims"
```

---

## Task 8 : Sync fichier racine + test final

**Files:**
- Copy: `apps/web/index.html` → `index.html`

- [ ] **Step 1: Copier le fichier**

```bash
cp apps/web/index.html index.html
```

- [ ] **Step 2: Test intégral**

Sur http://localhost:8080 vérifier :
- Profil → dropdown "Mes boards" → "Gérer mes boards" → onglet boards
- Ajouter une board avec tous les champs + photo
- Modifier une board
- Supprimer une board
- Partager mode Flex → image téléchargée
- Partager mode Vente → champs prix/ville + image
- Partager mode Repair → champs problème/ville/urgence + image
- Retour profil → la board apparaît dans le dropdown

- [ ] **Step 3: Commit final**

```bash
git add apps/web/index.html index.html
git commit -m "feat(boards): page Mes Boards complète — quiver, partage, données ML"
```

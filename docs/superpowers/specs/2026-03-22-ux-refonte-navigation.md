# Refonte UX — Navigation & Interface SurfAI

> **For agentic workers:** Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this spec task-by-task.

**Goal:** Remplacer les 7 onglets actuels par une navigation 4 onglets centrée sur l'usage quotidien du surfeur. Supprimer les redondances, cacher la configuration, mettre les prédictions IA en page d'accueil.

**Tech Stack:** HTML/JS vanilla · CSS inline existant · Backend Express existant · Supabase · Stormglass API · Geolocation API browser

---

## Problèmes actuels identifiés

- 7 onglets dont Config (technique, pas utilisateur) et Predictions/Météo qui font doublon avec le Dashboard
- Niveau de surf et sélection de spot répétés dans 3 onglets différents
- L'historique des sessions est mis en avant alors qu'il sert surtout au moteur IA
- Page d'accueil (Dashboard) trop générique, pas centrée sur l'identité du surfeur
- Configuration backend/Supabase visible comme onglet principal

---

## Architecture : 4 onglets

```
🏠 Accueil   |   📍 Spots   |   ➕ Session   |   👤 Profil
```

La Config disparaît de la navigation principale — accessible via un lien discret tout en bas de l'onglet Profil.

---

## Onglet 1 — 🏠 Accueil (page de démarrage)

**Responsabilité :** Vue synthétique personnalisée à chaque ouverture de l'app.

### Hero profil
- Avatar (emoji ou initiales en cercle coloré)
- Pseudo + niveau (`🌊 Intermédiaire · Côte Basque`)
- Compteur sessions + date dernière session

### Bloc météo géolocalisée
- Géolocalisation browser au chargement (`navigator.geolocation.getCurrentPosition`)
- Fallback : utiliser le spot le plus récent de l'utilisateur si géoloc refusée
- Affichage : 4 metrics en grille — 🌡️ température eau · 💨 vent (vitesse + direction) · 🌊 hauteur vagues · 🌙 prochaine marée haute/basse
- Source : Stormglass (même cache 6h existant). Heure de marée via `shomService` existant — fallback silencieux si indisponible (champ masqué)
- Label de localisation : `📍 Biarritz · maintenant`

### Bloc créneaux IA — 3 jours
- Appel `/api/v1/predictions/best-windows?userId=X&days=3`
- Top 3 créneaux triés par score
- Chaque ligne : score coloré · date + fenêtre horaire · spot · board suggérée · narrative
- Couleurs score : vert `#48bb78` (≥8) · bleu `#4299e1` (≥6) · orange `#ed8936` (<6)

### Boutons rapides
- `➕ Session` → ouvre onglet Session
- `📍 Spots` → ouvre onglet Spots

---

## Onglet 2 — 📍 Spots

**Responsabilité :** Explorer les spots, gérer ses favoris, consulter les prévisions d'un spot.

### Vue liste
- Barre de recherche/filtre : pays → région → ville (dropdowns cascadants existants)
- Section **Mes favoris** en haut (spots avec ⭐ dans Supabase)
- Section **Tous les spots** en dessous
- Chaque item : nom · ville · indicateur de score IA si disponible (ex: `8.5 demain`)
- Tap sur un spot → Vue fiche spot

### Vue fiche spot (dans le même onglet, navigation push)
- Header : nom du spot · ville · bouton ⭐ favori (toggle)
- Conditions idéales : vent idéal · houle idéale · marée idéale
- **Prévisions 5 jours** : liste des créneaux scorés par le moteur IA
  - Appel : `/api/v1/predictions/spot/:spotId?userId=X&days=5`
  - Même rendu que les créneaux de l'accueil
- **Mes sessions ici** : liste compacte des sessions passées sur ce spot (date + note)
- Bouton retour → revient à la liste

---

## Onglet 3 — ➕ Session

**Responsabilité :** Enregistrement rapide d'une session, météo capturée automatiquement.

### Formulaire
- Spot : dropdown spots favoris en premier, puis tous les spots
- Date : date picker (défaut = aujourd'hui)
- Heure : time picker (défaut = maintenant)
- Note : sélecteur 1–5 étoiles visuelles (pas 1-10, plus intuitif)
- Board : dropdown boards de l'utilisateur (optionnel)
- Notes : textarea (optionnel, placeholder : "Comment était la session ?")
- Bouton **Enregistrer** → `POST /api/v1/sessions/quick` avec body `{ userId, spotId, date, time, rating (1–5), notes, boardId }`
- La note est stockée en 1–5 (pas 1–10) — correspondance directe avec les étoiles visuelles

### Feedback
- Message de confirmation : "✅ Session enregistrée — météo capturée automatiquement" ou "✅ Session enregistrée"
- Pas de redirection automatique — l'utilisateur reste sur l'onglet pour en ajouter une autre si besoin

---

## Onglet 4 — 👤 Profil

**Responsabilité :** Paramètres personnels, boards, historique pour le moteur IA, configuration cachée.

### Section identité
- Avatar + pseudo (éditable)
- Niveau de surf (dropdown : Débutant / Intermédiaire / Avancé / Expert)
- Fourchette de vagues préférée (min/max en mètres)

### Section boards
- Liste des boards existantes (nom · taille · type)
- Formulaire ajout board (nom, taille, type, shaper)

### Section historique
- Liste des sessions passées (compacte : date · spot · note)
- Libellé discret : `(utilisé par le moteur IA pour personnaliser tes prédictions)`

### Configuration — section cachée
- Titre : `⚙️ Configuration avancée` (collapsible, fermé par défaut)
- Contenu : Backend URL · Supabase URL · Supabase Anon Key · boutons Test
- Statut des services (Backend · IA · Supabase) affiché ici uniquement

---

## Design System

### Couleurs
- **Primary** : `#4dff91` (vert lime fluo)
- **Dark bg** : `#0a0e27` (bleu nuit intense)
- **Dark secondary** : `#0d2137` (bleu nuit secondaire)
- **Gradient hero** : `linear-gradient(135deg, #0a0e27, #0d2137)`
- **Accent sur dark** : texte et chiffres en `#4dff91` sur fond sombre
- **Score excellent (≥8)** : `#4dff91` (vert lime)
- **Score bon (≥6)** : `#00cfff` (bleu cyan)
- **Score correct (<6)** : `#ed8936` (orange)
- **Background app** : `#0a0e27`
- **Cards** : `rgba(255,255,255,0.05)` avec border `rgba(255,255,255,0.08)` — effet glassmorphism léger sur fond sombre
- **Texte principal** : `#f0f4ff`
- **Texte secondaire** : `rgba(255,255,255,0.55)`
- **Nav tabs** : fond `#0d2137`, onglet actif fond `#4dff91` texte `#0a0e27`

### Navigation
- 4 onglets en bas, pleine largeur, fond `#0d2137`
- Onglet actif : fond `#4dff91`, texte `#0a0e27` (noir sur vert)
- Onglets inactifs : texte `rgba(255,255,255,0.5)`
- Chaque onglet : icône emoji + label court

### Typographie et densité
- Titres de section : `0.7rem uppercase letter-spacing:0.5px color:#888` (label style)
- Corps : `0.85rem` pour le contenu principal
- Métadonnées : `0.75rem color:#666`
- Narratives IA : `font-style:italic color:#888`

---

## Ce qui est supprimé

| Avant | Raison |
|-------|--------|
| Onglet **Dashboard** | Remplacé par Accueil (même contenu, mieux structuré) |
| Onglet **Predictions** | Fusionné dans Accueil (créneaux IA) et fiche Spot |
| Onglet **Météo** | Fusionné dans Accueil (météo géolocalisée) et fiche Spot |
| Onglet **Config** | Déplacé en bas du Profil, collapsible |
| Duplication niveau surf | Le niveau est lu depuis le profil, pas re-saisi à chaque fois |
| Duplication sélection spot | Le spot par défaut vient du profil/géoloc |

---

## Ce qui est hors scope

- Authentification multi-utilisateur
- Mode hors-ligne / PWA
- Annuaire shapers/shops géolocalisé (feature future payante)
- Écoles de surf / cours particuliers (feature future payante)
- Notifications push

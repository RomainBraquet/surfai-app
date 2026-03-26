# SurfAI -- Strategie de Monetisation

> Document strategique -- Mars 2026
> Version 1.0

---

## Table des matieres

1. [Resume executif](#1-resume-executif)
2. [Modele Freemium par abonnement](#2-modele-freemium-par-abonnement)
3. [Marketplace Ecoles de Surf & Moniteurs](#3-marketplace-ecoles-de-surf--moniteurs)
4. [Annuaire Pro Geolocalise](#4-annuaire-pro-geolocalise)
5. [Publicite & Partenariats](#5-publicite--partenariats)
6. [Analyse Concurrentielle des Prix](#6-analyse-concurrentielle-des-prix)
7. [Projections de Revenus](#7-projections-de-revenus)
8. [Roadmap de Monetisation](#8-roadmap-de-monetisation)
9. [Considerations Legales](#9-considerations-legales)

---

## 1. Resume executif

SurfAI se monetise sur **quatre piliers** complementaires :

| Pilier | Part du revenu cible (an 3) | Priorite |
|--------|----------------------------|----------|
| Abonnements Premium | 50-55% | Phase 1 |
| Marketplace cours/ecoles | 20-25% | Phase 2 |
| Annuaire pro geolocalise | 10-15% | Phase 2 |
| Publicite & partenariats | 10-15% | Phase 3 |

**Positionnement prix :** 30 a 50% sous Surfline, avec une proposition de valeur superieure pour les surfeurs amateurs grace a la personnalisation IA. Le marche europeen est sous-desservi par Surfline (qui est centre USA/Australie), ce qui cree une ouverture.

**Objectif :** atteindre la rentabilite a ~15 000 utilisateurs actifs avec un mix abonnements + marketplace.

---

## 2. Modele Freemium par abonnement

### 2.1 Ce qui reste gratuit (Free Tier)

L'objectif du tier gratuit est de creer de la retention et de l'habitude. Il doit etre suffisamment utile pour que l'utilisateur revienne chaque jour, mais limiter les fonctionnalites qui creent le plus de valeur.

| Fonctionnalite | Gratuit |
|----------------|---------|
| Previsions basiques (48h) | Oui |
| Nombre de spots favoris | 3 max |
| Score de conditions (simplifie) | Oui (note /5 seulement) |
| Alertes conditions | 1 alerte active |
| Log de sessions | 10 dernieres sessions |
| Partage Instagram | Oui (avec watermark SurfAI) |
| Carte des spots | Oui |
| Recommendations IA personnalisees | Non |
| Donnees de maree | Basique |

### 2.2 SurfAI Pro (Tier principal)

**Prix : 5,99 EUR/mois ou 39,99 EUR/an** (economie de 44% sur l'annuel)

| Fonctionnalite | Pro |
|----------------|-----|
| Previsions etendues (10-14 jours) | Oui |
| Spots favoris illimites | Oui |
| Score IA personnalise (detaille) | Oui -- le coeur de la proposition |
| Alertes conditions | Illimitees |
| Historique complet des sessions | Oui |
| Partage Instagram premium (sans watermark, designs exclusifs) | Oui |
| Stats de progression personnelles | Oui |
| Heatmap des meilleurs creneaux | Oui |
| Donnees de maree completes | Oui |
| Export des donnees de session | Oui |

### 2.3 Strategie de conversion Free --> Pro

Les meilleurs leviers de conversion pour les apps sportives (reference : Strava a ~10% de conversion, les apps meteo premium 5-8%) :

**Declencheurs de conversion :**

1. **Le "mur de la valeur IA"** -- L'utilisateur voit que l'IA a genere une recommandation personnalisee mais elle est floutee. Message : *"L'IA predit un score de [X]/10 pour toi demain a [spot]. Passe en Pro pour voir tes recommandations."*

2. **Apres 3 sessions loguees** -- L'utilisateur a investi du temps. Proposer Pro pour debloquer les stats de progression et l'historique complet.

3. **Alerte de conditions parfaites** -- Notification : *"Conditions ideales pour ton niveau demain a Hossegor. Les details sont reserves aux membres Pro."*

4. **Limite des 3 spots favoris atteinte** -- Quand l'utilisateur essaie d'ajouter un 4e spot.

5. **Fin de saison / recap** -- Generer un recap de saison attrayant (comme Spotify Wrapped) mais le rendre complet uniquement en Pro.

6. **Essai gratuit de 7 jours** -- Propose apres 2 semaines d'utilisation active (pas au premier lancement -- attendre que l'habitude se cree).

**Objectifs de conversion :**
- Annee 1 : 4-6% de conversion (phase de construction de valeur)
- Annee 2 : 7-10% (IA affinee, plus de valeur percue)
- Annee 3 : 10-12% (effet reseau, communaute)

### 2.4 Justification du prix

| App | Prix annuel | Marche | Focus |
|-----|------------|--------|-------|
| Surfline Premium | ~100 USD (~93 EUR) | Global (USA-centric) | Cams + previsions |
| MSW (Magic Seaweed) | Integre dans Surfline depuis 2022 | Europe | Previsions |
| Windguru Pro | ~29 EUR/an | Global | Vent/meteo |
| Strava Summit | ~60 EUR/an | Global | Cyclisme/running |
| **SurfAI Pro** | **39,99 EUR/an** | **Europe** | **IA personnalisee** |

A 39,99 EUR/an, SurfAI est :
- **57% moins cher que Surfline** -- argument massue pour les surfeurs amateurs
- **Plus cher que Windguru** -- justifie par l'IA et le focus surf (Windguru est generaliste vent)
- **Moins cher que Strava** -- comparable en proposition de valeur (tracking + insights)

---

## 3. Marketplace Ecoles de Surf & Moniteurs

### 3.1 Fonctionnement

La marketplace connecte les surfeurs (surtout debutants/intermediaires -- le coeur de cible de SurfAI) avec des ecoles de surf et moniteurs independants.

**Flux utilisateur :**
1. L'utilisateur consulte un spot
2. Section "Apprendre ici" affiche les ecoles/moniteurs a proximite
3. Filtres : niveau, langue, prix, date, type (groupe/prive)
4. Reservation et paiement integres dans l'app
5. Confirmation + rappel + conditions du jour (valeur ajoutee SurfAI)
6. Apres la session : notation et avis

**Flux ecole/moniteur :**
1. Inscription via un dashboard dedie (web)
2. Profil : photos, certifications, langues, zones, tarifs
3. Gestion du calendrier et des disponibilites
4. Notification de reservation
5. Paiement verse sous 48h apres la session
6. Dashboard analytics (reservations, avis, revenus)

### 3.2 Modele de commission

| Type | Commission SurfAI | Justification |
|------|-------------------|---------------|
| Ecoles de surf (structures) | 12-15% | Volume plus eleve, marge plus faible |
| Moniteurs independants | 10-12% | Attirer les independants, volume plus faible |
| Premiers 6 mois (lancement) | 8% | Taux d'appel pour amorcer l'offre |

**Comparaison marche :**
- Airbnb Experiences : 20% commission
- Bookedsurfing : 15-20% commission
- Surfinn : 10-15% commission
- GetYourGuide : 20-25% commission

SurfAI se positionne en dessous des grandes plateformes pour attirer les ecoles, tout en restant viable. L'argument : "Vous etes deja sur l'app que vos futurs clients utilisent pour surfer."

### 3.3 Tarification suggeree pour les cours

SurfAI ne fixe pas les prix mais peut suggerer des fourchettes par marche :

| Marche | Cours collectif (2h) | Cours prive (1h30) |
|--------|---------------------|---------------------|
| France (Cote Basque, Bretagne) | 35-50 EUR | 80-120 EUR |
| Espagne (Pays Basque, Canaries) | 30-45 EUR | 60-100 EUR |
| Portugal (Ericeira, Peniche) | 25-40 EUR | 50-90 EUR |
| Maroc (Taghazout, Imsouane) | 20-35 EUR | 40-70 EUR |

### 3.4 Strategie d'onboarding des ecoles

**Phase 1 -- Amorcer l'offre (50 premieres ecoles)**
- Cibler les hotspots : Hossegor, Biarritz, Ericeira, Peniche, Taghazout, Zarautz
- Approche directe : email + visite terrain (fondateur surfeur = credibilite)
- Offre de lancement : 0% commission les 3 premiers mois, puis 8% pendant 6 mois
- Profil gratuit + badge "Partenaire fondateur" (visibilite premium permanente)

**Phase 2 -- Croissance (50-300 ecoles)**
- Formulaire d'inscription en self-service sur le site
- Programme de parrainage : une ecole qui en invite une autre = 1 mois sans commission
- Partenariats avec les federations de surf (FFS en France, FPS au Portugal)
- Presence dans les salons/events surf (Gliss'Expo, etc.)

**Phase 3 -- Scale (300+ ecoles)**
- API d'integration pour les ecoles qui ont deja un systeme de reservation
- Widget de reservation SurfAI a integrer sur le site de l'ecole
- Programme "SurfAI Verified" pour les ecoles certifiees

### 3.5 Valeur ajoutee unique de SurfAI pour les ecoles

Ce qui differencie SurfAI des plateformes de booking generiques :
- **Contexte conditions** : l'ecole est suggeree quand les conditions sont adaptees aux debutants
- **Match IA** : recommandation de l'ecole en fonction du niveau et des objectifs de l'utilisateur
- **Audience qualifiee** : les utilisateurs de l'app sont deja des surfeurs ou aspirants surfeurs
- **Apres le cours** : l'eleve continue d'utiliser SurfAI, creant un lien durable

---

## 4. Annuaire Pro Geolocalise

### 4.1 Concept

Annuaire des professionnels du surf geolocalises autour des spots : shapers, reparateurs de boards, surf shops, photographes surf.

**Acces utilisateur :** gratuit (la valeur est dans l'audience, pas dans le paywall).

### 4.2 Modele economique

| Offre | Prix | Ce qui est inclus |
|-------|------|-------------------|
| Listing basique | Gratuit | Nom, adresse, contact, 1 photo |
| Listing Premium | 19,99 EUR/mois | Photos multiples, lien site, mise en avant, badge, analytics |
| Listing Gold (top spot) | 39,99 EUR/mois | Tout Premium + position #1 dans la zone, push notif quand utilisateurs a proximite |

**Pourquoi les pros paieraient :**
- Audience ultra-ciblee (surfeurs actifs sur le spot)
- Visibilite contextuelle (affiche sur la fiche spot au bon moment)
- Alternative moins chere que Google Ads pour toucher un surfeur local

### 4.3 Volume cible

- France : ~200 shapers + ~500 surf shops + ~150 reparateurs
- Espagne : ~100 shapers + ~300 surf shops
- Portugal : ~80 shapers + ~200 surf shops
- Maroc : ~30 shapers + ~50 surf shops

Objectif an 2 : 100 listings premium = ~24 000 EUR/an de revenu recurrent.

---

## 5. Publicite & Partenariats

### 5.1 Principes directeurs

L'experience utilisateur prime. La pub ne doit **jamais** interrompre la consultation des conditions ou le logging de session. Regles :

- **Zero pub intrusive** : pas de pop-up, pas d'interstitiel, pas de video forcee
- **Pub native uniquement** : integree dans le flux de contenu
- **Pertinence absolue** : uniquement des marques/produits surf
- **Pas de pub pour les utilisateurs Pro** : un des avantages du tier payant

### 5.2 Formats et placements

| Placement | Format | Exemple |
|-----------|--------|---------|
| Feed d'actualite / entre les spots | Carte sponsorisee | "La nouvelle DHD que tous les locaux testent a Hossegor" |
| Fiche spot (bas de page) | Banniere native | Decathlon surf / surf shop local |
| Post-session (apres le log) | Suggestion produit | "Ta session etait longue -- decouvre la combinaison Manera 4/3" |
| Section Boards | Listing sponsorise | Shapers mettant en avant un modele |
| Recap hebdo / newsletter | Partenariat contenu | "Le spot de la semaine, presente par Rip Curl" |

### 5.3 Estimation des revenus publicitaires

Les apps sportives de niche generent typiquement entre 1 et 4 EUR de revenu pub par utilisateur actif mensuel (MAU) par an.

| Scenario | MAU | RPM estime | Revenu pub annuel |
|----------|-----|------------|-------------------|
| Conservateur | 5 000 | 1,50 EUR | 7 500 EUR |
| Moyen | 20 000 | 2,00 EUR | 40 000 EUR |
| Optimiste | 50 000 | 2,50 EUR | 125 000 EUR |

### 5.4 Partenariats strategiques

Au-dela de la pub classique, des partenariats a valeur ajoutee :

- **Marques de combinaisons** (Manera, Vissla, Patagonia) : recommandations saisonnieres en fonction de la temperature de l'eau sur les spots
- **Marques de boards** : "Quelle board pour ton niveau ?" -- contenu sponsorise utile
- **Assurances surf** : partenariat affiliation (surf trip, RC moniteur)
- **Tourisme** : offices de tourisme des regions surf (Landes, Algarve, etc.)

---

## 6. Analyse Concurrentielle des Prix

### 6.1 Paysage concurrentiel

| App/Service | Prix gratuit | Prix premium | Forces | Faiblesses |
|-------------|-------------|-------------|--------|------------|
| **Surfline** | Previsions basiques, pubs | ~93 EUR/an (USD 99.99) | Cameras HD, maree, couverture mondiale | Cher, USA-centric, pas de personnalisation IA |
| **MSW** (absorbe par Surfline) | -- | Integre Surfline | Etait fort en Europe | N'existe plus independamment |
| **Windguru** | Previsions basiques | ~29 EUR/an | Vent detaille, pas cher | Interface datee, pas surf-specifique |
| **Magicseaweed** | -- | Redirige vers Surfline | -- | Disparu |
| **Glassy Pro** | Basique | ~50 USD/an | Alertes, interface propre | Peu de spots, US seulement |
| **Surf Forecast** | Gratuit | Pas de premium | Simple, gratuit | Pas de monetisation, pas d'IA |

### 6.2 Positionnement de SurfAI

```
Prix annuel (EUR)
|
100 |  Surfline ---------> [cameras, couverture globale]
 90 |
 80 |
 70 |
 60 |  Strava (ref) -----> [tracking sportif, communaute]
 50 |  Glassy -----------> [alertes, US]
 40 |  *** SurfAI *** ---> [IA personnalisee, Europe, marketplace]
 30 |  Windguru ---------> [vent, basique]
 20 |
 10 |
  0 |__________________________________________________
      Basique           Personnalise         IA avancee
                    Niveau de personnalisation
```

**Le sweet spot de SurfAI : 39,99 EUR/an.** Assez bas pour que l'amateur ne reflechisse pas trop, assez haut pour construire un revenu durable. La personnalisation IA justifie le premium par rapport a Windguru.

### 6.3 Avantage concurrentiel cle

Surfline a absorbe MSW et domine le marche anglophone. Mais :
- Pas de personnalisation par niveau d'utilisateur
- Couverture europeenne secondaire par rapport aux USA
- Prix eleve pour un amateur qui surfe 2-3 fois par semaine
- Pas de marketplace cours/ecoles

SurfAI se positionne comme **le Surfline europeen pour amateurs, avec une IA qui apprend de toi**.

---

## 7. Projections de Revenus

### 7.1 Hypotheses

| Parametre | Valeur |
|-----------|--------|
| Taux de conversion free-to-paid | 6% an 1, 9% an 2, 11% an 3 |
| Prix moyen abonnement | 36 EUR/an (mix mensuel/annuel) |
| Panier moyen cours reserve | 55 EUR |
| Commission marketplace moyenne | 11% |
| Revenu pub par MAU/an | 1,50-2,50 EUR |
| Revenu annuaire premium moyen | 25 EUR/mois |

### 7.2 Scenario 1 : 1 000 utilisateurs (fin annee 1)

| Source | Calcul | Revenu annuel |
|--------|--------|---------------|
| Abonnements Pro | 1 000 x 6% x 36 EUR | 2 160 EUR |
| Marketplace | 20 reservations/mois x 55 EUR x 11% | 1 452 EUR |
| Annuaire premium | 5 listings x 20 EUR/mois x 12 | 1 200 EUR |
| Publicite | 600 MAU x 1,50 EUR | 900 EUR |
| **Total** | | **~5 700 EUR** |

> Realiste pour une premiere annee. Ne couvre pas les couts mais valide le modele.

### 7.3 Scenario 2 : 10 000 utilisateurs (fin annee 2)

| Source | Calcul | Revenu annuel |
|--------|--------|---------------|
| Abonnements Pro | 10 000 x 9% x 36 EUR | 32 400 EUR |
| Marketplace | 120 reservations/mois x 55 EUR x 11% | 8 712 EUR |
| Annuaire premium | 40 listings x 22 EUR/mois x 12 | 10 560 EUR |
| Publicite | 6 000 MAU x 2,00 EUR | 12 000 EUR |
| **Total** | | **~63 700 EUR** |

> Debut de viabilite. Peut couvrir les couts API (Stormglass ~200 EUR/mois), hebergement, et un petit salaire.

### 7.4 Scenario 3 : 50 000 utilisateurs (fin annee 3)

| Source | Calcul | Revenu annuel |
|--------|--------|---------------|
| Abonnements Pro | 50 000 x 11% x 36 EUR | 198 000 EUR |
| Marketplace | 500 reservations/mois x 55 EUR x 11% | 36 300 EUR |
| Annuaire premium | 100 listings x 25 EUR/mois x 12 | 30 000 EUR |
| Publicite | 30 000 MAU x 2,50 EUR | 75 000 EUR |
| **Total** | | **~339 300 EUR** |

> Entreprise viable. Possibilite d'embaucher, d'investir dans le produit, et de preparer une levee de fonds.

### 7.5 Repartition visuelle du revenu (annee 3)

```
Abonnements   [=============================]  58%  198 000 EUR
Publicite     [================]               22%   75 000 EUR
Marketplace   [==========]                     11%   36 300 EUR
Annuaire      [========]                        9%   30 000 EUR
```

---

## 8. Roadmap de Monetisation

### Phase 1 -- Fondation (Mois 1-6)

**Objectif :** Valider le produit, construire la base utilisateurs.

- [ ] Lancer l'app en mode 100% gratuit (pas de paywall)
- [ ] Implementer le tracking des fonctionnalites pour identifier ce que les utilisateurs valorisent le plus
- [ ] Construire le systeme de sessions et de partage Instagram
- [ ] Atteindre 500-1 000 utilisateurs organiques
- [ ] Preparer l'infrastructure de paiement (Stripe)

### Phase 2 -- Premier Revenu (Mois 6-12)

**Objectif :** Activer le freemium et la marketplace.

- [ ] Lancer SurfAI Pro a 39,99 EUR/an
- [ ] Implementer les restrictions free tier (3 spots, 48h previsions, pas d'IA)
- [ ] Offrir 1 mois gratuit de Pro a tous les utilisateurs existants (recompenser les early adopters)
- [ ] Lancer la marketplace ecoles (50 premieres ecoles, marches FR/PT)
- [ ] Ouvrir l'annuaire pro basique (listings gratuits pour amorcer)

### Phase 3 -- Croissance (Mois 12-24)

**Objectif :** Scaler les revenus, diversifier.

- [ ] Optimiser la conversion (A/B testing des declencheurs)
- [ ] Lancer les listings premium pour l'annuaire
- [ ] Etendre la marketplace a l'Espagne et au Maroc
- [ ] Activer la publicite native (premiers partenariats marques)
- [ ] Lancer le programme d'affiliation ecoles

### Phase 4 -- Maturite (Mois 24+)

**Objectif :** Maximiser le revenu par utilisateur.

- [ ] Explorer un tier "SurfAI Family" ou "Crew" (partage entre amis)
- [ ] API pour partenaires (resorts, camps surf)
- [ ] Contenu premium (video coaching IA basee sur les conditions du jour)
- [ ] Expansion geographique (UK, Scandinavie, Italie)
- [ ] Preparer un eventuel tour de financement

---

## 9. Considerations Legales

### 9.1 Abonnements (App Store / Google Play)

- Apple et Google prennent **15-30% de commission** sur les achats in-app (15% pour les petits developpeurs <1M USD de CA annuel via les programmes PME)
- Alternative : proposer l'abonnement via le site web (sans commission) et via l'app (avec commission). Depuis le DMA en Europe, il est possible de rediriger vers un site de paiement externe
- Gerer les remboursements, les periodes d'essai, et le renouvellement automatique conformement aux regles des stores

### 9.2 Marketplace

- **Statut juridique** : SurfAI agit comme intermediaire (place de marche). Ne pas etre requalifie en employeur des moniteurs
- **CGV marketplace** : rediger des CGV specifiques pour les pros (ecoles/moniteurs) distinctes des CGU utilisateurs
- **Paiement** : utiliser une solution de paiement marketplace (Stripe Connect, Mangopay) qui gere le split de paiement et la conformite KYC
- **TVA** : les commissions sont soumises a TVA. Les ecoles restent responsables de leur propre TVA sur le prix du cours
- **Assurance** : verifier que les ecoles/moniteurs ont une RC pro. Eventuellement exiger une preuve d'assurance pour le listing
- **RGPD** : traitement de donnees personnelles des pros et des clients -- base legale a definir (contrat pour les pros, consentement pour le marketing)

### 9.3 Publicite

- Conformite RGPD pour le ciblage publicitaire (consentement explicite via CMP)
- Transparence : les contenus sponsorises doivent etre clairement identifies ("Sponsorise", "Partenaire")
- Pas de publicite ciblee sur les mineurs (regles strictes dans l'UE)

### 9.4 Donnees meteo

- Licence Stormglass : verifier les conditions de redistribution commerciale des donnees. Certains plans limitent l'usage a des fins non commerciales
- Mentionner les sources de donnees conformement aux exigences de licence

---

## Annexe : Metriques Cles a Suivre

| Metrique | Cible an 1 | Cible an 3 |
|----------|-----------|-----------|
| MAU (Monthly Active Users) | 600 | 30 000 |
| Taux de conversion free-to-Pro | 6% | 11% |
| Churn mensuel Pro | <8% | <5% |
| ARPU (Average Revenue Per User) | 5,70 EUR/an | 6,80 EUR/an |
| LTV (Lifetime Value) Pro | 36 EUR | 90 EUR+ |
| Reservations marketplace/mois | 20 | 500 |
| NPS (Net Promoter Score) | >40 | >55 |
| Cout d'acquisition (CAC) | <3 EUR | <5 EUR |

---

*Document genere le 25 mars 2026. A mettre a jour trimestriellement en fonction des donnees reelles.*

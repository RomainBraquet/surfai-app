# Auth Multi-User — Design Spec

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan.

**Goal:** Transformer SurfAI en webapp multi-utilisateur réelle via Supabase Auth (magic link), avec onboarding, déconnexion, et isolation complète des données par utilisateur.

**Architecture:** Supabase Auth gère les sessions. Le frontend écoute `onAuthStateChange` au démarrage. Toutes les tables sont protégées par RLS basé sur `auth.uid()`. Le backend filtre ses requêtes par `userId` fourni par l'appelant.

**Tech Stack:** Supabase Auth (magic link), Supabase RLS, vanilla JS (index.html single-file), Supabase JS SDK v2 (CDN)

**Modèle de sécurité:** Le backend utilise la service key (contourne RLS) et accepte `userId` sans validation JWT — risque accepté pour la phase de dev. À sécuriser avant mise en production ouverte.

**Convention de nommage:** Dans index.html, le SDK Supabase chargé via CDN expose la variable globale `supabase` (la librairie). Le client instancié s'appelle `supabaseClient`. Toutes les références dans cette spec utilisent `supabaseClient` pour désigner le client actif.

---

## 1. Flux d'authentification

### État initial au chargement
- `supabaseClient` est créé **immédiatement** au `DOMContentLoaded` : `supabaseClient = supabase.createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY)`
- **Avant toute vérification d'auth : l'app n'affiche rien** (écran noir / spinner minimal)
- `initAuth()` est appelé : enregistre `onAuthStateChange`, appelle `supabaseClient.auth.getSession()`

### Non connecté
- `onAuthStateChange` → `SIGNED_OUT` ou session null → `showLoginOverlay()`
- Overlay par-dessus fond sombre : logo 🏄‍♂️, champ email, bouton "Recevoir un lien"
- Appel : `supabaseClient.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })`
- Après soumission : "Vérifie ta boîte mail ✉️"

### Retour depuis le magic link
- SDK v2 utilise le **PKCE flow** par défaut : l'URL contient `?code=...` (pas `#access_token`)
- Le SDK échange automatiquement le code puis déclenche `onAuthStateChange` → `SIGNED_IN`
- Ne pas parser l'URL manuellement — laisser le SDK gérer entièrement
- Handler : `dataManager.currentUserId = session.user.id`, `hideLoginOverlay()`
- Nettoyage URL **après** l'event : `window.history.replaceState({}, '', window.location.pathname)`
- Puis : `checkOnboarding()`

### Reconnexion automatique
- SDK restaure session depuis localStorage → `SIGNED_IN` sans interaction → `initApp()`

### Session expirée
- `onAuthStateChange` → `SIGNED_OUT` → `showLoginOverlay()`, userData vidé, `currentUserId` = null

---

## 2. Onboarding (premier login)

```javascript
async function checkOnboarding() {
  const { data: { user } } = await supabaseClient.auth.getUser(); // await requis
  const { data } = await supabaseClient
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single();
  if (!data) showOnboarding(user.id);
  else initApp();
}
```

### Étape 1 — Pseudo : champ texte, bouton "Suivant →"
### Étape 2 — Niveau : 4 boutons (Débutant / Intermédiaire / Avancé / Expert), bouton "C'est parti !"
- Action : `INSERT INTO profiles (id, nickname, surf_level) VALUES (user.id, pseudo, level)`
- Puis : `initApp()`

---

## 3. Modifications frontend (index.html)

### Supprimé
- `this.currentUserId = 'demo_user'` (valeur initiale dans `SurfAIDataManager`)
- `dataManager.currentUserId = sessions[0].user_id` (hack dans `loadSessions`)
- La **fonction entière `connectSupabase()`** et son listener de bouton (ligne ~1911–1943)
- `await connectSupabase(...)` dans `DOMContentLoaded`
- `await loadHarmonizedData()` et `await loadAccueil()` dans `DOMContentLoaded` (déplacés dans `initApp()`)
- UI settings : champs "Supabase URL", "Supabase Anon Key", bouton "Tester Supabase"
- **Toutes les occurrences de `demo_user`** dans le code (guards `userId !== 'demo_user'` et `userId === 'demo_user'`) — supprimer ces conditions, remplacer par le seul guard nécessaire : `!userId || !supabaseClient`

### Ajouté
- `initAuth()` : crée `supabaseClient`, écoute `onAuthStateChange`, appelle `getSession()`
- `showLoginOverlay()` / `hideLoginOverlay()`
- `sendMagicLink(email)` : appelle `supabaseClient.auth.signInWithOtp()`
- `checkOnboarding()` : voir §2
- `showOnboarding(userId)` : 2 étapes, INSERT profil
- `initApp()` : `loadHarmonizedData()` + `loadSessions()` + `loadAccueil()`
- Bouton "Se déconnecter" dans l'onglet Profil → `supabaseClient.auth.signOut()`

### Corrigé (bug existant)
- `getUserProfile()` dans `SurfAIDataManager` : `from('user_profiles').eq('user_id', ...)` → `from('profiles').eq('id', ...)` (table inexistante, remplacée par la vraie)

### Modifié
- `loadSessions()` : `fetch('/api/v1/sessions/list?userId=' + dataManager.currentUserId)`

---

## 4. Backend

### `GET /api/v1/sessions/list`
- Ajouter `userId` en query param (requis)
- Filtrer : `.eq('user_id', userId)`

---

## 5. RLS Supabase (SQL à exécuter dans le dashboard)

### `spots` — lecture publique
```sql
ALTER TABLE spots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON spots FOR SELECT USING (true);
```

### `profiles`
```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own profile" ON profiles FOR ALL
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
```

### `sessions`
```sql
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own sessions" ON sessions FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

### `boards`
```sql
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own boards" ON boards FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

### `user_favorite_spots`
```sql
DROP POLICY IF EXISTS "Allow anon full access temp" ON user_favorite_spots;
CREATE POLICY "Own favorites" ON user_favorite_spots FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

---

## 6. Migration des données existantes (one-shot)

À exécuter **après** la première connexion. `NEW_UUID` = l'`auth.uid()` visible dans Supabase > Authentication > Users.

**Ordre : INSERT nouveau profil d'abord, puis UPDATE tables enfants** (évite FK violation si contraintes existent).

```sql
-- 1. Insérer le nouveau profil (avec le NEW_UUID de Supabase Auth)
INSERT INTO profiles (id, surf_level, min_wave_height, max_wave_height, nickname, created_at, updated_at)
SELECT 'NEW_UUID', surf_level, min_wave_height, max_wave_height, nickname, created_at, updated_at
FROM profiles WHERE id = '3ba8ad73-e2c6-49fe-ac88-c26b45551f4b';

-- 2. Migrer les tables enfants
UPDATE sessions            SET user_id = 'NEW_UUID' WHERE user_id = '3ba8ad73-e2c6-49fe-ac88-c26b45551f4b';
UPDATE boards              SET user_id = 'NEW_UUID' WHERE user_id = '3ba8ad73-e2c6-49fe-ac88-c26b45551f4b';
UPDATE user_favorite_spots SET user_id = 'NEW_UUID' WHERE user_id = '3ba8ad73-e2c6-49fe-ac88-c26b45551f4b';

-- 3. Supprimer l'ancien profil
DELETE FROM profiles WHERE id = '3ba8ad73-e2c6-49fe-ac88-c26b45551f4b';
```

---

## 7. Hors scope

- OAuth Google
- Validation JWT côté backend
- Gestion admin / suppression de compte
- Email de bienvenue personnalisé

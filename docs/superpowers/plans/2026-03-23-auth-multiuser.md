# Auth Multi-User Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter Supabase Auth (magic link) à SurfAI pour gérer de vrais comptes utilisateurs multi-user.

**Architecture:** Le frontend écoute `onAuthStateChange` au démarrage. Si non connecté → overlay login. Si connecté → onboarding (si nouveau) ou app. Le `currentUserId` est toujours issu de `supabaseClient.auth.getUser()`, jamais hacké depuis les sessions.

**Tech Stack:** Supabase Auth JS SDK v2 (CDN), vanilla JS, single HTML file (`apps/web/index.html`), Node.js/Express backend

**Spec:** `docs/superpowers/specs/2026-03-23-auth-multiuser-design.md`

---

## File Structure

- Modify: `apps/web/index.html` — Tasks 1–4
- Modify: `backend/src/routes/api.js:263–274` — Task 5

---

## Task 1 : Système auth complet (initAuth + overlay + onboarding)

**Files:**
- Modify: `apps/web/index.html`

**Context:** Les fonctions `initAuth`, `showLoginOverlay`, `checkOnboarding` et `showOnboarding` sont toutes interdépendantes — `initAuth` appelle les autres, donc elles doivent toutes exister dans le même commit. On remplace également `DOMContentLoaded` et le constructeur `SurfAIDataManager` dans cette même tâche.

- [ ] **Step 1 : Modifier le constructeur SurfAIDataManager**

Dans `SurfAIDataManager` autour de la ligne 532, remplacer :
```javascript
this.currentUserId = 'demo_user';
```
Par :
```javascript
this.currentUserId = null;
```

- [ ] **Step 2 : Remplacer DOMContentLoaded (lignes 956–1002)**

Remplacer tout le bloc `document.addEventListener('DOMContentLoaded', ...)` par :

```javascript
document.addEventListener('DOMContentLoaded', async function() {
    // Date par défaut pour le formulaire session
    const dateEl = document.getElementById('session-date');
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];

    // Charger backend URL depuis localStorage
    const savedBackendUrl = localStorage.getItem('backend_url');
    const savedApiKey = localStorage.getItem('backend_api_key');
    if (savedBackendUrl && savedBackendUrl.includes('localhost')) {
        backendUrl = savedBackendUrl;
    } else if (savedBackendUrl) {
        localStorage.setItem('backend_url', backendUrl);
    }
    if (savedApiKey) backendApiKey = savedApiKey;

    // Créer le client Supabase
    supabaseClient = supabase.createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY);
    dataManager = new SurfAIDataManager(backendUrl, supabaseClient);

    // Lancer l'auth — rien ne charge avant onAuthStateChange
    await initAuth();
});
```

- [ ] **Step 3 : Ajouter la section // AUTH avec toutes les fonctions**

Ajouter juste après le bloc `DOMContentLoaded`, avant `// CHARGEMENT DONNÉES HARMONISÉES` :

```javascript
// ========================================
// AUTH
// ========================================

async function initAuth() {
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
            dataManager.currentUserId = session.user.id;
            dataManager.supabase = supabaseClient;
            if (window.location.search.includes('code=')) {
                window.history.replaceState({}, '', window.location.pathname);
            }
            hideLoginOverlay();
            await checkOnboarding();
        } else if (event === 'SIGNED_OUT') {
            dataManager.currentUserId = null;
            userData = { sessions: [], spots: [], favoriteSpots: [], predictions: [], profile: {}, boards: [] };
            showLoginOverlay();
        }
    });

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        dataManager.currentUserId = session.user.id;
        dataManager.supabase = supabaseClient;
        await checkOnboarding();
    } else {
        showLoginOverlay();
    }
}

async function initApp() {
    await checkBackendConnection();
    await loadHarmonizedData();
    await loadSessions();
    await loadAccueil();
}

async function signOut() {
    await supabaseClient.auth.signOut();
}

// --- Overlay login ---

function showLoginOverlay() {
    let overlay = document.getElementById('auth-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'auth-overlay';
        overlay.innerHTML = `
            <div class="auth-card">
                <div class="auth-logo">🏄‍♂️</div>
                <h2>SurfAI</h2>
                <p class="auth-sub">Ton assistant surf intelligent</p>
                <input type="email" id="auth-email" placeholder="ton@email.com" />
                <button class="auth-btn" id="auth-btn" onclick="sendMagicLink()">
                    Recevoir un lien de connexion
                </button>
                <div class="auth-msg" id="auth-msg"></div>
            </div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('#auth-email').addEventListener('keydown', e => {
            if (e.key === 'Enter') sendMagicLink();
        });
    }
    overlay.classList.remove('hidden');
}

function hideLoginOverlay() {
    const overlay = document.getElementById('auth-overlay');
    if (overlay) overlay.classList.add('hidden');
}

async function sendMagicLink() {
    const emailEl = document.getElementById('auth-email');
    const btn = document.getElementById('auth-btn');
    const msg = document.getElementById('auth-msg');
    const email = emailEl?.value?.trim();
    if (!email || !email.includes('@')) {
        msg.textContent = 'Adresse email invalide';
        msg.className = 'auth-msg error';
        return;
    }
    btn.disabled = true;
    btn.textContent = 'Envoi...';
    msg.textContent = '';
    const { error } = await supabaseClient.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin }
    });
    if (error) {
        msg.textContent = '❌ ' + error.message;
        msg.className = 'auth-msg error';
        btn.disabled = false;
        btn.textContent = 'Recevoir un lien de connexion';
    } else {
        msg.textContent = '✉️ Vérifie ta boîte mail !';
        msg.className = 'auth-msg success';
        btn.textContent = 'Lien envoyé';
    }
}

// --- Onboarding ---

async function checkOnboarding() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const { data } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();
    if (!data) {
        showOnboarding(user.id);
    } else {
        await initApp();
    }
}

function showOnboarding(userId) {
    // Garantir que l'overlay existe (cas retour magic link sans passage par showLoginOverlay)
    if (!document.getElementById('auth-overlay')) showLoginOverlay();
    const overlay = document.getElementById('auth-overlay');
    overlay.classList.remove('hidden');

    const card = overlay.querySelector('.auth-card');
    if (!card) return;

    card.innerHTML = `
        <div class="auth-logo">🏄‍♂️</div>
        <h2>Bienvenue !</h2>
        <p class="auth-sub" id="onboarding-step-label">1 / 2 — Comment tu t'appelles ?</p>
        <div id="onboarding-step-1">
            <input type="text" id="onboarding-pseudo" placeholder="Ton prénom ou pseudo"
                style="width:100%;box-sizing:border-box;padding:12px;border-radius:8px;
                border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);
                color:#f0f4ff;font-size:0.95rem;margin-bottom:12px;outline:none" />
            <button class="auth-btn" onclick="onboardingStep2()">Suivant →</button>
        </div>
        <div id="onboarding-step-2" style="display:none">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
                <button class="onboarding-level-btn" data-level="beginner" onclick="selectLevel(this)"
                    style="padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#f0f4ff;cursor:pointer;font-size:0.88rem">Débutant</button>
                <button class="onboarding-level-btn" data-level="intermediate" onclick="selectLevel(this)"
                    style="padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#f0f4ff;cursor:pointer;font-size:0.88rem">Intermédiaire</button>
                <button class="onboarding-level-btn" data-level="advanced" onclick="selectLevel(this)"
                    style="padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#f0f4ff;cursor:pointer;font-size:0.88rem">Avancé</button>
                <button class="onboarding-level-btn" data-level="expert" onclick="selectLevel(this)"
                    style="padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#f0f4ff;cursor:pointer;font-size:0.88rem">Expert</button>
            </div>
            <button class="auth-btn" id="onboarding-finish-btn"
                onclick="finishOnboarding('${userId}')" disabled>
                C'est parti ! →
            </button>
        </div>
        <div class="auth-msg" id="onboarding-msg"></div>`;
}

function onboardingStep2() {
    const pseudo = document.getElementById('onboarding-pseudo')?.value?.trim();
    if (!pseudo) {
        document.getElementById('onboarding-msg').textContent = 'Entre ton prénom ou pseudo';
        document.getElementById('onboarding-msg').className = 'auth-msg error';
        return;
    }
    document.getElementById('onboarding-step-1').style.display = 'none';
    document.getElementById('onboarding-step-2').style.display = 'block';
    document.getElementById('onboarding-step-label').textContent = '2 / 2 — Ton niveau de surf ?';
    document.getElementById('onboarding-msg').textContent = '';
}

function selectLevel(btn) {
    document.querySelectorAll('.onboarding-level-btn').forEach(b => {
        b.style.background = 'rgba(255,255,255,0.06)';
        b.style.borderColor = 'rgba(255,255,255,0.15)';
        b.style.color = '#f0f4ff';
    });
    btn.style.background = 'rgba(77,255,145,0.15)';
    btn.style.borderColor = '#4dff91';
    btn.style.color = '#4dff91';
    document.getElementById('onboarding-finish-btn').disabled = false;
}

async function finishOnboarding(userId) {
    const pseudo = document.getElementById('onboarding-pseudo')?.value?.trim();
    const levelBtn = document.querySelector('.onboarding-level-btn[style*="4dff91"]');
    const level = levelBtn?.dataset?.level || 'intermediate';
    const msg = document.getElementById('onboarding-msg');

    const { error } = await supabaseClient.from('profiles').insert({
        id: userId,
        nickname: pseudo,
        surf_level: level,
        min_wave_height: 0.5,
        max_wave_height: 2.0
    });

    if (error) {
        msg.textContent = '❌ ' + error.message;
        msg.className = 'auth-msg error';
        return;
    }
    hideLoginOverlay();
    await initApp();
}
```

- [ ] **Step 4 : Ajouter le CSS de l'overlay dans le bloc `<style>`**

Ajouter avant `</style>` :

```css
/* ===== AUTH OVERLAY ===== */
#auth-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(10,14,39,0.92);
  backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
}
#auth-overlay.hidden { display: none; }
.auth-card {
  background: #0d2137;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  padding: 32px 24px;
  width: 320px;
  text-align: center;
}
.auth-card .auth-logo { font-size: 40px; margin-bottom: 8px; }
.auth-card h2 { color: #f0f4ff; font-size: 1.2rem; margin: 0 0 4px; }
.auth-card .auth-sub { color: rgba(255,255,255,0.45); font-size: 0.8rem; margin-bottom: 24px; }
.auth-card input[type="email"] {
  width: 100%; box-sizing: border-box; padding: 12px; border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.06);
  color: #f0f4ff; font-size: 0.95rem; margin-bottom: 12px; outline: none;
}
.auth-card input[type="email"]::placeholder { color: rgba(255,255,255,0.3); }
.auth-card .auth-btn {
  width: 100%; padding: 12px; background: #4dff91; color: #0a0e27;
  border: none; border-radius: 8px; font-weight: 700; font-size: 0.95rem; cursor: pointer;
}
.auth-card .auth-btn:disabled { opacity: 0.5; cursor: default; }
.auth-card .auth-msg { margin-top: 12px; font-size: 0.82rem; min-height: 20px; }
.auth-card .auth-msg.success { color: #4dff91; }
.auth-card .auth-msg.error { color: #fc8181; }
```

- [ ] **Step 5 : Tester le flow complet**

1. `bash "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/start.sh"`
2. Ouvrir `http://localhost:8080` en navigation privée
3. L'overlay login doit apparaître (logo 🏄‍♂️, champ email)
4. Entrer un vrai email → "Vérifie ta boîte mail" doit s'afficher
5. Cliquer le magic link reçu → onboarding step 1 (pseudo) → step 2 (niveau) → app
6. Recharger la page → reconnexion automatique (pas d'overlay)

- [ ] **Step 6 : Commit**

```bash
cd "/Users/imac/ANTIGRAVITY x CLAUDE/surfai"
git add apps/web/index.html
git commit -m "feat(auth): système auth complet — magic link, overlay, onboarding"
```

---

## Task 2 : Nettoyage — demo_user, connectSupabase, UI Supabase

**Files:**
- Modify: `apps/web/index.html`

**Context:** Supprimer tous les résidus de l'ancien système après que le nouveau auth fonctionne.

- [ ] **Step 1 : Supprimer connectSupabase() et testSupabaseConnection()**

Supprimer les deux fonctions complètes (lignes ~1911–1943).

- [ ] **Step 2 : Remplacer tous les guards demo_user**

Chercher `demo_user` dans index.html — 6 occurrences à traiter :

| Avant | Après |
|-------|-------|
| `if (userId && userId !== 'demo_user')` | `if (userId && supabaseClient)` |
| `if (!userId \|\| userId === 'demo_user' \|\| !dataManager.supabase)` | `if (!userId \|\| !supabaseClient)` |
| `if (!userId \|\| userId === 'demo_user') return;` | `if (!userId) return;` |

- [ ] **Step 3 : Fixer getUserProfile() — table user_profiles → profiles**

Dans `SurfAIDataManager.getUserProfile()` (autour ligne 660), remplacer :
```javascript
.from('user_profiles')
.select('*')
.eq('user_id', userId)
```
Par :
```javascript
.from('profiles')
.select('*')
.eq('id', userId)
```

- [ ] **Step 4 : Fixer loadSessions() — passer userId + supprimer hack**

Dans `loadSessions()` (autour ligne 2090), remplacer :
```javascript
const res = await fetch(`${backendUrl}/api/v1/sessions/list`);
const data = await res.json();
const sessions = data.sessions || [];
userData.sessions = sessions;
if (sessions.length > 0 && sessions[0].user_id) {
    dataManager.currentUserId = sessions[0].user_id;
}
```
Par :
```javascript
const userId = dataManager.currentUserId;
if (!userId) return;
const res = await fetch(`${backendUrl}/api/v1/sessions/list?userId=${userId}`);
const data = await res.json();
const sessions = data.sessions || [];
userData.sessions = sessions;
```

- [ ] **Step 5 : Nettoyer l'UI config dans loadProfilTab()**

Dans `loadProfilTab()`, dans `configHtml` :
- Supprimer les 2 lignes qui lisent `supabase-url` et `supabase-key` depuis le DOM (avant `configHtml`)
- Supprimer le bloc card Supabase (champs URL/Key + bouton "Tester Supabase")
- Supprimer la ligne `Supabase: ${supabaseClient ? '🟢 connecté' : '🔴 non configuré'}` dans `app-status`

- [ ] **Step 6 : Commit**

```bash
git add apps/web/index.html
git commit -m "refactor(auth): supprimer connectSupabase, demo_user guards, UI Supabase"
```

---

## Task 3 : Bouton Se déconnecter dans Profil

**Files:**
- Modify: `apps/web/index.html` — section `identiteHtml` dans `loadProfilTab()`

- [ ] **Step 1 : Ajouter le bouton dans identiteHtml**

Dans `loadProfilTab()`, dans le template `identiteHtml`, ajouter après la dernière `</div>` de la carte identité (avant le backtick fermant) :

```html
<button onclick="signOut()" style="width:100%;margin-top:12px;padding:10px;
  background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);
  border-radius:8px;color:rgba(255,255,255,0.5);cursor:pointer;font-size:0.85rem">
  Se déconnecter
</button>
```

- [ ] **Step 2 : Vérifier**

Aller dans l'onglet Profil → bouton "Se déconnecter" visible → cliquer → overlay login réapparaît.

- [ ] **Step 3 : Commit**

```bash
git add apps/web/index.html
git commit -m "feat(auth): bouton Se déconnecter dans Profil"
```

---

## Task 4 : Backend — forcer userId sur sessions/list

**Files:**
- Modify: `backend/src/routes/api.js:263–274`

- [ ] **Step 1 : Modifier la route**

Remplacer (lignes ~264–274) :
```javascript
router.get('/sessions/list', async (req, res) => {
  try {
    const db = require('../services/supabaseService');
    const userId = req.query.userId;
    const sessions = userId ? await db.getSessions(userId) : await db.getAllSessions();
    res.json({ success: true, sessions, count: sessions.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```
Par :
```javascript
router.get('/sessions/list', async (req, res) => {
  try {
    const db = require('../services/supabaseService');
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ success: false, error: 'userId requis' });
    const sessions = await db.getSessions(userId);
    res.json({ success: true, sessions, count: sessions.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

- [ ] **Step 2 : Tester**

```bash
# Redémarrer le backend
pkill -f "node server.js" 2>/dev/null
cd "/Users/imac/ANTIGRAVITY x CLAUDE/surfai/backend" && node server.js &
sleep 2

# Sans userId → 400
curl -s http://localhost:3001/api/v1/sessions/list | python3 -c "import json,sys; print(json.load(sys.stdin))"
# Expected: {'success': False, 'error': 'userId requis'}

# Avec userId → sessions
curl -s "http://localhost:3001/api/v1/sessions/list?userId=3ba8ad73-e2c6-49fe-ac88-c26b45551f4b" | python3 -c "import json,sys; d=json.load(sys.stdin); print('sessions:', d.get('count',0))"
# Expected: sessions: 41
```

- [ ] **Step 3 : Commit**

```bash
cd "/Users/imac/ANTIGRAVITY x CLAUDE/surfai"
git add backend/src/routes/api.js
git commit -m "fix(backend): sessions/list requiert userId"
```

---

## Après les 4 tâches : migration des données existantes

Une fois connecté avec ton vrai compte email :

1. Aller dans Supabase > Authentication > Users → copier ton `auth.uid()` (le nouveau UUID)
2. Exécuter dans Supabase SQL Editor :

```sql
-- Remplacer NEW_UUID par ton vrai auth.uid()
INSERT INTO profiles (id, surf_level, min_wave_height, max_wave_height, nickname, created_at, updated_at)
SELECT 'NEW_UUID', surf_level, min_wave_height, max_wave_height, nickname, created_at, updated_at
FROM profiles WHERE id = '3ba8ad73-e2c6-49fe-ac88-c26b45551f4b';

UPDATE sessions            SET user_id = 'NEW_UUID' WHERE user_id = '3ba8ad73-e2c6-49fe-ac88-c26b45551f4b';
UPDATE boards              SET user_id = 'NEW_UUID' WHERE user_id = '3ba8ad73-e2c6-49fe-ac88-c26b45551f4b';
UPDATE user_favorite_spots SET user_id = 'NEW_UUID' WHERE user_id = '3ba8ad73-e2c6-49fe-ac88-c26b45551f4b';

DELETE FROM profiles WHERE id = '3ba8ad73-e2c6-49fe-ac88-c26b45551f4b';
```

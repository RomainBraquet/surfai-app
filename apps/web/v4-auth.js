// SurfAI v4 : présentation, connexion, inscription et création du profil.
// Mêmes textes, mêmes étapes et mêmes enregistrements que l'ancienne version.
(function () {
  'use strict';
  var A = window.SurfV4, $ = A.$, esc = A.esc;
  function sb() { return A.client(); }

  var INTRO = [
    ['🌊', 'Une app qui parle de <em>ton</em> surf.', 'Pas de celui des autres.', 'SurfAI apprend de toi pour te trouver tes meilleures sessions.'],
    ['📝', '<em>Tes</em> sessions. <em>Tes</em> conditions.', '', 'Note en quelques secondes. L\'app mémorise la météo, la houle et les marées pour toi.'],
    ['🏄‍♂️', '<em>Tes</em> boards. <em>Ton</em> quiver.', '', 'Ajoute tes planches. L\'app sait laquelle est faite pour les conditions du jour.'],
    ['🎯', '<em>Tes</em> prévisions. Rien que <em>les tiennes</em>.', '', 'Pas de graphiques illisibles. Juste une réponse claire : quand, où, avec quelle board.'],
    ['✨', 'Plus tu surfes, plus elle <em>te</em> connaît.', '', 'Et ça ne fait que commencer.']
  ];

  function open(html) { var box = $('onb'); box.innerHTML = html; box.scrollTop = 0; box.classList.add('show'); return box; }
  function dots(n, k) { var s = '<div class="dots">'; for (var i = 0; i < n; i++) s += '<i' + (i <= k ? ' class="on"' : '') + '></i>'; return s + '</div>'; }

  // ───────── présentation ─────────
  function intro(k) {
    var it = INTRO[k], last = k === INTRO.length - 1;
    var box = open(dots(INTRO.length, k) +
      '<div class="emoji">' + it[0] + '</div>' +
      '<h2 style="font-size:36px;margin-top:18px">' + it[1] + (it[2] ? '<br><span style="color:rgba(255,255,255,.45)">' + it[2] + '</span>' : '') + '</h2>' +
      '<p class="hint">' + it[3] + '</p>' +
      '<button class="save" id="inNext">' + (last ? 'C\'est parti !' : 'Suivant') + '</button>' +
      (last ? '' : '<button class="skip" id="inSkip">Passer</button>'));
    $('inNext').addEventListener('click', function () { if (last) signup(); else intro(k + 1); });
    if ($('inSkip')) $('inSkip').addEventListener('click', signup);
    // glisser pour passer d'un écran à l'autre
    var x0 = null;
    box.ontouchstart = function (e) { x0 = e.touches[0].clientX; };
    box.ontouchend = function (e) {
      if (x0 == null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (dx < -50 && !last) intro(k + 1); else if (dx > 50 && k > 0) intro(k - 1);
    };
  }

  // ───────── inscription et connexion ─────────
  function oauth(provider) { sb().auth.signInWithOAuth({ provider: provider, options: { redirectTo: window.location.origin } }); }
  function authScreen(mode) {
    var up = mode === 'signup';
    var box = open(
      '<h2 style="margin-top:46px">' + (up ? 'Rejoins <em>SurfAI</em>' : 'Content de te revoir') + '</h2>' +
      '<p class="hint">' + (up ? 'Crée ton compte en 10 secondes.' : 'Connecte-toi pour retrouver tes sessions.') + '</p>' +
      '<button class="save alt" id="auApple">Continuer avec Apple</button>' +
      '<button class="save alt" id="auGoogle" style="margin-top:8px">Continuer avec Google</button>' +
      '<div class="or">ou par email</div>' +
      '<input class="word" type="email" id="auEmail" placeholder="ton@email.com" autocomplete="email">' +
      '<input class="word" type="password" id="auPw" placeholder="' + (up ? 'Mot de passe (6 car. min)' : 'Mot de passe') + '" autocomplete="' + (up ? 'new-password' : 'current-password') + '">' +
      '<div class="msg" id="auMsg"></div>' +
      '<button class="save" id="auGo">' + (up ? 'Créer mon compte' : 'Se connecter') + '</button>' +
      '<button class="skip" id="auSwitch">' + (up ? 'Déjà un compte ? Se connecter' : 'Pas de compte ? S\'inscrire') + '</button>' +
      (up ? '<p class="terms">En continuant, tu acceptes les conditions d\'utilisation et la politique de confidentialité de SurfAI.</p>' : ''));
    box.ontouchstart = box.ontouchend = null;
    $('auApple').addEventListener('click', function () { oauth('apple'); });
    $('auGoogle').addEventListener('click', function () { oauth('google'); });
    $('auSwitch').addEventListener('click', function () { authScreen(up ? 'login' : 'signup'); });
    function go() {
      var email = $('auEmail').value.trim(), pw = $('auPw').value, msg = $('auMsg'), btn = $('auGo'); msg.className = 'msg';
      if (!email || !pw) { msg.textContent = 'Email et mot de passe requis'; return; }
      if (up && pw.length < 6) { msg.textContent = 'Le mot de passe doit faire au moins 6 caractères'; return; }
      btn.disabled = true;
      var call = up ? sb().auth.signUp({ email: email, password: pw }) : sb().auth.signInWithPassword({ email: email, password: pw });
      call.then(function (r) {
        btn.disabled = false;
        if (r.error) { msg.textContent = r.error.message; return; }
        if (r.data && r.data.session) { location.reload(); return; }
        msg.className = 'msg fine'; msg.textContent = 'Vérifie ta boîte mail pour confirmer ton compte.';
      });
    }
    $('auGo').addEventListener('click', go);
    $('auPw').addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
  }
  function signup() { authScreen('signup'); }

  A.showAuth = function () {
    if (!sb()) return;
    var seen = false; try { seen = localStorage.getItem('surfai_intro_vue') === '1'; localStorage.setItem('surfai_intro_vue', '1'); } catch (e) { seen = false; }
    if (seen) authScreen('login'); else intro(0);
  };

  // ───────── création du profil : cinq étapes ─────────
  A.showProfileSteps = function (userId) {
    var data = { level: 'intermediate', days: [], slots: [], boardType: null }, step = 0, STEPS = 5;
    function chipSet(id, pairs, cls, multi) {
      return '<div class="chips ' + cls + '" id="' + id + '"' + (multi ? ' data-multi' : '') + '>' + pairs.map(function (p) { return '<button class="chip" data-v="' + p[0] + '">' + p[1] + '</button>'; }).join('') + '</div>';
    }
    function wire(box) {
      box.querySelectorAll('.chips,.days').forEach(function (g) {
        g.addEventListener('click', function (e) {
          var c = e.target.closest('.chip'); if (!c) return;
          if (g.hasAttribute('data-multi')) { c.classList.toggle('on'); return; }
          var was = c.classList.contains('on'); [].forEach.call(g.children, function (x) { x.classList.remove('on'); }); if (!was || !g.hasAttribute('data-optional')) c.classList.add('on');
        });
      });
    }
    function picked(sel) { return [].map.call(document.querySelectorAll(sel + ' .chip.on'), function (c) { return c.getAttribute('data-v'); }); }
    var screens = [
      function () { return '<h2>Comment tu t\'appelles ?</h2><input class="word" style="margin-top:22px" id="stName" placeholder="Ton prénom ou pseudo" value="' + esc(data.name || '') + '"><p class="hint">Tes buddy te retrouveront plus facilement.</p>'; },
      function () { return '<h2>Quel est ton <em>niveau</em> ?</h2><div style="margin-top:22px">' + chipSet('stLevel', [['beginner', 'Débutant'], ['intermediate', 'Intermédiaire'], ['advanced', 'Avancé'], ['expert', 'Expert']], 'col') + '</div><p class="hint">On adapte les spots et les conditions à ton niveau. Un débutant et un expert ne cherchent pas la même vague.</p>'; },
      function () { return '<h2>Quelles vagues tu <em>surfes</em> ?</h2><div class="two" style="margin-top:22px"><div class="box"><span>Hauteur min (m)</span><input type="number" step="0.1" id="stMin" value="' + (data.min || 0.5) + '"></div><div class="box"><span>Hauteur max (m)</span><input type="number" step="0.1" id="stMax" value="' + (data.max || 2.0) + '"></div></div><p class="hint">On ne te montre que les sessions dans ta zone. Pas de prévisions pour du 3m si tu surfes du 1m.</p>'; },
      function () { return '<h2>Ta première <em>board</em></h2><div style="margin-top:22px">' + chipSet('stBoard', [['shortboard', 'Shortboard'], ['fish', 'Fish'], ['midlength', 'Mid-length'], ['longboard', 'Longboard'], ['foamie', 'Foamie'], ['autre', 'Autre']], 'wrap').replace('id="stBoard"', 'id="stBoard" data-optional') + '</div><input class="word" style="margin-top:14px" id="stBSize" placeholder="Taille (ex: 6\'2)"><input class="word" id="stBName" placeholder="Nom de la board (optionnel)"><p class="hint">L\'app te dit quelle board sortir selon les conditions du jour.</p>'; },
      function () { return '<h2>Quand tu peux <em>surfer</em> ?</h2><div class="lab" style="margin-top:22px">Jours disponibles</div><div class="days" id="stDays" data-multi>' + [['lundi', 'Lun'], ['mardi', 'Mar'], ['mercredi', 'Mer'], ['jeudi', 'Jeu'], ['vendredi', 'Ven'], ['samedi', 'Sam'], ['dimanche', 'Dim']].map(function (d) { return '<button class="chip" data-v="' + d[0] + '">' + d[1] + '</button>'; }).join('') + '</div><div class="lab">Créneaux préférés</div>' + chipSet('stSlots', [['avant_8h', 'Avant 8h'], ['matin', 'Matin'], ['midi', 'Midi'], ['apres_midi', 'Après-midi'], ['apres_18h', 'Après 18h']], 'wrap', true) + '<p class="hint">On te prévient en priorité quand tu peux y aller. Pas quand t\'es au bureau.</p>'; }
    ];
    function keep() {
      if (step === 0) data.name = $('stName').value.trim();
      if (step === 1) data.level = picked('#stLevel')[0] || 'intermediate';
      if (step === 2) { data.min = parseFloat($('stMin').value) || 0.5; data.max = parseFloat($('stMax').value) || 2.0; }
      if (step === 3) { data.boardType = picked('#stBoard')[0] || null; data.boardSize = $('stBSize').value.trim() || null; data.boardName = $('stBName').value.trim() || null; }
      if (step === 4) { data.days = picked('#stDays'); data.slots = picked('#stSlots'); }
    }
    function draw() {
      var last = step === STEPS - 1;
      var box = open(dots(STEPS, step) + '<div class="st cur">' + screens[step]() + '<div class="msg" id="stMsg"></div><button class="save" id="stNext">' + (last ? 'C\'est parti !' : 'Suivant →') + '</button>' + (step === 3 ? '<button class="skip" id="stSkip">Passer cette étape</button>' : '') + '</div>');
      box.ontouchstart = box.ontouchend = null;
      wire(box);
      if (step === 1) { var c = box.querySelector('#stLevel [data-v="' + data.level + '"]'); if (c) c.classList.add('on'); }
      $('stNext').addEventListener('click', function () {
        keep();
        if (step === 0 && !data.name) { $('stMsg').textContent = 'Ton prénom ou pseudo est requis'; return; }
        if (last) finish(); else { step++; draw(); }
      });
      if ($('stSkip')) $('stSkip').addEventListener('click', function () { data.boardType = null; step++; draw(); });
    }
    function finish() {
      var btn = $('stNext'); btn.disabled = true;
      sb().from('profiles').insert({ id: userId, nickname: data.name, surf_level: data.level, min_wave_height: data.min || 0.5, max_wave_height: data.max || 2.0, available_days: data.days, available_slots: data.slots })
        .then(function (r) {
          if (r.error) { btn.disabled = false; $('stMsg').textContent = r.error.message; return; }
          var next = data.boardType ? sb().from('boards').insert({ user_id: userId, board_type: data.boardType, nickname: data.boardName, size: data.boardSize }) : Promise.resolve();
          return Promise.resolve(next).then(function () { location.reload(); });
        });
    }
    draw();
  };
})();

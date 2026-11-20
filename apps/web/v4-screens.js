// SurfAI v4 : ajouter une session, partage, profil, quiver, historique, spots.
(function () {
  'use strict';
  var A = window.SurfV4, $ = A.$, esc = A.esc, fr = A.fr, state = A.state, ICON = A.ICON;
  var sb = null;
  sb = A.client();

  var cache = { boards: null, favorites: null, profile: undefined, email: null };
  var LEVELS = [['beginner', 'Débutant'], ['intermediate', 'Intermédiaire'], ['advanced', 'Avancé'], ['expert', 'Expert']];
  var CLOSE = '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>';
  var STAR = '<svg viewBox="0 0 24 24"><path d="M12 2.800l2.900 5.900 6.500.900-4.700 4.600 1.100 6.500L12 17.600l-5.800 3.100 1.100-6.500L2.600 9.600l6.500-.900z"/></svg>';

  function stars(n) { n = Math.max(0, Math.min(5, Math.round(n || 0))); return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n); }
  function api(path, body) {
    var opt = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined;
    return fetch(A.BACKEND + '/api/v1' + path, opt).then(function (r) { return r.json(); });
  }
  function km(a, b) {
    var R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  // ───────── chargements ─────────
  function loadBoards(force) {
    if (A.DEMO) return Promise.resolve([{ id: 'b1', name: 'La grise', size: "6'6", board_type: 'shortboard', brand: 'Pyzel' }, { id: 'b2', name: 'Longboard', size: "9'2", board_type: 'longboard' }]);
    if (cache.boards && !force) return Promise.resolve(cache.boards);
    if (!sb) return Promise.resolve([]);
    return sb.from('boards').select('*').eq('user_id', state.userId).order('created_at', { ascending: false })
      .then(function (r) { cache.boards = (r.data || []).filter(function (b) { return b.is_active !== false; }); return cache.boards; })
      .catch(function () { return []; });
  }
  function loadFavorites(force) {
    if (A.DEMO) return Promise.resolve(state.results.filter(function (r) { return !r.discovery; }).map(function (r) { return r.spot; }));
    if (cache.favorites && !force) return Promise.resolve(cache.favorites);
    return api('/favorites?userId=' + encodeURIComponent(state.userId))
      .then(function (j) { cache.favorites = j.favorites || []; return cache.favorites; }).catch(function () { return []; });
  }
  function loadProfile() {
    if (A.DEMO) return Promise.resolve({ nickname: 'Romain', surf_level: 'intermediate', min_wave_height: 0.5, max_wave_height: 1.8 });
    if (cache.profile !== undefined) return Promise.resolve(cache.profile);
    var local = null; try { local = JSON.parse(localStorage.getItem('surfai_profile') || 'null'); } catch (e) { local = null; }
    if (!sb) { cache.profile = local; return Promise.resolve(local); }
    return sb.from('profiles').select('*').eq('id', state.userId).maybeSingle()
      .then(function (r) { cache.profile = r.data || local; return cache.profile; })
      .catch(function () { cache.profile = local; return local; });
  }
  function loadEmail() {
    if (!sb || A.DEMO) return Promise.resolve(null);
    return sb.auth.getSession().then(function (r) { return r.data && r.data.session ? r.data.session.user.email : null; }).catch(function () { return null; });
  }
  function knownSpots() {
    var seen = {}, out = [];
    (cache.favorites || []).concat(state.results.filter(function (r) { return !r.discovery; }).map(function (r) { return r.spot; }))
      .forEach(function (s) { if (s && !seen[s.id]) { seen[s.id] = 1; out.push(s); } });
    return out;
  }
  function searchSpots(q) {
    if (A.DEMO || !sb) return Promise.resolve([]);
    return sb.from('spots').select('id,name,city,country,lat,lng').ilike('name', '%' + q + '%').limit(12)
      .then(function (r) { return r.data || []; }).catch(function () { return []; });
  }

  // pastilles à choix unique (ou multiple, ou désélectionnable)
  function wireChips(root) {
    root.querySelectorAll('.chips').forEach(function (g) {
      g.addEventListener('click', function (e) {
        var c = e.target.closest('.chip'); if (!c) return; e.stopPropagation();
        var was = c.classList.contains('on');
        [].forEach.call(g.children, function (x) { x.classList.remove('on'); });
        if (!(was && g.hasAttribute('data-optional'))) c.classList.add('on');
        if (g._onpick) g._onpick(c);
      });
    });
  }
  function chosen(root, sel) { var c = root.querySelector(sel + ' .chip.on'); return c ? c.getAttribute('data-v') : null; }

  // ───────── ajouter une session ─────────
  function openAdd(preset) {
    var box = $('add'), now = new Date();
    Promise.all([loadFavorites(), loadBoards()]).then(function (res) {
      var spots = knownSpots(), boards = res[1];
      var pre = preset || (spots[0] && spots[0].id);
      box.innerHTML =
        '<button class="close" id="addClose" aria-label="Fermer">' + CLOSE + '</button>' +
        '<h2>Ajouter</h2>' +
        '<div class="q">Spot</div>' +
        '<div class="chips scroll-x" id="fSpot">' + spots.map(function (s) { return '<button class="chip' + (s.id === pre ? ' on' : '') + '" data-v="' + esc(s.id) + '">' + esc(s.name) + '</button>'; }).join('') + '</div>' +
        '<input class="word" id="fSearch" placeholder="Rechercher un spot...">' +
        '<div id="fFound"></div>' +
        '<div class="two"><div class="box"><span>Date</span><input type="date" id="fDate" value="' + A.localISO(now) + '" max="' + A.localISO(now) + '"></div>' +
        '<div class="box"><span>Heure</span><input type="time" id="fTime" value="' + String(Math.max(0, now.getHours() - 2)).padStart(2, '0') + ':00"></div></div>' +
        '<div class="q">Note de la session</div>' +
        '<div class="stars" id="fStars">' + [1, 2, 3, 4, 5].map(function () { return '<button type="button">' + STAR + '</button>'; }).join('') + '</div>' +
        '<div class="q">Pour toi, les vagues étaient</div>' +
        '<div class="chips" id="fSize" data-optional><button class="chip" data-v="too_small">Trop petites</button><button class="chip" data-v="perfect">À ma taille</button><button class="chip" data-v="too_big">Trop grosses</button></div>' +
        '<div class="q">Et le vent</div>' +
        '<div class="chips" id="fWind" data-optional><button class="chip" data-v="clean">Propre</button><button class="chip" data-v="annoying">Gênant</button><button class="chip" data-v="too_much">Trop fort</button></div>' +
        (boards.length ? '<div class="q">Board (optionnel)</div><div class="chips scroll-x" id="fBoard" data-optional>' + boards.map(function (b) { return '<button class="chip" data-v="' + esc(b.id) + '">' + esc(b.name || b.nickname || b.board_type || 'Board') + (b.size ? ' ' + esc(b.size) : '') + '</button>'; }).join('') + '</div>' : '') +
        '<div class="q">Notes libres</div>' +
        '<textarea class="word" id="fNotes" rows="3" placeholder="Comment était la session ?"></textarea>' +
        '<p class="auto">La houle, le vent et la marée de ce moment-là sont enregistrés tout seuls.</p>' +
        '<div class="msg" id="fMsg"></div>' +
        '<button class="save" id="fSave">Enregistrer la session</button>';
      wireChips(box);
      var rating = 0;
      [].forEach.call($('fStars').children, function (b, i) {
        b.addEventListener('click', function () { rating = i + 1; [].forEach.call($('fStars').children, function (x, k) { x.classList.toggle('on', k <= i); }); });
      });
      $('addClose').addEventListener('click', function () { box.classList.remove('show'); });
      var timer = null;
      $('fSearch').addEventListener('input', function () {
        var q = this.value.trim(); clearTimeout(timer);
        if (q.length < 2) { $('fFound').innerHTML = ''; return; }
        timer = setTimeout(function () {
          searchSpots(q).then(function (list) {
            $('fFound').innerHTML = list.map(function (s) { return '<div class="li act" data-id="' + esc(s.id) + '" data-name="' + esc(s.name) + '" style="cursor:pointer"><b style="color:#fff">' + esc(s.name) + '</b><span class="r" style="margin-left:auto;color:rgba(255,255,255,.6)">' + esc(s.city || s.country || '') + '</span></div>'; }).join('') || '<p class="auto">Aucun spot trouvé.</p>';
            $('fFound').querySelectorAll('[data-id]').forEach(function (row) {
              row.addEventListener('click', function () {
                var g = $('fSpot'); [].forEach.call(g.children, function (x) { x.classList.remove('on'); });
                var chip = document.createElement('button'); chip.className = 'chip on'; chip.setAttribute('data-v', row.getAttribute('data-id')); chip.textContent = row.getAttribute('data-name');
                g.insertBefore(chip, g.firstChild); g.scrollLeft = 0; $('fFound').innerHTML = ''; $('fSearch').value = '';
              });
            });
          });
        }, 250);
      });
      $('fSave').addEventListener('click', function () {
        var spotId = chosen(box, '#fSpot'), date = $('fDate').value, time = $('fTime').value, msg = $('fMsg');
        if (!spotId || !date || !time || !rating) { msg.textContent = 'Veuillez remplir : spot, date, heure et note.'; return; }
        var spotName = box.querySelector('#fSpot .chip.on').textContent;
        var payload = { userId: state.userId, spotId: spotId, date: date, time: time, rating: rating, notes: $('fNotes').value || '',
          boardId: chosen(box, '#fBoard'), sizeFeel: chosen(box, '#fSize'), windFeel: chosen(box, '#fWind') };
        var btn = $('fSave'); btn.disabled = true; btn.textContent = 'Enregistrement...'; msg.textContent = '';
        var send = A.DEMO ? Promise.resolve({ success: true, session: { meteo: { waveHeight: 1.2, windSpeed: 8, tidePhase: 'rising' } } }) : api('/sessions/quick', payload);
        send.then(function (j) {
          if (!j.success) throw new Error(j.error || 'Erreur serveur');
          state.sessions = null;
          box.classList.remove('show');
          openDone(spotName, rating, (j.session && j.session.meteo) || j.meteo || null);
        }).catch(function (e) {
          btn.disabled = false; btn.textContent = 'Enregistrer la session'; msg.textContent = 'La session n\'a pas pu être enregistrée. ' + (e.message || '');
        });
      });
      box.scrollTop = 0; box.classList.add('show');
    });
  }

  // ───────── confirmation et partage ─────────
  function openDone(spotName, rating, meteo) {
    var box = $('done'), bits = [];
    if (meteo) {
      if (meteo.waveHeight != null) bits.push(fr(meteo.waveHeight) + ' m');
      if (meteo.windSpeed != null) bits.push('Vent ' + A.windWord(meteo.windSpeed).toLowerCase());
      var tide = { rising: 'Marée montante', falling: 'Marée descendante', high: 'Marée haute', low: 'Marée basse' }[meteo.tidePhase];
      if (tide) bits.push(tide);
    }
    var line = bits.join(' · ');
    box.innerHTML =
      '<button class="close" id="doneClose" aria-label="Fermer">' + CLOSE + '</button>' +
      '<div class="ok"><svg viewBox="0 0 24 24"><path d="M5 12.500l4.500 4.500L19 7.500"/></svg></div>' +
      '<h2>Session enregistrée !</h2>' +
      '<div class="share"><span class="brand">SurfAI</span><div class="txt"><b>' + esc(spotName) + '</b><i>' + stars(rating) + '</i><span>' + esc(line) + '</span></div></div>' +
      '<div class="msg fine" id="doneMsg"></div>' +
      '<button class="save" id="doneShare">Partager ta session</button>' +
      '<button class="skip" id="doneSkip">Passer</button>';
    function close() { box.classList.remove('show'); A.reload(); }
    $('doneClose').addEventListener('click', close);
    $('doneSkip').addEventListener('click', close);
    $('doneShare').addEventListener('click', function () {
      var text = 'Session à ' + spotName + ' ' + stars(rating) + (line ? '\n' + line : '') + '\nNoté avec SurfAI';
      if (navigator.share) { navigator.share({ title: 'Ma session de surf', text: text }).catch(function () {}); return; }
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { $('doneMsg').textContent = 'Texte copié, tu peux le coller où tu veux.'; });
    });
    box.scrollTop = 0; box.classList.add('show');
  }

  // ───────── profil ─────────
  function li(title, sub, right) {
    return '<div class="li"><div><b>' + esc(title) + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</div>' + (right ? '<span class="r">' + right + '</span>' : '') + '</div>';
  }
  function spotRow(s, favIds, extra) {
    return '<div class="li"><div><b>' + esc(s.name) + '</b><span>' + esc(s.city || s.country || '') + (extra ? ' · ' + extra : '') + '</span></div>' +
      '<button class="fav' + (favIds[s.id] ? ' on' : '') + '" data-fav="' + esc(s.id) + '" aria-label="Favori">★</button></div>';
  }
  function card(cls, title, count, inner, open) {
    return '<article class="day ' + cls + (open ? ' open' : '') + '"><div class="row"><div class="name">' + title + '</div>' + (count != null ? '<div class="count">' + count + '</div>' : '') + '</div>' +
      '<div class="more"><div><div class="inner">' + inner + '</div></div></div></article>';
  }
  function renderMe() {
    var box = $('me');
    box.innerHTML = '<div class="head"><h1>Profil</h1></div><div class="skel"></div><div class="skel"></div>';
    Promise.all([loadProfile(), loadBoards(), A.loadSessions(), loadFavorites(), loadEmail()]).then(function (res) {
      var p = res[0] || {}, boards = res[1], sessions = res[2] || [], favs = res[3], email = res[4];
      var name = p.nickname || p.pseudo || 'Surfeur', level = p.surf_level || p.level || '';
      var levelLabel = (LEVELS.filter(function (l) { return l[0] === level; })[0] || [])[1] || '';
      var home = null; try { home = JSON.parse(localStorage.getItem('home_spot') || 'null'); } catch (e) { home = null; }
      var favIds = {}; favs.forEach(function (s) { favIds[s.id] = 1; });
      var boardName = {}; boards.forEach(function (b) { boardName[b.id] = b.name || b.nickname || b.board_type; });
      var avatar = p.avatar_url ? ' style="background:center/cover url(\'' + esc(p.avatar_url) + '\')"' : '';

      var profil =
        '<div class="lab" style="margin-top:0">Pseudo</div><input class="word" id="pName" placeholder="Votre pseudo" value="' + esc(p.nickname || p.pseudo || '') + '">' +
        '<div class="lab">Niveau de surf</div><div class="chips four" id="pLevel">' + LEVELS.map(function (l) { return '<button class="chip' + (l[0] === level ? ' on' : '') + '" data-v="' + l[0] + '">' + l[1] + '</button>'; }).join('') + '</div>' +
        '<div class="li" style="margin-top:14px"><div><b>Mon home spot</b></div><span class="r">' + esc(home && home.name ? home.name : 'Non défini') + '</span></div>' +
        '<div class="lab">Les vagues que je surfe</div>' +
        '<div class="two"><div class="box"><span>Min (m)</span><input type="number" step="0.1" min="0" id="pMin" value="' + (p.min_wave_height != null ? p.min_wave_height : '') + '"></div>' +
        '<div class="box"><span>Max (m)</span><input type="number" step="0.1" min="0" id="pMax" value="' + (p.max_wave_height != null ? p.max_wave_height : '') + '"></div></div>' +
        '<div class="msg" id="pMsg"></div><button class="mini" id="pSave">Sauvegarder</button>';

      var quiver = (boards.length ? boards.map(function (b) {
        var sub = [b.board_type ? A.cap(String(b.board_type)) : '', b.size || '', b.brand || ''].filter(Boolean).join(' · ');
        var th = b.photo_url ? '<div class="th" style="background:center/cover url(\'' + esc(b.photo_url) + '\')"></div>' : '<div class="th c"></div>';
        return '<div class="li">' + th + '<div><b>' + esc(b.name || b.nickname || 'Board') + '</b><span>' + esc(sub) + '</span></div></div>';
      }).join('') : '<p class="why" style="color:rgba(255,255,255,.62)">Aucune board dans ton quiver</p>') +
        '<div class="li act" id="openBoard"><b>+ Ajouter une board</b></div>';

      var shown = 6;
      function histRows(n) {
        return sessions.slice(0, n).map(function (s) {
          var d = s.date ? A.dateOf(String(s.date).slice(0, 10)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : '';
          return li((s.spots && s.spots.name) || 'Spot', [d, boardName[s.board_id]].filter(Boolean).join(' · '), stars(s.rating));
        }).join('');
      }
      var hist = sessions.length ? '<div id="hRows">' + histRows(shown) + '</div>' + (sessions.length > shown ? '<div class="li act" id="hMore"><b>Voir plus</b></div>' : '')
        : '<p class="why" style="color:rgba(255,255,255,.62)">Aucune session enregistrée.</p>';

      var spots =
        '<div class="lab" style="margin-top:0">Favoris</div><div id="sFavs">' + (favs.map(function (s) { return spotRow(s, favIds); }).join('') || '<p class="why" style="color:rgba(255,255,255,.62)">Aucun favori pour l\'instant.</p>') + '</div>' +
        '<div class="seg" id="seg" style="margin-top:14px"><span class="on">Autour de moi</span><span>Explorer</span></div>' +
        '<div id="near"><p class="why" style="color:rgba(255,255,255,.62)">Recherche des spots autour de toi...</p></div>' +
        '<div id="exp" style="display:none"><input class="word" id="sSearch" placeholder="Rechercher un spot..."><div id="sFound"></div></div>';

      var notif = '<div class="li"><div><b>Prédictions par email</b><span>Dimanche + jeudi</span></div><button class="tog" id="nTog" aria-label="Prédictions par email" style="border:0;cursor:pointer;margin-left:auto;' + (p.email_predictions ? '' : 'opacity:.35') + '"></button></div>';

      var compte = li('Email', null, esc(email || 'Non connecté')) +
        '<div class="li act" id="cOld"><b>Ouvrir l\'ancienne version</b></div>' +
        (email ? '<div class="li act" id="cOut"><b>Se déconnecter</b></div>' : '');

      box.innerHTML =
        '<div class="head"><h1>Profil</h1></div>' +
        '<div class="who"><div class="avatar"' + avatar + '></div><div><b>' + esc(name) + '</b><span>' + esc(levelLabel) + '</span></div></div>' +
        '<div class="stack">' +
          card('p1', 'Profil', esc(levelLabel), profil, true) +
          card('p2', 'Mon Quiver', boards.length, quiver) +
          card('p3', 'Historique', sessions.length, hist) +
          card('p4', 'Spots', favs.length + (favs.length > 1 ? ' favoris' : ' favori'), spots) +
          card('p5', 'Notifications', null, notif) +
          card('p6', 'Compte', null, compte) +
        '</div>';

      // dépliage
      box.querySelectorAll('.day').forEach(function (c) {
        c.addEventListener('click', function () {
          var was = c.classList.contains('open');
          box.querySelectorAll('.day.open').forEach(function (x) { x.classList.remove('open'); });
          if (!was) c.classList.add('open');
        });
      });
      box.querySelectorAll('.inner').forEach(function (n) { n.addEventListener('click', function (e) { e.stopPropagation(); }); });
      wireChips(box);

      // profil
      $('pSave').addEventListener('click', function () {
        var data = { nickname: $('pName').value.trim(), surf_level: chosen(box, '#pLevel') || level || null,
          min_wave_height: parseFloat($('pMin').value) || null, max_wave_height: parseFloat($('pMax').value) || null };
        try { localStorage.setItem('surfai_profile', JSON.stringify(data)); } catch (e) { /* stockage indisponible */ }
        var msg = $('pMsg'); msg.className = 'msg';
        if (A.DEMO || !sb) { msg.className = 'msg fine'; msg.textContent = 'Profil sauvegardé !'; return; }
        var row = { id: state.userId, updated_at: new Date().toISOString() }; for (var k in data) row[k] = data[k];
        sb.from('profiles').upsert(row).then(function (r) {
          if (r.error) { msg.textContent = 'Le profil n\'a pas pu être sauvegardé. ' + r.error.message; return; }
          cache.profile = undefined; msg.className = 'msg fine'; msg.textContent = 'Profil sauvegardé !'; A.reload();
        });
      });
      // quiver
      $('openBoard').addEventListener('click', openBoard);
      // historique
      if ($('hMore')) $('hMore').addEventListener('click', function () { shown += 12; $('hRows').innerHTML = histRows(shown); if (shown >= sessions.length) this.style.display = 'none'; });
      // spots
      function wireFavs(root) {
        root.querySelectorAll('[data-fav]').forEach(function (b) {
          b.addEventListener('click', function () {
            var id = b.getAttribute('data-fav'); b.classList.toggle('on');
            if (A.DEMO) return;
            api('/favorites/toggle', { userId: state.userId, spotId: id }).then(function () { cache.favorites = null; A.reload(); });
          });
        });
      }
      wireFavs(box);
      [].forEach.call($('seg').children, function (sp, i) {
        sp.addEventListener('click', function () {
          $('seg').children[0].classList.toggle('on', i === 0); $('seg').children[1].classList.toggle('on', i === 1);
          $('near').style.display = i === 0 ? '' : 'none'; $('exp').style.display = i === 1 ? '' : 'none';
        });
      });
      var pos = state.position || (home && home.lat ? { lat: Number(home.lat), lng: Number(home.lng) } : (favs[0] && favs[0].lat ? { lat: Number(favs[0].lat), lng: Number(favs[0].lng) } : null));
      if (pos && sb && !A.DEMO) {
        sb.from('spots').select('id,name,city,country,lat,lng').gte('lat', pos.lat - 0.3).lte('lat', pos.lat + 0.3).gte('lng', pos.lng - 0.45).lte('lng', pos.lng + 0.45).limit(200)
          .then(function (r) {
            var list = (r.data || []).map(function (s) { s._d = km(pos, { lat: Number(s.lat), lng: Number(s.lng) }); return s; })
              .filter(function (s) { return s._d <= 30 && !favIds[s.id]; }).sort(function (a, b) { return a._d - b._d; }).slice(0, 12);
            $('near').innerHTML = list.map(function (s) { return spotRow(s, favIds, fr(s._d, s._d < 10 ? 1 : 0) + ' km'); }).join('') || '<p class="why" style="color:rgba(255,255,255,.62)">Aucun autre spot à moins de 30 km.</p>';
            wireFavs($('near'));
          });
      } else { $('near').innerHTML = '<p class="why" style="color:rgba(255,255,255,.62)">Position inconnue. Utilise Explorer pour chercher un spot.</p>'; }
      var t = null;
      $('sSearch').addEventListener('input', function () {
        var q = this.value.trim(); clearTimeout(t);
        if (q.length < 2) { $('sFound').innerHTML = ''; return; }
        t = setTimeout(function () { searchSpots(q).then(function (list) {
          $('sFound').innerHTML = list.map(function (s) { return spotRow(s, favIds); }).join('') || '<p class="why" style="color:rgba(255,255,255,.62)">Aucun spot trouvé.</p>';
          wireFavs($('sFound'));
        }); }, 250);
      });
      // notifications
      var notifOn = !!p.email_predictions;
      $('nTog').addEventListener('click', function () {
        notifOn = !notifOn; var on = notifOn; this.style.opacity = on ? '' : '.35';
        if (A.DEMO || !sb) return;
        sb.from('profiles').upsert({ id: state.userId, email_predictions: on, updated_at: new Date().toISOString() }).then(function () { cache.profile = undefined; });
      });
      // compte
      $('cOld').addEventListener('click', function () { location.href = 'ancienne.html'; });
      if ($('cOut')) $('cOut').addEventListener('click', function () { sb.auth.signOut().then(function () { location.href = 'ancienne.html?retour=1'; }); });
    });
  }

  // ───────── ajouter une board ─────────
  function chipRow(id, names, optional) {
    return '<div class="chips scroll-x" id="' + id + '"' + (optional ? ' data-optional' : '') + '>' + names.map(function (n) { return '<button class="chip" data-v="' + esc(n.toLowerCase()) + '">' + esc(n) + '</button>'; }).join('') + '</div>';
  }
  function openBoard() {
    var box = $('board');
    box.innerHTML =
      '<button class="close" id="bClose" aria-label="Fermer">' + CLOSE + '</button>' +
      '<h2>Ajouter une board</h2>' +
      '<div class="q">L\'essentiel</div>' +
      '<div class="lab">Nom</div><input class="word" id="bName" placeholder="Nom de la board (optionnel)">' +
      '<div class="lab">Type</div>' + chipRow('bType', ['Shortboard', 'Fish', 'Hybrid', 'Midlength', 'Funboard', 'Longboard', 'Gun', 'SUP', 'Foil']) +
      '<div class="lab">Taille</div><input class="word" id="bSize" placeholder="Taille (ex: 6\'2)">' +
      '<div class="q">Les détails</div>' +
      '<div class="two"><div class="box"><span>Marque</span><input id="bBrand"></div><div class="box"><span>Shaper</span><input id="bShaper"></div></div>' +
      '<div class="two"><div class="box"><span>Année</span><input id="bYear" type="number" inputmode="numeric"></div><div class="box"><span>Largeur (")</span><input id="bWidth" type="number" step="0.01"></div></div>' +
      '<div class="lab">Tail</div>' + chipRow('bTail', ['Squash', 'Round', 'Pin', 'Swallow', 'Diamond'], true) +
      '<div class="lab">Fins</div>' + chipRow('bFins', ['Single', 'Twin', 'Thruster', 'Quad', '2+1', '5-box'], true) +
      '<div class="lab">État</div><div class="chips four" id="bCond" data-optional><button class="chip" data-v="neuf">Neuf</button><button class="chip on" data-v="bon">Bon</button><button class="chip" data-v="use">Usé</button><button class="chip" data-v="a_reparer">À réparer</button></div>' +
      '<div class="q">Dans quelles conditions tu la sors ?</div>' +
      '<div class="two"><div class="box"><span>Houle min (m)</span><input id="bMin" type="number" step="0.1"></div><div class="box"><span>Houle max (m)</span><input id="bMax" type="number" step="0.1"></div></div>' +
      '<div class="lab">Marée</div><div class="chips four" id="bTide"><button class="chip" data-v="low">Basse</button><button class="chip" data-v="mid">Mi-marée</button><button class="chip" data-v="high">Haute</button><button class="chip on" data-v="any">Peu importe</button></div>' +
      '<div class="msg" id="bMsg"></div>' +
      '<button class="save" id="bSave">Ajouter cette board</button>';
    wireChips(box);
    $('bClose').addEventListener('click', function () { box.classList.remove('show'); });
    $('bSave').addEventListener('click', function () {
      var type = chosen(box, '#bType'), msg = $('bMsg');
      if (!type) { msg.textContent = 'Choisis au moins le type de board.'; return; }
      var name = $('bName').value.trim();
      var row = { user_id: state.userId, name: name || A.cap(type), nickname: name || null, board_type: type, size: $('bSize').value.trim() || null,
        brand: $('bBrand').value.trim() || null, shaper: $('bShaper').value.trim() || null,
        year_made: parseInt($('bYear').value, 10) || null, width_in: parseFloat($('bWidth').value) || null,
        tail_shape: chosen(box, '#bTail'), fins_setup: chosen(box, '#bFins'), condition: chosen(box, '#bCond') || 'bon',
        sweet_spot_wave_min: parseFloat($('bMin').value) || null, sweet_spot_wave_max: parseFloat($('bMax').value) || null,
        sweet_spot_wind: 'any', sweet_spot_tide: chosen(box, '#bTide') || 'any' };
      if (A.DEMO || !sb) { box.classList.remove('show'); return; }
      var btn = $('bSave'); btn.disabled = true;
      sb.from('boards').insert([row]).then(function (r) {
        btn.disabled = false;
        if (r.error) { msg.textContent = 'La board n\'a pas pu être ajoutée. ' + r.error.message; return; }
        cache.boards = null; box.classList.remove('show'); renderMe();
      });
    });
    box.scrollTop = 0; box.classList.add('show');
  }

  // ───────── menu ─────────
  function go(me) {
    var nb = document.querySelectorAll('.nav button');
    $('me').classList.toggle('show', me); nb[0].classList.toggle('cur', !me); nb[2].classList.toggle('cur', me);
    if (me) { $('me').scrollTop = 0; renderMe(); }
  }
  A.onReady = function () {
    var nb = document.querySelectorAll('.nav button');
    nb[0].addEventListener('click', function () { go(false); });
    nb[1].addEventListener('click', function () { openAdd(); });
    nb[2].addEventListener('click', function () { go(true); });
  };
})();

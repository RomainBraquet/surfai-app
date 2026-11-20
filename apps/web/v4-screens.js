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
      .then(function (r) { cache.boards = (r.data || []).filter(function (b) { return b.is_active !== false; }).map(function (b) { b.type = b.board_type || b.type; return b; }); window.userData.boards = cache.boards; return cache.boards; })
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
    return sb.auth.getSession().then(function (r) {
      var u = r.data && r.data.session ? r.data.session.user : null;
      return u ? { email: u.email, provider: (u.app_metadata && u.app_metadata.provider) || 'email' } : null;
    }).catch(function () { return null; });
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
        '<p class="auto" style="margin-top:8px">Facultatif. C\'est ce qui apprend à SurfAI ta vraie taille de vagues.</p>' +
        '<div class="q">Et le vent</div>' +
        '<div class="chips" id="fWind" data-optional><button class="chip" data-v="clean">Propre</button><button class="chip" data-v="annoying">Gênant</button><button class="chip" data-v="too_much">Trop fort</button></div>' +
        '<p class="auto" style="margin-top:8px">Facultatif. SurfAI apprend le vent que tu supportes.</p>' +
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
          var met = (j.session && j.session.meteo) || j.meteo || null, sp = knownSpots().filter(function (x) { return String(x.id) === String(spotId); })[0];
          openDone(spotName, rating, met, { spotName: spotName, spotCity: (sp && sp.city) || '', date: date, rating: rating, nickname: (cache.profile && (cache.profile.nickname || cache.profile.pseudo)) || '', meteo: met });
        }).catch(function (e) {
          btn.disabled = false; btn.textContent = 'Enregistrer la session'; msg.textContent = 'La session n\'a pas pu être enregistrée. ' + (e.message || '');
        });
      });
      box.scrollTop = 0; box.classList.add('show');
    });
  }

  // ───────── confirmation et partage ─────────
  function openDone(spotName, rating, meteo, share) {
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
      '<label class="save" style="display:block;text-align:center;cursor:pointer">Partager ta session<input type="file" accept="image/*" id="doneFile" style="display:none"></label>' +
      '<button class="skip" id="doneSkip">Passer</button>';
    function close() { box.classList.remove('show'); A.reload(); }
    $('doneClose').addEventListener('click', close);
    $('doneSkip').addEventListener('click', close);
    $('doneFile').addEventListener('change', function () {
      var f = this.files[0]; if (!f) return;
      $('doneMsg').textContent = 'Génération en cours...';
      generateShareCard(f, share).then(function (canvas) { showCard(box, canvas, share, close); })
        .catch(function () { $('doneMsg').className = 'msg'; $('doneMsg').textContent = 'Erreur lors de la génération de l\'image.'; });
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
  function renderMe(openCls) {
    var box = $('me');
    box.innerHTML = '<div class="head"><h1>Profil</h1></div><div class="skel"></div><div class="skel"></div>';
    Promise.all([loadProfile(), loadBoards(), A.loadSessions(), loadFavorites(), loadEmail()]).then(function (res) {
      var p = res[0] || {}, boards = res[1], sessions = res[2] || [], favs = res[3], account = res[4], email = account && account.email;
      var name = p.nickname || p.pseudo || 'Surfeur', level = p.surf_level || p.level || '';
      var levelLabel = (LEVELS.filter(function (l) { return l[0] === level; })[0] || [])[1] || '';
      var home = null; try { home = JSON.parse(localStorage.getItem('home_spot') || 'null'); } catch (e) { home = null; }
      var favIds = {}; favs.forEach(function (s) { favIds[s.id] = 1; });
      var boardName = {}; boards.forEach(function (b) { boardName[b.id] = b.name || b.nickname || b.board_type; });
      var avatarUrl = p.avatar_url || null; try { avatarUrl = avatarUrl || localStorage.getItem('surfai_avatar'); } catch (e) { /* stockage indisponible */ }
      var avatar = avatarUrl ? ' style="background:center/cover url(\'' + esc(avatarUrl) + '\')"' : '';

      var profil =
        '<div class="lab" style="margin-top:0">Pseudo</div><input class="word" id="pName" placeholder="Votre pseudo" value="' + esc(p.nickname || p.pseudo || '') + '">' +
        '<div class="lab">Niveau de surf</div><div class="chips four" id="pLevel">' + LEVELS.map(function (l) { return '<button class="chip' + (l[0] === level ? ' on' : '') + '" data-v="' + l[0] + '">' + l[1] + '</button>'; }).join('') + '</div>' +
        '<div class="li act" id="hsRow" style="margin-top:14px"><div><b style="color:#fff">Mon home spot</b></div><span class="r" id="hsName">' + esc(home && home.name ? home.name : 'Choisir un spot') + '</span></div>' +
        '<div id="hsPick" style="display:none"><input class="word" id="hsSearch" placeholder="Rechercher un spot..."><div id="hsFound"></div></div>' +
        '<div class="lab">Les vagues que je surfe</div>' +
        '<div class="two"><div class="box"><span>Min (m)</span><input type="number" step="0.1" min="0" id="pMin" value="' + (p.min_wave_height != null ? p.min_wave_height : '') + '"></div>' +
        '<div class="box"><span>Max (m)</span><input type="number" step="0.1" min="0" id="pMax" value="' + (p.max_wave_height != null ? p.max_wave_height : '') + '"></div></div>' +
        '<div class="msg" id="pMsg"></div><button class="mini" id="pSave">Sauvegarder</button>';

      window.userData.sessions = sessions;
      var quiver = (boards.length ? boards.map(function (b) {
        var dims = [b.length_ft || b.size, b.width_in ? b.width_in + '"' : '', b.thickness_in ? b.thickness_in + '"' : ''].filter(Boolean).join(' × ');
        var line1 = [dims, b.volume_l ? b.volume_l + 'L' : '', b.type ? A.cap(String(b.type)) : ''].filter(Boolean).join(' · ');
        var shaper = [b.shaper, b.brand].filter(Boolean).join(' · ');
        var setup = [b.fins_setup, b.tail_shape].filter(Boolean).join(' · ');
        var sweet = formatSweetSpot(b), st = getBoardSessionStats(b.id);
        var th = b.photo_url ? '<div class="th big" style="background:center/cover url(\'' + esc(b.photo_url) + '\')"></div>' : '<div class="th big c"></div>';
        return '<div class="bcard">' +
          '<div class="li" style="border-top:0;padding-top:0">' + th + '<div><b>' + esc(b.nickname || b.name || 'Board') + '</b>' +
            (line1 ? '<span>' + esc(line1) + '</span>' : '') + (shaper ? '<span style="display:block">' + esc(shaper) + '</span>' : '') + (setup ? '<span style="display:block">' + esc(setup) + '</span>' : '') + '</div></div>' +
          (sweet ? '<div class="sweet">★ Sweet spot : ' + esc(sweet) + '</div>' : '') +
          '<div class="bfoot"><span>' + (st.count ? st.count + ' session' + (st.count > 1 ? 's' : '') + ' · ' + esc(st.lastDate) : 'Pas encore de session') + '</span>' +
            '<span class="bact"><button data-edit="' + esc(b.id) + '">Modifier</button><button data-share="' + esc(b.id) + '">Partager</button><button class="del" data-del="' + esc(b.id) + '">Supprimer</button></span></div>' +
        '</div>';
      }).join('') : '<p class="why" style="color:rgba(255,255,255,.62)">Aucune board dans ton quiver</p>') +
        '<div class="li act" id="openBoard"><b>+ Ajouter une board</b></div>';

      var shown = 6, sortBy = 'date';
      function sortedSessions() {
        var list = sessions.slice();
        if (sortBy === 'note') list.sort(function (a, b) { return (b.rating || 0) - (a.rating || 0); });
        else if (sortBy === 'spot') list.sort(function (a, b) { return String((a.spots && a.spots.name) || '').localeCompare(String((b.spots && b.spots.name) || '')); });
        else list.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
        return list;
      }
      function histRows(n) {
        return sortedSessions().slice(0, n).map(function (s) {
          var d = s.date ? A.dateOf(String(s.date).slice(0, 10)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: '2-digit' }) : '';
          var wave = s.meteo && s.meteo.waveHeight != null ? fr(s.meteo.waveHeight) + ' m' : '';
          return '<div class="li act" data-sid="' + esc(s.id) + '"><div><b style="color:#fff">' + esc((s.spots && s.spots.name) || 'Spot') + '</b><span>' + esc([d, boardName[s.board_id], wave].filter(Boolean).join(' · ')) + '</span></div><span class="r">' + stars(s.rating) + '</span></div>';
        }).join('');
      }
      var hist = sessions.length ? '<div class="chips" id="hSort"><button class="chip on" data-v="date">Date</button><button class="chip" data-v="note">★ Note</button><button class="chip" data-v="spot">Spot</button></div>' +
        '<div id="hRows" style="margin-top:8px">' + histRows(shown) + '</div>' + (sessions.length > shown ? '<div class="li act" id="hMore"><b>Voir toutes les sessions (' + sessions.length + ')</b></div>' : '')
        : '<p class="why" style="color:rgba(255,255,255,.62)">Aucune session enregistrée.</p>';

      var spots =
        '<div class="lab" style="margin-top:0">Favoris</div><div id="sFavs">' + (favs.map(function (s) { return spotRow(s, favIds); }).join('') || '<p class="why" style="color:rgba(255,255,255,.62)">Aucun favori pour l\'instant.</p>') + '</div>' +
        '<div class="seg" id="seg" style="margin-top:14px"><span class="on">Autour de moi</span><span>Explorer</span></div>' +
        '<div id="near"><p class="why" style="color:rgba(255,255,255,.62)">Recherche des spots autour de toi...</p></div>' +
        '<div id="exp" style="display:none"><input class="word" id="sSearch" placeholder="Rechercher un spot..."><div id="sFound"></div></div>';

      var notif = '<div class="li"><div><b>Prédictions par email</b><span>Dimanche + jeudi</span></div><button class="tog" id="nTog" aria-label="Prédictions par email" style="border:0;cursor:pointer;margin-left:auto;' + (p.email_predictions ? '' : 'opacity:.35') + '"></button></div>';

      var isEmail = account && account.provider === 'email';
      var compte = li('Email', null, esc(email || 'Non connecté')) +
        (account ? (isEmail ? '<div class="li act" id="pwRow"><b>Changer le mot de passe</b></div>' +
            '<div id="pwForm" style="display:none"><input class="word" type="password" id="pwNew" placeholder="Nouveau mot de passe (min 6 caractères)"><input class="word" type="password" id="pwConf" placeholder="Confirmer le mot de passe"><div class="msg" id="pwMsg"></div><button class="mini" id="pwSave">Sauvegarder</button></div>'
          : '<p class="why" style="color:rgba(255,255,255,.62);padding:10px 0">Connecté via ' + esc(A.cap(account.provider)) + ', mot de passe non modifiable</p>') : '') +
        '<div class="li act" id="cOld"><b>Ouvrir l\'ancienne version</b></div>' +
        (email ? '<div class="li act" id="cOut"><b>Se déconnecter</b></div>' : '');

      box.innerHTML =
        '<div class="head"><h1>Profil</h1></div>' +
        '<label class="who" style="cursor:pointer"><div class="avatar" id="avatar"' + avatar + '></div><div><b>' + esc(name) + '</b><span id="avatarTxt">Appuie pour changer la photo</span></div><input type="file" accept="image/*" id="avatarFile" style="display:none"></label>' +
        '<div class="stack">' +
          card('p1', 'Profil', esc(levelLabel), profil, !openCls) +
          card('p2', 'Mon Quiver', boards.length, quiver) +
          card('p3', 'Historique', sessions.length, hist) +
          card('p4', 'Spots', favs.length + (favs.length > 1 ? ' favoris' : ' favori'), spots) +
          card('p5', 'Notifications', null, notif) +
          card('p6', 'Compte', null, compte) +
        '</div>';

      if (openCls && box.querySelector('.day.' + openCls)) box.querySelector('.day.' + openCls).classList.add('open');
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
      $('openBoard').addEventListener('click', function () { openBoard(null); });
      function boardById(id) { return boards.filter(function (b) { return String(b.id) === String(id); })[0]; }
      box.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { openBoard(boardById(b.getAttribute('data-edit'))); }); });
      box.querySelectorAll('[data-share]').forEach(function (b) { b.addEventListener('click', function () { openBoardShare(boardById(b.getAttribute('data-share'))); }); });
      box.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { deleteBoard(b.getAttribute('data-del')); }); });
      // historique
      function wireHist() {
        $('hRows').querySelectorAll('[data-sid]').forEach(function (row) { row.addEventListener('click', function () {
          openSession(sessions.filter(function (x) { return String(x.id) === row.getAttribute('data-sid'); })[0]); }); });
      }
      if ($('hRows')) {
        wireHist();
        $('hSort')._onpick = function (c) { sortBy = c.getAttribute('data-v'); $('hRows').innerHTML = histRows(shown); wireHist(); };
        if ($('hMore')) $('hMore').addEventListener('click', function () { shown = sessions.length; $('hRows').innerHTML = histRows(shown); wireHist(); this.style.display = 'none'; });
      }
      // photo de profil (même rangement que l'ancienne version)
      $('avatarFile').addEventListener('change', function () {
        var f = this.files[0]; if (!f) return;
        if (f.size > 2 * 1024 * 1024) { $('avatarTxt').textContent = 'Image trop lourde (max 2 MB)'; return; }
        if (A.DEMO || !sb) return;
        var path = 'avatars/' + state.userId + '.' + f.name.split('.').pop();
        $('avatarTxt').textContent = 'Envoi en cours...';
        sb.storage.from('avatars').upload(path, f, { upsert: true }).then(function (r) {
          if (r.error) throw r.error;
          var url = sb.storage.from('avatars').getPublicUrl(path).data.publicUrl + '?t=' + Date.now();
          try { localStorage.setItem('surfai_avatar', url); } catch (e) { /* stockage indisponible */ }
          $('avatar').style.background = 'center/cover url(' + url + ')'; $('avatarTxt').textContent = 'Appuie pour changer la photo';
        }).catch(function (e) { $('avatarTxt').textContent = 'La photo n\'a pas pu être envoyée.'; });
      });
      // home spot
      $('hsRow').addEventListener('click', function () { var b = $('hsPick'); b.style.display = b.style.display === 'none' ? '' : 'none'; if (b.style.display === '') $('hsSearch').focus(); });
      var th = null;
      $('hsSearch').addEventListener('input', function () {
        var q = this.value.trim(); clearTimeout(th);
        if (q.length < 2) { $('hsFound').innerHTML = ''; return; }
        th = setTimeout(function () { searchSpots(q).then(function (list) {
          $('hsFound').innerHTML = list.map(function (sp, k) { return '<div class="li act" data-k="' + k + '"><div><b style="color:#fff">' + esc(sp.name) + '</b><span>' + esc(sp.city || sp.country || '') + '</span></div></div>'; }).join('') || '<p class="why" style="color:rgba(255,255,255,.62)">Aucun spot trouvé.</p>';
          $('hsFound').querySelectorAll('[data-k]').forEach(function (row) { row.addEventListener('click', function () {
            var sp = list[parseInt(row.getAttribute('data-k'), 10)];
            try { localStorage.setItem('home_spot', JSON.stringify({ id: sp.id, name: sp.name, lat: sp.lat, lng: sp.lng })); } catch (e) { /* stockage indisponible */ }
            $('hsName').textContent = sp.name; $('hsPick').style.display = 'none'; $('hsFound').innerHTML = ''; $('hsSearch').value = ''; A.reload();
          }); });
        }); }, 250);
      });
      // mot de passe
      if ($('pwRow')) {
        $('pwRow').addEventListener('click', function () { var b = $('pwForm'); b.style.display = b.style.display === 'none' ? '' : 'none'; });
        $('pwSave').addEventListener('click', function () {
          var a = $('pwNew').value, c = $('pwConf').value, m = $('pwMsg'); m.className = 'msg';
          if (!a || a.length < 6) { m.textContent = 'Le mot de passe doit faire au moins 6 caractères'; return; }
          if (a !== c) { m.textContent = 'Les mots de passe ne correspondent pas'; return; }
          sb.auth.updateUser({ password: a }).then(function (r) {
            if (r.error) { m.textContent = r.error.message; return; }
            m.className = 'msg fine'; m.textContent = 'Mot de passe mis à jour !'; $('pwNew').value = ''; $('pwConf').value = '';
          });
        });
      }
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

  // ───────── session : modifier ou supprimer ─────────
  function openSession(s) {
    if (!s) return;
    var box = $('board'), rating = Math.round(s.rating || 0), m = s.meteo || {};
    var meteo = [m.waveHeight != null ? fr(m.waveHeight) + ' m' : '', m.windSpeed != null ? Math.round(m.windSpeed) + ' km/h' : '', m.wavePeriod != null ? Math.round(m.wavePeriod) + ' s' : ''].filter(Boolean).join(' · ');
    box.innerHTML =
      '<button class="close" id="eClose" aria-label="Fermer">' + CLOSE + '</button>' +
      '<h2 style="font-size:34px">Modifier session</h2><p class="hint" style="margin-top:4px">' + esc((s.spots && s.spots.name) || '') + '</p>' +
      '<div class="two"><div class="box" style="grid-column:1/-1"><span>Date</span><input type="date" id="eDate" value="' + esc(String(s.date || '').slice(0, 10)) + '"></div></div>' +
      '<div class="q">Note de la session</div><div class="stars" id="eStars">' + [1, 2, 3, 4, 5].map(function (k) { return '<button type="button"' + (k <= rating ? ' class="on"' : '') + '>' + STAR + '</button>'; }).join('') + '</div>' +
      '<div class="q">Notes</div><textarea class="word" id="eNotes" rows="3">' + esc(s.notes || '') + '</textarea>' +
      (meteo ? '<p class="auto">Météo capturée : ' + esc(meteo) + '</p>' : '') +
      '<div class="msg" id="eMsg"></div>' +
      '<button class="save" id="eSave">Enregistrer</button><button class="skip" id="eDel" style="color:#FFB4A8">Supprimer</button>';
    [].forEach.call($('eStars').children, function (b, i) { b.addEventListener('click', function () { rating = i + 1; [].forEach.call($('eStars').children, function (x, k) { x.classList.toggle('on', k <= i); }); }); });
    function done() { state.sessions = null; box.classList.remove('show'); renderMe('p3'); A.reload(); }
    $('eClose').addEventListener('click', function () { box.classList.remove('show'); });
    $('eSave').addEventListener('click', function () {
      if (A.DEMO) { box.classList.remove('show'); return; }
      fetch(A.BACKEND + '/api/v1/sessions/' + encodeURIComponent(s.id), { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: state.userId, rating: rating || 3, notes: $('eNotes').value, date: $('eDate').value }) })
        .then(function (r) { return r.json(); })
        .then(function (j) { if (j.success) done(); else $('eMsg').textContent = 'Erreur : ' + (j.error || 'Impossible de modifier'); })
        .catch(function () { $('eMsg').textContent = 'Erreur réseau'; });
    });
    $('eDel').addEventListener('click', function () {
      if (!confirm('Supprimer cette session ? Cette action est irréversible.')) return;
      if (A.DEMO) { box.classList.remove('show'); return; }
      fetch(A.BACKEND + '/api/v1/sessions/' + encodeURIComponent(s.id) + '?userId=' + encodeURIComponent(state.userId), { method: 'DELETE' })
        .then(function (r) { return r.json(); })
        .then(function (j) { if (j.success) done(); else $('eMsg').textContent = 'Erreur : ' + (j.error || 'Impossible de supprimer'); })
        .catch(function () { $('eMsg').textContent = 'Erreur réseau'; });
    });
    box.scrollTop = 0; box.classList.add('show');
  }

  // ───────── board : ajouter ou modifier ─────────
  function chipRow(id, pairs, optional, current, cls) {
    return '<div class="chips ' + (cls || 'scroll-x') + '" id="' + id + '"' + (optional ? ' data-optional' : '') + '>' + pairs.map(function (p) {
      return '<button class="chip' + (String(current || '') === p[0] ? ' on' : '') + '" data-v="' + esc(p[0]) + '">' + esc(p[1]) + '</button>'; }).join('') + '</div>';
  }
  function same(names) { return names.map(function (n) { return [n.toLowerCase(), n]; }); }
  function val(v) { return v == null ? '' : esc(v); }
  function uploadBoardPhoto(file) {
    if (file.size > 2 * 1024 * 1024) return Promise.reject(new Error('Image trop lourde (max 2 MB)'));
    var path = 'boards/' + state.userId + '/' + Date.now() + '.' + file.name.split('.').pop();
    return sb.storage.from('avatars').upload(path, file, { upsert: true }).then(function (r) {
      if (r.error) throw r.error;
      return sb.storage.from('avatars').getPublicUrl(path).data.publicUrl + '?t=' + Date.now();
    });
  }
  function openBoard(b) {
    var box = $('board'), edit = !!b; b = b || {};
    box.innerHTML =
      '<button class="close" id="bClose" aria-label="Fermer">' + CLOSE + '</button>' +
      '<h2>' + (edit ? 'Modifier la board' : 'Ajouter une board') + '</h2>' +
      '<div class="q">L\'essentiel</div>' +
      '<div class="lab">Nom</div><input class="word" id="bName" placeholder="La Bleue, Mon fish..." value="' + val(b.nickname || b.name) + '">' +
      '<div class="lab">Photo</div><label class="photo" style="height:120px;cursor:pointer' + (b.photo_url ? ';background:center/cover url(\'' + esc(b.photo_url) + '\')' : '') + '" id="bPhotoBox"><span id="bPhotoTxt">' + (b.photo_url ? '' : 'Choisir une photo') + '</span><input type="file" accept="image/*" id="bPhoto" style="display:none"></label>' +
      '<div class="lab">Type</div>' + chipRow('bType', same(['Shortboard', 'Fish', 'Midlength', 'Longboard', 'Gun', 'Funboard', 'Hybrid', 'Foil', 'SUP']), false, b.board_type || b.type) +
      '<div class="lab">Taille</div><input class="word" id="bSize" placeholder="6\'2" value="' + val(b.size || b.length_ft) + '">' +
      '<div class="q">Les détails</div>' +
      '<div class="two"><div class="box"><span>Volume (L)</span><input id="bVol" type="number" step="0.1" placeholder="32" value="' + val(b.volume_l) + '"></div><div class="box"><span>Largeur (")</span><input id="bWidth" placeholder="20.5" value="' + val(b.width_in) + '"></div></div>' +
      '<div class="two"><div class="box"><span>Épaisseur (")</span><input id="bThick" placeholder="2.5" value="' + val(b.thickness_in) + '"></div><div class="box"><span>Année</span><input id="bYear" type="number" inputmode="numeric" placeholder="2024" value="' + val(b.year_made) + '"></div></div>' +
      '<div class="two"><div class="box"><span>Shaper</span><input id="bShaper" placeholder="Pukas" value="' + val(b.shaper) + '"></div><div class="box"><span>Marque</span><input id="bBrand" placeholder="Channel Islands" value="' + val(b.brand) + '"></div></div>' +
      '<div class="lab">Fins</div>' + chipRow('bFins', same(['Thruster', 'Twin', 'Quad', 'Single', '2+1', '5-box']), true, b.fins_setup) +
      '<div class="lab">Tail</div>' + chipRow('bTail', same(['Squash', 'Swallow', 'Pin', 'Round', 'Diamond']), true, b.tail_shape) +
      '<div class="lab">État</div>' + chipRow('bCond', [['neuf', 'Neuf'], ['bon', 'Bon'], ['use', 'Usé'], ['reparer', 'À réparer']], false, b.condition || 'bon', 'four') +
      '<div class="q">Dans quelles conditions tu la sors ?</div>' +
      '<div class="two"><div class="box"><span>Houle min (m)</span><input id="bMin" type="number" step="0.1" placeholder="0.5" value="' + val(b.sweet_spot_wave_min) + '"></div><div class="box"><span>Houle max (m)</span><input id="bMax" type="number" step="0.1" placeholder="2.0" value="' + val(b.sweet_spot_wave_max) + '"></div></div>' +
      '<div class="lab">Vent</div>' + chipRow('bWind', [['offshore', 'Offshore'], ['onshore', 'Onshore'], ['any', 'Peu importe']], false, b.sweet_spot_wind || 'any', '') +
      '<div class="lab">Marée</div>' + chipRow('bTide', [['haute', 'Haute'], ['basse', 'Basse'], ['mi-maree', 'Mi-marée'], ['any', 'Peu importe']], false, b.sweet_spot_tide || 'any', 'four') +
      '<div class="msg" id="bMsg"></div>' +
      '<button class="save" id="bSave">' + (edit ? 'Enregistrer' : 'Ajouter cette board') + '</button>' +
      (edit ? '<button class="skip" id="bDel" style="color:#FFB4A8">Supprimer cette board</button>' : '');
    wireChips(box);
    $('bClose').addEventListener('click', function () { box.classList.remove('show'); });
    $('bPhoto').addEventListener('change', function () {
      var f = this.files[0]; if (!f) return;
      $('bPhotoBox').style.background = 'center/cover url(' + URL.createObjectURL(f) + ')'; $('bPhotoTxt').textContent = '';
    });
    if (edit) $('bDel').addEventListener('click', function () { deleteBoard(b.id, function () { box.classList.remove('show'); }); });
    $('bSave').addEventListener('click', function () {
      var type = chosen(box, '#bType'), msg = $('bMsg'), name = $('bName').value.trim();
      if (edit && !name) { msg.textContent = 'Le nom est requis'; return; }
      if (!edit && !type) { msg.textContent = 'Choisis au moins le type de board.'; return; }
      var size = $('bSize').value.trim() || null;
      var row = { name: name || A.cap(type), nickname: name || null, board_type: type || null, size: size, length_ft: size,
        shaper: $('bShaper').value.trim() || null, brand: $('bBrand').value.trim() || null,
        volume_l: parseFloat($('bVol').value) || null, width_in: $('bWidth').value.trim() || null, thickness_in: $('bThick').value.trim() || null,
        fins_setup: chosen(box, '#bFins'), tail_shape: chosen(box, '#bTail'), year_made: parseInt($('bYear').value, 10) || null,
        condition: chosen(box, '#bCond') || 'bon',
        sweet_spot_wave_min: parseFloat($('bMin').value) || null, sweet_spot_wave_max: parseFloat($('bMax').value) || null,
        sweet_spot_wind: chosen(box, '#bWind') || 'any', sweet_spot_tide: chosen(box, '#bTide') || 'any' };
      if (A.DEMO || !sb) { box.classList.remove('show'); return; }
      var btn = $('bSave'), file = $('bPhoto').files[0]; btn.disabled = true; msg.textContent = '';
      (file ? uploadBoardPhoto(file) : Promise.resolve(null)).then(function (url) {
        if (url) row.photo_url = url;
        if (edit) return sb.from('boards').update(row).eq('id', b.id).eq('user_id', state.userId).select();
        row.user_id = state.userId; return sb.from('boards').insert([row]).select();
      }).then(function (r) {
        btn.disabled = false;
        if (r.error) throw r.error;
        if (!r.data || !r.data.length) throw new Error('aucune ligne modifiée');
        cache.boards = null; box.classList.remove('show'); renderMe('p2');
      }).catch(function (e) { btn.disabled = false; msg.textContent = 'La board n\'a pas pu être enregistrée. ' + (e.message || ''); });
    });
    box.scrollTop = 0; box.classList.add('show');
  }
  function deleteBoard(id, after) {
    if (!confirm('Supprimer cette board ?')) return;
    if (A.DEMO || !sb) { if (after) after(); return; }
    // on détache d'abord les sessions liées, comme dans l'ancienne version
    sb.from('sessions').update({ board_id: null }).eq('board_id', id).then(function () {
      return sb.from('boards').delete().eq('id', id).eq('user_id', state.userId);
    }).then(function (r) {
      if (r.error) { alert('Erreur suppression : ' + r.error.message); return; }
      cache.boards = null; state.sessions = null; if (after) after(); renderMe('p2');
    });
  }

  // ───────── board : montrer, vendre, réparer ─────────
  function openBoardShare(b) {
    var box = $('board'), name = b.nickname || b.name || 'Board';
    function head(title, back) {
      return '<button class="close" id="sClose" aria-label="Fermer">' + CLOSE + '</button><h2 style="font-size:34px">' + esc(title) + '</h2>' + (back ? '<button class="skip" id="sBack" style="text-align:left;padding-left:0">← Retour</button>' : '');
    }
    function wireHead() { $('sClose').addEventListener('click', function () { box.classList.remove('show'); }); if ($('sBack')) $('sBack').addEventListener('click', menu); }
    function menu() {
      box.innerHTML = head('Partager « ' + name + ' »') +
        '<div class="opt" data-m="flex"><b>Montrer ma board</b><span>Partage lifestyle, montre ton quiver</span></div>' +
        '<div class="opt" data-m="sell"><b>Vendre ma board</b><span>Crée une annonce pour Instagram</span></div>' +
        '<div class="opt" data-m="repair"><b>Réparer ma board</b><span>Trouve un réparateur via ton réseau</span></div>';
      wireHead();
      box.querySelectorAll('.opt').forEach(function (o) { o.addEventListener('click', function () {
        var m = o.getAttribute('data-m'); if (m === 'flex') pickPhoto('flex', {}); else if (m === 'sell') sell(); else repair(); }); });
    }
    function sell() {
      box.innerHTML = head('Vendre ma board', true) +
        '<div class="lab">Prix (€)</div><input class="word" id="sPrice" type="number" placeholder="350">' +
        '<div class="lab">Localisation</div><input class="word" id="sLoc" placeholder="Biarritz">' +
        '<div class="lab">Message (optionnel)</div><textarea class="word" id="sMsg" rows="2" placeholder="Vendue car j\'ai changé de niveau"></textarea>' +
        '<button class="save" id="sNext">Suivant, choisir une photo</button>';
      wireHead();
      $('sNext').addEventListener('click', function () { pickPhoto('sell', { price: $('sPrice').value || '', location: $('sLoc').value || '', message: $('sMsg').value || '' }); });
    }
    function repair() {
      box.innerHTML = head('Réparer ma board', true) +
        '<div class="lab">Description du problème</div><textarea class="word" id="rDesc" rows="3" placeholder="Ding sur le nose, fissure rail droit..."></textarea>' +
        '<div class="lab">Localisation</div><input class="word" id="rLoc" placeholder="Biarritz">' +
        '<div class="lab">Urgence</div>' + chipRow('rUrg', [['tranquille', 'Tranquille'], ['rapide', 'Rapide'], ['urgent', 'Urgent']], false, 'tranquille', '') +
        '<button class="save" id="rNext">Suivant, choisir une photo</button>';
      wireHead(); wireChips(box);
      $('rNext').addEventListener('click', function () { pickPhoto('repair', { description: $('rDesc').value || '', location: $('rLoc').value || '', urgency: chosen(box, '#rUrg') }); });
    }
    function pickPhoto(mode, extras) {
      box.innerHTML = head(name, true) +
        '<p class="hint">Choisis une photo pour ta story Instagram</p>' +
        '<label class="save" style="display:block;text-align:center;cursor:pointer">Choisir une photo<input type="file" accept="image/*" id="sFile" style="display:none"></label>' +
        '<div class="msg" id="sErr"></div>';
      wireHead();
      $('sFile').addEventListener('change', function () { var f = this.files[0]; if (f) build(mode, extras, f); });
    }
    function build(mode, extras, file) {
      $('sErr').className = 'msg fine'; $('sErr').textContent = 'Génération en cours...';
      // mêmes textes que l'ancienne version
      var stats = getBoardSessionStats(b.id), sweet = formatSweetSpot(b);
      var dims = [b.length_ft || b.size, b.type ? A.cap(String(b.type)) : ''].filter(Boolean).join(' · ');
      var shaperLine = [b.shaper, b.brand].filter(Boolean).join(' — ');
      var title = name, accent = '', detail = '', bottom = 'SurfAI';
      if (mode === 'flex') { accent = sweet ? '🌊 ' + sweet : ''; detail = stats.count ? '📊 ' + stats.count + ' sessions' : ''; }
      else if (mode === 'sell') {
        title = 'À VENDRE · ' + title; accent = extras.price ? extras.price + ' €' : '';
        detail = [extras.location ? '📍 ' + extras.location : '', b.condition ? 'État : ' + b.condition : ''].filter(Boolean).join(' · ');
        bottom = extras.message ? '"' + extras.message + '"' : 'SurfAI';
      } else {
        title = '🔧 ' + title; accent = extras.description ? '"' + extras.description + '"' : '';
        detail = extras.location ? '📍 ' + extras.location : '';
        if (extras.urgency && extras.urgency !== 'tranquille') bottom = '⚡ ' + extras.urgency.toUpperCase();
      }
      var data = { spotName: title, spotCity: dims, date: shaperLine ? '🔨 ' + shaperLine : '', rating: null, nickname: '', meteo: accent ? { custom: true, line: accent } : null };
      generateBoardShareCanvas(file, data, detail, bottom, mode).then(function (canvas) {
        showCard(box, canvas, { spotName: name, date: 'board' }, function () { box.classList.remove('show'); });
      }).catch(function () { $('sErr').className = 'msg'; $('sErr').textContent = 'Erreur lors de la génération de l\'image.'; });
    }
    menu(); box.scrollTop = 0; box.classList.add('show');
  }
  // aperçu d'une carte image : Enregistrer, Partager, Fermer (comme dans l'ancienne version)
  function showCard(box, canvas, sessionData, onClose) {
    box.innerHTML = '<button class="close" id="kClose" aria-label="Fermer">' + CLOSE + '</button>' +
      '<img src="' + canvas.toDataURL('image/png') + '" alt="Aperçu" style="display:block;width:100%;border-radius:22px;margin-top:16px">' +
      '<div class="two" style="margin-top:16px"><button class="save" id="kSave" style="margin-top:0;background:rgba(255,255,255,.12);color:#fff">Enregistrer</button><button class="save" id="kShare" style="margin-top:0">Partager</button></div>' +
      '<button class="skip" id="kSkip">Fermer</button>';
    $('kClose').addEventListener('click', onClose); $('kSkip').addEventListener('click', onClose);
    $('kSave').addEventListener('click', function () { downloadShareCard(canvas, sessionData); });
    $('kShare').addEventListener('click', function () { shareCard(canvas, sessionData); });
    box.scrollTop = 0;
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

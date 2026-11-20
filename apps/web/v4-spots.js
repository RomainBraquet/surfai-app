// SurfAI v4 : fiche complète d'un spot, exploration par pays / zone / ville, conditions en direct des favoris.
(function () {
  'use strict';
  var A = window.SurfV4, $ = A.$, esc = A.esc, fr = A.fr, state = A.state;
  var CLOSE = '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>';
  var DIFF = { beginner: 'Débutant', intermediate: 'Intermédiaire', advanced: 'Avancé', expert: 'Expert' };
  var TIDE = { low: 'Basse', mid: 'Mi-marée', high: 'Haute' };
  var FRANCE_ZONE_ORDER = ['Pays Basque', 'Landes', 'Gironde', 'Charentes', 'Vendée', 'Bretagne Sud', 'Bretagne Nord', 'Normandie / Manche', 'Nord', 'Méditerranée Ouest', 'Méditerranée Est', 'Corse', 'Réunion'];
  var PAGE = 30;
  function sb() { return A.client(); }
  function clean(t) { return String(t).replace(/\s+—\s+/g, ', '); }

  // ───────── fiche d'un spot ─────────
  A.openSpot = function (id) {
    var box = $('spot');
    box.innerHTML = '<button class="close" id="spClose" aria-label="Fermer">' + CLOSE + '</button><p class="hint">Chargement...</p>';
    $('spClose').addEventListener('click', function () { box.classList.remove('show'); });
    box.scrollTop = 0; box.classList.add('show');
    if (A.DEMO || !sb()) { box.querySelector('.hint').textContent = 'Fiche indisponible en mode exemple.'; return; }
    Promise.all([
      sb().from('spots').select('*').eq('id', id).maybeSingle(),
      A.api('/favorites?userId=' + encodeURIComponent(state.userId)).catch(function () { return {}; }),
      A.loadSessions()
    ]).then(function (res) {
      var spot = res[0].data; if (!spot) { box.querySelector('.hint').textContent = 'Spot introuvable.'; return; }
      var isFav = ((res[1] && res[1].favorites) || []).some(function (f) { return String(f.id) === String(id); });
      var mine = (res[2] || []).filter(function (s) { return String(s.spot_id) === String(id); }).slice(0, 5);
      var loc = [spot.city, spot.region, spot.country].filter(Boolean).join(', ');
      var chars = [];
      if (spot.wave_type || spot.bottom_type) chars.push(['Type de vague', A.cap(String(spot.wave_type || spot.bottom_type).replace(/_/g, ' '))]);
      if (spot.difficulty && spot.difficulty.length) chars.push(['Niveau', spot.difficulty.map(function (d) { return DIFF[d] || d; }).join(' · ')]);
      if (spot.ideal_tide && spot.ideal_tide.length) chars.push(['Marée idéale', spot.ideal_tide.map(function (t) { return TIDE[t] || t; }).join(' · ')]);
      if (spot.ideal_wind && spot.ideal_wind.length) chars.push(['Vent idéal', spot.ideal_wind.join(', ') + ' (offshore)']);
      box.innerHTML =
        '<button class="close" id="spClose" aria-label="Fermer">' + CLOSE + '</button>' +
        '<h2 style="font-size:38px">' + esc(spot.name) + '</h2>' +
        (loc ? '<p class="hint" style="margin-top:4px">' + esc(loc) + '</p>' : '') +
        '<button class="favbtn' + (isFav ? ' on' : '') + '" id="spFav">' + (isFav ? '★ Favori' : '☆ Favori') + '</button>' +
        (chars.length ? '<div class="two" style="margin-top:18px">' + chars.map(function (c) { return '<div class="box"><span>' + esc(c[0]) + '</span><b style="font-size:16px;font-weight:500">' + esc(c[1]) + '</b></div>'; }).join('') + '</div>' : '') +
        (spot.lat != null ? '<a class="save alt" style="background:rgba(255,255,255,.12);color:#fff" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=' + spot.lat + ',' + spot.lng + '">S\'y rendre (Google Maps)</a>' : '') +
        '<div class="q">Prévisions 5 jours</div>' +
        '<div class="chips" id="spSort" style="margin-bottom:6px"><button class="chip on" data-v="score">Score</button><button class="chip" data-v="date">Date</button></div>' +
        '<div id="spFore"><p class="hint">Chargement des prévisions...</p></div>' +
        '<div class="q">Mes sessions ici</div>' +
        (mine.length ? mine.map(function (s) {
          var d = s.date ? A.dateOf(String(s.date).slice(0, 10)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: '2-digit' }) : '';
          return '<div class="li" style="border-top-color:rgba(255,255,255,.14)"><div><b>' + esc(d) + '</b></div><span class="r" style="margin-left:auto">' + A.stars(s.rating) + '</span></div>';
        }).join('') : '<p class="hint">Aucune session ici</p>');
      $('spClose').addEventListener('click', function () { box.classList.remove('show'); });
      A.wireChips(box);
      $('spFav').addEventListener('click', function () {
        var b = this;
        A.api('/favorites/toggle', { userId: state.userId, spotId: id }).then(function (j) {
          var on = !!j.isFavorite; b.classList.toggle('on', on); b.textContent = on ? '★ Favori' : '☆ Favori';
          A.resetFavorites(); A.reload(); if ($('me').classList.contains('show')) A.renderMe('p4');
        });
      });
      // mêmes prévisions que l'accueil : même nombre de jours, pour ne pas payer un appel de plus sur la même zone
      A.api('/predictions/spot/' + encodeURIComponent(id) + '?userId=' + encodeURIComponent(state.userId) + '&days=' + A.DAYS).then(function (j) {
        var fore = $('spFore'); if (!fore) return;
        if (!j.success || !(j.windows || []).length) {
          fore.innerHTML = '<p class="hint">' + (/quota/i.test(j.error || '') ? 'Le quota de prévisions du jour est atteint. Elles reviennent demain.' : 'Aucun créneau favorable sur 5 jours.') + '</p>'; return;
        }
        function draw(by) {
          var list = j.windows.slice().sort(function (a, b) { return by === 'date' ? String(a.date).localeCompare(String(b.date)) || parseInt(a.peakHour, 10) - parseInt(b.peakHour, 10) : b.score - a.score; });
          fore.innerHTML = list.map(function (w, k) {
            var v = A.verdict(w.score), c = w.conditions || {}, tags = [];
            if (c.waveHeight != null) tags.push(fr(c.waveHeight) + ' m');
            if (c.wavePeriod != null) tags.push(Math.round(c.wavePeriod) + ' s');
            if (c.windSpeed != null) tags.push(Math.round(c.windSpeed) + ' km/h' + (c.windDirection != null ? ' ' + A.cardinal(c.windDirection) : ''));
            if (c.tidePhase && c.tidePhase !== 'unknown') tags.push('Marée ' + A.tideWord(c.tidePhase).toLowerCase());
            if (c.waterTemp != null) tags.push('Eau ' + Math.round(c.waterTemp) + '°C');
            var skip = w.reminder && w.reminder.text;
            var good = (w.whyGood || []).filter(function (t) { return t !== skip; }), bad = (w.whyNotPerfect || []).filter(function (t) { return t !== skip; });
            var bs = w.boardSuggestion;
            return '<div class="fw" data-k="' + k + '"><div class="top"><span class="sb ' + v.cls + '">' + fr(w.score) + '</span><div><b>' + esc(A.dayLabel(w.date) + ', ' + A.slotText(w)) + '</b><span>' + esc(v.label) + '</span></div></div>' +
              '<div class="det">' + (w.narrative ? '<em>« ' + esc(clean(w.narrative)) + ' »</em>' : '') + '<div class="tags">' + tags.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>' +
              (w.reminder && w.reminder.text ? '<div>' + esc(w.reminder.text) + '</div>' : '') +
              good.map(function (t) { return '<div class="plus">+ ' + esc(clean(t)) + '</div>'; }).join('') +
              bad.map(function (t) { return '<div class="minus">- ' + esc(clean(t)) + '</div>'; }).join('') +
              (bs && bs.board ? '<div style="margin-top:6px">Prends ta ' + esc(bs.board.nickname || bs.board.name || 'board') + (bs.reason ? '. ' + esc(clean(bs.reason)) : '') + '</div>' : '') +
              '</div></div>';
          }).join('');
          fore.querySelectorAll('.fw').forEach(function (r) { r.addEventListener('click', function () { r.classList.toggle('open'); }); });
        }
        draw('score');
        $('spSort')._onpick = function (c) { draw(c.getAttribute('data-v')); };
      }).catch(function () { if ($('spFore')) $('spFore').innerHTML = '<p class="hint">Erreur chargement créneaux.</p>'; });
    });
  };

  // ───────── conditions en direct sous chaque favori ─────────
  A.liveConditions = function (favs) {
    if (A.DEMO || !favs.length) return;
    var best = {};
    state.results.forEach(function (r) { if (r.windows && r.windows[0]) best[r.spot.id] = r.windows.reduce(function (a, b) { return a.score >= b.score ? a : b; }).score; });
    A.api('/spots/conditions?spotIds=' + favs.map(function (s) { return encodeURIComponent(s.id); }).join(',')).then(function (j) {
      var cond = j.conditions || {};
      document.querySelectorAll('#sFavs [data-live]').forEach(function (el) {
        var id = el.getAttribute('data-live'), c = cond[id], bits = [];
        if (best[id] != null) bits.push('Meilleure note ' + fr(best[id]));
        if (c) {
          if (c.waveHeight != null) bits.push(fr(c.waveHeight) + ' m');
          if (c.windSpeed != null) bits.push(Math.round(c.windSpeed) + ' km/h' + (c.windDirection ? ' ' + c.windDirection : ''));
          if (c.wavePeriod != null) bits.push(Math.round(c.wavePeriod) + ' s');
        }
        el.textContent = bits.join(' · ');
      });
    }).catch(function () {});
  };

  // ───────── explorer : pays, puis zone, puis ville ─────────
  A.browseSpots = function (root) {
    if (!root || A.DEMO || !sb()) return;
    var filter = {}, page = 0;
    root.innerHTML = '<div class="chips wrap" id="bCountries" style="margin-top:12px"></div><div class="chips scroll-x" id="bZones"></div><div class="chips scroll-x" id="bCities"></div><div id="bList"></div><div class="li act" id="bMore" style="display:none"><b>Voir plus</b></div>';
    function chips(el, values, onPick) {
      el.innerHTML = values.map(function (v) { return '<button class="chip" data-v="' + esc(v) + '">' + esc(v) + '</button>'; }).join('');
      el.onclick = function (e) {
        var c = e.target.closest('.chip'); if (!c) return; e.stopPropagation();
        [].forEach.call(el.children, function (x) { x.classList.remove('on'); }); c.classList.add('on'); onPick(c.getAttribute('data-v'));
      };
    }
    function list(reset) {
      if (reset) { page = 0; $('bList').innerHTML = ''; }
      var q = sb().from('spots').select('id,name,city,region,country,lat,lng,surf_zone').order('name').range(page * PAGE, (page + 1) * PAGE - 1);
      if (filter.country) q = q.eq('country', filter.country);
      if (filter.zone) q = q.eq('surf_zone', filter.zone);
      if (filter.city) q = q.eq('city', filter.city);
      q.then(function (r) {
        var rows = r.data || [], ui = A.ui;
        if (!rows.length && page === 0) { $('bList').innerHTML = '<p class="why" style="color:rgba(255,255,255,.62)">Aucun spot trouvé.</p>'; $('bMore').style.display = 'none'; return; }
        var holder = document.createElement('div');
        holder.innerHTML = rows.map(function (s) { return ui.spotRow(s, ui.favIds, s.surf_zone || s.region || ''); }).join('');
        $('bList').appendChild(holder); ui.wireFavs(holder);
        $('bMore').style.display = rows.length === PAGE ? '' : 'none';
      });
    }
    $('bMore').addEventListener('click', function () { page++; list(false); });
    sb().from('spots').select('country').not('country', 'is', null).order('country').then(function (r) {
      var seen = {}, countries = []; (r.data || []).forEach(function (s) { if (!seen[s.country]) { seen[s.country] = 1; countries.push(s.country); } });
      chips($('bCountries'), countries, function (country) {
        filter = { country: country }; $('bCities').innerHTML = '';
        sb().from('spots').select('surf_zone').eq('country', country).not('surf_zone', 'is', null).then(function (z) {
          var zs = {}, zones = []; (z.data || []).forEach(function (s) { if (!zs[s.surf_zone]) { zs[s.surf_zone] = 1; zones.push(s.surf_zone); } });
          zones.sort(function (a, b) {
            var ia = FRANCE_ZONE_ORDER.indexOf(a), ib = FRANCE_ZONE_ORDER.indexOf(b);
            return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
          });
          chips($('bZones'), zones, function (zone) {
            filter = { country: country, zone: zone }; $('bCities').innerHTML = '';
            sb().from('spots').select('city').eq('surf_zone', zone).not('city', 'is', null).then(function (c) {
              var all = c.data || [], cs = {}, cities = [];
              all.forEach(function (s) { if (!cs[s.city]) { cs[s.city] = 1; cities.push(s.city); } });
              if (all.length > 10) chips($('bCities'), cities.sort(), function (city) { filter = { country: country, zone: zone, city: city }; list(true); });
              list(true);
            });
          });
          list(true);
        });
      });
    });
  };
})();

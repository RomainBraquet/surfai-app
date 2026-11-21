// SurfAI, nouvelle interface (v4) : la semaine en pile et le détail du spot.
// Lit les mêmes données que l'app actuelle, sans rien y modifier.
(function () {
  'use strict';

  var SUPABASE_URL = 'https://zssiqpxlqshsmhpqjzgb.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_3C5uSVKx16FeKH7qlSGsRw_DYHWQlBC';
  var LOCAL = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  var BACKEND = LOCAL ? 'http://localhost:3001' : 'https://surfai-backend.vercel.app';
  var DEV_USER_ID = '3ba8ad73-e2c6-49fe-ac88-c26b45551f4b';
  var DAYS = 6;
  var params = new URLSearchParams(location.search);
  var DEMO = params.has('demo');

  var $ = function (id) { return document.getElementById(id); };
  var state = { results: [], days: [], userId: null, sessions: null };

  // ───────── petits outils ─────────
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fr(n, d) { return Number(n).toFixed(d == null ? 1 : d).replace('.', ','); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function localISO(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dateOf(iso) { var p = iso.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2], 12); }
  var CARD = ['Nord', 'Nord-est', 'Est', 'Sud-est', 'Sud', 'Sud-ouest', 'Ouest', 'Nord-ouest'];
  function cardinal(deg) { return CARD[Math.round((((deg % 360) + 360) % 360) / 45) % 8]; }

  function verdict(score, storm) {
    if (storm) return { cls: 'none', label: 'Tempête' };
    if (score >= 8.5) return { cls: 'top', label: 'À ne pas rater' };
    if (score >= 6.5) return { cls: 'good', label: 'Bonne session' };
    if (score >= 4) return { cls: 'mid', label: 'Moyen' };
    return { cls: 'none', label: 'Pas terrible' };
  }
  function windWord(v) { return v < 12 ? 'Léger' : v < 20 ? 'Modéré' : v < 30 ? 'Soutenu' : 'Fort'; }
  function tideWord(p) { return { rising: 'Montante', falling: 'Descendante', high: 'Haute', low: 'Basse' }[p] || 'Marée'; }
  function tideLevelWord(l) { return l == null ? '' : l < 0.25 ? 'Marée basse' : l > 0.75 ? 'Marée haute' : 'Mi-marée'; }
  function slotText(w) { return String(w.timeWindow || w.peakHour || '').replace(/[–-]/, ' à '); }
  function dayName(iso, i) {
    if (i === 0) return "Aujourd'hui";
    return cap(dateOf(iso).toLocaleDateString('fr-FR', { weekday: 'long' }));
  }
  function shortDate(iso) { return dateOf(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); }
  function longDate(iso) { return cap(dateOf(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })); }
  function moment(iso, i, w) {
    var h = parseInt(w.peakHour, 10);
    var part = h < 12 ? 'matin' : h < 14 ? 'midi' : h < 18 ? 'après-midi' : 'soir';
    if (i === 0) return (part === 'après-midi' ? 'Cet ' : 'Ce ') + part + ', ' + slotText(w);
    return dayName(iso, i) + ' ' + part + ', ' + slotText(w);
  }
  function windowHours(w) {
    var m = String(w.timeWindow || '').match(/(\d+)h\D+(\d+)h/);
    if (m) return [parseInt(m[1], 10), parseInt(m[2], 10) - 1];
    var h = parseInt(w.timeWindow || w.peakHour, 10);
    return [h, h];
  }
  function hoursOf(result, date) { return (result.hourlyScores || []).filter(function (h) { return h.date === date; }); }

  var ICON = {
    wave: '<svg viewBox="0 0 24 24"><path d="M2 16c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M3 10c2-4 6-5.5 9-3-2 .3-3 1.700-2.500 3.500"/></svg>',
    wind: '<svg viewBox="0 0 24 24"><path d="M3 9h10a2.500 2.500 0 1 0-2.500-2.500M3 14h15a2.500 2.500 0 1 1-2.500 2.500M3 19h6"/></svg>',
    tide: '<svg viewBox="0 0 24 24"><path d="M2 19c2.500 0 2.500-2 5-2s2.500 2 5 2 2.500-2 5-2 2.500 2 5 2M8 12V4M5 7l3-3 3 3M16 4v8M13 9l3 3 3-3"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.800" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.300-7-9.500A4 4 0 0 1 12 8a4 4 0 0 1 7 2.500C19 15.700 12 20 12 20z"/></svg>',
    compass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.800" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M15 9l-2 4-4 2 2-4z"/></svg>',
    go: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="M12 3.500l2.600 5.400 5.900.800-4.300 4.100 1 5.900L12 16.900 6.800 19.700l1-5.900L3.500 9.700l5.900-.800z"/></svg>',
    arrowWind: '<svg viewBox="0 0 48 48"><path d="M24 42V9M10 22L24 8l14 14"/></svg>',
    arrowSwell: '<svg viewBox="0 0 48 48"><path d="M7 21Q24 3 41 21M10 32Q24 17 38 32M14 42Q24 31 34 42"/></svg>'
  };

  // ───────── préparation : un jour = la meilleure session parmi tous les spots ─────────
  function buildDays(results) {
    var days = [], today = new Date();
    for (var i = 0; i < DAYS; i++) {
      var d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i, 12);
      var iso = localISO(d), best = null, hasData = false;
      results.forEach(function (r) {
        if (hoursOf(r, iso).length) hasData = true;
        (r.windows || []).forEach(function (w) {
          if (w.date === iso && (!best || w.score > best.w.score)) best = { r: r, w: w };
        });
      });
      if (!best && !hasData) continue;   // au-delà de l'horizon des prévisions
      days.push({ iso: iso, index: i, best: best, why: best ? null : whyNothing(results, iso) });
    }
    return days;
  }
  function whyNothing(results, iso) {
    var small = 0, big = 0, storm = 0, gusty = 0, n = 0;
    results.forEach(function (r) { hoursOf(r, iso).forEach(function (h) { n++; if (h.sizeIssue === 'too_small') small++; if (h.sizeIssue === 'too_big') big++; if (h.storm) storm++; if (((h.conditions || {}).windGust || 0) >= 40) gusty++; }); });
    if (n && storm / n > 0.25) return 'Tempête : trop de vent et une mer démontée. On reste à terre.';
    if (n && gusty / n > 0.5) return 'Trop de vent toute la journée, avec de fortes rafales.';
    if (n && small / n > 0.5) return 'Trop petit toute la journée, sur tous tes spots.';
    if (n && big / n > 0.5) return 'Trop gros toute la journée, sur tous tes spots.';
    return 'Pas de bon créneau ce jour-là, sur aucun de tes spots.';
  }

  // ───────── accueil ─────────
  function miniBars(result, date, w) {
    var hs = hoursOf(result, date); if (!hs.length) return '';
    var range = windowHours(w);
    var bars = hs.map(function (h) {
      var on = h.hour >= range[0] && h.hour <= range[1];
      return '<i' + (on ? ' class="on"' : '') + ' style="height:' + Math.max(18, Math.round(h.score * 10)) + '%"></i>';
    }).join('');
    var mid = hs[Math.floor(hs.length / 2)].hour;
    return '<div class="bars">' + bars + '</div><div class="hours"><span>' + hs[0].hour + 'h</span><span>' + mid + 'h</span><span>' + hs[hs.length - 1].hour + 'h</span></div>';
  }
  function dayCard(day, open) {
    var name = dayName(day.iso, day.index);
    var small = day.index === 0 ? '' : '<small>' + esc(shortDate(day.iso)) + '</small>';
    if (!day.best) {
      return '<article class="day none" data-i="' + day.index + '"><div class="row"><div class="name">' + name + '</div><div class="verdict">Rien à surfer</div></div>' +
        '<div class="more"><div><div class="inner"><p class="why">' + esc(day.why) + '</p></div></div></div></article>';
    }
    var r = day.best.r, w = day.best.w, v = verdict(w.score), c = w.conditions || {};
    var memory = '';
    if (r.discovery) {
      memory = '<div class="memory">' + ICON.compass + '<span>Tu n\'as jamais surfé ici.' + (r.distanceKm != null ? ' C\'est à ' + fr(r.distanceKm, r.distanceKm < 10 ? 1 : 0) + ' km,' : '') + ' et ce sera mieux que sur tes spots habituels</span></div>';
    } else if (w.reminder && w.reminder.text) {
      memory = '<div class="memory">' + ICON.heart + '<span>' + esc(w.reminder.text) + '</span></div>';
    }
    return '<article class="day ' + v.cls + (open ? ' open' : '') + '" data-i="' + day.index + '">' +
      '<div class="row"><div class="name">' + name + small + '</div><div class="verdict">' + v.label + '</div></div>' +
      '<div class="sub"><span class="pill">' + esc(r.spot.name) + '</span><span class="pill">' + esc(slotText(w)) + '</span>' + (r.discovery ? '<span class="pill new">À découvrir</span>' : '') + (w.confidence === 'low' ? '<span class="pill">À confirmer</span>' : '') + '</div>' +
      '<div class="more"><div><div class="inner">' +
        '<div class="big"><div><div class="spot">' + esc(r.spot.name) + '</div><div class="slot">' + esc(moment(day.iso, day.index, w)) + '</div></div><div class="score">' + fr(w.score) + '<span>/10</span></div></div>' +
        miniBars(r, day.iso, w) +
        '<div class="facts">' +
          '<div class="fact">' + ICON.wave + '<b>' + (c.waveHeight != null ? fr(c.waveHeight) + ' m' : '') + '</b></div>' +
          '<div class="fact">' + ICON.wind + '<b>' + ((c.windGust || 0) >= 30 ? 'Rafales ' + Math.round(c.windGust) : c.windSpeed != null ? windWord(c.windSpeed) : '') + '</b></div>' +
          '<div class="fact">' + ICON.tide + '<b>' + tideWord(c.tidePhase) + '</b></div>' +
        '</div>' + memory +
        '<div class="go" data-detail="' + day.index + '"><span>Voir le spot</span><span class="arrow">' + ICON.go + '</span></div>' +
      '</div></div></div></article>';
  }
  // toutes les sessions possibles, tous spots confondus, de la meilleure à la moins bonne
  function renderByScore() {
    var wrap = $('stackWrap'), rows = [];
    state.results.forEach(function (r) { (r.windows || []).forEach(function (w) { rows.push({ r: r, w: w }); }); });
    rows.sort(function (a, b) { return b.w.score - a.w.score; });
    wrap.innerHTML = '<div class="others" style="margin:0 10px">' + rows.map(function (o, k) {
      var day = state.days.filter(function (d) { return d.iso === o.w.date; })[0];
      var when = day ? dayName(day.iso, day.index) + (day.index ? ' ' + shortDate(day.iso) : '') : shortDate(o.w.date);
      return '<div class="other ' + verdict(o.w.score).cls + '" data-k="' + k + '"><span class="n" style="display:block">' + esc(o.r.spot.name) + '<span class="s" style="display:block;font-weight:400">' + esc(when + ', ' + slotText(o.w)) + '</span></span><span class="s" style="font-size:20px;font-weight:500">' + fr(o.w.score) + '</span></div>';
    }).join('') + '</div>';
    wrap.querySelectorAll('[data-k]').forEach(function (row) { row.addEventListener('click', function () {
      var o = rows[parseInt(row.getAttribute('data-k'), 10)], day = state.days.filter(function (d) { return d.iso === o.w.date; })[0];
      if (day) openDetail(day, o.r);
    }); });
  }
  // conditions du moment, lues dans les prévisions déjà chargées (aucun appel de plus au fournisseur)
  function renderNow() {
    var box = $('now'); if (!box) return;
    var today = localISO(new Date()), hour = new Date().getHours(), best = null;
    state.results.forEach(function (r) {
      if (r.discovery || best) return;
      var hs = hoursOf(r, today).filter(function (h) { return h.hour >= hour; });
      if (hs.length) best = { r: r, h: hs[0] };
    });
    if (!best) { box.innerHTML = ''; return; }
    var c = best.h.conditions || {}, bits = [];
    if (c.airTemp != null) bits.push('Air ' + Math.round(c.airTemp) + '°');
    if (c.windSpeed != null) bits.push('Vent ' + Math.round(c.windSpeed) + ' km/h' + (c.windDirection != null ? ' ' + cardinal(c.windDirection).toLowerCase() : ''));
    if (c.waveHeight != null) bits.push('Vagues ' + fr(c.waveHeight) + ' m');
    if (c.waterTemp != null) bits.push('Eau ' + Math.round(c.waterTemp) + '°');
    if (c.tidePhase && c.tidePhase !== 'unknown') bits.push('Marée ' + tideWord(c.tidePhase).toLowerCase());
    box.innerHTML = '<b>' + (best.h.hour === hour ? 'Maintenant' : 'À ' + best.h.hour + 'h') + ' · ' + esc(best.r.spot.name) + '</b>' + bits.map(function (b) { return '<span>' + esc(b) + '</span>'; }).join('');
  }
  function renderHome() {
    renderNow();
    var seg = $('homeSort');
    if (seg) { seg.style.display = state.days.length ? '' : 'none'; if (state.byScore && state.days.length) return renderByScore(); }
    var wrap = $('stackWrap'), days = state.days;
    if (!days.length) { wrap.innerHTML = stateCard('Pas encore de prévisions', 'Ajoute un spot favori pour voir ta semaine.'); return; }
    var bestDay = null;
    days.forEach(function (d) { if (d.best && (!bestDay || d.best.w.score > bestDay.best.w.score)) bestDay = d; });
    wrap.innerHTML = '<div class="stack">' + days.map(function (d) { return dayCard(d, d === bestDay); }).join('') + '</div>';
    wrap.querySelectorAll('.day').forEach(function (card) {
      card.addEventListener('click', function () {
        var was = card.classList.contains('open');
        wrap.querySelectorAll('.day.open').forEach(function (c) { c.classList.remove('open'); });
        if (!was) card.classList.add('open');
      });
    });
    wrap.querySelectorAll('[data-detail]').forEach(function (g) {
      g.addEventListener('click', function (e) {
        e.stopPropagation();
        var day = dayByIndex(parseInt(g.getAttribute('data-detail'), 10));
        openDetail(day, day.best.r);
      });
    });
  }
  function dayByIndex(i) { return state.days.filter(function (d) { return d.index === i; })[0]; }
  function stateCard(title, text, link) {
    return '<div class="state"><b>' + esc(title) + '</b>' + esc(text) + (link ? '<br><a href="' + link.href + '">' + esc(link.label) + '</a>' : '') + '</div>';
  }

  // ───────── détail du spot ─────────
  function bestWindowOn(result, iso) {
    return (result.windows || []).filter(function (w) { return w.date === iso; }).sort(function (a, b) { return b.score - a.score; })[0] || null;
  }
  function openDetail(day, result) {
    var sheet = $('sheet'), iso = day.iso, hs = hoursOf(result, iso), w = bestWindowOn(result, iso);
    var v = w ? verdict(w.score) : { cls: 'none', label: 'Rien à surfer' };
    sheet.className = 'sheet v-' + v.cls;
    var others = state.results.map(function (r) { return { r: r, w: bestWindowOn(r, iso) }; })
      .sort(function (a, b) { return (b.w ? b.w.score : 0) - (a.w ? a.w.score : 0); });
    sheet.innerHTML =
      '<button class="close" id="close" aria-label="Fermer">' + ICON.down + '</button>' +
      '<div class="kicker">' + esc(longDate(iso)) + '</div>' +
      '<h2>' + esc(result.spot.name) + '</h2>' +
      '<div class="headline"><span class="v">' + (w ? v.label + ', ' + esc(slotText(w)) : 'Rien à surfer ce jour-là') + '</span>' + (w ? '<span class="score">' + fr(w.score) + '<span>/10</span></span>' : '') + '</div>' +
      (hs.length ?
        '<div class="blabel">' + ICON.star + 'Ta note, heure par heure</div>' +
        '<div class="hbars" id="hbars"></div><div class="hlabels" id="hlabels"></div>' +
        '<div class="at"><b id="atHour"></b><span id="atVerdict"></span></div>' +
        '<div class="nums">' +
          '<div class="num wide"><div class="c1"><label>Houle</label><b id="nWave"></b><em id="tWave"></em></div><div class="c2"><b id="nSd"></b><em id="tSd"></em></div><span class="arr" id="aSd">' + ICON.arrowSwell + '</span></div>' +
          '<div class="num wide"><div class="c1"><label>Vent</label><b id="nWind"></b><em id="tWind"></em></div><div class="c2"><b id="nWd"></b><em id="tWd"></em></div><span class="arr" id="aWd">' + ICON.arrowWind + '</span></div>' +
          '<div class="num"><label>Période</label><b id="nPer"></b><em id="tPer"></em></div>' +
          '<div class="num"><label>Puissance</label><b id="nPow"></b><em id="tPow"></em></div>' +
          '<div class="num" style="grid-column:1/-1"><label>Marée</label><b id="nTide"></b><em id="tTide"></em></div>' +
          '<div class="num"><label>Air</label><b id="nAir"></b></div>' +
          '<div class="num"><label>Eau</label><b id="nWater"></b></div>' +
        '</div>' : '<p class="why" style="margin-top:20px">Pas de prévision heure par heure pour ce jour.</p>') +
      whyBlock(w) +
      '<h3>Les autres spots ' + esc(dayName(iso, day.index).toLowerCase()) + '</h3>' +
      '<div class="others">' + others.map(function (o, k) {
        var ov = o.w ? verdict(o.w.score) : { cls: 'none' };
        var here = o.r === result ? '<span class="here">Ici</span>' : '';
        return '<div class="other ' + ov.cls + '" data-o="' + k + '"><span class="n">' + esc(o.r.spot.name) + here + '</span><span class="s">' + (o.w ? fr(o.w.score) + ' · ' + esc(slotText(o.w)) : 'Rien à surfer') + '</span></div>';
      }).join('') + '</div>' +
      '<div id="past"></div>';

    $('close').addEventListener('click', function () { sheet.classList.remove('show'); });
    if ($('sendMate')) $('sendMate').addEventListener('click', function () {
      // même message que dans l'ancienne version
      var vibe = w.score >= 8 ? 'Très bonne session prévue' : w.score >= 6 ? 'Ça devrait être bien' : 'Session pas ouf mais envie d\'aller à l\'eau';
      var text = vibe + ' à ' + result.spot.name + ' ' + longDate(iso).toLowerCase() + (w.timeWindow ? ' (' + slotText(w) + ')' : '') + ', ' + fr(w.score) + '/10 ! Tu viens ?\n\nhttps://surfai-app.vercel.app';
      var label = this.querySelector('span');
      if (navigator.share) { navigator.share({ text: text }).catch(function () {}); return; }
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { label.textContent = 'Copié !'; setTimeout(function () { label.textContent = 'Envoyer à un pote'; }, 1500); });
    });
    sheet.querySelectorAll('[data-o]').forEach(function (row) {
      row.addEventListener('click', function () { var o = others[parseInt(row.getAttribute('data-o'), 10)]; if (o.r !== result) openDetail(day, o.r); });
    });
    if (hs.length) buildHours(hs, w);
    renderPast(result.spot);
    sheet.scrollTop = 0;
    sheet.classList.add('show');
  }

  // explications du moteur, board conseillée et envoi à un pote (contenus de l'ancienne version)
  function clean(t) { return String(t).replace(/\s+—\s+/g, ', '); }
  function whyBlock(w) {
    if (!w) return '';
    var out = '', skip = w.reminder && w.reminder.text;
    var good = (w.whyGood || []).filter(function (t) { return t !== skip; }), bad = (w.whyNotPerfect || []).filter(function (t) { return t !== skip; });
    if (w.narrative) out += '<p class="narr">« ' + esc(clean(w.narrative)) + ' »</p>';
    if (good.length || bad.length) out += '<div class="whys">' +
      good.map(function (t) { return '<div class="wy">' + esc(clean(t)) + '</div>'; }).join('') +
      bad.map(function (t) { return '<div class="wy b">' + esc(clean(t)) + '</div>'; }).join('') + '</div>';
    var bs = w.boardSuggestion;
    if (bs && bs.board) out += '<div class="wy board">Prends ta ' + esc(bs.board.nickname || bs.board.name || 'board') + (bs.reason ? '. ' + esc(clean(bs.reason)) : '') + '</div>';
    out += '<div class="go" id="sendMate" style="cursor:pointer"><span>Envoyer à un pote</span><span class="arrow">' + ICON.go + '</span></div>';
    return out;
  }

  var COL = { ok: '#1F9D55', warn: '#F2820F', bad: '#E23D28' };
  function rel(deg, facing) { return ((deg - facing) % 360 + 540) % 360 - 180; }   // 0 = vient pile du large
  function setArrow(id, relDeg, size, level) {
    var a = $(id); a.style.color = COL[level];
    a.firstChild.style.transform = 'rotate(' + (relDeg + 180) + 'deg) scale(' + size.toFixed(2) + ')';
  }
  function buildHours(hs, w) {
    var bars = $('hbars'), labels = $('hlabels'), range = w ? windowHours(w) : [-1, -1], highAt = null, lowAt = null;
    hs.forEach(function (h) { var p = (h.conditions || {}).tidePhase; if (p === 'high' && highAt == null) highAt = h.hour; if (p === 'low' && lowAt == null) lowAt = h.hour; });
    hs.forEach(function (h, i) {
      var c = document.createElement('div'); c.className = 'hc';
      var n = document.createElement('span'); n.className = 'sc'; n.textContent = fr(h.score);
      var b = document.createElement('button');
      b.className = 'hb' + (h.hour >= range[0] && h.hour <= range[1] ? ' best' : '');
      b.style.height = Math.max(14, h.score * 10.5) + 'px'; b.setAttribute('aria-label', h.hour + 'h');
      b.addEventListener('click', function () { pick(i); });
      c.appendChild(n); c.appendChild(b); bars.appendChild(c);
      var l = document.createElement('span'); l.textContent = h.hour + 'h'; labels.appendChild(l);
    });
    function pick(i) {
      var h = hs[i], c = h.conditions || {}, v = verdict(h.score, h.storm);
      [].forEach.call(bars.children, function (x, k) { x.classList.toggle('sel', k === i); });
      [].forEach.call(labels.children, function (x, k) { x.classList.toggle('sel', k === i); });
      $('atHour').textContent = h.hour + 'h';
      $('atVerdict').textContent = v.label + ' · ' + fr(h.score) + (h.confidence === 'low' ? ' · à confirmer' : '');
      // houle
      $('nWave').innerHTML = c.waveHeight != null ? fr(c.waveHeight) + '<small>m</small>' : '';
      $('tWave').textContent = h.sizeIssue === 'too_small' ? 'Trop petit pour toi' : h.sizeIssue === 'too_big' ? 'Trop gros pour toi' : 'À ta taille';
      // le large est là d'où viennent les vagues : toutes les flèches se lisent plage en bas, large en haut
      var swell = c.swellDirection != null ? c.swellDirection : c.waveDirection;
      var facing = c.waveDirection != null ? c.waveDirection : swell;
      if (swell != null) {
        var sr = rel(swell, facing), as = Math.abs(sr);
        $('nSd').textContent = Math.round(swell) + '° ' + cardinal(swell);
        $('tSd').textContent = as < 25 ? 'Bien en face' : 'De biais, par la ' + (sr > 0 ? 'droite' : 'gauche');
        setArrow('aSd', sr, 0.5 + Math.min(c.waveHeight || 0, 2) / 2 * 0.7, h.sizeIssue ? 'warn' : as < 50 ? 'ok' : 'warn');
        $('aSd').style.visibility = '';
      } else { $('nSd').textContent = ''; $('tSd').textContent = ''; $('aSd').style.visibility = 'hidden'; }
      // vent
      var ws = c.windSpeed;
      $('nWind').innerHTML = ws != null ? Math.round(ws) + '<small>km/h</small>' : '';
      var gust = c.windGust;
      $('tWind').textContent = ws != null ? windWord(ws) + (gust != null && gust >= 25 ? ' · rafales ' + Math.round(gust) : '') : '';
      if (c.windDirection != null && facing != null) {
        var wr = rel(c.windDirection, facing), aw = Math.abs(wr);
        var level = aw > 135 ? (ws >= 30 ? 'warn' : 'ok') : aw < 45 ? (ws < 10 ? 'warn' : 'bad') : (ws < 12 ? 'ok' : ws >= 20 ? 'bad' : 'warn');
        if (gust != null && gust >= 40) level = 'bad'; else if (gust != null && gust >= 30 && level === 'ok') level = 'warn';
        $('nWd').textContent = Math.round(c.windDirection) + '° ' + cardinal(c.windDirection);
        $('tWd').textContent = aw > 135 ? 'Dans le dos' : aw < 45 ? 'De face' : 'De côté, par la ' + (wr > 0 ? 'droite' : 'gauche');
        setArrow('aWd', wr, 0.5 + Math.min(Math.max(ws || 0, (gust || 0) * 0.7), 30) / 30 * 0.7, level);
        $('aWd').style.visibility = '';
      } else { $('nWd').textContent = ''; $('tWd').textContent = ''; $('aWd').style.visibility = 'hidden'; }
      // période et marée
      var per = c.peakPeriod != null ? c.peakPeriod : c.swellPeriod != null ? c.swellPeriod : c.wavePeriod;
      var choppy = c.windWaveHeight != null && c.waveHeight ? c.windWaveHeight / c.waveHeight >= 0.4 : false;
      $('nPer').innerHTML = per != null ? Math.round(per) + '<small>s</small>' : '';
      $('tPer').textContent = per == null ? '' : choppy ? 'Mer hachée par le vent' : per >= 10 ? 'Vagues bien formées' : per >= 7 ? 'Vagues correctes' : 'Vagues brouillonnes';
      var pw = c.wavePower;
      $('nPow').innerHTML = pw != null ? fr(pw, pw < 10 ? 1 : 0) + '<small>kW/m</small>' : '';
      var pState = { weak: 'Molle, tu risques de ramer', fair: 'Correcte', good: 'Bonne pour toi', strong: 'Trop puissante pour toi' }[h.powerState];
      $('tPow').textContent = pw == null ? '' : pState || (pw < 5 ? 'Molle' : pw < 15 ? 'Correcte' : pw < 30 ? 'Puissante' : pw < 60 ? 'Très puissante' : 'Énorme');
      $('nTide').textContent = tideWord(c.tidePhase);
      $('tTide').textContent = [tideLevelWord(c.tideLevel), highAt != null ? 'haute ~' + highAt + 'h' : '', lowAt != null ? 'basse ~' + lowAt + 'h' : ''].filter(Boolean).join(' · ');
      $('nAir').innerHTML = c.airTemp != null ? Math.round(c.airTemp) + '<small>°C</small>' : '';
      $('nWater').innerHTML = c.waterTemp != null ? Math.round(c.waterTemp) + '<small>°C</small>' : '';
    }
    var start = 0, bestScore = -1;
    hs.forEach(function (h, i) { if (h.score > bestScore) { bestScore = h.score; start = i; } });
    pick(start);
  }

  // ───────── ton vécu ici ─────────
  function loadSessions() {
    if (DEMO) return Promise.resolve(demoSessions());
    if (state.sessions) return Promise.resolve(state.sessions);
    return fetch(BACKEND + '/api/v1/sessions/list?userId=' + encodeURIComponent(state.userId))
      .then(function (r) { return r.json(); })
      .then(function (j) { state.sessions = j.sessions || j.data || []; return state.sessions; })
      .catch(function () { return []; });
  }
  function renderPast(spot) {
    loadSessions().then(function (all) {
      var mine = all.filter(function (s) { return s.spot_id === spot.id; }).slice(0, 8);
      var box = $('past'); if (!box || !mine.length) return;
      box.innerHTML = '<h3>Ton vécu ici</h3><div class="past">' + mine.map(function (s, k) {
        var n = Math.max(0, Math.min(5, Math.round(s.rating || 0)));
        var photo = s.photo_url || s.photo || null;
        var ph = photo ? '<div class="ph" style="background:center/cover url(\'' + esc(photo) + '\')"></div>' : '<div class="ph' + ['', ' b', ' c'][k % 3] + '"></div>';
        var note = s.notes ? '« ' + esc(String(s.notes).slice(0, 70)) + ' »' : '';
        return '<div class="mem">' + ph + '<div class="st">' + '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n) + '</div><p>' + note + '</p></div>';
      }).join('') + '</div>';
    });
  }

  // ───────── chargement ─────────
  var _client = null;
  function client() {
    if (!_client) { try { _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); } catch (e) { _client = null; } }
    return _client;
  }
  function getUserId() {
    if (DEMO) return Promise.resolve('demo');
    if (LOCAL) return Promise.resolve(DEV_USER_ID);
    try {
      return client().auth.getSession().then(function (r) { return r.data && r.data.session ? r.data.session.user.id : null; });
    } catch (e) { return Promise.resolve(null); }
  }
  function getPosition() {
    return new Promise(function (resolve) {
      var home = null;
      try { var hs = JSON.parse(localStorage.getItem('home_spot') || 'null'); if (hs && hs.lat) home = { lat: Number(hs.lat), lng: Number(hs.lng) }; } catch (e) { home = null; }
      var resolveNull = resolve; resolve = function (p) { resolveNull(p || home); };
      if (DEMO || !navigator.geolocation) return resolve(null);
      var done = false, t = setTimeout(function () { if (!done) { done = true; resolve(null); } }, 4000);
      navigator.geolocation.getCurrentPosition(function (p) {
        if (done) return; done = true; clearTimeout(t); resolve({ lat: p.coords.latitude, lng: p.coords.longitude });
      }, function () { if (done) return; done = true; clearTimeout(t); resolve(null); }, { maximumAge: 600000, timeout: 3500 });
    });
  }
  function start() {
    var seg = $('homeSort');
    if (seg) [].forEach.call(seg.children, function (sp, i) { sp.addEventListener('click', function () {
      state.byScore = i === 1; seg.children[0].classList.toggle('on', i === 0); seg.children[1].classList.toggle('on', i === 1); renderHome();
    }); });
    getUserId().then(function (userId) {
      if (!userId) {
        if (window.SurfV4.showAuth) { $('stackWrap').innerHTML = ''; window.SurfV4.showAuth(); return; }
        $('stackWrap').innerHTML = stateCard('Connecte-toi', 'Tes prévisions t\'attendent.', { href: 'ancienne.html?retour=1', label: 'Se connecter' });
        return;
      }
      state.userId = userId;
      if (window.SurfV4.onReady) window.SurfV4.onReady();
      loadPredictions();
      checkProfile(userId);
    });
  }
  // Un compte sans profil n'a pas fini son inscription : elle se fait encore dans l'ancienne version.
  function checkProfile(userId) {
    if (DEMO || LOCAL) return;
    try {
      client().from('profiles').select('id').eq('id', userId).maybeSingle()
        .then(function (r) { if (!r.error && !r.data) { if (window.SurfV4.showProfileSteps) window.SurfV4.showProfileSteps(userId); else location.replace('ancienne.html?retour=1'); } });
    } catch (e) { /* on reste sur l'accueil */ }
  }
  function loadPredictions() {
      var userId = state.userId;
      if (DEMO) { show(demoData()); return; }
      getPosition().then(function (pos) {
        state.position = pos;
        if (pos) return pos;
        return fetch(BACKEND + '/api/v1/favorites?userId=' + encodeURIComponent(userId)).then(function (r) { return r.json(); })
          .then(function (j) { var f = (j.favorites || []).filter(function (x) { return x.lat != null; })[0]; return f ? { lat: Number(f.lat), lng: Number(f.lng) } : null; })
          .catch(function () { return null; });
      }).then(function (pos) {
        var url = BACKEND + '/api/v1/predictions/best-windows?userId=' + encodeURIComponent(userId) + '&days=' + DAYS +
          (pos ? '&lat=' + pos.lat.toFixed(3) + '&lng=' + pos.lng.toFixed(3) : '');
        return fetch(url).then(function (r) { return r.json(); });
      }).then(show).catch(function () {
        $('stackWrap').innerHTML = stateCard('Connexion impossible', 'Le serveur de prévisions ne répond pas. Réessaie dans un instant.');
      });
  }
  function show(json) {
    var results = (json && json.results) || [];
    var usable = results.filter(function (r) { return !r.error; });
    if (!usable.length) {
      var err = results.length ? results[0].error : (json && (json.message || json.error));
      var quota = /quota/i.test(err || '');
      $('stackWrap').innerHTML = stateCard(quota ? 'Prévisions en pause' : 'Pas encore de prévisions',
        quota ? 'Le quota de prévisions du jour est atteint. Elles reviennent demain.' : (err || 'Ajoute un spot favori pour voir ta semaine.'));
      return;
    }
    state.results = usable;
    state.days = buildDays(usable);
    var cities = {}; usable.forEach(function (r) { if (r.spot.city && !r.discovery) cities[r.spot.city] = 1; });
    var names = Object.keys(cities);
    $('whereTxt').textContent = names.length === 1 ? names[0] + ' et alentours' : names.length ? names.slice(0, 2).join(', ') + (names.length > 2 ? ' et alentours' : '') : 'Tes spots';
    renderHome();
  }

  // ───────── données de démonstration (v4.html?demo) ─────────
  function demoData() {
    var today = new Date();
    function iso(i) { return localISO(new Date(today.getFullYear(), today.getMonth(), today.getDate() + i, 12)); }
    function spotDay(i, base, shape, opt) {
      opt = opt || {};
      var hours = [];
      for (var h = 8; h <= 17; h++) {
        var k = h - 8, score = Math.max(1.5, Math.min(9.6, base + shape[k]));
        hours.push({ hour: h, date: iso(i), score: Math.round(score * 10) / 10, sizeIssue: opt.size || null, conditions: {
          waveHeight: (opt.wave || 1.2) + k * 0.03, wavePeriod: opt.per || 11, waveDirection: 290, swellDirection: 290 + (opt.skew || 0),
          windSpeed: 6 + k * (opt.windUp || 1.8), windDirection: k < 4 ? 95 : 270, tidePhase: h === 13 ? 'high' : h < 13 ? 'rising' : 'falling', airTemp: 13 + k * 0.5, waterTemp: 15, tideLevel: 1 - Math.abs(13 - h) / 6 } });
      }
      return hours;
    }
    var AM = [0, 2.2, 2.2, 1.2, -0.2, -1.2, -1.8, -2.2, -1.9, -1.4], PM = [-2, -1.6, -1.2, -0.8, -0.2, 0.3, 0.8, 1, 0.6, 0];
    function result(spot, plan, extra) {
      var hourly = [], windows = [];
      plan.forEach(function (p, i) {
        if (!p) return;
        var hs = spotDay(i, p.base, p.shape, p);
        hourly = hourly.concat(hs);
        var best = hs.reduce(function (a, b) { return a.score >= b.score ? a : b; });
        if (best.score >= 4) windows.push({ date: iso(i), timeWindow: best.hour + 'h–' + (best.hour + 2) + 'h', peakHour: best.hour + 'h', score: best.score, conditions: best.conditions, reminder: p.reminder || null, narrative: p.narr || null, whyGood: p.good || [], whyNotPerfect: p.bad || [], boardSuggestion: p.board || null });
      });
      var r = { spot: spot, windows: windows, hourlyScores: hourly };
      for (var key in (extra || {})) r[key] = extra[key];
      return r;
    }
    var small = { base: 2.5, shape: PM, size: 'too_small', wave: 0.4 }, big = { base: 2.8, shape: AM, size: 'too_big', wave: 2.6 };
    return { success: true, results: [
      result({ id: 'a', name: 'Côte des Basques', city: 'Biarritz' }, [{ base: 4.2, shape: PM, wave: 0.8 }, { base: 6.2, shape: AM, reminder: { tone: 'good', text: 'Tu as déjà eu ces conditions ici, et tu avais adoré' }, narr: 'Petit matin propre, des lignes bien rangées', good: ['Vent de terre léger', 'Houle longue de 11 s', 'Mi-marée montante — idéale pour ce spot'], bad: ['Du monde à l\'eau le week-end'], board: { board: { nickname: 'Longboard' }, reason: 'Parfaite dans ces vagues douces' } }, { base: 4.6, shape: AM }, big, small, { base: 4.4, shape: PM }]),
      result({ id: 'b', name: 'Grande Plage', city: 'Biarritz' }, [{ base: 3.6, shape: PM, wave: 0.8 }, { base: 5, shape: AM }, { base: 4.2, shape: AM }, big, small, { base: 5.2, shape: PM, wave: 1.6 }]),
      result({ id: 'c', name: 'Ilbaritz', city: 'Bidart' }, [{ base: 4.7, shape: PM, wave: 0.8 }, { base: 3.8, shape: AM }, { base: 3.9, shape: AM }, big, small, { base: 3.6, shape: PM }]),
      result({ id: 'd', name: 'Le VVF', city: 'Anglet' }, [null, null, { base: 5, shape: AM, wave: 1 }, null, null, null], { discovery: true, distanceKm: 4 })
    ] };
  }
  function demoSessions() {
    return [
      { spot_id: 'a', rating: 5, notes: "Glassy jusqu'à 11h, longues droites, personne à l'eau" },
      { spot_id: 'a', rating: 4, notes: 'Bien mais du monde, longboard parfait' },
      { spot_id: 'a', rating: 2, notes: 'Trop de vent, ça hachait' }
    ];
  }

  window.SurfV4 = { state: state, $: $, esc: esc, fr: fr, cap: cap, BACKEND: BACKEND, LOCAL: LOCAL, DEMO: DEMO,
    SUPABASE_URL: SUPABASE_URL, SUPABASE_KEY: SUPABASE_KEY, ICON: ICON, localISO: localISO, dateOf: dateOf,
    windWord: windWord, client: client, verdict: verdict, slotText: slotText, tideWord: tideWord, cardinal: cardinal, DAYS: DAYS, shortDate: shortDate, dayLabel: function (iso) { var t = localISO(new Date()); return iso === t ? "Aujourd'hui" : cap(dateOf(iso).toLocaleDateString('fr-FR', { weekday: 'long' })) + ' ' + shortDate(iso); }, reload: loadPredictions, loadSessions: loadSessions };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

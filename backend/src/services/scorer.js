// 🎯 Scorer SurfAI — Score composite 0-10 par créneau horaire
// Spec : docs/superpowers/specs/2026-03-22-moteur-prediction-ia-design.md

// Poids des facteurs (somme = 1.0)
// La personnalisation ne passe plus par un facteur « sessions proches » (qui ne faisait que
// refléter la moyenne des notes récentes) mais par la fourchette de vagues apprise des sessions.
const WEIGHTS = {
  wind:   0.375,
  waves:  0.25,
  period: 0.1875,
  spot:   0.1875,
};

function computeWeights() {
  return { ...WEIGHTS, history: 0 };
}

// ─── Fourchette de vagues apprise ───────────────────────
// Ce que le surfeur déclare dans son profil n'est qu'un point de départ.
// Dès qu'il a assez de sessions, on apprend sa vraie zone de confort :
//   - ressenti « parfait »            → cette taille est dans sa zone (preuve forte)
//   - session notée 4 ou 5 sans ressenti → probablement dans sa zone (preuve faible)
//   - ressenti « trop petit »          → sa taille mini est au-dessus
//   - ressenti « trop gros »           → sa taille maxi est en dessous
const MIN_SESSIONS_TO_LEARN = 5;
const FULL_CONFIDENCE_SESSIONS = 15;

// Poids d'une session selon son ancienneté : divisé par deux tous les `halfLifeDays` jours
function recencyWeight(date, halfLifeDays) {
  const t = date ? new Date(date).getTime() : NaN;
  if (!Number.isFinite(t)) return 1;
  const ageDays = Math.max(0, (Date.now() - t) / 86400000);
  return Math.pow(0.5, ageDays / halfLifeDays);
}

function sessionSizeFeel(session) {
  return session.size_feel || session.meteo?.sizeFeel || null;
}

function sessionWaveHeight(session) {
  const m = session.meteo;
  if (!m || typeof m.waveHeight !== 'number') return null;
  return Math.max(m.waveHeight, typeof m.swellHeight === 'number' ? m.swellHeight : 0);
}

function weightedQuantile(points, q) {
  const sorted = [...points].sort((x, y) => x.h - y.h);
  const total = sorted.reduce((sum, p) => sum + p.w, 0);
  let acc = 0;
  for (const p of sorted) {
    acc += p.w;
    if (acc >= q * total) return p.h;
  }
  return sorted[sorted.length - 1].h;
}

function learnWaveRange(pastSessions, profile) {
  const declared = {
    min: profile?.min_wave_height || 0.8,
    max: profile?.max_wave_height || 2.0,
  };
  const base = { ...declared, source: 'declared', basedOnSessions: 0, confidence: 0, declared };

  const good = [], tooSmall = [], tooBig = [];
  (pastSessions || []).forEach(s => {
    const h = sessionWaveHeight(s);
    if (h == null) return;
    const feel = sessionSizeFeel(s);
    // Les sessions récentes pèsent plus : la fourchette suit la progression du surfeur
    const recency = recencyWeight(s.date, 365);
    if (feel === 'perfect') good.push({ h, w: 1 * recency });
    else if (feel === 'too_small') { if (recency >= 0.25) tooSmall.push(h); }
    else if (feel === 'too_big') { if (recency >= 0.25) tooBig.push(h); }
    else if (s.rating >= 4) good.push({ h, w: 0.5 * recency });
  });

  const evidence = good.length + tooSmall.length + tooBig.length;
  if (good.length < 3 || evidence < MIN_SESSIONS_TO_LEARN) {
    return { ...base, basedOnSessions: evidence };
  }

  let learnedMin = weightedQuantile(good, 0.1);
  let learnedMax = weightedQuantile(good, 0.9);
  const center = weightedQuantile(good, 0.5);
  // Les « trop petit » remontent le mini, les « trop gros » abaissent le maxi
  const smallBelow = tooSmall.filter(h => h < center);
  const bigAbove = tooBig.filter(h => h > center);
  if (smallBelow.length) learnedMin = Math.max(learnedMin, Math.max(...smallBelow) + 0.1);
  if (bigAbove.length) learnedMax = Math.min(learnedMax, Math.min(...bigAbove) - 0.1);
  if (learnedMax < learnedMin + 0.3) learnedMax = learnedMin + 0.3;

  // On glisse progressivement du profil déclaré vers la fourchette apprise
  const confidence = Math.min(1, evidence / FULL_CONFIDENCE_SESSIONS);
  const round = v => Math.round(v * 10) / 10;
  return {
    min: round(declared.min + (learnedMin - declared.min) * confidence),
    max: round(declared.max + (learnedMax - declared.max) * confidence),
    source: 'learned',
    basedOnSessions: evidence,
    confidence: Math.round(confidence * 100) / 100,
    declared,
  };
}

// ─── Facteur Vent (0-10) ────────────────────────────────
function scoreWind(windSpeed, windDirection, idealWindDirections, waveDirection) {
  if (typeof windSpeed !== 'number' || Number.isNaN(windSpeed)) windSpeed = 0;
  // windSpeed en km/h, windDirection en degrés (0-360)
  const speedKmh = windSpeed || 0; // toujours en km/h (converti a la collecte)

  // Courbe continue gaussienne au lieu de paliers
  // 0→10, 10→8.5, 15→7.0, 20→5.3, 25→3.7, 30→2.4, 40→0.8
  const speedScore = 10 * Math.exp(-Math.pow(speedKmh / 25, 2));

  // Scoring offshore : compare direction vent vs direction vagues
  let offshoreBonus = 0;
  if (windDirection != null && waveDirection != null) {
    const diff = Math.abs(windDirection - waveDirection);
    const normalized = diff > 180 ? 360 - diff : diff;
    if (normalized > 150)      offshoreBonus = 2.0;   // offshore pur
    else if (normalized > 120) offshoreBonus = 1.5;   // cross-offshore
    else if (normalized > 60)  offshoreBonus = 0;     // cross-shore
    else if (normalized > 30)  offshoreBonus = -1.0;  // cross-onshore
    else                       offshoreBonus = -1.5;  // onshore pur
  }

  // Bonus direction idéale du spot (si connue)
  let spotDirBonus = 0;
  if (windDirection != null && idealWindDirections?.length > 0) {
    const dir = degreesToCardinal(windDirection);
    if (idealWindDirections.includes(dir)) spotDirBonus = 0.5;
  }

  return Math.min(10, Math.max(0, speedScore + offshoreBonus + spotDirBonus));
}

// ─── Facteur Vagues + Houle (0-10) ──────────────────────
function scoreWaves(waveHeight, swellHeight, profile) {
  const combined = Math.max(waveHeight || 0, swellHeight || 0);
  const min = profile.min_wave_height || 0.8;
  const max = profile.max_wave_height || 2.0;
  const optimal = (min + max) / 2;

  if (combined >= min && combined <= max) {
    // Dans la fourchette — peak au centre
    const distFromOptimal = Math.abs(combined - optimal) / ((max - min) / 2);
    return 10 - distFromOptimal * 2;
  } else if (combined < min) {
    const shortfall = (min - combined) / min;
    return Math.max(0, 6 - shortfall * 10);
  } else {
    const excess = (combined - max) / max;
    return Math.max(0, 6 - excess * 8);
  }
}

// ─── Facteur Période (0-10) ─────────────────────────────
function scorePeriod(period) {
  if (!period) return 4; // neutre si inconnu (pas 3 — on ne pénalise pas l'absence)
  // Courbe sigmoïde : transition douce entre 6-14s, plateau au-dessus
  // 5s→2.4, 7s→3.6, 8s→4.4, 10s→6.0, 12s→7.6, 14s→8.8, 16s→9.5
  return Math.min(10, 2 + 8 / (1 + Math.exp(-0.6 * (period - 10))));
}

// ─── Facteur Adéquation Spot (0-10) ─────────────────────
function scoreSpot(slot, spot) {
  let score = 5; // base neutre

  if (spot.ideal_wind?.length > 0 && slot.windDirection != null) {
    const dir = degreesToCardinal(slot.windDirection);
    if (spot.ideal_wind.includes(dir)) score += 2.5;
  }

  if (spot.ideal_swell?.length > 0 && slot.swellDirection != null) {
    const dir = degreesToCardinal(slot.swellDirection);
    if (spot.ideal_swell.includes(dir)) score += 2.5;
  }

  return Math.min(10, score);
}

// ─── Bonus Marée ────────────────────────────────────────
// Impact réel sur le Pays Basque : la marée peut rendre un spot dangereux ou parfait
// Catégorie de marée : 'low' | 'mid' | 'high' | null
// Priorité au niveau (tideLevel : 0 = basse mer, 1 = pleine mer), sinon la phase
function tideCategory(slot) {
  if (typeof slot.tideLevel === 'number') {
    if (slot.tideLevel < 0.25) return 'low';
    if (slot.tideLevel > 0.75) return 'high';
    return 'mid';
  }
  const phaseMap = { low: 'low', high: 'high', rising: 'mid', falling: 'mid' };
  return phaseMap[slot.tidePhase] || null;
}

function tideBonus(slot, idealTide) {
  const category = tideCategory(slot);
  if (!category) return 0;

  // Spot sans fiche marée → neutre (on ne récompense pas l'absence d'information)
  if (!idealTide?.length) return 0;

  // Marée idéale → bonus
  if (idealTide.includes(category)) return 1.0;

  // Marée opposée à l'idéale → pénalité forte
  const isOpposite = (idealTide.includes('low') && category === 'high' && !idealTide.includes('mid')) ||
                     (idealTide.includes('high') && category === 'low' && !idealTide.includes('mid'));
  if (isOpposite) return -1.5;

  // Marée pas idéale mais pas opposée
  return -0.5;
}

// ─── Board Suggestion ───────────────────────────────────
// Attention : beaucoup de surfeurs n'ont qu'une board et surfent tout avec.
// La suggestion doit être utile, pas culpabilisante.
function suggestBoard(slot, pastSessions, boards) {
  if (!boards?.length) return null;
  const waveH = Math.max(slot.waveHeight || 0, slot.swellHeight || 0);

  // Cas 1 : Une seule board → pas besoin de suggérer, c'est évident
  if (boards.length === 1) {
    return {
      board: boards[0],
      confidence: 1.0,
      method: 'only_board',
      reason: 'Ta fidèle compagne',
      basedOnSessions: 0,
    };
  }

  // Cas 2 : Plusieurs boards — regarder d'abord l'historique réel
  // (ce que le surfeur FAIT est plus important que ce qu'il a déclaré)
  const goodSessions = pastSessions.filter(s => s.rating >= 4 && s.meteo && s.board_id);
  if (goodSessions.length >= 3) {
    function similarity(s) {
      const dWave = Math.abs((s.meteo.waveHeight || 0) - waveH) / 3;
      const dWind = Math.abs((s.meteo.windSpeed || 0) - (slot.windSpeed || 0)) / 40;
      // Décroissance temporelle aussi ici
      const ageInDays = (Date.now() - new Date(s.date).getTime()) / 86400000;
      const recency = Math.exp(-ageInDays / 180);
      return recency / (1 + Math.sqrt(dWave ** 2 + dWind ** 2));
    }

    const similar = goodSessions
      .map(s => ({ board_id: s.board_id, sim: similarity(s) }))
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 7);

    const boardCounts = {};
    similar.forEach(({ board_id }) => {
      boardCounts[board_id] = (boardCounts[board_id] || 0) + 1;
    });
    const topBoardId = Object.entries(boardCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const board = boards.find(b => String(b.id) === String(topBoardId));

    if (board) {
      // Vérifier si le surfeur utilise toujours la même board (mono-board de fait)
      const uniqueBoards = new Set(goodSessions.map(s => s.board_id));
      if (uniqueBoards.size === 1) {
        return {
          board,
          confidence: 1.0,
          method: 'always_same',
          reason: 'Ta board de toutes les sessions',
          basedOnSessions: goodSessions.length,
        };
      }

      return {
        board,
        confidence: Math.round((boardCounts[topBoardId] / similar.length) * 100) / 100,
        method: 'history',
        reason: 'Celle que tu prends dans ces conditions',
        basedOnSessions: similar.length,
      };
    }
  }

  // Cas 3 : Pas assez de sessions — utiliser le sweet spot déclaré
  const matchingBoards = boards
    .filter(b => b.sweet_spot_wave_min && b.sweet_spot_wave_max)
    .filter(b => waveH >= b.sweet_spot_wave_min && waveH <= b.sweet_spot_wave_max)
    .sort((a, b) => {
      const centerA = (a.sweet_spot_wave_min + a.sweet_spot_wave_max) / 2;
      const centerB = (b.sweet_spot_wave_min + b.sweet_spot_wave_max) / 2;
      return Math.abs(centerA - waveH) - Math.abs(centerB - waveH);
    });

  if (matchingBoards.length > 0) {
    return {
      board: matchingBoards[0],
      confidence: 0.7,
      method: 'sweet_spot',
      reason: `Dans son sweet spot (${waveH.toFixed(1)}m)`,
      basedOnSessions: 0,
    };
  }

  // Cas 4 : Aucun match — ne rien suggérer plutôt que suggérer n'importe quoi
  return null;
}

// ─── Utilitaires ────────────────────────────────────────
function degreesToCardinal(deg) {
  if (deg === null || deg === undefined) return null;
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

// ─── Explications lisibles ────────────────────────────────
function buildWhyGood(slot, windScore, wavesScore, periodScore, tideAdj, spotScore, profile, spot, similarSession, badSession) {
  const reasons = [];   // pourquoi c'est bien
  const caveats = [];   // points d'attention

  // --- Vent ---
  const speedKmh = slot.windSpeed || 0;
  if (windScore >= 9) {
    if (speedKmh <= 8) reasons.push('Conditions glassy — quasi pas de vent');
    else reasons.push('Vent léger de terre (' + Math.round(speedKmh) + ' km/h) — vagues propres');
  } else if (windScore >= 7) {
    // Vérifier si c'est grâce à l'offshore
    if (slot.windDirection != null && slot.waveDirection != null) {
      const diff = Math.abs(slot.windDirection - slot.waveDirection);
      const norm = diff > 180 ? 360 - diff : diff;
      if (norm > 120) reasons.push('Vent offshore — vagues propres et creuses');
      else reasons.push('Vent modéré et bien orienté');
    } else {
      reasons.push('Vent faible (' + Math.round(speedKmh) + ' km/h)');
    }
  } else if (windScore < 4) {
    if (speedKmh > 30) caveats.push('Vent fort (' + Math.round(speedKmh) + ' km/h) — conditions difficiles');
    else caveats.push('Vent onshore — vagues hachées');
  }

  // --- Vagues ---
  const waveH = Math.max(slot.waveHeight || 0, slot.swellHeight || 0);
  if (wavesScore >= 8) {
    reasons.push('Vagues parfaites pour toi (' + waveH.toFixed(1) + 'm)');
  } else if (wavesScore >= 6) {
    reasons.push('Taille de vagues dans ta zone (' + waveH.toFixed(1) + 'm)');
  } else if (wavesScore < 4) {
    if (waveH < (profile.min_wave_height || 0.8)) {
      caveats.push('Vagues petites (' + waveH.toFixed(1) + 'm) — en dessous de tes préférences');
    } else {
      caveats.push('Vagues grosses (' + waveH.toFixed(1) + 'm) — au-dessus de tes préférences');
    }
  }

  // --- Période ---
  const period = slot.wavePeriod || 0;
  if (period >= 12) {
    reasons.push('Période longue (' + Math.round(period) + 's) — vagues puissantes et espacées');
  } else if (period > 0 && period < 7) {
    caveats.push('Période courte (' + Math.round(period) + 's) — vagues désorganisées');
  }

  // --- Marée ---
  const tideCat = tideCategory(slot);
  const tideLabel = { low: 'Marée basse', high: 'Marée haute', mid: 'Mi-marée' }[tideCat];
  if (tideLabel && tideAdj >= 1.0) {
    reasons.push(tideLabel + ' — idéale pour ce spot');
  } else if (tideLabel && tideAdj <= -1.0) {
    caveats.push(tideLabel + ' — pas idéale pour ce spot');
  }

  // --- Mémoire du spot : rappel d'une session vécue ici dans des conditions proches ---
  // L'année n'est affichée que pour une session d'une autre année
  const sessionDate = d => {
    const date = new Date(d);
    const sameYear = date.getUTCFullYear() === new Date().getUTCFullYear();
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC', ...(sameYear ? {} : { year: 'numeric' }) });
  };
  if (similarSession) {
    reasons.push('Ressemble à ta session du ' + sessionDate(similarSession.date) + ' ici (' + '★'.repeat(similarSession.rating || 0) + ')');
  } else if (badSession) {
    caveats.push('Ressemble à ta session du ' + sessionDate(badSession.date) + ' ici, que tu avais notée ' + '★'.repeat(badSession.rating || 1));
  }

  return { whyGood: reasons, whyNotPerfect: caveats };
}

// ─── Bonus Communautaire ─────────────────────────────────
// S'active automatiquement quand le profil communautaire du spot a assez de data
function scoreCommunity(slot, communityProfile) {
  if (!communityProfile || communityProfile.confidence < 0.3) return { bonus: 0, active: false };

  const waveH = Math.max(slot.waveHeight || 0, slot.swellHeight || 0);
  let bonus = 0;

  // Les conditions matchent le sweet spot communautaire ?
  if (communityProfile.wave_sweet_min && communityProfile.wave_sweet_max) {
    if (waveH >= communityProfile.wave_sweet_min && waveH <= communityProfile.wave_sweet_max) {
      bonus += 0.8 * communityProfile.confidence;
    } else if (waveH < communityProfile.wave_sweet_min * 0.7 || waveH > communityProfile.wave_sweet_max * 1.3) {
      bonus -= 0.5 * communityProfile.confidence;
    }
  }

  // Le vent est dans les bonnes directions communautaires ?
  if (communityProfile.best_wind_dirs?.length > 0 && slot.windDirection != null) {
    const dir = degreesToCardinal(slot.windDirection);
    if (communityProfile.best_wind_dirs.includes(dir)) {
      bonus += 0.4 * communityProfile.confidence;
    }
  }

  // La marée communautaire
  if (communityProfile.tide_good?.length > 0 && slot.tidePhase) {
    const category = tideCategory(slot);
    if (communityProfile.tide_good.includes(slot.tidePhase) || communityProfile.tide_good.includes(category)) {
      bonus += 0.3 * communityProfile.confidence;
    }
    if (communityProfile.tide_bad?.includes(slot.tidePhase)) {
      bonus -= 0.5 * communityProfile.confidence;
    }
  }

  return {
    bonus: Math.round(Math.min(1.5, Math.max(-1.0, bonus)) * 10) / 10,
    active: true,
    confidence: communityProfile.confidence,
    sessionCount: communityProfile.session_count,
  };
}

// ─── Mémoire du spot ─────────────────────────────────────
// Ce que le surfeur a vécu SUR CE SPOT, dans des conditions proches, fait bouger la prévision.
// Règle stricte : une session ne se compare qu'à une prévision du même spot — les mêmes chiffres
// ne donnent pas la même vague ailleurs.
function angleDiff(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// Ressemblance entre une session passée et un créneau à venir : 1 = identique, 0 = rien à voir.
// On compare tout ce qui est connu des deux côtés : taille, période, vent (force et direction),
// direction de houle, niveau de marée.
function sessionSimilarity(session, slot) {
  const m = session.meteo;
  const diffs = [];
  const sH = sessionWaveHeight(session);
  const fH = Math.max(slot.waveHeight || 0, slot.swellHeight || 0);
  if (sH == null || !fH) return 0; // sans la taille des vagues, pas de comparaison possible
  diffs.push((sH - fH) / Math.max(0.3, fH * 0.25));
  if (typeof m.windSpeed !== 'number' || typeof slot.windSpeed !== 'number') return 0;
  diffs.push((m.windSpeed - slot.windSpeed) / 10);
  if (m.wavePeriod && slot.wavePeriod) diffs.push((m.wavePeriod - slot.wavePeriod) / 3);
  // La direction du vent ne compte que s'il y a du vent
  if (m.windDirection != null && slot.windDirection != null && Math.max(m.windSpeed, slot.windSpeed) > 8) {
    diffs.push(angleDiff(m.windDirection, slot.windDirection) / 45);
  }
  const sSwell = m.swellDirection != null ? m.swellDirection : m.waveDirection;
  const fSwell = slot.swellDirection != null ? slot.swellDirection : slot.waveDirection;
  if (sSwell != null && fSwell != null) diffs.push(angleDiff(sSwell, fSwell) / 30);
  if (typeof m.tideLevel === 'number' && typeof slot.tideLevel === 'number') diffs.push((m.tideLevel - slot.tideLevel) / 0.35);

  // Données anciennes mal formées (texte à la place d'un nombre) : on ignore le critère
  const usable = diffs.filter(Number.isFinite);
  if (usable.length < 2) return 0;
  const distance = Math.sqrt(usable.reduce((sum, d) => sum + d * d, 0) / usable.length);
  return Math.exp(-distance * distance);
}

const SIMILAR_THRESHOLD = 0.4;   // en dessous, la session ne ressemble pas assez
const MEMORY_MAX_ADJUST = 1.5;   // la mémoire déplace la note de 1,5 point au plus

function spotMemory(slot, pastSessions, spotId) {
  const none = { adjustment: 0, sessionsHere: 0, similarCount: 0, bestGood: null, worstBad: null };
  if (!spotId) return none;
  const here = (pastSessions || []).filter(s => s.spot_id === spotId && s.rating >= 1 && s.meteo);
  if (!here.length) return none;

  const similar = here
    .map(s => ({ s, sim: sessionSimilarity(s, slot) }))
    .filter(x => x.sim >= SIMILAR_THRESHOLD)
    .map(x => ({ ...x, w: x.sim * recencyWeight(x.s.date, 730) }))
    .sort((a, b) => b.sim - a.sim);
  if (!similar.length) return { ...none, sessionsHere: here.length };

  const totalW = similar.reduce((sum, x) => sum + x.w, 0);
  const avgRating = similar.reduce((sum, x) => sum + x.s.rating * x.w, 0) / totalW;
  // Une seule session très proche pèse un tiers ; trois et plus pèsent plein
  const strength = Math.min(1, totalW / 3);
  const adjustment = Math.round(((avgRating - 3) / 2) * strength * MEMORY_MAX_ADJUST * 10) / 10;

  return {
    adjustment,
    sessionsHere: here.length,
    similarCount: similar.length,
    bestGood: similar.find(x => x.s.rating >= 4)?.s || null,
    worstBad: similar.find(x => x.s.rating <= 2)?.s || null,
  };
}

// ─── Fonction principale ─────────────────────────────────
function scoreSlot(slot, context) {
  const { spot, pastSessions = [], boards = [], communityProfile = null } = context;
  const sessionsWithMeteo = pastSessions.filter(s => s.meteo).length;
  const weights = computeWeights();
  // Fourchette de vagues : apprise des sessions si possible, sinon celle du profil
  const waveRange = context.waveRange || learnWaveRange(pastSessions, context.profile);
  const profile = { ...context.profile, min_wave_height: waveRange.min, max_wave_height: waveRange.max };

  const windScore    = scoreWind(slot.windSpeed, slot.windDirection, spot.ideal_wind, slot.waveDirection);
  const wavesScore   = scoreWaves(slot.waveHeight, slot.swellHeight, profile);
  const periodScore  = scorePeriod(slot.wavePeriod);
  const spotScore    = scoreSpot(slot, spot);
  const tideAdj      = tideBonus(slot, spot.ideal_tide);

  const community = scoreCommunity(slot, communityProfile);

  // Mémoire : ce que le surfeur a déjà vécu sur ce spot dans des conditions proches
  const memory = spotMemory(slot, pastSessions, slot.spotId || spot.id);
  const similarSession = memory.bestGood;

  const rawScore =
    windScore    * weights.wind   +
    wavesScore   * weights.waves  +
    periodScore  * weights.period +
    spotScore    * weights.spot   +
    tideAdj +
    community.bonus +
    memory.adjustment;

  // Conditions nécessaires : sans vagues à ta taille, ou avec un vent destructeur,
  // rien d'autre ne peut sauver le créneau. On multiplie au lieu d'additionner.
  //   vagues dans la fourchette (score >= 6) → ×1 ; plat ou énorme (score 0) → ×0.2
  //   vent correct (score >= 4) → ×1 ; vent destructeur (score 0) → ×0.5
  const sizeGate = 0.2 + 0.8 * Math.min(1, wavesScore / 6);
  const windGate = 0.5 + 0.5 * Math.min(1, windScore / 4);
  const cappedScore = rawScore * sizeGate * windGate;

  const score = Math.round(Math.min(10, Math.max(0, cappedScore)) * 10) / 10;

  // Diagnostic de taille pour les libellés
  const combinedWave = Math.max(slot.waveHeight || 0, slot.swellHeight || 0);
  const sizeIssue = wavesScore >= 4 ? null
    : (combinedWave < (profile.min_wave_height || 0.8) ? 'too_small' : 'too_big');

  const boardSuggestion = score >= 6 ? suggestBoard(slot, pastSessions, boards) : null;

  // Trouver la session similaire la plus proche pour la narrative

  const why = buildWhyGood(slot, windScore, wavesScore, periodScore, tideAdj, spotScore, profile, spot, similarSession, memory.worstBad);

  return {
    score,
    factors: {
      wind:    { score: Math.round(windScore * 10) / 10,    weight: weights.wind },
      waves:   { score: Math.round(wavesScore * 10) / 10,   weight: weights.waves },
      period:  { score: Math.round(periodScore * 10) / 10,  weight: weights.period },
      history: { score: null, weight: 0, basedOnSessions: sessionsWithMeteo },
      spot:    { score: Math.round(spotScore * 10) / 10,     weight: weights.spot },
      tide:    { bonus: tideAdj },
      community: community,
      memory: { adjustment: memory.adjustment, sessionsHere: memory.sessionsHere, similarCount: memory.similarCount },
    },
    whyGood: community.active && community.bonus > 0
      ? [...why.whyGood, `👥 Confirmé par ${community.sessionCount} sessions terrain (confiance ${Math.round(community.confidence * 100)}%)`]
      : why.whyGood,
    whyNotPerfect: community.active && community.bonus < 0
      ? [...why.whyNotPerfect, `👥 Retours terrain mitigés sur ce spot dans ces conditions`]
      : why.whyNotPerfect,
    boardSuggestion,
    similarSession,
    memory,
    sizeIssue,
    waveRange,
    calibrationLevel: waveRange.confidence,
  };
}

module.exports = { scoreSlot, learnWaveRange, computeWeights, degreesToCardinal, buildWhyGood, tideCategory, spotMemory, sessionSimilarity };

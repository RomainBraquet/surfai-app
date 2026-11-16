// 🎯 Scorer SurfAI — Score composite 0-10 par créneau horaire
// Spec : docs/superpowers/specs/2026-03-22-moteur-prediction-ia-design.md

// Poids de base (somme = 1.0)
const BASE_WEIGHTS = {
  wind:    0.30,
  waves:   0.20,
  period:  0.15,
  history: 0.20,
  spot:    0.15,
};

// Calcul du poids historique progressif selon le nombre de sessions réelles avec météo
function computeWeights(sessionsWithMeteoCount) {
  const h = 0.10 + (0.10 * Math.min(sessionsWithMeteoCount, 20) / 20);
  const remaining = 1 - h;
  const baseWithoutHistory = 1 - BASE_WEIGHTS.history; // 0.80
  return {
    wind:    BASE_WEIGHTS.wind    * (remaining / baseWithoutHistory),
    waves:   BASE_WEIGHTS.waves   * (remaining / baseWithoutHistory),
    period:  BASE_WEIGHTS.period  * (remaining / baseWithoutHistory),
    history: h,
    spot:    BASE_WEIGHTS.spot    * (remaining / baseWithoutHistory),
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

// ─── Facteur Historique (0-10) ──────────────────────────
function scoreHistory(slot, pastSessions) {
  // Inclure TOUTES les sessions notées (pas seulement 4+) → apprendre aussi des mauvaises
  const ratedSessions = pastSessions.filter(s => s.rating >= 1 && s.meteo);
  if (ratedSessions.length < 3) return 5; // neutre si pas assez de données

  function similarity(s) {
    const dWave = Math.abs((s.meteo.waveHeight || 0) - (slot.waveHeight || 0)) / 3;
    const dWind = Math.abs((s.meteo.windSpeed || 0) - (slot.windSpeed || 0)) / 40;
    const dPeriod = Math.abs((s.meteo.wavePeriod || 0) - (slot.wavePeriod || 0)) / 15;

    // Décroissance temporelle : sessions récentes comptent plus (demi-vie 6 mois)
    const ageInDays = (Date.now() - new Date(s.date).getTime()) / 86400000;
    const recencyWeight = Math.exp(-ageInDays / 180);

    // Bonus si même spot : 30% plus pertinent
    const spotBonus = s.spot_id === slot.spotId ? 1.3 : 1.0;

    return spotBonus * recencyWeight / (1 + Math.sqrt(dWave ** 2 + dWind ** 2 + dPeriod ** 2));
  }

  // Top 7 sessions les plus similaires (plus stable que 5)
  const ranked = ratedSessions
    .map(s => ({ session: s, sim: similarity(s) }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 7);

  const weightedRating = ranked.reduce((sum, { session, sim }) => sum + session.rating * sim, 0);
  const totalSim = ranked.reduce((sum, { sim }) => sum + sim, 0);
  const avgRating = totalSim > 0 ? weightedRating / totalSim : 3;

  return (avgRating / 5) * 10; // normaliser 1-5 → 0-10
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
function buildWhyGood(slot, windScore, wavesScore, periodScore, tideAdj, spotScore, profile, spot, similarSession) {
  const reasons = [];   // pourquoi c'est bien
  const caveats = [];   // points d'attention

  // --- Vent ---
  const speedKmh = slot.windSpeed || 0;
  if (windScore >= 9) {
    reasons.push('Conditions glassy — quasi pas de vent');
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

  // --- Session similaire ---
  if (similarSession) {
    const date = new Date(similarSession.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    const stars = '★'.repeat(similarSession.rating || 0);
    reasons.push('Conditions similaires à ta session du ' + date + ' (' + stars + ')');
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

// ─── Session vraiment similaire ──────────────────────────
// On ne cite une session passée que si vagues, vent ET période sont proches.
function findSimilarSession(slot, pastSessions) {
  const waveH = Math.max(slot.waveHeight || 0, slot.swellHeight || 0);
  const candidates = pastSessions
    .filter(s => s.rating >= 4 && s.meteo && typeof s.meteo.waveHeight === 'number' && typeof s.meteo.windSpeed === 'number')
    .map(s => {
      const sWave = Math.max(s.meteo.waveHeight || 0, s.meteo.swellHeight || 0);
      const dWave = Math.abs(sWave - waveH);
      const dWind = Math.abs(s.meteo.windSpeed - (slot.windSpeed || 0));
      const dPeriod = (s.meteo.wavePeriod && slot.wavePeriod) ? Math.abs(s.meteo.wavePeriod - slot.wavePeriod) : 0;
      return { s, dWave, dWind, dPeriod, dist: dWave / 0.4 + dWind / 10 + dPeriod / 3 };
    })
    .filter(c => c.dWave <= Math.max(0.3, waveH * 0.25) && c.dWind <= 10 && c.dPeriod <= 3)
    .sort((a, b) => a.dist - b.dist);
  return candidates.length ? candidates[0].s : null;
}

// ─── Fonction principale ─────────────────────────────────
function scoreSlot(slot, context) {
  const { profile, spot, pastSessions = [], boards = [], communityProfile = null } = context;
  const sessionsWithMeteo = pastSessions.filter(s => s.meteo).length;
  const weights = computeWeights(sessionsWithMeteo);

  const windScore    = scoreWind(slot.windSpeed, slot.windDirection, spot.ideal_wind, slot.waveDirection);
  const wavesScore   = scoreWaves(slot.waveHeight, slot.swellHeight, profile);
  const periodScore  = scorePeriod(slot.wavePeriod);
  const historyScore = scoreHistory(slot, pastSessions);
  const spotScore    = scoreSpot(slot, spot);
  const tideAdj      = tideBonus(slot, spot.ideal_tide);

  const community = scoreCommunity(slot, communityProfile);

  const rawScore =
    windScore    * weights.wind   +
    wavesScore   * weights.waves  +
    periodScore  * weights.period +
    historyScore * weights.history +
    spotScore    * weights.spot   +
    tideAdj +
    community.bonus;

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
  const similarSession = findSimilarSession(slot, pastSessions);

  const why = buildWhyGood(slot, windScore, wavesScore, periodScore, tideAdj, spotScore, profile, spot, similarSession);

  return {
    score,
    factors: {
      wind:    { score: Math.round(windScore * 10) / 10,    weight: weights.wind },
      waves:   { score: Math.round(wavesScore * 10) / 10,   weight: weights.waves },
      period:  { score: Math.round(periodScore * 10) / 10,  weight: weights.period },
      history: { score: Math.round(historyScore * 10) / 10, weight: weights.history, basedOnSessions: sessionsWithMeteo },
      spot:    { score: Math.round(spotScore * 10) / 10,     weight: weights.spot },
      tide:    { bonus: tideAdj },
      community: community,
    },
    whyGood: community.active && community.bonus > 0
      ? [...why.whyGood, `👥 Confirmé par ${community.sessionCount} sessions terrain (confiance ${Math.round(community.confidence * 100)}%)`]
      : why.whyGood,
    whyNotPerfect: community.active && community.bonus < 0
      ? [...why.whyNotPerfect, `👥 Retours terrain mitigés sur ce spot dans ces conditions`]
      : why.whyNotPerfect,
    boardSuggestion,
    similarSession,
    sizeIssue,
    calibrationLevel: Math.round(weights.history * 100) / 100,
  };
}

module.exports = { scoreSlot, computeWeights, degreesToCardinal, buildWhyGood, tideCategory, findSimilarSession };

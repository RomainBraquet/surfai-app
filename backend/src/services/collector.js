// 📡 Collector SurfAI — Agrège toutes les sources de données en un contexte unifié
// Spec : docs/superpowers/specs/2026-03-22-moteur-prediction-ia-design.md

const stormglassService = require('./stormglassService');
const shomService = require('./shomService');
const db = require('./supabaseService');

// Marée à un instant donné, à partir des pleines et basses mers encadrantes.
// tideLevel : 0 = basse mer, 1 = pleine mer (interpolation en cosinus, comme une vraie marée).
// tidePhase : 'low' / 'high' dans l'heure de l'étale, sinon 'rising' / 'falling'.
function tideAt(ts, extremes) {
  const prev = [...extremes].reverse().find(e => e.timestamp <= ts);
  const next = extremes.find(e => e.timestamp > ts);
  if (!prev && !next) return { tidePhase: 'unknown', tideLevel: null };

  let tideLevel = null;
  if (prev && next && next.timestamp > prev.timestamp) {
    const progress = (ts - prev.timestamp) / (next.timestamp - prev.timestamp); // 0 → 1
    const curve = (1 - Math.cos(Math.PI * progress)) / 2;                        // 0 → 1 en cosinus
    tideLevel = next.type === 'high' ? curve : 1 - curve;
    tideLevel = Math.round(tideLevel * 100) / 100;
  }

  const nearest = [prev, next].filter(Boolean)
    .sort((a, b) => Math.abs(a.timestamp - ts) - Math.abs(b.timestamp - ts))[0];
  let tidePhase;
  if (Math.abs(nearest.timestamp - ts) <= 1800) tidePhase = nearest.type; // étale : 'high' | 'low'
  else if (next) tidePhase = next.type === 'high' ? 'rising' : 'falling';
  else tidePhase = prev.type === 'high' ? 'falling' : 'rising';

  return { tidePhase, tideLevel };
}

// Les sessions ont été enregistrées sous plusieurs formats au fil du temps.
// On les ramène au format du moteur (vent en km/h) sans toucher à la base.
function normalizeSession(session) {
  let meteo = session.meteo;
  if (!meteo) return session;

  // Météo enregistrée comme un texte éclaté caractère par caractère → on la reconstitue
  if (typeof meteo === 'object' && Object.prototype.hasOwnProperty.call(meteo, '0')) {
    try {
      const text = Object.keys(meteo).filter(k => /^\d+$/.test(k)).sort((a, b) => a - b).map(k => meteo[k]).join('');
      let parsed = JSON.parse(text);
      if (typeof parsed === 'string') parsed = JSON.parse(parsed);
      meteo = parsed;
    } catch (e) {
      return { ...session, meteo: null };
    }
  }
  if (typeof meteo === 'string') {
    try { meteo = JSON.parse(meteo); } catch (e) { return { ...session, meteo: null }; }
  }

  // Format brut Stormglass (reconnaissable à airTemperature / cloudCover) : vent en m/s → km/h
  if (meteo && (meteo.airTemperature !== undefined || meteo.cloudCover !== undefined) && typeof meteo.windSpeed === 'number') {
    meteo = { ...meteo, windSpeed: Math.round(meteo.windSpeed * 3.6 * 10) / 10 };
  }
  return { ...session, meteo };
}

async function collectContext(spotId, userId, days = 5) {
  console.log(`📡 Collecte contexte: spot=${spotId} user=${userId} days=${days}`);

  // Récupérer toutes les données en parallèle
  const [spot, profile, sessions, boards] = await Promise.all([
    db.getSpotById(spotId),
    db.getProfile(userId),
    db.getSessionsWithMeteo(userId),
    db.getBoards(userId),
  ]);

  if (!spot) throw new Error(`Spot ${spotId} introuvable`);

  // Prévisions météo Stormglass (5 jours)
  const weatherData = await stormglassService.getForecast(spot.lat, spot.lng, days);

  // Marées via Stormglass tide/extremes, puis interpolation sur le forecast
  let forecast = weatherData.forecast;
  try {
    const tideExtremes = await stormglassService.getTideExtremes(spot.lat, spot.lng, days);
    if (tideExtremes.length > 0) {
      forecast = forecast.map(point => ({ ...point, ...tideAt(point.timestamp, tideExtremes), tideExtremes }));
    }
  } catch (e) {
    console.warn('⚠️ Stormglass tide indisponible:', e.message);
  }

  return {
    spot,
    forecast,         // array de points horaires enrichis avec marée
    profile: profile || { surf_level: 'intermediate', min_wave_height: 0.8, max_wave_height: 2.0 },
    pastSessions: (sessions || []).map(normalizeSession),
    boards: boards || [],
    userId,
    collectedAt: new Date().toISOString(),
  };
}

module.exports = { collectContext, tideAt, normalizeSession };

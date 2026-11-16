// Tests du moteur de prédiction — npm test
const assert = require('assert');
const { scoreSlot } = require('../src/services/scorer');
const { tideAt, normalizeSession } = (() => {
  // collector charge Stormglass et Supabase : on fournit des variables factices pour les tests
  process.env.STORMGLASS_API_KEY = process.env.STORMGLASS_API_KEY || 'test';
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost';
  process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test';
  const log = console.log; console.log = () => {};
  const m = require('../src/services/collector'); console.log = log; return m;
})();
const { sunTimes, localParts, spotTimeZone, isDaylightSlot } = require('../src/services/timeUtils');
const { getBestWindows } = require('../src/services/recommender');

const profile = { surf_level: 'intermediate', min_wave_height: 0.8, max_wave_height: 2.0 };
const spot = { id: 's1', name: 'Test', lat: 43.48, lng: -1.56, ideal_wind: ['E', 'NE'], ideal_swell: ['W', 'NW'], ideal_tide: ['low'] };
const ctx = { profile, spot, pastSessions: [], boards: [] };
const perfect = { waveHeight: 1.4, swellHeight: 1.3, wavePeriod: 12, windSpeed: 8, windDirection: 90, waveDirection: 280, swellDirection: 280, tideLevel: 0.1, tidePhase: 'falling' };
const score = (slot, c = ctx) => scoreSlot(slot, c).score;
let n = 0; const ok = (cond, msg) => { assert(cond, msg); n++; };

// Conditions parfaites
ok(score(perfect) >= 8.5, `conditions parfaites >= 8.5, obtenu ${score(perfect)}`);

// 1. La taille des vagues est décisive
ok(score({ ...perfect, waveHeight: 0.2, swellHeight: 0.2 }) < 3, 'océan plat sans vent doit être < 3');
ok(score({ ...perfect, waveHeight: 5, swellHeight: 5, wavePeriod: 16 }) < 3, '5 m pour un max de 2 m doit être < 3');
ok(scoreSlot({ ...perfect, waveHeight: 5, swellHeight: 5 }, ctx).sizeIssue === 'too_big', '5 m → trop gros');
ok(scoreSlot({ ...perfect, waveHeight: 0.2, swellHeight: 0.2 }, ctx).sizeIssue === 'too_small', '0,2 m → trop petit');

// 4. Le vent : plus il est fort de face, plus le score baisse, sans rebond au-delà de 50 km/h
const onshore = v => score({ ...perfect, windSpeed: v, windDirection: 280 });
[10, 20, 30, 40, 50, 51, 60, 80].reduce((prev, v) => { ok(onshore(v) <= prev, `vent de face ${v} km/h ne doit pas remonter`); return onshore(v); }, 10);
ok(onshore(55) < 4, `vent de face 55 km/h doit être < 4, obtenu ${onshore(55)}`);

// 5. Marée : le niveau compte, un spot sans fiche n'est pas favorisé
ok(score({ ...perfect, tideLevel: 0.1 }) > score({ ...perfect, tideLevel: 0.5 }), 'spot de marée basse : basse > mi-marée');
ok(score({ ...perfect, tideLevel: 0.5 }) > score({ ...perfect, tideLevel: 0.9 }), 'spot de marée basse : mi-marée > haute');
const noInfo = { ...spot, ideal_wind: null, ideal_swell: null, ideal_tide: null };
ok(score(perfect, { ...ctx, spot: noInfo }) <= score(perfect), 'un spot sans fiche ne dépasse pas un spot renseigné idéal');

// Marée calculée depuis les pleines et basses mers
const ext = [{ timestamp: 0, type: 'low' }, { timestamp: 22000, type: 'high' }, { timestamp: 44000, type: 'low' }];
ok(tideAt(600, ext).tidePhase === 'low' && tideAt(600, ext).tideLevel < 0.05, 'près de la basse mer → low');
ok(tideAt(11000, ext).tidePhase === 'rising' && Math.abs(tideAt(11000, ext).tideLevel - 0.5) < 0.02, 'mi-montant → rising, niveau 0,5');
ok(tideAt(21800, ext).tidePhase === 'high', 'près de la pleine mer → high');
ok(tideAt(33000, ext).tidePhase === 'falling', 'après la pleine mer → falling');

// 7. Session similaire : citée seulement si elle ressemble
const far = [{ rating: 5, date: '2026-03-26', meteo: { waveHeight: 0.9, windSpeed: 5, wavePeriod: 14 } }];
ok(scoreSlot({ ...perfect, waveHeight: 2.6, swellHeight: 2.6, windSpeed: 30 }, { ...ctx, pastSessions: far }).similarSession === null, 'session lointaine non citée');
const near = [{ rating: 5, date: '2026-03-26', meteo: { waveHeight: 1.5, windSpeed: 10, wavePeriod: 11 } }];
ok(scoreSlot(perfect, { ...ctx, pastSessions: near }).similarSession !== null, 'session proche citée');

// 9. Sessions : formats anciens ramenés au format du moteur
ok(normalizeSession({ meteo: { windSpeed: 5, airTemperature: 15, waveHeight: 1 } }).meteo.windSpeed === 18, 'format brut : m/s → km/h');
const text = JSON.stringify({ waveHeight: 0.7, windSpeed: 3, airTemperature: 15 });
const broken = {}; [...text].forEach((c, i) => { broken[i] = c; });
ok(normalizeSession({ meteo: broken }).meteo.waveHeight === 0.7, 'météo éclatée reconstituée');
ok(normalizeSession({ meteo: { windSpeed: 12.5, waveHeight: 1, swellHeight: 1 } }).meteo.windSpeed === 12.5, 'format récent inchangé');

// 3. Heure locale et nuit
const tz = spotTimeZone(43.48, -1.56);
ok(tz === 'Europe/Paris', 'fuseau de Biarritz');
ok(localParts('2026-11-16T16:00:00Z', tz).hour === 17, '16h UTC = 17h à Biarritz en hiver');
ok(localParts('2026-07-16T16:00:00Z', tz).hour === 18, '16h UTC = 18h à Biarritz en été');
const sun = sunTimes('2026-11-16', 43.48, -1.56);
ok(!isDaylightSlot(Date.parse('2026-11-16T19:00:00Z'), sun), '20h locales en novembre = nuit');
ok(isDaylightSlot(Date.parse('2026-11-16T10:00:00Z'), sun), '11h locales = jour');

// Recommandation : aucun créneau de nuit, heures locales
const start = Date.now() + 86400000; const day0 = new Date(start); day0.setUTCHours(0, 0, 0, 0);
const forecast = Array.from({ length: 48 }, (_, i) => ({ ...perfect, time: new Date(day0.getTime() + i * 3600000).toISOString(), timestamp: day0.getTime() / 1000 + i * 3600 }));
const res = getBestWindows({ ...ctx, forecast }, 10);
ok(res.windows.length > 0, 'des créneaux sont proposés');
ok(res.hourlyScores.every(h => { const s = sunTimes(h.date, spot.lat, spot.lng); return isDaylightSlot(Date.parse(h.time), s); }), 'aucune heure de nuit');
ok(res.hourlyScores.every(h => h.hour === localParts(h.time, tz).hour), 'heures affichées = heures locales du spot');

// Score toujours borné, jamais NaN
[{}, { waveHeight: 0, windSpeed: 80 }, { waveHeight: 1.5 }, { windSpeed: null, waveHeight: null }].forEach(sl => {
  const sc = score(sl); ok(typeof sc === 'number' && !Number.isNaN(sc) && sc >= 0 && sc <= 10, `score borné pour ${JSON.stringify(sl)}, obtenu ${sc}`);
});

console.log(`✅ ${n} vérifications du moteur passent`);

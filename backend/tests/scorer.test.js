// Tests unitaires du scorer — node tests/scorer.test.js
require('dotenv').config();
const assert = require('assert');
const { scoreSlot } = require('../src/services/scorer');

// Contexte de test minimal
const baseContext = {
  profile: { surf_level: 'intermediate', min_wave_height: 0.8, max_wave_height: 2.0 },
  spot: {
    ideal_wind: ['E', 'NE'],
    ideal_swell: ['W', 'NW'],
    ideal_tide: ['low', 'mid'],
  },
  pastSessions: [], // pas de sessions pour commencer
  boards: [{ id: 'b1', name: "Fish 5'9", board_type: 'fish' }],
};

// Test 1 : conditions parfaites → score élevé
const perfectSlot = {
  waveHeight: 1.5, wavePeriod: 12, windSpeed: 8, windDirection: 90, // E = offshore
  swellHeight: 1.4, swellDirection: 270, // W = ideal
  tidePhase: 'low',
};
const result1 = scoreSlot(perfectSlot, baseContext);
assert(result1.score >= 7, `Score conditions parfaites devrait être >= 7, got ${result1.score}`);
assert(result1.score <= 10, `Score ne doit pas dépasser 10, got ${result1.score}`);
console.log('✅ Test 1 (conditions parfaites):', result1.score);

// Test 2 : vent fort onshore → score bas
const badWindSlot = { ...perfectSlot, windSpeed: 50, windDirection: 270 }; // W = onshore pour côte Atlantique
const result2 = scoreSlot(badWindSlot, baseContext);
assert(result2.score < result1.score, `Vent fort onshore devrait donner score < conditions parfaites`);
console.log('✅ Test 2 (vent fort onshore):', result2.score);

// Test 3 : vagues hors fourchette → score réduit
const tooBigSlot = { ...perfectSlot, waveHeight: 4.0 };
const result3 = scoreSlot(tooBigSlot, baseContext);
assert(result3.score < result1.score, `Vagues trop grosses devrait donner score < conditions parfaites`);
console.log('✅ Test 3 (vagues hors fourchette):', result3.score);

// Test 4 : avec sessions passées → board suggestion
const contextWithSessions = {
  ...baseContext,
  pastSessions: [
    { rating: 5, meteo: { waveHeight: 1.4, windSpeed: 9, wavePeriod: 11 }, board_id: 'b1' },
    { rating: 5, meteo: { waveHeight: 1.6, windSpeed: 7, wavePeriod: 13 }, board_id: 'b1' },
    { rating: 4, meteo: { waveHeight: 1.5, windSpeed: 10, wavePeriod: 12 }, board_id: 'b1' },
  ],
};
const result4 = scoreSlot(perfectSlot, contextWithSessions);
assert(result4.boardSuggestion !== null, 'Devrait avoir une suggestion de board');
console.log("✅ Test 4 (board suggestion):", result4.boardSuggestion?.board?.name);

// Test 5 : score entre 0 et 10 dans tous les cas
const extremeSlot = { waveHeight: 0, wavePeriod: 2, windSpeed: 80, windDirection: 180, swellHeight: 0, tidePhase: 'unknown' };
const result5 = scoreSlot(extremeSlot, baseContext);
assert(result5.score >= 0 && result5.score <= 10, `Score doit être entre 0 et 10, got ${result5.score}`);
console.log('✅ Test 5 (conditions extrêmes):', result5.score);

console.log('\n🎉 Tous les tests scorer passent !');

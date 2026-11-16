-- Migration: ajouter colonnes disponibilites surf au profil
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS available_days TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS available_slots TEXT[] DEFAULT '{}';

COMMENT ON COLUMN profiles.available_days IS 'Jours de surf: lundi, mardi, mercredi, jeudi, vendredi, samedi, dimanche';
COMMENT ON COLUMN profiles.available_slots IS 'Creneaux: avant_8h, matin, midi, apres_midi, apres_18h';

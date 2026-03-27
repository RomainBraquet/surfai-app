-- Phase 3 : Infrastructure communautaire
-- Ces tables se remplissent automatiquement et s'activent quand les seuils sont atteints

-- 1. Snapshots anonymisés (pas de user_id, pas de date exacte)
CREATE TABLE IF NOT EXISTS spot_session_snapshots (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  spot_id         uuid REFERENCES spots(id) ON DELETE CASCADE,
  wave_height     numeric(4,2),
  wind_speed      numeric(5,2),
  wind_direction  numeric(5,1),
  wave_period     numeric(4,1),
  swell_height    numeric(4,2),
  tide_phase      text,
  rating_norm     numeric(3,2) NOT NULL,
  month           integer NOT NULL,
  year            integer NOT NULL,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sss_spot_rating ON spot_session_snapshots(spot_id, rating_norm);

-- 2. Profils communautaires par spot
CREATE TABLE IF NOT EXISTS spot_community_profiles (
  spot_id             uuid REFERENCES spots(id) ON DELETE CASCADE PRIMARY KEY,
  session_count       integer DEFAULT 0,
  user_count          integer DEFAULT 0,
  confidence          numeric(3,2) DEFAULT 0,
  wave_sweet_min      numeric(4,2),
  wave_sweet_max      numeric(4,2),
  wave_optimal        numeric(4,2),
  wind_sweet_max      numeric(5,2),
  best_wind_dirs      text[],
  period_min_good     numeric(4,1),
  tide_good           text[],
  tide_bad            text[],
  best_months         integer[],
  avg_community_rating numeric(3,2),
  computed_at         timestamptz DEFAULT now()
);

-- 3. Journées magiques
CREATE TABLE IF NOT EXISTS magic_days (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  spot_id         uuid REFERENCES spots(id) ON DELETE CASCADE,
  date            date NOT NULL,
  session_count   integer NOT NULL,
  user_count      integer NOT NULL,
  avg_rating      numeric(3,2) NOT NULL,
  wave_height_med numeric(4,2),
  wind_speed_med  numeric(5,2),
  wave_period_med numeric(4,1),
  tide_phases     text[],
  magic_score     numeric(5,1) NOT NULL,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (spot_id, date)
);

CREATE INDEX IF NOT EXISTS idx_md_spot_date ON magic_days(spot_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_md_magic_score ON magic_days(magic_score DESC);

-- RLS : snapshots jamais lisibles côté client
ALTER TABLE spot_session_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS snapshots_service_only ON spot_session_snapshots;
CREATE POLICY snapshots_service_only ON spot_session_snapshots FOR ALL USING (false);

-- RLS : profils communautaires lisibles par les connectés
ALTER TABLE spot_community_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS community_profiles_read ON spot_community_profiles;
CREATE POLICY community_profiles_read ON spot_community_profiles FOR SELECT USING (auth.role() = 'authenticated');

-- RLS : magic days lisibles par les connectés
ALTER TABLE magic_days ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS magic_days_read ON magic_days;
CREATE POLICY magic_days_read ON magic_days FOR SELECT USING (auth.role() = 'authenticated');

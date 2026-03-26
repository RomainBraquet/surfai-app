-- Migration: Create tide_cache table
CREATE TABLE IF NOT EXISTS tide_cache (
  spot_id UUID REFERENCES spots(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  data JSONB NOT NULL,
  cached_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (spot_id, date)
);

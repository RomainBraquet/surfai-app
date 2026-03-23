-- Nouvelles colonnes pour l'enrichissement des spots
ALTER TABLE spots ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE spots ADD COLUMN IF NOT EXISTS wave_type text;
ALTER TABLE spots ADD COLUMN IF NOT EXISTS bottom_type text;
ALTER TABLE spots ADD COLUMN IF NOT EXISTS difficulty text[];
ALTER TABLE spots ADD COLUMN IF NOT EXISTS ideal_swell_direction text[];
ALTER TABLE spots ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE spots ADD COLUMN IF NOT EXISTS surfline_id text;

-- Index unique pour dédoublonnage idempotent
CREATE UNIQUE INDEX IF NOT EXISTS idx_spots_surfline_id ON spots(surfline_id) WHERE surfline_id IS NOT NULL;

-- Migration: Add shom_port_code column to spots table
ALTER TABLE spots ADD COLUMN IF NOT EXISTS shom_port_code VARCHAR(10);

UPDATE spots SET shom_port_code = 'BIA' WHERE city = 'Biarritz';
UPDATE spots SET shom_port_code = 'CPB' WHERE city = 'Capbreton' OR name ILIKE '%capbreton%';
UPDATE spots SET shom_port_code = 'BIA' WHERE city = 'Anglet';
UPDATE spots SET shom_port_code = 'BIA' WHERE city = 'Les Cavaliers';
UPDATE spots SET shom_port_code = 'RDB' WHERE city = 'Lacanau' OR name ILIKE '%lacanau%';
UPDATE spots SET shom_port_code = 'CPB' WHERE city = 'Hossegor' OR name ILIKE '%hossegor%';
UPDATE spots SET shom_port_code = 'CPB' WHERE city = 'Seignosse' OR name ILIKE '%seignosse%';

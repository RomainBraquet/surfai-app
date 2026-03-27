-- Ajouter le champ felt_adapted pour savoir si la board était la bonne
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS felt_adapted BOOLEAN;

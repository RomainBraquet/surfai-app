-- Création de la table des spots favoris utilisateur
-- À exécuter dans Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS public.user_favorite_spots (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid NOT NULL,
  spot_id    uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, spot_id)
);

-- RLS : chaque utilisateur ne voit et ne modifie que ses propres favoris
ALTER TABLE public.user_favorite_spots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own favorites"
  ON public.user_favorite_spots FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own favorites"
  ON public.user_favorite_spots FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own favorites"
  ON public.user_favorite_spots FOR DELETE
  USING (user_id = auth.uid());

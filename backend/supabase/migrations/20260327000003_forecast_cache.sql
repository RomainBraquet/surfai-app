-- Cache des prévisions Stormglass dans Supabase (persiste entre redémarrages)
CREATE TABLE IF NOT EXISTS forecast_cache (
  cache_key       text PRIMARY KEY,              -- "lat_lng_days" ex: "43.4800_-1.5600_5"
  data            jsonb NOT NULL,                 -- forecast complet
  cached_at       timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL             -- cached_at + 6h
);

CREATE INDEX IF NOT EXISTS idx_fc_expires ON forecast_cache(expires_at);

-- Nettoyage auto des entrées expirées (optionnel, via pg_cron)
-- SELECT cron.schedule('cleanup-forecast-cache', '0 */6 * * *',
--   $$DELETE FROM forecast_cache WHERE expires_at < now()$$);

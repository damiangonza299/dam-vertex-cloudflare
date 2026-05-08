-- Migration 7: Internal ads attribution tracking
-- Agrega columnas de seguimiento a la tabla leads para atribución interna.
-- No toca Purchase, Meta, CAPI ni lógica de comprado.
-- Ejecutar: wrangler d1 execute dam-vertex-leads --file=migrate7.sql --remote

ALTER TABLE leads ADD COLUMN fbclid        TEXT;
ALTER TABLE leads ADD COLUMN utm_source    TEXT;
ALTER TABLE leads ADD COLUMN utm_medium    TEXT;
ALTER TABLE leads ADD COLUMN utm_campaign  TEXT;
ALTER TABLE leads ADD COLUMN utm_content   TEXT;
ALTER TABLE leads ADD COLUMN utm_term      TEXT;
ALTER TABLE leads ADD COLUMN campaign_id   TEXT;
ALTER TABLE leads ADD COLUMN adset_id      TEXT;
ALTER TABLE leads ADD COLUMN ad_id         TEXT;
ALTER TABLE leads ADD COLUMN campaign_name TEXT;
ALTER TABLE leads ADD COLUMN adset_name    TEXT;
ALTER TABLE leads ADD COLUMN ad_name       TEXT;
ALTER TABLE leads ADD COLUMN landing_path  TEXT;
ALTER TABLE leads ADD COLUMN referrer      TEXT;

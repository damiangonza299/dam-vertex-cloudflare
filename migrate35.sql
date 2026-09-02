-- migrate35.sql — columna platform en products (DCANP GROUP)
-- Distingue productos DAM_VERTEX (flujo normal, admin panel, /api/leads)
-- de productos DCANP_GROUP (Google Sheets + Telegram + Meta CAPI vía
-- /api/dcanp-lead, sin admin panel). Ver CLAUDE.md "DCANP GROUP — Flujo
-- especial". Default DAM_VERTEX preserva el comportamiento de todo
-- producto existente.

ALTER TABLE products ADD COLUMN platform TEXT DEFAULT 'DAM_VERTEX';

-- DAM Vertex — Migration 29: Backfill product_briefs for depilador-electrico-guard-wing
-- Same root cause and fix as migrate28.sql (lampara-escritorio-plegable): this
-- product (id=150 in `products`) was created via direct SQL INSERT, bypassing
-- Product Studio's handleCreate action, so it never got a row in `product_briefs`.
-- Product Studio's list view (functions/api/product-registry.js onRequestGet)
-- queries FROM product_briefs (LEFT JOIN products) — no brief row means invisible
-- there even though the product exists and is active in `products`.
--
-- status='draft' + landing_status='active' mirrors the same precedent: the brief
-- itself never went through the structured Product Studio flow (no strategic/
-- visual research, no DAM Finanzas sync — dam_finanzas_status stays 'pending'),
-- but the landing is live in production.
--
-- INSERT OR IGNORE makes this safe to re-run: skips if product_slug already exists.
--
-- Ejecutar remoto: wrangler d1 execute dam-vertex-leads --remote --file=migrate29.sql
-- Verificar:       wrangler d1 execute dam-vertex-leads --remote --command "SELECT product_slug, status, landing_status, dam_finanzas_status FROM product_briefs WHERE product_slug='depilador-electrico-guard-wing';"

INSERT OR IGNORE INTO product_briefs (
  product_slug,
  op_json,
  strategic_json,
  visual_json,
  research_json,
  insights_json,
  status,
  landing_status,
  created_at,
  updated_at
) VALUES (
  'depilador-electrico-guard-wing',
  '{"name":"Depilador Eléctrico Guard Wing","type":"simple","category":"Belleza / Cuidado facial","price":149000,"compare_price":190000,"stock":10,"min_stock":5}',
  '{"desire_type":[]}',
  '{}',
  '[]',
  '{"insync":null,"landing_intelligence":null}',
  'draft',
  'active',
  datetime('now'),
  datetime('now')
);

-- DAM Vertex — Migration 28: Backfill product_briefs for lampara-escritorio-plegable
-- This product (id=125 in `products`) was created via direct SQL INSERT during a
-- fast manual landing build, bypassing Product Studio's handleCreate action. As a
-- result it never got a row in `product_briefs`, and Product Studio's list view
-- (functions/api/product-registry.js onRequestGet) queries FROM product_briefs
-- (LEFT JOIN products), so a product with no brief row is invisible there even
-- though it exists and is active in `products`.
--
-- Same situation and same fix as migrate25.sql (cadena/cepillo/lentes/reloj).
-- status='draft' + landing_status='active' mirrors that precedent exactly: the
-- brief itself never went through the structured Product Studio flow (no
-- strategic/visual research done, no DAM Finanzas sync — dam_finanzas_status
-- stays at its default 'pending'), but the landing is live in production.
--
-- IMPORTANT: There is no create_brief API endpoint — this is the correct and only
-- mechanism for retroactive brief creation. See product-registry.js NOTE.
--
-- INSERT OR IGNORE makes this safe to re-run: skips if product_slug already exists.
--
-- Ejecutar remoto: wrangler d1 execute dam-vertex-leads --remote --file=migrate28.sql
-- Verificar:       wrangler d1 execute dam-vertex-leads --remote --command "SELECT product_slug, status, landing_status, dam_finanzas_status FROM product_briefs WHERE product_slug='lampara-escritorio-plegable';"

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
  'lampara-escritorio-plegable',
  '{"name":"Lámpara de Escritorio Plegable Recargable","type":"simple","category":"Hogar / Oficina","price":139000,"compare_price":179000,"stock":20,"min_stock":5}',
  '{"desire_type":[]}',
  '{}',
  '[]',
  '{"insync":null,"landing_intelligence":null}',
  'draft',
  'active',
  datetime('now'),
  datetime('now')
);

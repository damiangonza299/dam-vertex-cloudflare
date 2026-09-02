-- migrate37.sql — Backfill product_briefs para estante-aluminio-bano
-- Mismo root cause que migrate28/29: el producto (id=168 en `products`) se
-- creó vía INSERT SQL directo, sin pasar por Product Studio's handleCreate,
-- así que nunca tuvo fila en `product_briefs`. Product Studio lista productos
-- vía `FROM product_briefs pb LEFT JOIN products p` (functions/api/
-- product-registry.js onRequestGet) — sin fila en product_briefs, el
-- producto es invisible ahí aunque exista y esté en `products`.
--
-- status='draft' + landing_status='active': el brief nunca pasó por el flujo
-- estructurado de Product Studio (sin research/estrategia/visual, sin sync a
-- Dam Finanzas — dam_finanzas_status queda 'pending'), pero la landing ya
-- está desplegada en public/estante-aluminio-bano/.
--
-- INSERT OR IGNORE hace este archivo seguro de re-ejecutar.
--
-- Ejecutar remoto: wrangler d1 execute dam-vertex-leads --remote --file=migrate37.sql
-- Verificar:       wrangler d1 execute dam-vertex-leads --remote --command "SELECT product_slug, status, landing_status FROM product_briefs WHERE product_slug='estante-aluminio-bano';"

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
  'estante-aluminio-bano',
  '{"name":"Estante Organizador de Aluminio","type":"simple","category":"Hogar / Baño","price":149000,"compare_price":199000,"stock":20,"min_stock":3}',
  '{"desire_type":[]}',
  '{}',
  '[]',
  '{"insync":null,"landing_intelligence":null}',
  'draft',
  'active',
  datetime('now'),
  datetime('now')
);

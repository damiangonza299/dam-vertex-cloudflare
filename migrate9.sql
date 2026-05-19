-- Migration 9: Add product_slug to leads + ensure reloj variants match modal options
-- Ejecutar: wrangler d1 execute dam-vertex-leads --remote --file=migrate9.sql
-- NOTA: ALTER TABLE falla si la columna ya existe — eso es esperado en segunda ejecución.

-- Columna para guardar el slug del producto al crear el lead.
-- Permite que confirm-purchase use slug en lugar de name para el lookup de stock,
-- y que content_ids en Purchase sea consistente con el resto del funnel.
ALTER TABLE leads ADD COLUMN product_slug TEXT;

-- Asegurar que el producto reloj existe con las variantes correctas.
-- Los keys del JSON deben coincidir EXACTAMENTE con las opciones del modal en reloj/index.html.
-- ON CONFLICT: si el producto ya existe, solo actualiza variants_json si estaba NULL o vacío
-- (preserva stock real ya decrementado por ventas). Nunca sobreescribe datos de stock reales.
INSERT INTO products (slug, name, stock_total, variants_json, active, updated_at)
VALUES (
  'reloj',
  'Reloj Blackout Minimal',
  100,
  '{"Negro Total":60,"Negro Rosa":10,"Negro Dorado":10,"Dorado Negro":10,"Rosa Negro":5,"Plateado Negro":5}',
  1,
  datetime('now')
)
ON CONFLICT(slug) DO UPDATE SET
  name        = 'Reloj Blackout Minimal',
  variants_json = CASE
    WHEN products.variants_json IS NULL
      OR TRIM(products.variants_json) = ''
      OR products.variants_json = '{}'
    THEN '{"Negro Total":60,"Negro Rosa":10,"Negro Dorado":10,"Dorado Negro":10,"Rosa Negro":5,"Plateado Negro":5}'
    ELSE products.variants_json
  END,
  updated_at  = datetime('now');

-- VERIFICACIÓN MANUAL RECOMENDADA después de ejecutar:
-- wrangler d1 execute dam-vertex-leads --remote --command "SELECT slug, name, variants_json FROM products WHERE slug='reloj';"
-- Confirmar que las keys del JSON son: Negro Total, Negro Rosa, Negro Dorado, Dorado Negro, Rosa Negro, Plateado Negro

-- Migration 10: Renombrar keys de variantes del reloj en D1
-- Ejecutar ANTES de deployar los cambios de reloj/index.html
-- Los nuevos nombres en el frontend son: Negro Cobre (ex Dorado Negro), Plateado Sutil (ex Rosa Negro)
--
-- Ejecutar:
--   wrangler d1 execute dam-vertex-leads --remote --file=migrate10.sql
--
-- PASO 0: Verificar estado ACTUAL antes de ejecutar
--   wrangler d1 execute dam-vertex-leads --remote --command "SELECT variants_json FROM products WHERE slug='reloj';"

-- PASO 1: Renombrar keys manteniendo los valores de stock reales
-- Preserva los valores actuales de Dorado Negro y Rosa Negro (lo que esté en D1)
-- y los reasigna a las nuevas keys Negro Cobre y Plateado Sutil.
UPDATE products
SET variants_json = json_set(
  json_set(
    json_remove(
      json_remove(variants_json, '$."Dorado Negro"'),
      '$."Rosa Negro"'
    ),
    '$."Negro Cobre"',
    COALESCE(json_extract(variants_json, '$."Dorado Negro"'), 10)
  ),
  '$."Plateado Sutil"',
  COALESCE(json_extract(variants_json, '$."Rosa Negro"'), 5)
)
WHERE slug = 'reloj'
  AND variants_json IS NOT NULL;

-- PASO 2: Verificar el resultado
--   wrangler d1 execute dam-vertex-leads --remote --command "SELECT variants_json FROM products WHERE slug='reloj';"
--
-- El JSON resultante debe tener EXACTAMENTE estas keys en cualquier orden:
--   Negro Total, Negro Dorado, Negro Rosa, Negro Cobre, Plateado Sutil, Plateado Negro
--
-- IMPORTANTE: Las keys del JSON deben coincidir EXACTAMENTE con PRODUCT.options en reloj/index.html.
-- Si no coinciden, confirm-purchase rechazará pedidos con "Sin stock del color: X" (line 70).

-- Migration 10: Normalizar variants_json del reloj en D1
-- Renombra keys viejas, elimina keys obsoletas y fija los valores exactos de stock.
--
-- Ejecutar ANTES de deployar:
--   wrangler d1 execute dam-vertex-leads --remote --file=migrate10.sql
--
-- PASO 0: Verificar estado ACTUAL antes de ejecutar
--   wrangler d1 execute dam-vertex-leads --remote --command "SELECT variants_json FROM products WHERE slug='reloj';"

-- PASO 1: Limpiar keys obsoletas y fijar el JSON completo con valores exactos.
-- Elimina: "Dorado Negro", "Rosa Negro", "Plateado Sutil" (si existieran).
-- Escribe: las 6 keys correctas con sus valores reales de stock.
UPDATE products
SET variants_json = json_set(
  json_remove(
    json_remove(
      json_remove(variants_json, '$."Dorado Negro"'),
      '$."Rosa Negro"'
    ),
    '$."Plateado Sutil"'
  ),
  '$."Negro Total"',        67,
  '$."Negro Dorado"',       10,
  '$."Negro Rosa"',          5,
  '$."Plateado Negro"',      5,
  '$."Negro Cobre"',        10,
  '$."Negro Dorado Sutil"',  5
)
WHERE slug = 'reloj'
  AND variants_json IS NOT NULL;

-- PASO 2: Verificar el resultado
--   wrangler d1 execute dam-vertex-leads --remote --command "SELECT variants_json FROM products WHERE slug='reloj';"
--
-- El JSON resultante debe ser exactamente:
-- {"Negro Total":67,"Negro Dorado":10,"Negro Rosa":5,"Plateado Negro":5,"Negro Cobre":10,"Negro Dorado Sutil":5}
-- (el orden de keys no importa para SQLite, solo importan los valores)
--
-- IMPORTANTE: Las keys deben coincidir EXACTAMENTE con PRODUCT.options en reloj/index.html.
-- Si no coinciden, confirm-purchase rechazará pedidos con "Sin stock del color: X".

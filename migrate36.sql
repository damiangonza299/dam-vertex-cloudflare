-- migrate36.sql — renombrar depilador-electrico-guard-wing → tabla-marmol en D1
-- El HTML de la landing ya vive en public/tabla-marmol/ (renombrado en un commit
-- anterior), pero products.slug y product_briefs.product_slug seguían en el slug
-- viejo — Product Studio y el resto del sistema mostraban "Depilador Eléctrico
-- Guard Wing" en vez de "Tabla de Picar de Mármol Ovalada".
--
-- product_briefs.product_slug tiene un FK hacia products.slug — no se puede
-- actualizar products.slug directo (violaría el FK mientras product_briefs
-- sigue apuntando al valor viejo). PRAGMA defer_foreign_keys difiere la
-- validación del FK hasta el commit de la transacción, permitiendo actualizar
-- ambas tablas en el mismo lote sin romper la constraint.
--
-- Ejecutar remoto: wrangler d1 execute dam-vertex-leads --remote --file=migrate36.sql
-- Verificar:       wrangler d1 execute dam-vertex-leads --remote --command "SELECT slug, name, platform FROM products WHERE slug='tabla-marmol';"

PRAGMA defer_foreign_keys = TRUE;

UPDATE products SET
  name     = 'Tabla de Picar de Mármol Ovalada',
  slug     = 'tabla-marmol',
  platform = 'DCANP_GROUP'
WHERE slug = 'depilador-electrico-guard-wing';

UPDATE product_briefs SET
  product_slug = 'tabla-marmol'
WHERE product_slug = 'depilador-electrico-guard-wing';

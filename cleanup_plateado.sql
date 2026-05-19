UPDATE products
SET variants_json = json_remove(variants_json, '$."Plateado Sutil"')
WHERE slug = 'reloj';

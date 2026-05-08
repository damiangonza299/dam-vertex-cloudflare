-- migrate6.sql
-- Rename reloj variant keys to Spanish names. Stock preserved, no duplicates.
UPDATE products
SET
  variants_json = '{"Negro Total":60,"Negro Rosa":10,"Negro Dorado":10,"Dorado Negro":10,"Rosa Negro":5,"Plateado Negro":5}',
  updated_at = datetime('now')
WHERE slug = 'reloj';

-- Dam Vertex — Migración 3
-- Agrega columna variant a leads (puede fallar si ya existe — OK).
-- Ejecutar: wrangler d1 execute dam-vertex-leads --remote --command "ALTER TABLE leads ADD COLUMN variant TEXT;"
ALTER TABLE leads ADD COLUMN variant TEXT;

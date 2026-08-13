-- DAM Vertex — Migration 28: anon_id_hashed column on leads
-- Guarda el hash SHA-256 del _dv_anon_id (ID anónimo de visita, generado en tracking.js)
-- para poder unir la sesión anónima (ViewContent/AddToCart/InitiateCheckout) con
-- QualifiedLead y Purchase del mismo usuario en Meta CAPI.
-- Ejecutar: wrangler d1 execute dam-vertex-leads --remote --file=migrate28.sql
ALTER TABLE leads ADD COLUMN anon_id_hashed TEXT;

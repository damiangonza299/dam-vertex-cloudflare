-- Migration 11: Ventas manuales WhatsApp
-- Agrega columnas necesarias para registrar ventas manuales desde el admin.
-- Todas las columnas son nullable — leads normales existentes no se ven afectados.
--
-- Ejecutar:
--   wrangler d1 execute dam-vertex-leads --remote --file=migrate11.sql
--
-- NOTA: ALTER TABLE falla si la columna ya existe — eso es esperado en segunda ejecución.

-- Fuente de la venta: 'manual_whatsapp' | 'meta_ads_manual' | 'referido' | 'otro'
-- NULL para leads normales del flujo estándar.
ALTER TABLE leads ADD COLUMN source_type TEXT;

-- Tipo de atribución: 'manual' para ventas manuales. NULL para leads normales.
ALTER TABLE leads ADD COLUMN attribution_type TEXT;

-- Nota libre del admin (observación interna).
ALTER TABLE leads ADD COLUMN observation TEXT;

-- Estado del evento Purchase en Meta CAPI: 'pending' | 'sent' | 'error'
-- NULL para leads normales (el confirm-purchase no usa esta columna).
ALTER TABLE leads ADD COLUMN capi_status TEXT;

-- event_id que se envió a Meta CAPI para esta venta manual.
ALTER TABLE leads ADD COLUMN capi_event_id TEXT;

-- Mensaje de error si capi_status = 'error'.
ALTER TABLE leads ADD COLUMN capi_error TEXT;

-- Verificar resultado:
--   wrangler d1 execute dam-vertex-leads --remote --command "PRAGMA table_info(leads);"

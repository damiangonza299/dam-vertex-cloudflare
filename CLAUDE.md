# DAM VERTEX — Instrucciones Claude Code

## META ADS — STRICT MODE

### CHECKLIST PRE-CAMPAÑA — Obligatorio antes de crear o modificar campañas

Antes de cualquier creación o modificación de campaña, ejecutar en orden:

1. Analizar campañas históricas (performance, ROAS, estructura).
2. Analizar ROAS real (D1 `purchased_manual` / gasto Meta — NO Meta Purchase).
3. Analizar Purchase real (ventas confirmadas en admin panel, no pixel).
4. Analizar QualifiedLead real (leads que entraron al Admin Panel).
5. Proponer cambios concretos con justificación en datos reales.
6. Esperar aprobación explícita del usuario antes de ejecutar.

**Nunca ejecutar cambios basados únicamente en métricas de Meta sin contrastar con datos reales de DAM Vertex.**

### Reglas de escritura Meta API

- Lectura: siempre permitida.
- Escritura (crear, modificar, pausar, activar): solo con autorización explícita.
- Si Meta devuelve error (rate limit, throttling, permisos): detenerse, mostrar diagnóstico, esperar instrucciones. No reintentar.

### Reglas de análisis — Strict Mode

1. Leer datos reales antes de recomendar. No actuar sobre hipótesis o memoria de sesiones anteriores.
2. ROAS real = `purchased_manual` en D1 / gasto Meta. No usar Meta Purchase como fuente de verdad.
3. QualifiedLead = cuando el pedido entra al Admin Panel. No antes.
4. Purchase es manual — se marca en admin panel después de la entrega.
5. No mezclar InitiateCheckout con QualifiedLead — son etapas distintas del funnel.
6. No tocar Pixel, CAPI, Purchase, InitiateCheckout sin pedido explícito confirmado.

### Prioridad de fuentes de verdad

1. D1 (admin panel) + `purchased_manual`
2. Meta API (datos de gasto, impresiones, CTR)
3. Nunca: conjetura, estimación o datos de sesiones anteriores

---

## FUENTE DE VERDAD DEL SISTEMA

### DAM Vertex — Responsable de

Leads · Pedidos · Admin Panel · Delivery Panel · Inventario comercial · WhatsApp · Telegram · Meta Ads · Pixel · CAPI · Purchase manual · QualifiedLead · Gestión operativa

### Dam Finanzas — Responsable de

Reportes financieros · Ganancia real · Publicidad del día · CPA promedio · Distribución de publicidad · Distribución de envíos · Inventario financiero · Costos · Utilidad por card · Resúmenes diarios · Resúmenes mensuales

### Regla de separación de responsabilidades

DAM Vertex **nunca** debe recalcular: Ganancia · Utilidad · CPA · Publicidad distribuida · Envíos distribuidos.

DAM Vertex solo envía datos. Dam Finanzas realiza los cálculos.

### Checklist producto nuevo — 11 puntos obligatorios

No se considera terminado hasta verificar:

1. Existe en Admin Panel.
2. Existe en venta manual WhatsApp.
3. Existe en inventario DAM Vertex.
4. Existe en inventario Dam Finanzas.
5. Existe en el mapeo producto/variante.
6. Existe en webhook hacia Dam Finanzas.
7. Existe en reportes financieros.
8. Existe en descuentos de stock.
9. Existe en combos.
10. Existe en landing y modal.
11. Landing completamente instrumentada para InSync (todas las secciones visibles tienen `id` único).

### Regla de cambios en lógica financiera

Antes de modificar lógica financiera:

1. Buscar cómo funciona actualmente.
2. Verificar si ya existe cálculo en Dam Finanzas.
3. Reutilizar la lógica existente.
4. No reescribir cálculos que ya funcionaban.
5. No duplicar lógica financiera entre sistemas.

Si un dato ya existe en Dam Finanzas: NO recalcularlo en DAM Vertex. Enviar únicamente la información necesaria.

---

### Regla de Fecha Operativa

Nunca `new Date().toISOString()`. Siempre:
```javascript
new Intl.DateTimeFormat("en-CA", { timeZone: "America/Asuncion" }).format(new Date())
```

## REGLA CRÍTICA DE DEPLOY — DAM VERTEX

> **Incidente 2026-06:** `wrangler pages deploy .` (raíz) subió estáticos bajo `/public/reloj/`, `/public/cadena/` etc. Landings en 404 en producción. `node_modules` incluido en el upload.

### Único comando correcto — producción

```powershell
& "C:\Program Files\nodejs\npx.cmd" wrangler pages deploy public --project-name=dam-vertex-cloudflare --branch=dam-vertex-cloudflare --commit-dirty=true
```

### PROHIBIDO usar

- `wrangler pages deploy .` — deploya desde raíz, rompe todas las rutas
- `wrangler pages deploy` — sin directorio explícito usa raíz
- `npx wrangler pages deploy .` — ídem
- Deploy sin `--branch=dam-vertex-cloudflare` → va a preview, no producción
- Deploy sin verificar `pages_build_output_dir = "public"` en wrangler.toml

### Checklist pre-deploy

1. Leer `wrangler.toml` — confirmar `pages_build_output_dir = "public"`
2. Confirmar directorio a deployar: `public/` (no `.` ni raíz)
3. Confirmar `--branch=dam-vertex-cloudflare`
4. Confirmar que `.dev.vars`, `node_modules/`, archivos internos no se suben
5. Confirmar que el Functions bundle se genera correctamente

### Rutas críticas — verificar 200 post-deploy

`/` · `/reloj/` · `/cadena/` · `/admin/` · `/intelligence/`
`/api/admin-leads` · `/api/intelligence/alerts` · `/api/intelligence/ping-telegram`

**Si alguna falla → NO declarar deploy exitoso. Detenerse y corregir.**

### Script de deploy seguro

```powershell
.\scripts\deploy-production.ps1
```

Verifica wrangler.toml, ejecuta deploy correcto, prueba rutas automáticamente.

### Account ID Meta

`act_992345752726304` — cuenta en PYG. No multiplicar spend por tasa USD.

---

Para contexto completo del proyecto, skills y routing: leer `gemini.md`.

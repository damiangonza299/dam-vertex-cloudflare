# DAM VERTEX — Instrucciones Claude Code

## CONTEXT LOADING POLICY — Optimización de Tokens

### Regla permanente

Cuando se indique "Lee AI_SYSTEM/INDEX.md" o al iniciar una sesión:
**No cargar automáticamente todo el ecosistema.**
Primero clasificar la tarea. Luego cargar solo lo necesario.

`AI_SYSTEM/INDEX.md` actúa como **router**. Leerlo no implica cargar todo.

### Niveles de tarea

#### Nivel 1 — Tarea pequeña

Señales: mover botones · cambiar colores · spacing · CSS · textos · badges · ajustes visuales · pequeños fixes HTML

Acción:
- Leer `AI_SYSTEM/INDEX.md`
- Identificar si existe skill relacionado
- Cargar solamente lo estrictamente necesario
- No cargar Product Studio, InSync, Dam Finanzas, Meta Ads, Event Flow si no aplican

#### Nivel 2 — Tarea mediana

Señales: nueva funcionalidad aislada · Admin Panel · Product Studio · Dam Finanzas · Activation Check · Dam Intelligence · landing completa · tracking específico

Acción:
- Leer `AI_SYSTEM/INDEX.md`
- Cargar únicamente los skills relacionados con la tarea
- No cargar skills de áreas no involucradas

#### Nivel 3 — Tarea grande

Señales: producto nuevo · auditoría completa · migraciones · InSync Recommendation Engine · Meta CAPI · Event Flow · arquitectura · sistemas cross-module

Acción:
- Leer `AI_SYSTEM/INDEX.md`
- Cargar todos los skills relevantes al alcance de la tarea
- Expandir contexto progresivamente, no de golpe

### Prioridad de principios

1. Precisión
2. Arquitectura correcta
3. Minimización de contexto
4. Minimización de tokens

Nunca sacrificar precisión por ahorrar tokens.
Nunca cargar el ecosistema completo si la tarea puede resolverse con un subconjunto.

---

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

### Product Studio — flujo de activación (módulo interno)

Ruta: `/product-studio/` (botón "+ Nuevo producto" en Admin Panel → Productos)

**El brief estructurado es la fuente de verdad.** No editar archivos de forma manual mientras el producto esté en Product Studio.

Flujo obligatorio:
1. Crear en Product Studio → `status='draft'`, `active=0` en D1
2. Completar tabs: Producto → Inventario → Estrategia → Visual
3. Tab Investigación (opcional): analizar URLs de proveedores
4. Tab Sync → "Sincronizar con DAM Finanzas" → llama a `importProductFromVertex`
5. Tab Sync → **"Validar Activación Total"** → corre `/api/product-activation-check` (PASS/WARNING/FAIL por check)
6. Tab Sync → "Activar producto" → `active=1`, `status='active'`
7. Landing: generar blueprint desde el brief (Tab Landing) + crear `public/{slug}/index.html` + deploy manual
8. InSync: instrumentar todas las secciones con triple atributo antes del primer deploy:
   - `id="section-{nombre}"` + `data-insync-section="{nombre}"` en cada `<section>`
   - `data-insync-cta="{nombre}"` en cada CTA, donde `{nombre}` = sección que lo contiene
   - Referencia canónica: `public/reloj-imperial-verde/index.html`
9. Correr PRODUCT_COMPLETION_CHECKLIST antes de declarar el producto terminado

Una vez activado: aparece automáticamente en:
- Venta manual WhatsApp (MANUAL_PRODUCTS dinámico desde `/api/product-stock?active_only=1`)
- Home `/` y `/productos/` (cargados dinámicamente desde la misma API)
- Filtros Admin: leads, dashboard, ads, meta (poblados en login desde la API)
- Intelligence: selector InSync (poblado desde la API tras auth)
- Ranking de productos del dashboard (slug como clave, sin ambigüedad por includes())

**Regla permanente — Activación Total:**
> Ningún producto nuevo se considera terminado por tener landing y active=1.
> Todo módulo que liste, filtre, mida, reporte o venda productos debe leer Product Registry o una fuente dinámica equivalente.
> Los hardcodes de productos son deuda técnica y deben eliminarse o marcarse como FAIL en la validación.

### Checklist producto nuevo — 11 puntos obligatorios

No se considera terminado hasta verificar:

1. Existe en Admin Panel. ← Product Studio lo crea
2. Existe en venta manual WhatsApp. ← **automático** al activar (MANUAL_PRODUCTS dinámico desde API)
3. Existe en inventario DAM Vertex. ← Product Studio lo crea
4. Existe en inventario Dam Finanzas. ← Tab Sync → "Sincronizar con DAM Finanzas"
5. Existe en el mapeo producto/variante. ← variants_json en D1 via Product Studio
6. Existe en webhook hacia Dam Finanzas. ← `importProductFromVertex` vía `onAdminSale`
7. Existe en reportes financieros. ← automático si DAM Finanzas vinculado
8. Existe en descuentos de stock. ← automático (confirm-purchase.js usa slug)
9. Existe en combos. ← combos nuevos van como `product_type='combo'` en Product Studio
10. Existe en landing y modal. ← Tab Landing → generar blueprint → deploy manual
11. Landing completamente instrumentada para InSync — triple atributo: `id="section-{nombre}"` + `data-insync-section="{nombre}"` + `data-insync-cta="{nombre}"` en CTAs.
12. Pasó Validación de Activación Total sin FAIL crítico. ← `/api/product-activation-check`
13. Aparece en Home y /productos/ sin deploy manual. ← **automático** (carga dinámica desde API)
14. Aparece en filtros Admin sin código manual. ← **automático** (carga dinámica tras login)
15. Aparece en Intelligence/InSync sin código manual. ← **automático** (carga dinámica tras auth)

### Regla permanente — PRODUCT COMPLETION CHECKLIST

**Ningún producto nuevo está terminado hasta pasar el PRODUCT_COMPLETION_CHECKLIST completo.**

Ver: `AI_SYSTEM/execution/PRODUCT_COMPLETION_CHECKLIST.md`

El checklist cubre 22 áreas: slug, PRODUCT object, InSync instrumentation, modal, WhatsApp, lead/Telegram, tracking, InitiateCheckout, QualifiedLead, Purchase manual, CAPI, Product Registry, Admin, Dam Finanzas, Stock, Home, /productos, Intelligence, activation check, auditoría final.

No declarar "producto terminado", "listo para activar" ni "listo para deploy" sin haber verificado cada punto de ese checklist.

---

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

## UMBRALES OFICIALES DAM VERTEX

DAM VERTEX Paraguay — clasificación de compradores y eventos Meta CAPI. **Prohibido modificar sin decisión de negocio explícita documentada aquí.**

| Clasificación | Umbral | Evento CAPI | buyer_type D1 |
|---|---|---|---|
| Alto valor | >= 199.000 Gs | `HighValuePurchase` | `alto_valor` |
| VIP | >= 300.000 Gs | `HighValuePurchase` + `VIPPurchase` | `vip` |
| Ultra VIP | >= 500.000 Gs | `HighValuePurchase` + `VIPPurchase` (sin CAPI dedicado) | `ultra_vip` |
| Fast Buyer | compra en < 24h | `FastBuyer` (solo server-side CAPI, nunca Pixel) | `rapido` |

**Mapping explícito CAPI ↔ DAM Intelligence:**
- `HighValuePurchase` Meta = Alto Valor DAM VERTEX (>= Gs. 199.000)
- `VIPPurchase` Meta = VIP DAM VERTEX (>= Gs. 300.000)
- `FastBuyer` Meta = Fast Buyer DAM VERTEX (confirmación < 24h)
- `Purchase` Meta = toda compra confirmada, sin umbral de valor

**Justificación:** Precio base reloj Gs. 189.000. Con envío express: Gs. 199.000 → intención de compra superior → clasificación Alto Valor.

**Archivos que implementan estos umbrales:**
- `functions/api/intelligence/_bqe-scorer.js` — constantes `ALTO_VALOR_PYG`, `VIP_PYG`, `ULTRA_VIP_PYG`, `FAST_BUYER_H`
- `functions/api/confirm-purchase.js` — condiciones de `HighValuePurchase` y `VIPPurchase`

---

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

---

## LANDINGS — REGLA CRÍTICA DE CREACIÓN

### Flujo obligatorio antes de escribir HTML

No se crea una landing solo desde el brief del producto. El flujo correcto:

```
1. Leer brief completo (nombre, precio, specs, variantes, restricciones)
2. Verificar estado del producto en D1: active, stock_total, variants
3. Revisar InSync de landings existentes relevantes (/reloj/, /cadena/, /lentes/, /cepillo/)
4. Extraer patrones ganadores: orden de secciones, bloques que retienen, ubicación de precio/confianza
5. Proponer ángulo principal, secciones y referencias antes de codear
6. Recién después crear o modificar HTML
```

**No saltar directo a escribir código.**

### Patrones = estructura y psicología. No = plantilla visual literal

**Extraer de InSync histórico:**
- Orden de secciones que retuvo mejor
- Bloques con mayor attention_score y menor abandono
- Posición de precio, pago al recibir, entrega en el día, prueba social

**No copiar entre landings:**
- Colores, paleta, fondo
- Imágenes, variantes, testimonios
- Copy literal o diseño exacto

### Jerarquía brief vs InSync

- **Brief manda sobre:** nombre, precio, specs, variantes, material, oferta
- **InSync manda sobre:** orden de secciones, peso de bloques, ubicación de precio/confianza

### Modal — reglas de coherencia visual (obligatorio por landing)

Toda landing nueva debe cumplir estos 4 puntos en su modal de pedido. **No declarar landing terminada si el modal no los cumple.**

1. **Paleta visual coherente** — el modal usa la misma paleta principal/secundaria de la landing vía clase `.theme-{producto}`. No usar colores genéricos sin override.
2. **3 combos por defecto** — siempre incluir:
   - 1 unidad (sin badge)
   - 2 unidades con badge `Más elegido`
   - 3 unidades con badge `Mayor ahorro`
3. **Badges de combo** — colores coherentes con el color de acento de la landing.
4. **Espaciado consistente** — todos los bloques secundarios (Envío express, Necesito factura, futuros upsells) deben tener el mismo margen entre sí. Prohibido `margin-top` distinto por bloque.

---

### Prueba social — prohibido inventar

- No usar nombres falsos ni "pedido verificado" sin datos reales
- Usar prueba social genérica: "Pedidos activos · Entrega en el día", "Clientes en Central e Interior"
- Si hay testimonios reales: incluirlos con nombre y resultado específico

### Identidad visual — parte del producto, no de otra landing

1. Color y material del producto → paleta base
2. Percepción deseada → tono visual
3. No usar fondo negro por defecto — justificar si se elige
4. No copiar look de otra landing sin justificación de negocio

### Archivos de referencia

```
AI_SYSTEM/skills/insync-cro.md         ← extracción de patrones históricos
AI_SYSTEM/skills/product-studio.md     ← checklist pre-código + regla de testimonios
AI_SYSTEM/skills/pagina-ventas.md      ← frameworks de copy + regla patrones vs copia
```

---

Para contexto completo del proyecto, skills y routing: leer `gemini.md`.

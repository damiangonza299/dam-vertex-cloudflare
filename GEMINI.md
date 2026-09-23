# DAM Vertex Cloudflare Context

Este repositorio usa un sistema local de AI Skills en `/AI_SYSTEM`.

---

## Protocolo de inicio de tarea

Antes de cualquier tarea:

1. Leer `/AI_SYSTEM/router/skill-router.md` — decide qué skills cargar
2. Leer `/AI_SYSTEM/core/dam-vertex-core.md` — contexto del proyecto
3. Seleccionar máximo 2 a 4 skills relevantes según la tarea (ver router)
4. Leer `/AI_SYSTEM/execution/cloudcode-execution-rules.md` antes de modificar código
5. Analizar archivos reales del proyecto antes de proponer cambios
6. No tocar código de producción salvo que la tarea lo requiera explícitamente
7. DAM Vertex Cloudflare es prioridad sobre DAM Finanzas, Turno Axis u otros proyectos

---

## META_ANALYSIS_MODE=STRICT — Análisis de campañas Meta Ads

**Reglas completas:** `AI_SYSTEM/meta-ads/meta-strict-mode.md`
**Ventanas operativas + confianza:** `AI_SYSTEM/meta-ads/meta-operational-windows.md` ← leer en TODOS los análisis

**Activación:** automática cuando el usuario menciona Meta Ads, campañas, anuncios, ROAS, CTR, CPM, CPC, presupuesto, delivery, compras o escalado.

### Paso 1 — ABORTAR si no hay endpoints reales

Si CloudCode NO puede consultar endpoints reales en esta sesión:

```
ABORTAR. Responder: "NO puedo hacer análisis real porque no consulté
endpoints actuales."
```

Mínimo obligatorio: `/api/meta/campaigns` + `/api/meta/deep-insights`

### Paso 2 — Invalidar contexto viejo

Al iniciar análisis: descartar toda campaña, estado ON/OFF, presupuesto y métrica de sesiones anteriores. Fuente única válida: endpoints consultados ahora.

### Paso 3 — Acceso directo Meta API (sin servidor, siempre disponible)

```bash
# Leer META_MARKETING_TOKEN y META_AD_ACCOUNT_ID de .dev.vars — luego:

# Campañas actuales
curl -s "https://graph.facebook.com/v21.0/act_992345752726304/campaigns?fields=id,name,status,effective_status,daily_budget,start_time&access_token=TOKEN_DE_DEV_VARS"

# Métricas profundas (ajustar fechas)
curl -s "https://graph.facebook.com/v21.0/act_992345752726304/insights?fields=campaign_id,campaign_name,spend,impressions,reach,frequency,inline_link_clicks,inline_link_click_ctr,cost_per_inline_link_click,actions,action_values,cost_per_action_type&time_range={\"since\":\"YYYY-MM-DD\",\"until\":\"YYYY-MM-DD\"}&level=campaign&access_token=TOKEN_DE_DEV_VARS"

# Copies/hooks (si se necesitan creativos)
curl -s "https://graph.facebook.com/v21.0/act_992345752726304/ads?fields=id,name,status,campaign_id,creative{body,title}&access_token=TOKEN_DE_DEV_VARS"
```

Dev server local `:8788` — auth: `Bearer PONER_PASSWORD_AQUI` (ADMIN_PASSWORD del `.dev.vars`)

Limitación: `/api/meta/report` falla localmente (`D1_ERROR: no such table: leads`). Solo funciona en producción o con `--remote`.

### CHECKLIST PRE-CAMPAÑA — Obligatorio antes de crear o modificar campañas

Antes de cualquier creación o modificación de campaña, ejecutar en orden:

1. Analizar campañas históricas (performance, ROAS, estructura).
2. Analizar ROAS real (D1 `purchased_manual` / gasto Meta — NO Meta Purchase).
3. Analizar Purchase real (ventas confirmadas en admin panel — `status='purchased'` en D1 —, no el evento CAPI, que desde el 27/08/2026 se dispara al crear el lead, no al confirmar).
4. Analizar leads reales que entraron al Admin Panel (QualifiedLead como evento CAPI fue eliminado el 27/08/2026 — usar conteo de leads en D1).
5. Proponer cambios concretos con justificación en datos reales.
6. Esperar aprobación explícita del usuario antes de ejecutar.

**Nunca ejecutar cambios basados únicamente en métricas de Meta sin contrastar con datos reales de DAM Vertex.**

### PROHIBIDO — nunca sin verificación real

- Recomendar apagar o pausar campañas sin verificar `effective_status` actual
- Recomendar subir presupuesto sin ver spend real del período
- Dar CTR, CPM, ROAS sin consultar datos reales
- Mezclar campañas históricas con campañas actuales
- Inventar o estimar métricas faltantes
- Asumir estado basándose en conversaciones anteriores

### Lectura parcial — no leer GEMINI.md completo si no aplica

Tarea Meta Ads → leer SOLO secciones Meta + core. No leer landing, CSS, Firebase, PWA, WhatsApp flows, stock, diseño.

Tarea landing/código → no leer reglas Meta si no aplican.

### Strict Mode — Reglas Ampliadas

Cuando el Strict Mode está activo, estas reglas son obligatorias:

1. **Leer datos reales antes de recomendar** — no recomendar sobre hipótesis o memoria de sesión anterior
2. **Diferenciar hipótesis de conclusión** — marcar `[HIPÓTESIS]` vs `[CONCLUSIÓN]` explícitamente
3. **Separar creatividad, métrica y decisión** — no mezclar análisis de creativo con análisis de ROAS en la misma conclusión
4. **No optimizar por CTR/CPC si no hay compras o señales fuertes** — CTR sin conversión es vanidad
5. **Priorizar caja real, compras reales y cierre real por WhatsApp** — el KPI final es revenue, no métricas intermedias
6. **Purchase se dispara al crear el lead** (desde el 27/08/2026 — ver "FLUJO DE EVENTOS META — IMPORTANTE" más abajo). `status='purchased'` en D1 sigue siendo manual, vía Admin Panel, y sigue siendo la única fuente de verdad para ROAS real — pero ya no dispara ningún evento a Meta.
7. **QualifiedLead fue eliminado del sistema** (27/08/2026) — no usarlo como referencia en análisis nuevos.
8. ~~No mezclar InitiateCheckout con QualifiedLead~~ — regla obsoleta, QualifiedLead ya no existe.
9. **No tocar tracking** — nunca modificar Pixel, CAPI, Purchase, InitiateCheckout sin pedido explícito confirmado

**Reglas completas en:** `AI_SYSTEM/meta-ads/meta-strict-mode.md` — sección Regla 6

---

## SKILLS_MODULARES_MODE — Routing Inteligente de Marketing

**Activación:** automática cuando el usuario menciona anuncios, campañas, creatives, landing pages, bundles, descuentos, retargeting, TikTok, podcast ads, tripwire, sales page, lookalike, venta cruzada, presupuesto de ads, o performance.

**Router maestro:** `AI_SYSTEM/skills/router.md` — leer para routing completo e inputs requeridos.

**Reglas de activación antes de responder:**

1. Determinar la intención → consultar `skills/router.md` → cargar skill correspondiente
2. Si faltan inputs críticos → pedirlos antes de avanzar (ver "Inputs Requeridos" del skill)
3. NO avanzar sin: producto + objetivo + audiencia + plataforma + CTA + etapa del funnel
4. NO mezclar frameworks incompatibles entre skills
5. NO usar lógica genérica si existe skill especializado en `skills/`
6. Para análisis de performance → activar META_ANALYSIS_MODE=STRICT + `reporte-desempeno-ad`
7. Source of truth SIEMPRE: D1 + admin panel + purchased manual (NO Meta purchase)

### Routing Rápido

| Si pide... | Skill a cargar |
|---|---|
| anuncios / ad copy / creativos | `skills/copia-ad.md` + `skills/brief-creative-ad.md` |
| campaña Facebook/Instagram | `skills/campana-facebook-ads.md` |
| TikTok ads / guión video | `skills/guion-ad-tiktok.md` |
| podcast ad / sponsorship | `skills/guion-ad-podcast.md` |
| bundles / aumentar AOV | `skills/creador-bundles.md` |
| retargeting / remarketing | `skills/estrategia-retargeting.md` |
| descuentos / promos / ventas | `skills/estrategia-descuentos.md` |
| landing / página de ventas | `skills/pagina-ventas.md` |
| tripwire / bajo-ticket | `skills/oferta-tripwire.md` |
| performance / ROAS report | `skills/reporte-desempeno-ad.md` ← STRICT MODE |
| lookalike / audiencia similar | `skills/plan-audiencia-similar.md` |
| venta cruzada / cross-sell | `skills/estrategia-venta-cruzada.md` |
| presupuesto / calculadora CPA | `skills/calculadora-gasto-ad.md` |

### Compatibilidad DAM Vertex — Funnel Real

El sistema usa un funnel manual de cierre humano, **no** ecommerce automático:

```
Meta Ads → Landing → WhatsApp → Pending → Delivery → Purchased Manual
```

- **NO aplicar** lógica Shopify, WooCommerce, o ecommerce USA genérico
- **NO usar** Meta purchases como fuente de verdad para ROAS
- **ROAS real** = `purchased_manual` en D1 / gasto Meta
- **Lead quality** se mide por: intención WhatsApp + ciudad + día + horario
- **Pending** no es automáticamente mal lead — evaluar antigüedad y comportamiento

### Skills de Prioridad CRÍTICA (núcleo operativo)

Estas 8 skills tienen prioridad máxima. Si la tarea las involucra, cargar antes que cualquier otra:

1. `brief-creative-ad` — producción de creatives para Meta
2. `copia-ad` — copy para Facebook/Instagram/Google
3. `campana-facebook-ads` — arquitectura de campaña Meta
4. `guion-ad-tiktok` — contenido nativo TikTok
5. `reporte-desempeno-ad` — análisis ROAS + D1
6. `creador-bundles` — aumentar AOV en funnel
7. `estrategia-retargeting` — recuperar leads calientes
8. `pagina-ventas` — landing de conversión

### Skills de Referencia Externa — Capa 2 (Meta Ads / Marketing)

Estas 3 skills instaladas en Claude actúan como marco de referencia complementario para Meta Ads y marketing.
**No reemplazan las skills operativas DAM Vertex** — las enriquecen con marcos creativos, estratégicos y psicológicos.

| Skill | Referencia principal para |
|---|---|
| `ad-creative` | Generación de anuncios, variaciones creativas, copies, hooks, headlines, textos primarios, ángulos visuales, conceptos UGC, POV, demo, review, antes/después y creatividad orientada a conversión |
| `ads` | Estrategia publicitaria, lectura de métricas (CPA, CTR, CPC, ROAS, frecuencia, gasto), diagnóstico de campañas, escalado, pausado, presupuesto y decisiones de optimización |
| `marketing-psychology` | Persuasión, deseo, dolor, urgencia, objeciones, transformación, identidad, rareza, estatus, prueba social y gatillos psicológicos de compra |

**Regla de prioridad — cualquier trabajo Meta Ads:**

1. Contexto real del proyecto DAM Vertex (`core/dam-vertex-core.md`)
2. Strict Mode activo (`meta-ads/meta-strict-mode.md`)
3. Skills externas como marco: `ad-creative` + `ads` + `marketing-psychology`
4. Datos reales disponibles (Meta API + D1)
5. No inventar conclusiones si no hay datos
6. No basarse en teoría si existen métricas reales

**Regla de no conflicto:**

- Las skills externas aportan marcos creativos y psicológicos; los datos reales y las decisiones operativas siguen siendo del sistema DAM Vertex
- Si una recomendación de skill externa contradice una regla crítica DAM Vertex → la regla DAM Vertex tiene prioridad
- No mezclar lógica genérica de skills externas con el funnel Paraguay (no Shopify, no checkout automático, no ROAS Meta como source of truth)

---

## PRODUCT STUDIO — Workspace de productos (migrate23)

Módulo interno para crear, investigar y activar productos. Reemplaza el flujo manual de modificar 5+ archivos.

**Ruta:** `/product-studio/` — botón "+ Nuevo producto" en Admin Panel → Productos
**Patrón:** igual a `/intelligence/` — admin auth requerido, se abre en nueva pestaña

**Arquitectura:**
- `product_briefs` table (D1) — fuente de verdad: `op_json`, `strategic_json`, `visual_json`, `research_json`, `insights_json`
- `products` table — extendida con `status`, `product_type`, `compare_price` (migrate23)
- `insights_json.insync` — snapshot de InSync bajo demanda via `/api/insync-report`
- `insights_json.landing_intelligence` — `null` ahora, reservado para Landing Intelligence futuro

**Endpoints nuevos:**
- `GET/POST/PATCH /api/product-registry` — CRUD de products + product_briefs + proxy sync DAM Finanzas
- `POST /api/product-research` — fetch URL server-side + extracción de título, features, specs

**Estado del producto (lifecycle):**
- `draft` — creado, no visible en ventas (`active=0`)
- `pending_sync` — vinculado a DAM Finanzas, pendiente de activación
- `active` — activo en ventas (`active=1`), aparece en MANUAL_PRODUCTS
- `archived` — inactivo (`active=0`), sin eliminar

**MANUAL_PRODUCTS:**
- Ahora dinámico — fetcheado de `/api/product-stock?active_only=1` al cargar el admin
- Fallback al array hardcodeado si el fetch falla
- Productos nuevos aparecen automáticamente al activarlos en Product Studio

**Sync DAM Finanzas:**
- Tab Sync → "Sincronizar" → `product-registry` llama a `importProductFromVertex` en `us-central1-dam-finanzas-cf863.cloudfunctions.net`
- Requiere `DAM_FINANZAS_WEBHOOK_SECRET` en Cloudflare secrets
- Resultado: `dam_finanzas_id` (UUID Firestore) en `product_briefs`
- `importProductFromVertex` funciona sobre el slug D1 → fetchea `damvertex.com/api/product-stock?slug=X`

**Research Engine:**
- Tab Investigación → URL → `/api/product-research` → extracción de title/features/specs
- No aplica nada automáticamente — usuario revisa y elige qué mergear al brief
- Historial guardado en `research_json` (array de sesiones)

**Landing Blueprint:**
- Tab Landing → "Generar blueprint" → HTML generado desde el brief
- Almacenado en `product_briefs.landing_html`
- Se puede descargar y deployar manualmente

**Regla:** No tocar products D1 directamente para slugs gestionados por Product Studio. Editar via Tab Producto → Guardar.

**⚠️ Regla crítica de deploy — NUNCA VIOLAR:** Product Studio solo puede modificar `public/{slug}/index.html`. Nunca debe tocar `public/_headers`, `public/assets/js/protect.js` ni ningún JS compartido. Roturas graves documentadas en agosto y septiembre 2026. Si un CTA deja de abrir el modal, buscar `&amp;gt;` en el script (`grep "amp;" public/{slug}/index.html`) — señal de que el editor re-escapó operadores JS. Fix: `git checkout {commit-bueno} -- public/{slug}/index.html` + deploy. Ver CLAUDE.md sección "PRODUCT STUDIO — REGLA CRÍTICA".

---

## DAM INTELLIGENCE — Regla Permanente

Sistema: `public/intelligence/` + `functions/api/intelligence/`
Panel: `/intelligence/` (módulo separado del Admin Panel)
Motor: BQE (Buyer Quality Engine) — scoring 0-100 por lead/comprador
Tabla nueva: `lead_quality` (D1, aditiva, no modifica leads)

**Fuentes de verdad — orden de prioridad:**
1. D1 `leads` — Purchase real confirmado en Admin Panel
2. D1 `lead_quality` — Puntaje de calidad calculado por el BQE
3. D1 `behavior_events` — Comportamiento InSync (session_id como puente)
4. Meta Ads API — Distribución y métricas publicitarias (no fuente de verdad de compras)

**Regla fundamental:**
DAM Vertex NO optimiza por métricas de Meta Ads solamente.
DAM Vertex optimiza por: Purchase real · Puntaje del Comprador · Revenue real · Calidad del lead · Calidad del creativo · Comportamiento InSync.

Meta Ads es el canal de distribución.
D1 es la fuente de verdad operativa.
Admin Panel es la fuente de acciones.
Dam Intelligence es la capa de inteligencia que cruza las tres.
El agente de Meta Ads solo debe actuar DESPUÉS de leer D1 + lead_quality.
NUNCA tomar decisión de presupuesto basada solo en Ads Manager.

**Botón Admin Panel:** `INTEL` → abre `/intelligence/` (reemplazó a `Sync`)
**InSync dentro de Dam Intelligence:** tab `Sync` reutiliza `/api/insync-report`
**Eventos CAPI:** `FastBuyer`/`ComboBuyer` eliminados el 27/08/2026 (ver "FLUJO DE EVENTOS META — IMPORTANTE") — la clasificación sigue existiendo en D1 (`buyer_type`), sin señal a Meta.
**Eventos negativos:** NO enviados a Meta todavía. Uso interno en lead_quality.

**Endpoints:**
- `POST /api/intelligence/run-bqe` — Motor de scoring (BQE v2)
- `POST /api/intelligence/stale-scanner` — Detector de leads vencidos
- `GET  /api/intelligence/buyer-quality` — Consulta de compradores
- `GET  /api/intelligence/creative-quality` — Calidad de creativos
- `GET  /api/intelligence/recommendations` — Recomendaciones sin ejecutar
- `GET  /api/intelligence/alerts` — Alertas en tiempo real (dashboard)
- `POST /api/intelligence/send-alerts` — Genera alertas y las envía a Telegram Intelligence

**Módulo compartido:** `functions/api/intelligence/_alert-engine.js` — importado por alerts.js y send-alerts.js. Contiene toda la lógica de generación de alertas. Agregar nuevos tipos de alerta aquí.

**Alertas Telegram:**
- Bot: mismo `TELEGRAM_BOT_TOKEN` que el grupo operativo de pedidos
- Grupo: `TELEGRAM_INTELLIGENCE_CHAT_ID` — secret de Cloudflare Pages (grupo exclusivo Dam Intelligence)
- Cron: `send-alerts-daily.yml` — diario 11:00 UTC (07:00 PYT)
- Tipos: `creative_dead` 🚨 · `garbage_risk` 🚨 · `conversion_drop` 🚨 · `creative_scalable` ℹ️ · `winning_city` ℹ️ · `buyer_type_increase` ℹ️

**Ventana de maduración:** 5 días pending sin compra = lead vencido.
**Score:** Compra confirmada +50 base. Rápido +15. VIP +15. Interior vencido -40 base.

---

## FUENTE DE VERDAD DEL SISTEMA

### DAM Vertex — Responsable de

Leads · Pedidos · Admin Panel · Delivery Panel · Inventario comercial · WhatsApp · Telegram · Meta Ads · Pixel · CAPI · Purchase (dispara al crear el lead desde 27/08/2026 — ver "FLUJO DE EVENTOS META — IMPORTANTE") · Gestión operativa · **Dam Intelligence**

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

## Integración DAM Vertex + DAM Finanzas — Regla Operativa

**Regla principal:** Cada producto nuevo en DAM Vertex requiere su contraparte en DAM Finanzas. No se crea una landing sin crear el producto en inventario financiero.

**Checklist completo:** `AI_SYSTEM/execution/new-product-checklist.md` — leer obligatoriamente cuando el usuario pida agregar un nuevo producto.

### Datos que siempre pedir antes de crear un producto

Nombre público · Slug · Precio venta · Costo unitario · Stock inicial · Stock mínimo alerta · ¿Variantes? (nombre/stock/precio/costo por variante) · Combos (1u/2u/3u) · Landing · Flujo WhatsApp · Tipo de pago

### Flujo de venta DAM Vertex → DAM Finanzas

```
Admin Panel → lead comprado
→ onAdminSale webhook
→ DAM Finanzas: crea reporte, descuenta stock, actualiza Pedidos del día
→ notificación push "Venta confirmada"
```

### Fecha operativa — regla crítica

Nunca `new Date().toISOString().slice(0,10)` (UTC). Siempre:
```javascript
new Intl.DateTimeFormat("en-CA", { timeZone: "America/Asuncion" }).format(new Date())
```

### Publicidad del día — documento Firestore

`syncMetaDailyAds` escribe en `users/{uid}/reports/rds:YYYY-MM-DD`.
Campos OBLIGATORIOS para que la UI lo reconozca:
- `kind: "day_summary"` — sin esto `state.reportSummaries` ignora el documento
- `date: "YYYY-MM-DD"` — para `getDaySummaryByDate()`
- `adsTotal: NUMBER` — en PYG (cuenta ya en guaraníes, no multiplicar)
- `_metaCurrency: "PYG"`

### UMBRALES OFICIALES DAM VERTEX

DAM VERTEX Paraguay — clasificación interna de compradores (D1 / Dam Intelligence). **Prohibido modificar sin decisión de negocio explícita documentada en este archivo.**

> **Cambio 27/08/2026:** `HighValuePurchase`, `VIPPurchase` y `FastBuyer` fueron **eliminados como eventos CAPI** — ya no se envían a Meta desde ningún archivo (antes vivían en `confirm-purchase.js`, ahora removidos por completo). Los umbrales de abajo siguen usándose **solo para `buyer_type` interno en D1** (Dam Intelligence / `_bqe-scorer.js`), sin ninguna señal correspondiente hacia Meta.

| Clasificación | Umbral | Evento CAPI | buyer_type D1 |
|---|---|---|---|
| Alto valor | >= 199.000 Gs | ~~`HighValuePurchase`~~ eliminado | `alto_valor` |
| VIP | >= 300.000 Gs | ~~`HighValuePurchase` + `VIPPurchase`~~ eliminado | `vip` |
| Ultra VIP | >= 500.000 Gs | ~~sin CAPI dedicado~~ | `ultra_vip` |
| Fast Buyer | compra en < 24h | ~~`FastBuyer`~~ eliminado | `rapido` |

**Justificación (histórica, sigue aplicando al `buyer_type` interno):** Precio base reloj Gs. 189.000. Con envío express: Gs. 199.000 → intención de compra superior → clasificación Alto Valor.

**Archivos:** `_bqe-scorer.js` (constantes `ALTO_VALOR_PYG`, `VIP_PYG`, `ULTRA_VIP_PYG` — sin cambios, siguen clasificando en D1). `confirm-purchase.js` ya **no** contiene ninguna condición de `HighValuePurchase`/`VIPPurchase` — ver "FLUJO DE EVENTOS META — IMPORTANTE" abajo.

---

### CAPI — user_data obligatorio en todos los eventos

Todo evento CAPI (`ViewContent`, `AddToCart`, `InitiateCheckout`, `Purchase`) DEBE llevar al menos un campo de identidad en `user_data` además de IP/user_agent — sin eso Meta no puede atribuir ni optimizar la entrega.

- **Pre-formulario** (`ViewContent`, `AddToCart`, `InitiateCheckout`): `external_id_hashed` (SHA-256 de `_dv_anon_id`, ID anónimo persistente en `localStorage`, generado por `getOrCreateAnonId()` en `tracking.js`) + `lead_hashed` si el visitante ya compró antes (prioridad sobre el anónimo).
- **`Purchase`** (desde el 27/08/2026, se dispara al crear el lead — ver "FLUJO DE EVENTOS META — IMPORTANTE" abajo): datos reales hasheados (`ph`, `fn`, `ln`, `em`, `ct`) tomados del formulario recién enviado, más `anon_id_hashed` como valor adicional de `external_id`.

Detectado por Meta el 12/08/2026 (los 3 eventos pre-formulario iban sin identidad útil) y corregido el mismo día en `tracking.js` + `functions/api/meta-event.js`. No es la causa confirmada de la caída de pedidos del 11-12/08 — esa fue por leads borrados de D1, un hallazgo separado. Detalle completo: ver "CAPI — user_data obligatorio en todos los eventos" en `CLAUDE.md`.

---

### FLUJO DE EVENTOS META — IMPORTANTE

**Cambio de flujo crítico, 27/08/2026 — decisión de negocio explícita del usuario, con autorización confirmada tras advertencia de riesgo.**

- **`Purchase` se dispara cuando el lead SE CREA**, en `functions/api/leads.js` (al caer el pedido desde la landing) — no más al confirmar entrega. Mismos parámetros que tenía antes en `confirm-purchase.js`: `value`, `currency='PYG'`, `event_id = pur_{slug}_{timestamp}_{random}`, `user_data` con `ph`/`fn`/`ln`/`ct`/`country` hasheados + `external_id` (real si hay teléfono, `anon_id_hashed` como valor adicional). Best-effort en `waitUntil` — si falla, no rompe la creación del lead.
- **`confirm-purchase.js` NO envía ningún evento a Meta.** El botón "Confirmar compra" del Admin Panel sigue existiendo y sigue haciendo todo lo demás — `UPDATE` de `status` en D1, descuento de stock, webhook a Dam Finanzas, desbloqueo de cliente — pero es 100% interno, sin ninguna señal hacia Meta.
- **`QualifiedLead` fue eliminado del sistema** — ya no se dispara desde ningún archivo.
- **`HighValuePurchase`, `VIPPurchase`, `FastBuyer`, `ComboBuyer` fueron eliminados del sistema** — ya no se disparan desde ningún archivo. Los umbrales que los definían siguen usándose solo para `buyer_type` interno en D1 (ver "UMBRALES OFICIALES DAM VERTEX").
- **`ViewContent`, `AddToCart`, `InitiateCheckout` no cambiaron** — siguen disparándose igual desde `tracking.js`, con el mismo `event_id` compartido Pixel↔CAPI.

**Consecuencia asumida explícitamente por el usuario:** Meta ahora recibe `Purchase` para el 100% de los leads que caen (incluyendo los que después quedan `pending`, se cancelan o nunca se cobran) — no solo para las ventas confirmadas y entregadas. El algoritmo de Meta va a optimizar la entrega hacia "gente que llena el formulario", no hacia compradores reales confirmados. `status='purchased'` en D1 sigue siendo la única fuente de verdad para ROAS real y reportes — el evento Purchase que le llega a Meta ya no representa lo mismo que esa columna.

**Este cambio es irreversible en la práctica una vez deployado** — cada `Purchase` ya enviado a Meta queda permanentemente en el historial de conversiones de la cuenta de anuncios, sin forma de retirarlo. **No revertir el código a "Purchase en confirm-purchase.js" sin autorización explícita del usuario** — y si se revierte, tener en cuenta que la cuenta de Meta va a tener mezclados en su historial: eventos Purchase-por-lead (de este período) y eventos Purchase-por-confirmación (de antes y de después de revertir).

---

### REGLA CRÍTICA DE DEPLOY — DAM VERTEX

> **Incidente 2026-06:** `wrangler pages deploy .` (raíz) subió estáticos bajo `/public/reloj/`, `/public/cadena/` etc. Landings en 404 en producción.

**Único comando correcto — producción:**

```powershell
& "C:\Program Files\nodejs\npx.cmd" wrangler pages deploy public --project-name=dam-vertex-cloudflare --branch=dam-vertex-cloudflare --commit-dirty=true
```

**PROHIBIDO:**
- `wrangler pages deploy .` — rompe todas las rutas
- Deploy sin `--branch=dam-vertex-cloudflare` → va a preview, no producción
- Deploy sin verificar `pages_build_output_dir = "public"` en wrangler.toml

**Checklist pre-deploy:**
1. Leer `wrangler.toml` — confirmar `pages_build_output_dir = "public"`
2. Confirmar directorio a deployar: `public/` (no `.` ni raíz del repo)
3. Confirmar `--branch=dam-vertex-cloudflare`
4. Confirmar que `.dev.vars`, `node_modules/`, archivos internos no se suben

**Rutas críticas — verificar 200 post-deploy:**
`/` · `/reloj/` · `/cadena/` · `/admin/` · `/intelligence/` · `/api/admin-leads` · `/api/intelligence/alerts`

**Si alguna falla → NO declarar deploy exitoso. Detenerse y corregir.**

**Script de deploy seguro:** `.\scripts\deploy-production.ps1`

### Deploy correcto DAM Finanzas (Firebase Functions)

```
npx firebase deploy --only functions
```

`.env` se bundlea en deploy. Contiene `META_MARKETING_TOKEN`, `META_AD_ACCOUNT_ID`, `META_AD_ACCOUNT_CURRENCY=PYG`.

### Account ID Meta confirmado

`act_992345752726304` — cuenta en PYG. No multiplicar spend por tasa USD.

---

---

## INSTRUMENTACIÓN InSync — Regla obligatoria en nuevas landings

**Regla completa:** `AI_SYSTEM/execution/landing-insync-instrumentation.md`

Toda landing nueva debe tener IDs únicos en todas sus secciones visibles **antes del primer deploy**.

InSync usa `section[id]` para medir `section_view`, `section_time` y atribución de CTAs. Sin ID, esa sección es invisible para el análisis CRO.

```html
<!-- CORRECTO -->
<section class="hero" id="section-hero">
<section class="faq" id="section-faq">
<section class="close-sec" id="section-cierre">

<!-- PROHIBIDO — sección sin ID -->
<section class="beneficios">
```

**PROHIBIDO hacer deploy de una landing nueva sin completar la instrumentación de secciones.**

---

## CTA DE WHATSAPP — Regla obligatoria en nuevas landings

**Regla completa:** sección "CTA — BLINDADO CONTRA FALLOS DE RED" en `CLAUDE.md`.

Todo botón `[data-scroll-form]` debe tener `href` real de WhatsApp hardcodeado como fallback (nunca `href="#"`, nunca un `<button>` sin `<a>` de respaldo) y el `DOMContentLoaded` debe aislar cada llamada `DV.*` en su propio try/catch. Sin esto, si `tracking.js` o `products.js` fallan en cargar (WiFi restrictivo, firewall corporativo), el botón queda completamente mudo — incidente real detectado 2026-08.

**PROHIBIDO hacer deploy de una landing nueva sin este blindaje en el CTA.**

---

## CAMPO HORARIO — Regla obligatoria en el modal de toda landing

**Regla completa:** sección "Modal — reglas de coherencia visual" (punto 6) en `CLAUDE.md`.

Todo modal de pedido debe incluir el campo `horario` (`<input id="horario" name="horario">`) debajo del teléfono. Opcional, no bloquea el envío. Viaja al mensaje de WhatsApp del cliente y al Telegram (`functions/api/leads.js`) después de Ciudad — solo se muestra la línea si el cliente lo completó.

---

## NOMBRES ABREVIADOS — Regla obligatoria al registrar un producto nuevo

Al registrar un producto nuevo en D1 y en `leads.js`, agregar siempre el nombre abreviado en `PRODUCT_SHORT_NAMES` (`functions/api/leads.js` y `public/assets/js/products.js`, duplicado por ser contextos distintos sin módulo compartido) — máximo 3 palabras, sin artículos innecesarios. Se usa en el mensaje de Telegram y en el de WhatsApp del cliente en vez del nombre completo; si el slug no está en el mapa, cae al nombre completo como fallback.

---

## Prioridades del proyecto

- Conversión de la landing
- Tracking correcto (Pixel + CAPI, sin contaminar Purchase)
- Performance de Meta Ads (ROAS)
- Funnel de WhatsApp sin fricción
- Velocidad mobile
- Estabilidad técnica

---

## Regla de carga de skills

No cargar todo el sistema en cada sesión.
El router indica qué leer según el tipo de tarea.
Máximo 4 skills por tarea.

---

## DAM Vertex AI System

Este repositorio incluye un sistema de memoria operativa para AI en `/AI_SYSTEM/`.

### Estructura

```
/AI_SYSTEM
  /router
    skill-router.md         ← leer primero, decide qué cargar
  /core
    dam-vertex-core.md      ← contexto del proyecto principal
  /sales
    hormozi-offers.md
    dan-kennedy-direct-response.md
  /copywriting
    eugene-schwartz-awareness.md
    paraguay-hooks.md
  /landing-cro
    peep-laja-cro.md
    mobile-first-conversion.md
  /meta-ads
    meta-strict-mode.md       ← LEER PRIMERO en tareas Meta Ads
    meta-creative-testing.md
    andrew-foxwell-meta-ads.md
    ezra-firestone-ecommerce.md
  /app-architecture
    pwa-cloudflare-firebase.md
    performance-indexeddb.md
    push-notifications.md
  /execution
    cloudcode-execution-rules.md
    new-product-checklist.md       ← leer al crear producto nuevo
    landing-insync-instrumentation.md ← leer al crear landing nueva
  /skills                   ← SKILLS MODULARES DE MARKETING
    router.md               ← ÍNDICE MAESTRO — leer para routing
    brief-creative-ad.md    ← CRÍTICA
    calculadora-gasto-ad.md
    campana-facebook-ads.md ← CRÍTICA
    copia-ad.md             ← CRÍTICA
    creador-bundles.md      ← CRÍTICA
    estrategia-descuentos.md
    estrategia-retargeting.md ← CRÍTICA
    estrategia-venta-cruzada.md
    guion-ad-podcast.md
    guion-ad-tiktok.md      ← CRÍTICA
    oferta-tripwire.md
    pagina-ventas.md        ← CRÍTICA
    plan-audiencia-similar.md
    reporte-desempeno-ad.md ← CRÍTICA
  SKILL_AUDIT.md            ← auditoría completa del sistema

# SKILLS DE REFERENCIA EXTERNA (instaladas en Claude, no en /AI_SYSTEM)
  ad-creative               ← creativos, hooks, ángulos visuales, copies
  ads                       ← estrategia publicitaria, métricas, escalado
  marketing-psychology      ← persuasión, psicología de conversión
```

### Propósito

Cada archivo contiene principios operativos accionables para tareas específicas.
El sistema evita que la IA invente estructuras, funciones o flujos inexistentes.
Reemplaza el historial de chat como fuente de contexto entre sesiones.

### Qué cubre

| Área | Skills disponibles |
|---|---|
| Ofertas y ventas | `sales/` |
| Copy y hooks | `copywriting/` |
| Landing y conversión | `landing-cro/` |
| Meta Ads | `meta-ads/` |
| Apps PWA/Firebase | `app-architecture/` |
| Ejecución segura | `execution/` |
| **Skills modulares de marketing** | **`skills/`** |

### Cómo usarlo

1. Tarea marketing/ads → leer `skills/router.md` → cargar 2–3 skills relevantes
2. Tarea Meta Ads + análisis → activar META_ANALYSIS_MODE=STRICT → leer `meta-ads/meta-strict-mode.md` + `skills/reporte-desempeno-ad.md`
3. Tarea código/técnica → leer `execution/cloudcode-execution-rules.md` primero
4. Tarea landing → `skills/pagina-ventas.md` + `landing-cro/` según necesidad
5. Nunca improvisar si existe un skill adecuado en `skills/`
6. Máximo 4 skills por sesión — no cargar el sistema completo

## VALIDACIÓN TELÉFONO — Modal DCANP

**REGLA FIJA — nunca cambiar sin decisión de negocio explícita:**
- **Mínimo 9 dígitos numéricos** (cubre Paraguay: 0984 832 688 = 10 dígitos, y números cortos reales de 9 dígitos)
- Condición exacta del código: `if (soloNumeros.length < 9)` — NUNCA usar `< 10` ni otro umbral
- Campo vacío por defecto (sin value pre-cargado)
- Label: `Teléfono <span style="color:#c0392b;font-size:11px;font-weight:600;">· Ingresá tu número completo</span>`
- Si < 9 dígitos → no enviar, borde rojo en el campo, mensaje inline debajo, scroll al campo
- Si ≥ 9 dígitos → permitir envío
- Al tipear nuevamente → limpiar borde y error automáticamente
- Aplica en: estante-aluminio-bano, tabla-marmol, talonera-gel (landings DCANP)
- IDs por landing: `d-phone`/`d-phone-error` (estante) · `m-phone`/`m-phone-error` (tabla) · `t-phone`/`t-phone-error` (talonera)

## DCANP GROUP — Normalización de ciudades
- El campo ciudad en landings DCANP es siempre texto libre
- dcanp-lead.js normaliza automáticamente antes de enviar a Sheets y Telegram
- Si la ciudad no está en el mapa → se guarda tal como la escribió el cliente
- El modal DCANP no incluye campo Referencia. Campos en orden: Nombre y apellido → Teléfono → Ciudad → Dirección exacta (calle principal y secundaria, obligatorio) → Nota del pedido (opcional) → Envío express → Necesito factura.
- El placeholder de Nota del pedido en modales DCANP es siempre: "Ej: Frente al edificio Torres, portón azul"
## CAMPO CIUDAD — Modal DCANP
- Texto libre — sin selector estricto ni dropdown de autocomplete
- Placeholder: "Ej: Asunción, Lambaré, San Lorenzo..."
- Label: `Ciudad` + subtítulo rojo `· Solo el nombre de tu ciudad` (color:#c0392b, font-size:11px, font-weight:600)
- Validación: solo que el campo no esté vacío (`!data.city`) — sin bloquear por ciudad específica
- Normalización automática en dcanp-lead.js (CITY_NORMALIZE map) — el texto libre llega normalizado a Google Sheets
- NO cargar dcanp-cities.js ni window.CIUDADES_PY — ya no aplica
- El campo teléfono en modales DCANP tiene valor inicial "09" y placeholder "981 234 567". Al enfocar el cursor queda al final. Al enviar, se limpian los espacios con .replace(/\s/g, '').
- El teléfono se normaliza automáticamente en dcanp-lead.js — se quita el prefijo internacional +595 o 595 antes de guardar en Sheets y Telegram.
- El mensaje de Telegram incluye "Departamento: X" después de "Ciudad: X" cuando la ciudad se reconoce en CITY_TO_DEPT.
- Para agregar nuevas ciudades → editar CITY_NORMALIZE en dcanp-lead.js
- Referencia de ciudades por departamento: ver CITY_NORMALIZE en dcanp-lead.js

## PRODUCT STUDIO — Editor Visual

- El editor solo puede cambiar: textos visibles, imágenes, colores, precio
- **Nunca toca:** `<script>`, `<style>`, `<noscript>` — Meta Pixel (fbq, fbevents.js), endpoints API (/api/leads, /api/dcanp-lead), tokens, lógica de Telegram, Sheets, CAPI son 100% intocables desde el bridge
- El bridge agrega `contenteditable` solo a elementos con nodos de texto directos, nunca a scripts
- **CTAs** (A, BUTTON, .btn, .cta): doble clic activa edición; clic simple bloqueado mientras el bridge está activo (no abre modal)
- **Precio inteligente:** al editar `.price-main`, recalcula automáticamente precio tachado (×1.33), ahorrás (tachado-base), combo 2u (×1.85), combo 3u (×1.65)
- **Deploy:** el botón 🚀 commitea el HTML limpio a GitHub (`main` branch). No conecta CF Pages a Git — el deploy a producción sigue siendo manual con `wrangler pages deploy public --branch=main`
- **X-Frame-Options:** todas las landings tienen `SAMEORIGIN` (desde `public/_headers`). El editor carga same-origin → funciona. No usar `DENY` en landings individuales.
- Para nuevas landings: agregar `data-insync-section` en secciones para que aparezcan en el árbol del editor
- El HTML limpio usa `XMLSerializer` para evitar atributos booleanos duplicados (`checked=""`, `defer=""`, `required=""` que `outerHTML` duplica)

## REGLAS DE OFERTA — Todas las landing nuevas (Hormozi)

### Principio base
Los anuncios de video ya explican el producto. La landing NO repite lo que el video muestra.
La landing tiene UN solo trabajo: eliminar objeciones y hacer el pedido irresistible.

### Estructura obligatoria de toda landing nueva
1. H1 — Dolor directo (no descripción del producto)
2. Sub — Transformación en una línea
3. Bloque riesgo cero — "No pagás nada hasta tenerlo en la mano" (verde, borde izquierdo)
4. Precio + tachado + ahorrás + value anchor ("menos que dos deliverys")
5. Features con emoji — máximo 4, solo beneficios reales, sin repetir lo de los videos
6. CTA + prueba social "+X pedidos entregados este mes"
7. Imágenes del producto (ganchos entre medio)
8. Bloque garantía 90 días (propio, prominente)
9. FAQ 4 preguntas: cuándo llega / pago adelantado / garantía / envío
10. CTA cierre

### Lo que NUNCA va en una landing
- Eyebrow tipo "Hogar inteligente · Dam Vertex" — innecesario
- Duplicados: si algo ya está en las features con emoji, no repetirlo arriba sin emoji
- Características técnicas que el video ya muestra
- Texto explicativo que no toca dolor, transformación o urgencia
- Frases genéricas como "calidad premium" sin contexto concreto

### Elementos de oferta irresistible (obligatorios)
- Barra urgencia: "⚡ Quedan X unidades · Envío gratis · Pagás al recibir" — en UNA línea — fondo rojo
- Riesgo cero: verde #e8f5e9 con borde #1a7a3e — antes del precio
- Prueba social: "+X pedidos entregados en Paraguay este mes" — debajo del CTA hero
- Escasez real con número concreto (no "stock limitado")
- Garantía: bloque propio con borde verde, no solo subtítulo del botón
- FAQ: resuelve las 4 objeciones principales antes del footer
- Value anchor: frase de precio relativo debajo del precio principal
- Color CTA: rojo #dc2626 — genera urgencia, convierte mejor que azul en COD Paraguay

### Textos que detienen el scroll (usar en H1 y ganchos)
- Empezar con la situación exacta del cliente: "Ya estás en la cama..."
- Preguntas que duelen: "¿Ese rincón del baño que no sabés cómo aprovechar?"
- Contraste antes/después: "Sin taladro. Sin perforar. En segundos."
- Identidad: "Para los que trabajan todo el día y merecen descansar bien"

---

## ⚠️ ENCODING — REGLA CRÍTICA
Siempre guardar HTMLs con UTF-8 sin BOM.
NUNCA usar Set-Content de PowerShell sin especificar encoding:
  ❌ Set-Content archivo.html $content
  ✅ [System.IO.File]::WriteAllText(path, content, [System.Text.UTF8Encoding]::new($false))
Esto causó corrupción de caracteres especiales (tildes, ñ, símbolos) dos veces:
- 2026-09: Set-Content leyó HTMLs UTF-8 como Windows-1252 y reescribió con encoding doble → caracteres como "ó" se guardaron como "Ã³", "—" como "â€"", etc.
- Afectó: esquinero-aluminio, interruptor-control-remoto, estante-aluminio-bano (y otros 16 landings del bump masivo de tracking.js)
- Fix: git checkout al commit pre-corrupción + [System.IO.File]::WriteAllText con UTF8Encoding($false)


---

## ⚠️ PIXEL EVENTS — REGLA INAMOVIBLE — NUNCA CAMBIAR

El sistema de eventos Meta Pixel replica exactamente Releasit COD Form en Shopify.
Esta configuración NUNCA se toca. No importa qué fix, qué optimización ni qué deploy.

FLUJO EXACTO (igual a Releasit COD + Shopify) — confirmado 2026-09-20:
1. **ViewContent** → DOMContentLoaded + setTimeout 800ms (browser + CAPI)
2. **AddToCart** → dentro de `openModal()`, al inicio, inmediato
3. **InitiateCheckout** → dentro de `openModal()`, setTimeout 1500ms después de AddToCart, flag `_icFired`, UNA SOLA VEZ por sesión
4. **Purchase** → CAPI server-side únicamente, en el endpoint al recibir el lead (NUNCA en browser)

REGLAS:
- InitiateCheckout NUNCA en focus/blur listener — siempre setTimeout dentro de openModal()
- InitiateCheckout NUNCA se dispara al submit — ya es tarde
- Purchase NUNCA se duplica en browser y server
- Pixel ID NUNCA hardcodeado en server-side — siempre `env.META_PIXEL_ID` via secret
- Esta configuración aplica a TODAS las landings sin excepción — activas, inactivas, DCANP o normales

Si algo se rompe: `git log` → encontrar el commit bueno → revertir solo el archivo afectado.

### Patrón canónico — TODAS las landings (copiar exactamente)

```javascript
let _icFired = false;
function openModal() {
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  try { DV.trackAddToCart(PRODUCT); } catch(_) {}
  if (!_icFired) {
    _icFired = true;
    setTimeout(() => {
      try { DV.trackInitiateCheckout(PRODUCT, null, 1); } catch(_) {}
    }, 1500);
  }
}
```

Ver `PIXEL-EVENTS.md` para patrones de combo modal y tabla-marmol (MutationObserver).

## ⚠️ NUEVAS LANDINGS — REGLA META PIXEL INAMOVIBLE

Antes de crear cualquier landing nueva, leer `PIXEL-EVENTS.md` completo.
El flujo de eventos Meta Pixel NUNCA cambia:

1. ViewContent → setTimeout 800ms en DOMContentLoaded
2. AddToCart → al abrir el modal (dentro de `openModal()` o en click `[data-scroll-form]`)
3. InitiateCheckout → setTimeout 1500ms dentro del mismo evento de apertura, flag `_icFired`, UNA VEZ por sesión
4. Purchase → CAPI server-side ÚNICAMENTE

NUNCA usar focus/blur para InitiateCheckout.
NUNCA hardcodear Pixel ID en server-side — siempre `env.META_PIXEL_ID` via secret.

---

## MODAL ESTÁNDAR — Estructura canónica (todas las landings nuevas)

Referencia exacta: `public/interruptor-control-remoto/index.html` y `public/esquinero-aluminio/index.html`

- Label nombre: **"Nombre y apellido"** (NO "Nombre completo")
- Placeholder nombre: `"Ej: Damián Rivero"`
- Label teléfono: **"Teléfono (WhatsApp)"**
- Subtítulo teléfono: `"· Ingresá tu número completo"` en rojo
- Validación teléfono: mínimo 9 dígitos, sin valor predeterminado, sin "09" hardcodeado
- Ciudad: texto libre, placeholder `"Ej: Asunción, Lambaré, San Lorenzo..."`, sin selector estricto bloqueante
- Calle: opcional, sin `required`
- Campo "Nota del pedido": **ELIMINADO en landings DCANP**
- Sin texto `"Completá tus datos y nos comunicamos para coordinar tu entrega."`
- Badge: `"💳 Pago al recibir"` — sin `"· Central"`
- Combos: solo dentro del modal, nunca antes del CTA principal en la landing

---

## ESTRUCTURA LANDING PAGES — COD Paraguay 2026

### Regla principal
El headline de la landing SIEMPRE tiene que continuar exactamente el hook del anuncio de video.
Si el video dice "¿te cuesta levantarte a apagar la luz?" — el H1 dice exactamente eso.
Meta Andromeda penaliza el rebote post-clic subiendo el CPM. Landing y anuncio desconectados = más caro.

### Estructura obligatoria para NUEVAS landings
1. HERO — mismo gancho del video, H1 directo al dolor
2. PRECIO + RIESGO CERO — antes del primer scroll. "No pagás nada hasta tenerlo en la mano" + precio grande + tachado + ahorrás + "+340 pedidos" al lado del precio
3. VIDEO del producto — antes del primer CTA (15-28% más conversión que solo imágenes)
4. CTA — "Pedir ahora" simple. Garantía debajo en texto pequeño.
5. IMÁGENES + GANCHOS — estructura actual de secciones alternas
6. 3 OBJECIONES VISUALES — reemplaza el FAQ de acordeón:
   - 🚚 ¿Cuándo llega? → Hoy si pedís antes de las 15:00
   - 💵 ¿Tengo que pagar antes? → No, pagás cuando lo recibís
   - 🛡️ ¿Y si no funciona? → 30 días de garantía, cambio sin costo
7. CTA CIERRE

### Para landings existentes
- NO cambiar estructura sin que Armando lo pida explícitamente
- Si Armando pide un cambio visual en una landing existente, preguntar: "¿Querés que también actualice la estructura al nuevo formato COD 2026?"

### Lo que NO va en landing nuevas
- FAQ de acordeón con 4+ preguntas → usar 3 objeciones visuales
- Bloque de garantía separado al final → integrar debajo del precio
- "+340 pedidos" después del CTA → va al lado del precio
- Bullets de características técnicas → el video ya las muestra

### Referencia canónica
`public/interruptor-control-remoto/index.html` y `public/esquinero-aluminio/index.html`
(refactorizadas con esta estructura en septiembre 2026)

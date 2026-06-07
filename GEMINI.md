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
3. Analizar Purchase real (ventas confirmadas en admin panel, no pixel).
4. Analizar QualifiedLead real (leads que entraron al Admin Panel).
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
6. **Purchase es manual** — no existe Purchase automático; se marca a mano en admin panel después de la entrega
7. **QualifiedLead ocurre cuando el pedido entra al Admin Panel** — no antes, no con el submit del form
8. **No mezclar InitiateCheckout con QualifiedLead** — son eventos distintos que miden etapas distintas del funnel
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
**Eventos CAPI nuevos agregados:** `FastBuyer` (compra <24h), `ComboBuyer` (compra combo)
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

Leads · Pedidos · Admin Panel · Delivery Panel · Inventario comercial · WhatsApp · Telegram · Meta Ads · Pixel · CAPI · Purchase manual · QualifiedLead · Gestión operativa · **Dam Intelligence**

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

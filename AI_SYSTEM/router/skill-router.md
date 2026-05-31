# Skill Router

Lee este archivo primero. Luego carga solo 2 a 4 skills relevantes. No leas todo el sistema.

---

## Regla de carga

- Máximo 4 skills por tarea.
- Siempre leer `core/dam-vertex-core.md` si la tarea toca el proyecto DAM Vertex.
- Siempre leer `execution/cloudcode-execution-rules.md` antes de modificar código.
- No cargar skills de una categoría no relacionada con la tarea.

---

## Regla especial — Funnel Paraguay

Cuando la tarea involucre análisis de leads, pedidos, pendientes, tasa de cierre, ROAS real, o comportamiento del funnel:
- Leer la sección **"Funnel real Paraguay"** de `core/dam-vertex-core.md` antes de interpretar datos
- No asumir pending = mal lead sin evaluar antigüedad, ciudad y día de la semana
- Siempre cruzar métricas Meta con D1 real — Meta sobre-atribuye

---

## Mapa de routing

### OFERTA / PRECIO / PROMESA / VALOR PERCIBIDO
- `sales/hormozi-offers.md`
- `sales/dan-kennedy-direct-response.md`

Usar cuando: necesitas estructurar una oferta, definir precio, armar garantía, comunicar valor, crear escasez o urgencia real.

---

### COPYWRITING / HOOKS / DOLOR / DESEO / ÁNGULOS
- `copywriting/eugene-schwartz-awareness.md`
- `copywriting/paraguay-hooks.md`

Usar cuando: escribís copy para anuncios, landing, WhatsApp, creativos o titulares. Cuando necesitas diagnosticar nivel de conciencia del público.

---

### LANDING PAGE / CRO / UX / MOBILE FIRST
- `landing-cro/peep-laja-cro.md`
- `landing-cro/mobile-first-conversion.md`

Usar cuando: modificás o revisás la landing, el flujo de compra, CTAs, jerarquía visual, velocidad o experiencia mobile.

---

### META ADS / CREATIVOS / TESTEO / ESCALADO
- `meta-ads/meta-strict-mode.md` ← **LEER SIEMPRE PRIMERO en tareas Meta**
- `meta-ads/meta-creative-testing.md`
- `meta-ads/andrew-foxwell-meta-ads.md`
- `meta-ads/ezra-firestone-ecommerce.md`

Usar cuando: planificás campañas, testeo de creativos, estructura de cuentas, presupuesto, análisis de resultados o escalado.

**Keywords de activación META_ANALYSIS_MODE=STRICT:**
```
Meta Ads | campañas | anuncios | ROAS | CTR | CPM | CPC
presupuesto | delivery | compras | escalado | pausar | activar
resultados | métricas | creativos | leads Meta | atribución
```

---

### PROTOCOLO OBLIGATORIO — META_ANALYSIS_MODE=STRICT

**Reglas completas en:** `AI_SYSTEM/meta-ads/meta-strict-mode.md`

Flujo mínimo antes de cualquier análisis:

```
1. Activar META_ANALYSIS_MODE=STRICT
2. INVALIDAR todo contexto de campañas de sesiones anteriores
3. Leer .dev.vars → obtener META_MARKETING_TOKEN real
4. GET /campaigns → estados actuales reales (ACTIVE/PAUSED)
5. GET /deep-insights?since=X&until=Y → métricas del período real
6. GET /ads?campaign_id=X → copies/hooks (si aplica)
7. GET /report → D1 cruzado (solo producción o --remote)
8. Confirmar validación explícita antes de recomendar
9. Analizar SOLO con datos de endpoints consultados en esta sesión
```

**ABORTAR si no hay acceso a endpoints:**
```
"NO puedo hacer análisis real porque no consulté endpoints actuales."
```

**Diferenciar tipo de campaña:**
- Campañas con leads en D1 → `/api/meta/report` para ROAS real + tasa de cierre
- Campañas históricas sin D1 → MODO HISTÓRICO META-ONLY (no inventar datos D1)

**Métricas mínimas a reportar cuando disponibles:**
```
campaign_name / campaign_id
adset_name (si nivel adset o ad)
ad_name / hook/copy (si nivel ad)
spend | impressions | reach | frequency | cpm
inline_link_clicks | ctr_link | cpc_link
landing_page_views | view_content | add_to_cart | initiate_checkout | purchases
cost_per_landing_page_view | cost_per_add_to_cart | cost_per_purchase
purchase_value | roas_meta
video: avg_time_watched_sec | plays | p25/p50/p75/p95 (si es video)
D1: leads | purchased | pending | cancelled | close_rate | roas_real (si disponible)
```

---

### SKILLS DE REFERENCIA EXTERNA — Capa 2 (Meta Ads / Marketing)

Skills instaladas en Claude como marco de referencia para Meta Ads y marketing.
Se aplican **sobre** las skills operativas DAM Vertex, no en lugar de ellas.
Activar en tareas de generación creativa avanzada, análisis de estrategia o psicología de conversión.

| Skill Externa | Área | Cuándo Usar |
|---|---|---|
| `ad-creative` | Creativos, hooks, copy | Generar anuncios, variaciones, conceptos UGC, POV, demo, review, antes/después, ángulos visuales |
| `ads` | Estrategia, métricas | Diagnóstico de campañas, lectura de CPA/CTR/CPC/ROAS/frecuencia/gasto, escalado, pausado, presupuesto |
| `marketing-psychology` | Persuasión | Dolor, deseo, urgencia, objeciones, identidad, rareza, estatus, prueba social, gatillos de compra |

**Regla de prioridad para trabajo Meta Ads:**
1. Contexto real DAM Vertex (`core/dam-vertex-core.md`)
2. Strict Mode (`meta-ads/meta-strict-mode.md`)
3. Skills externas: `ad-creative` + `ads` + `marketing-psychology` como marco complementario
4. Datos reales Meta API + D1
5. No inventar conclusiones si no hay datos
6. No basarse en teoría si existen métricas reales

**Regla de no conflicto:**
- Si una recomendación de skill externa contradice una regla crítica de DAM Vertex → la regla DAM Vertex tiene prioridad
- No mezclar lógica genérica de skills externas con el funnel Paraguay (no Shopify, no checkout automático, no ROAS Meta como source of truth)
- No tocar tracking, Purchase, QualifiedLead, InitiateCheckout, Meta Pixel, CAPI bajo ningún marco externo

---

### APLICACIONES / PWA / FIREBASE / CLOUDFLARE / INDEXEDDB
- `app-architecture/pwa-cloudflare-firebase.md`
- `app-architecture/performance-indexeddb.md`
- `app-architecture/push-notifications.md`

Usar cuando: trabajás en DAM Finanzas, Turno Axis u otras PWAs. Cuando tocás Firebase, IndexedDB, push notifications o arquitectura de app.

---

### EJECUCIÓN TÉCNICA EN CLOUDCODE
- `execution/cloudcode-execution-rules.md`

Usar siempre antes de modificar cualquier archivo de código en producción.

---

### SKILLS MODULARES DE MARKETING — `skills/`

Skills operativos de agencia para tareas de marketing, publicidad y conversión.
**Router maestro:** `skills/router.md` — leer para routing completo, inputs esperados y combinaciones.
Cargar según intención del usuario. Máximo 3 skills de esta categoría por tarea.

**Compatibilidad DAM Vertex:** funnel manual Meta → WhatsApp → cierre humano.
NO Shopify. NO ecommerce USA. Source of truth = D1 + purchased manual.

**Skills CRÍTICAS (prioridad máxima):**
`brief-creative-ad` · `copia-ad` · `campana-facebook-ads` · `guion-ad-tiktok`
`reporte-desempeno-ad` · `creador-bundles` · `estrategia-retargeting` · `pagina-ventas`

#### Routing por Intención

**SI usuario pide: anuncios / ad copy / creativos / Facebook Ads**
→ `skills/copia-ad.md` + `skills/brief-creative-ad.md` + `skills/campana-facebook-ads.md`

**SI usuario pide: TikTok ads / guión video / UGC**
→ `skills/guion-ad-tiktok.md`

**SI usuario pide: podcast ad / sponsorship / host-read**
→ `skills/guion-ad-podcast.md`

**SI usuario pide: bundles / agrupar productos / aumentar AOV**
→ `skills/creador-bundles.md`

**SI usuario pide: retargeting / remarketing / visitantes que no compraron**
→ `skills/estrategia-retargeting.md`

**SI usuario pide: descuentos / promos / ventas / precio promocional**
→ `skills/estrategia-descuentos.md`

**SI usuario pide: landing / página de ventas / sales page / conversión**
→ `skills/pagina-ventas.md`

**SI usuario pide: tripwire / oferta bajo-ticket / convertir leads en compradores**
→ `skills/oferta-tripwire.md`

**SI usuario pide: performance report / análisis campañas / ROAS report**
→ `skills/reporte-desempeno-ad.md`

**SI usuario pide: lookalike / audiencia similar / escalar con nuevos clientes**
→ `skills/plan-audiencia-similar.md`

**SI usuario pide: venta cruzada / cross-sell / vender a clientes existentes**
→ `skills/estrategia-venta-cruzada.md`

**SI usuario pide: presupuesto de ads / cuánto gastar / calculadora CPA**
→ `skills/calculadora-gasto-ad.md`

#### Lista Completa de Skills Modulares

| Skill | Archivo | Cuándo Cargar |
|---|---|---|
| Brief Creative Ad | `skills/brief-creative-ad.md` | Producción de creatives, dirección visual |
| Calculadora Gasto Ad | `skills/calculadora-gasto-ad.md` | Presupuesto, CPA objetivo, proyecciones |
| Campaña Facebook Ads | `skills/campana-facebook-ads.md` | Estructura de campaña Meta completa |
| Copia de Ad | `skills/copia-ad.md` | Escribir copy para cualquier plataforma |
| Creador Bundles | `skills/creador-bundles.md` | Crear bundles, aumentar AOV |
| Estrategia Descuentos | `skills/estrategia-descuentos.md` | Promos, ventas, pricing con margen |
| Estrategia Retargeting | `skills/estrategia-retargeting.md` | Retargetear visitantes, segmentación funnel |
| Estrategia Venta Cruzada | `skills/estrategia-venta-cruzada.md` | Cross-sell a clientes existentes |
| Guión Ad Podcast | `skills/guion-ad-podcast.md` | Scripts host-read, sponsorships |
| Guión Ad TikTok | `skills/guion-ad-tiktok.md` | Scripts video nativo, UGC, Spark Ads |
| Oferta Tripwire | `skills/oferta-tripwire.md` | Bajo-ticket, convertir leads en compradores |
| Página de Ventas | `skills/pagina-ventas.md` | Sales page largo formato, conversión |
| Plan Audiencia Similar | `skills/plan-audiencia-similar.md` | Lookalike strategy, escalar con nuevos clientes |
| Reporte Desempeño Ad | `skills/reporte-desempeno-ad.md` | Análisis ROAS, reporting estructurado |

---

## Ejemplo de routing por tarea

| Tarea | Skills a cargar |
|---|---|
| Reescribir hero de la landing | `core`, `copywriting/paraguay-hooks.md`, `landing-cro/peep-laja-cro.md` |
| Armar nueva campaña Meta | `core`, `skills/campana-facebook-ads.md`, `skills/copia-ad.md` |
| Revisar oferta y precio | `core`, `sales/hormozi-offers.md`, `sales/dan-kennedy-direct-response.md` |
| Fix de bug en admin/tracking | `core`, `execution/cloudcode-execution-rules.md` |
| Mejorar performance IndexedDB | `app-architecture/performance-indexeddb.md`, `execution/cloudcode-execution-rules.md` |
| Configurar push notifications | `app-architecture/push-notifications.md`, `app-architecture/pwa-cloudflare-firebase.md` |
| Escribir guión TikTok ad | `skills/guion-ad-tiktok.md`, `copywriting/paraguay-hooks.md` |
| Diseñar estrategia retargeting | `skills/estrategia-retargeting.md`, `core` |
| Crear bundles de productos | `skills/creador-bundles.md`, `sales/hormozi-offers.md` |
| Planificar descuento o promo | `skills/estrategia-descuentos.md` |
| Escribir sales page | `skills/pagina-ventas.md`, `copywriting/eugene-schwartz-awareness.md` |
| Análisis de performance ads | `skills/reporte-desempeno-ad.md`, `meta-ads/meta-strict-mode.md` |
| Escalar con lookalike | `skills/plan-audiencia-similar.md`, `core` |
| Calcular presupuesto ads | `skills/calculadora-gasto-ad.md` |

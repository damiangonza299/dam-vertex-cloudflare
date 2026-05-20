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

## Ejemplo de routing por tarea

| Tarea | Skills a cargar |
|---|---|
| Reescribir hero de la landing | `core`, `copywriting/paraguay-hooks.md`, `landing-cro/peep-laja-cro.md` |
| Armar nueva campaña Meta | `core`, `meta-ads/meta-creative-testing.md`, `copywriting/eugene-schwartz-awareness.md` |
| Revisar oferta y precio | `core`, `sales/hormozi-offers.md`, `sales/dan-kennedy-direct-response.md` |
| Fix de bug en admin/tracking | `core`, `execution/cloudcode-execution-rules.md` |
| Mejorar performance IndexedDB | `app-architecture/performance-indexeddb.md`, `execution/cloudcode-execution-rules.md` |
| Configurar push notifications | `app-architecture/push-notifications.md`, `app-architecture/pwa-cloudflare-firebase.md` |

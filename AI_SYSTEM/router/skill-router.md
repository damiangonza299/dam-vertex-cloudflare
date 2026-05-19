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
- `meta-ads/meta-creative-testing.md`
- `meta-ads/andrew-foxwell-meta-ads.md`
- `meta-ads/ezra-firestone-ecommerce.md`

Usar cuando: planificás campañas, testeo de creativos, estructura de cuentas, presupuesto, análisis de resultados o escalado.

---

### PROTOCOLO OBLIGATORIO — Cuando el usuario pide analizar campañas Meta Ads

Antes de responder cualquier análisis de campañas, seguir este protocolo en orden:

**1. Confirmar fuente de datos**
- ¿Se están usando datos reales de Meta API o solo el repo local?
- Declarar explícitamente: "Estoy usando datos reales de Meta API" o "No tengo acceso a Meta API, solo puedo analizar el código/repo".

**2. Consultar métricas profundas**
- Endpoint preferido: `/api/meta/deep-insights` — devuelve inline_link_clicks, CTR link, funnel completo nombrado (landing_page_views, view_content, add_to_cart, initiate_checkout, purchases), costos por evento, video metrics.
- Si no disponible: `/api/meta/insights?level=ad` — devuelve actions[] crudo, sin extracción nombrada.
- Para creative body/hook/title: `/api/meta/ads?campaign_id=X` o `?status=ARCHIVED` para histórico.
- Para campañas históricas (ARCHIVED): `/api/meta/deep-insights?status=ARCHIVED&since=YYYY-MM-DD&until=YYYY-MM-DD`

**3. Cruzar con D1 si aplica**
- Si hay leads en D1 para el período → usar `/api/meta/report` para cruzar atribución real.
- Si son campañas históricas anteriores al sistema D1 → MODO HISTÓRICO META-ONLY (no inventar datos D1 que no existen).

**4. Diferenciar tipo de campaña**
- Campañas nuevas (con leads en D1): analizar con ROAS real + tasa de cierre + métricas Meta.
- Campañas históricas (sin D1): analizar solo métricas Meta — CTR link, CPC link, CPM, frequency, funnel events, video retention si aplica.

**5. Reglas de honestidad**
- NO inventar datos faltantes.
- NO asumir purchased/revenue si no hay datos D1 reales.
- Si un endpoint no responde o requiere credenciales: proveer el curl exacto para que el usuario lo ejecute y pegue el resultado.
- Declarar limitaciones explícitamente: "No encontré datos para X en el rango consultado."

**6. Metricas a reportar siempre (cuando disponibles)**
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

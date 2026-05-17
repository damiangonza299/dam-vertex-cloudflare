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

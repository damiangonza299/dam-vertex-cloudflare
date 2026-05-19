# Meta Creative Testing — Estrategia DAM Vertex

Estrategia de testeo y gestión de campañas para productos físicos en Paraguay.

---

## Filosofía base

- Meta segmenta por creativos, no por intereses
- Los anuncios crean audiencias — no al revés
- Broad targeting + creativos fuertes es la estrategia correcta
- El test agresivo es la única forma de encontrar ganadores reales

---

## Estructura de campañas

- Campañas separadas por producto o línea de producto
- Presupuesto por campaña: ~75.000 Gs (referencia actual)
- Objetivo: conversiones (Purchase) para tráfico caliente, o tráfico para cold test
- No mezclar productos en la misma campaña

---

## Ventana de rendimiento

- **Horario fuerte:** 5:00 a 13:00
- Evaluar resultados en esa ventana antes de tomar decisiones de corte
- No descartar campañas fuera de horario pico sin ver datos de ventana completa

---

## Criterios de evaluación

Descartar si:
- No hay venta ni intención calificada en el período de evaluación
- CPA es insostenible para el margen del producto
- El creativo genera clics pero no pedidos

Mantener si:
- Hay compras reales o leads de calidad
- El costo por resultado es viable
- El creativo muestra señales de resonancia (engagement + conversión)

**No decidir solo por CTR o CPC.** Un CTR alto sin conversión es un creativo que entretiene pero no vende.

---

## Pilares creativos

Trabajar con diversidad real de pilares, no microvariaciones del mismo ángulo:

| Pilar | Qué comunica |
|---|---|
| Dolor | El problema que tiene el cliente ahora |
| Frustración | Lo que no funcionó antes |
| Comparación | Con/sin el producto, diferencia visible |
| Prueba social | Otros lo tienen, les funcionó |
| Identidad/Status | Quién sos / cómo te ven cuando lo usás |
| Oferta/Urgencia | Precio, stock, entrega hoy |

---

## Formatos creativos

Crear diversidad de formato, no solo de copy:

- **POV** — el cliente usando el producto desde su perspectiva
- **UGC style** — video o foto estilo usuario real, sin producción obvia
- **Demo** — el producto en uso, cómo funciona, cómo se ve
- **Review** — alguien hablando del producto directamente
- **Antes / Después** — comparación visual
- **Producto en uso** — outfit completo, contexto real

---

## Interpretación de resultados — contexto Paraguay

El funnel termina con **confirmación manual en WhatsApp**, no con checkout automático. Esto cambia cómo leer los datos:

- **Pending no es fracaso.** Es el estado normal entre lead y compra confirmada.
- **Un pending de 1–2 días es normal en Paraguay.** No cortar campaña por eso.
- **Interior del país alarga el ciclo y reduce conversión** — no es señal del creativo.
- **Meta sobre-atribuye** casi siempre. Validar compras contra D1, no contra el panel de Meta.
- **Compras se marcan generalmente después de las 17:00 o de noche.** No evaluar ROAS a mitad del día.
- **Fin de semana:** cierres se desplazan al lunes. No tomar decisiones de corte el sábado.

Cuando evalúes un creativo: mirá el funnel completo (link clicks → landing views → add to cart → pedidos D1 → purchased D1), no solo las compras atribuidas por Meta.

---

## Protocolo de análisis CloudCode — métricas a leer siempre

Cuando se analiza el rendimiento de un creativo o campaña, CloudCode debe leer en este orden:

### Funnel de métricas (de arriba hacia abajo)

```
Impresiones → Reach → Frequency → CPM
    ↓
Inline Link Clicks → CTR link → CPC link
    ↓
Landing Page Views → tasa LPV/click
    ↓
ViewContent → AddToCart → InitiateCheckout → Purchases
    ↓
Cost per Purchase → Purchase Value → ROAS Meta
    ↓ (si hay D1)
Leads D1 → Pending → Purchased → Close Rate → ROAS Real
```

### Para creativos tipo video — leer retención

```
Video Plays → P25 → P50 → P75 → P95 → Thruplay
Avg time watched (segundos)
```

Un video que pierde el 80% antes de P25 → hook no funciona.
Un video que retiene hasta P75+ → candidato a escalar.

### Errores de interpretación comunes

| Métrica confundida | Problema |
|---|---|
| CTR "all" vs CTR "link" | CTR all incluye clics en perfil/likes. CTR link (inline_link_click_ctr) es el real. |
| ROAS Meta vs ROAS Real | ROAS Meta sobre-atribuye. ROAS Real = revenue D1 / spend. |
| Clicks vs Landing Page Views | Los clicks salen de Meta. LPV depende de que la landing cargue. Gap = velocidad/carga. |
| Purchases Meta vs Purchases D1 | Meta usa ventana 7d/1d y view-through. D1 es fuente de verdad. |

### Endpoint a usar por tipo de análisis

| Necesidad | Endpoint |
|---|---|
| Análisis profundo de métricas + funnel | `/api/meta/deep-insights` |
| Análisis profundo con D1 cruzado | `/api/meta/report` |
| Copies y hooks por anuncio | `/api/meta/ads?campaign_id=X` |
| Copies históricos (ARCHIVED) | `/api/meta/ads?status=ARCHIVED` |
| Campañas históricas (ARCHIVED) | `/api/meta/deep-insights?status=ARCHIVED&since=...` |

---

## Lo que hay que evitar

- Microcambios en el mismo creativo (cambiar el color del botón no es test)
- Duplicar campañas sin criterio diferenciador claro
- Escalar sin ganador validado
- Pausar demasiado rápido (antes de ventana completa)
- Pausar demasiado tarde (cuando el presupuesto ya se quemó sin señal)

---

## Escalado

- Escalar solo creativos con resultados probados
- Escalar gradualmente: +20% de presupuesto cada 2-3 días
- No duplicar el presupuesto de golpe — reinicia el aprendizaje
- Cuando un creativo fatiga: rotar, no apagar la campaña entera

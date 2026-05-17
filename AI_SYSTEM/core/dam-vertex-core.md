# DAM Vertex Cloudflare — Core Context

Este es el proyecto principal. Tiene prioridad sobre cualquier otro proyecto de Damián.

---

## Qué es

Ecommerce de productos físicos para el mercado paraguayo.
Funnel principal: Meta Ads → Landing/Tienda → WhatsApp → Pedido → Entrega.
Infraestructura: Cloudflare Pages + Workers + D1/KV para el frontend y lógica de negocio.

---

## Contexto de mercado

- **País:** Paraguay (principalmente Asunción y Gran Asunción, con Interior)
- **Cliente:** visual, poco lector, sensible al precio, decide rápido o no decide
- **Canal de cierre:** WhatsApp (no checkout clásico)
- **Pago Central:** acepta pago al recibir
- **Pago Interior:** puede requerir pago adelantado o transferencia previa
- **Dispositivo:** mayoría mobile, conexión variable, muchos en 4G

---

## Prioridades del proyecto (en orden)

1. Ventas reales y pedidos confirmados
2. Conversión de la landing
3. ROAS positivo en Meta Ads
4. Tracking confiable (Pixel + CAPI)
5. Experiencia WhatsApp sin fricción
6. Velocidad de carga mobile
7. Estabilidad técnica del sistema

---

## Principios de diseño

- Conversión antes que estética
- Mobile-first siempre
- Claridad antes que creatividad
- Velocidad antes que animaciones
- CTA a WhatsApp visible y directo
- Texto mínimo, impacto máximo

---

## Tracking

- Meta Pixel activo en frontend
- Conversions API (CAPI) en backend/Workers
- Evento Purchase solo cuando el pedido está confirmado
- No contaminar eventos con clics, vistas o interacciones que no son conversión real
- No tocar la configuración de Purchase salvo que sea parte explícita de la tarea

---

## Meta Ads

- El tráfico entra desde campañas de Meta
- Meta segmenta por creativos, no por intereses (broad targeting)
- Los anuncios crean audiencias, no al revés
- Test agresivo con múltiples campañas por producto
- Evaluación por compras reales + intención + costo, no solo CTR/CPC

---

## Stack técnico

- **Frontend:** HTML/CSS/JS vanilla + Cloudflare Pages
- **Backend:** Cloudflare Workers + D1 (SQLite) + KV
- **Auth/DB apps:** Firebase Auth + Firestore (en proyectos de app)
- **WhatsApp:** links directos con mensaje pre-armado
- **Admin:** panel interno para gestión de pedidos y stock

---

## Funnel real Paraguay — comportamiento operativo

Este NO es un checkout automático tipo Shopify USA.

El flujo real es:
Meta Ads → Landing → CTA WhatsApp → conversación humana → coordinación delivery → confirmación manual → Purchase marcado a mano.

### Ciclo de vida del lead en Paraguay

El comportamiento de WhatsApp en Paraguay no es inmediato. No interpretar silencio como lead muerto.

| Antigüedad pending | Interpretación correcta |
|---|---|
| 0–24h | Lead fresco, en conversación activa o a punto de responder |
| 1–2 días | Normal en PY. Muchos responden al día siguiente o luego del trabajo |
| 2–3 días | Zona tibia — seguimiento activo recomendado |
| 3+ días sin actividad | Zona fría — alto riesgo de pérdida, pero no descartado si hay señal |
| 5+ días sin respuesta | Lead probablemente perdido salvo reapertura por el operador |

### Factores que alargan el ciclo

- **Pago contra entrega:** elimina urgencia de decidir rápido — el cliente sabe que no paga hasta recibir
- **Interior del país:** requiere coordinar con encomienda, más fricción, más tiempo, más seguimiento
- **Fin de semana (viernes noche → domingo):** cierres se desplazan al lunes/martes siguiente
- **Horario laboral:** muchos no ven WhatsApp durante el día, responden a la noche
- **Entrega horario:** generalmente lunes a viernes después de las 17:00 — los "purchased" se marcan después de las 17:00 o durante la noche

### Reglas de interpretación de leads para análisis

NUNCA asumir automáticamente:
- pending = mal lead
- pending > 1 día = curioso
- sin compra hoy = campaña sin conversión

SIEMPRE evaluar:
- antigüedad del pending en contexto del día de la semana
- ciudad: Gran Asunción vs Interior
- horario en que entró el lead
- si hay leads del viernes que aún no cerraron (normal hasta el lunes)

### Diferencia Gran Asunción vs Interior

**Gran Asunción (Asunción, San Lorenzo, Lambaré, Luque, Ñemby, Capiata, Fernando, etc.):**
- Entrega misma zona, más rápida
- Pago al recibir sin fricción
- Conversión más alta y más rápida
- Tasa de cierre esperada: 40–60% de los leads activos

**Interior (Ciudad del Este, Encarnación, Pedro Juan, Santa Rita, Villa Hayes, Pdte Franco, etc.):**
- Requiere encomienda o coordinación especial
- Mayor posibilidad de pago adelantado → genera fricción
- Conversión más baja y más lenta
- Pendientes de Interior no deben alarmarse en 1–2 días
- Cancelaciones de Interior son más frecuentes — no señalan problema creativo

### Métricas reales a usar en análisis

- **ROAS real** = revenue de pedidos confirmed purchased / gasto en ads (NO el ROAS de Meta)
- **Tasa de cierre** = purchased / (purchased + cancelled + pending resueltos)
- **Leads pendientes activos** = oportunidad de revenue, no fracaso
- **Meta sobre-atribuye** frecuentemente: verificar siempre contra D1

---

## Reglas de interpretación del reporte Meta Ads

El admin panel expone tres métricas de compras distintas. Nunca mezclarlas.

### Prioridad de análisis por campaña (de más a menos confiable)

1. **Real atrib.** (`d1.purchased`) — leads de D1 con `campaign_id` que están `purchased`. Fuente de verdad operativa. Usar para ROAS real y decisiones de pausa/escala.
2. **Leads atribuidos** + costo por lead — complemento de Real atrib.
3. **Meta purchases** — referencia de distribución de Ads Manager. Puede sobre-atribuir (view-through) o sub-atribuir (re-atribución multi-touch). Nunca como fuente de verdad.
4. **Real prod.** — contexto del producto, no atribución de campaña. Ver regla abajo.
5. **Sin atribución** — zona gris. No asignar a ninguna campaña específica.

### Regla crítica — Real prod. y ROAS prod.

**Real prod.** = total de compras reales del producto en el rango, con o sin `campaign_id`.

- Si hay 2+ campañas del mismo producto, Real prod. es el **mismo número en todas las filas** del producto.
- NO se interpreta como "esta campaña sola generó N ventas".
- ES contexto: cuánto vendió el producto en total. La atribución está en Real atrib.

**ROAS prod.** = revenue total del producto / gasto de esta campaña.

- Solo tiene sentido si el producto tiene **una sola campaña activa** en el período.
- Si hay 2+ campañas del mismo producto, el backend anula ROAS prod. (muestra —) porque el numerador incluye ventas que pertenecen a otras campañas.
- NUNCA usar ROAS prod. como métrica de performance cuando hay múltiples campañas del mismo producto.

### Ejemplo correcto con producto compartido

Cadena Apex — 30 días:
- Campaña A (vieja): Real atrib. = 3, Gasto = 200k → ROAS atrib. = calculado sobre sus 3 ventas
- Campaña B (nueva): Real atrib. = 6, Gasto = 100k → ROAS atrib. = calculado sobre sus 6 ventas
- Real prod. = 13 (total del producto) → mismo en ambas filas, es contexto
- ROAS prod. = — en ambas filas (producto compartido, no atribuible)
- Sin atribución = 4 ventas que no se pueden asignar a ninguna campaña

---

## Proyectos relacionados (secundarios)

- **DAM Finanzas:** app PWA de finanzas personales, Firebase + IndexedDB
- **Turno Axis:** app de gestión de turnos, misma arquitectura base
- No tocar estos proyectos salvo pedido explícito del usuario

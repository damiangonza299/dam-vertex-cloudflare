# Meta Ads — Ventanas Operativas y Niveles de Confianza

Sistema de análisis por ventana temporal para DAM Vertex.
Activo en todos los análisis de campañas. Parte del META_ANALYSIS_MODE=STRICT.

---

## Principio base

El sistema DAM Vertex tiene tres "relojes" distintos que nunca se sincronizan en tiempo real:

| Reloj | Qué mide | Velocidad |
|---|---|---|
| **D1 / Admin** | Leads, status, attribution | Realtime (< 1 min) |
| **Meta API** | Delivery, clicks, spend | 15–30 min lag |
| **Meta Attribution** | Purchases atribuidos | 1–7 días |
| **Humano/Operacional** | Confirmación manual, entrega | 1–3 días |

**Consecuencia directa:** ROAS real del día N no está estabilizado hasta el día N+2 mínimo.
No existe "ROAS de hoy". Existe "ROAS parcial de hoy" y "ROAS confiable de hace 2–3 días".

---

## Ventana 1 — Análisis de intención temprana

**Cuándo:** T+6h a T+12h del inicio del día operativo PY (ej. 11:00–13:00 PY)

**Qué mirar:**
- D1 leads nuevos por campaña y por ad (fuente de verdad)
- LPV / ATC / IC ratio (intent proxy)
- CTR link, CPC link (distribución de presupuesto)
- Frecuencia (señal de fatiga)
- messaging_user_depth (profundidad de conversación WA)

**Qué NO mirar:**
- Purchases (0 o 1, no representativo)
- ROAS (sin sentido a esta hora)
- Meta purchases (casi siempre 0, CAPI aún no procesó)

**Decisiones permitidas:** Ninguna irreversible. Solo observación y registro de señales.
Si un ad tiene 0 ATC, 0 LPV y > 20.000 Gs gastados: **anotar como alerta**, no apagar todavía.

**Nivel de confianza: 30%** — intención temprana, sin resultado

---

## Ventana 2 — Análisis operativo de cierre

**Cuándo:** T+18h a T+24h (00:00–02:00 PY, fin del día operativo)

**Qué mirar:**
- D1 leads del día completo por campaña
- Status changes (pending que pasaron a purchased o cancelled)
- Spend total y por ad del día completo
- CTR / CPC / LPV del día completo
- Purchases D1 ya marcados (del día anterior, entregados hoy)
- Pending aging: cuántas horas llevan sin respuesta WA

**Decisiones permitidas:**
- Pausar ads con 0 leads + 0 ATC + 0 LPV + spend > 20.000 Gs del día (evidencia de basura)
- Identificar ad ganador del día por D1 leads + LPV/click ratio
- Anotar pending para follow-up WA prioritario

**NO hacer todavía:**
- Subir presupuesto
- CBO
- Declarar ganador definitivo
- Matar campaña completa por un día solo

**Nivel de confianza: 55%** — datos del día completos, ROAS parcial, sin compras del día confirmadas

---

## Ventana 3 — Decisiones agresivas

**Cuándo:** T+36h a T+48h (cierre del día N+1 / N+2)

**Qué mirar:**
- D1 purchased acumulados (día N + día N+1)
- ROAS real parcial (70–85% del valor final)
- Meta attribution para día N (90% estable)
- Pending aging: leads de día N que siguen sin resolver
- Interior vs Gran Asunción split (Interior puede tardar 1 día más)

**Decisiones permitidas:**
- Pausar campañas sin D1 leads en 2+ días consecutivos + 0 intent signals
- Escalar ad ganador: +20% presupuesto si tiene ≥2 purchased confirmed
- Identificar candidatos a duplicar
- Evaluar cambio de creativo (fatiga confirmada)

**Nivel de confianza: 80%**

---

## Ventana 4 — Verdad casi definitiva

**Cuándo:** T+72h a T+96h (cierre día N+3 / N+4)

**Qué mirar:**
- ROAS real completo (Interior mayormente cerrado, Gran Asunción cerrado)
- Meta attribution 95%+ estable para día N
- CBO criteria: ≥3 D1 purchased por campaña + ROAS >3x + 3 días con datos
- Creativos candidatos a variación basada en ganador confirmado

**Decisiones permitidas:**
- CBO migration (solo si los 3 criterios están cumplidos)
- Duplicar campaña ganadora
- Matar perdedores definitivamente
- Lanzar nueva variación creativa basada en ángulo ganador
- Consolidar estructura (less campaigns, más presupuesto en ganadores)

**Nivel de confianza: 95%**

---

## Tabla de decisiones — SÍ/NO por ventana

| Decisión | T+12h | T+24h | T+48h | T+72h+ |
|---|---|---|---|---|
| Observar D1 leads e intención | ✓ | ✓ | ✓ | ✓ |
| Pausar ad basura obvia (0 todo, 2+ días) | ✗ | ✓ | ✓ | ✓ |
| Subir presupuesto +20% | ✗ | ✗ | ✓ (≥2 purchased) | ✓ |
| Declarar ganador definitivo | ✗ | ✗ | ✓ | ✓ |
| Matar campaña definitivamente | ✗ | ✗ | ✓ | ✓ |
| Pasar a CBO | ✗ | ✗ | ✗ | ✓ (criterios OK) |
| Duplicar campaña | ✗ | ✗ | ✗ | ✓ |
| Nueva variación creativa | ✗ | ✗ | preparar | ✓ lanzar |
| ROAS real confiable | ✗ | parcial | 80% | 95% |

---

## Estabilización Meta API — tiempos exactos

| Métrica | Lag inicial | Estabilización | Definitivo |
|---|---|---|---|
| Ad status (ACTIVE/PAUSED) | < 5 min | Inmediato | Inmediato |
| Spend / Impressiones / CTR | 15–30 min | 2–4h | Día siguiente |
| LPV / ATC / IC | 30–60 min | 4–8h | Día siguiente |
| Purchases Meta (attribution) | 1–4h | 24–48h | **7 días** |
| ROAS Meta | Depende purchases | 24–48h | **7 días** |
| Video retention | 30–60 min | 4–6h | Día siguiente |

**Regla:** ROAS Meta para el día N sigue creciendo durante 7 días porque la ventana de atribución es 7d click / 1d view. Nunca usar ROAS Meta de hoy para decisiones de hoy.

---

## Estabilización del pipeline DAM Vertex

| Etapa | Lag real |
|---|---|
| Form submit → D1 write | < 500ms |
| Lead en admin panel | < 1 min |
| Attribution escrita (campaign_id, ad_id) | Al submit. **Permanente, no cambia.** |
| Pending → respuesta WA (Gran Asunción) | 0–4h típico |
| Pending → respuesta WA (Interior) | 12–48h típico |
| Delivery confirmada → purchased marcado | Mismo momento post-entrega |
| D1 purchased reflejado | < 1 min post-marca |
| CAPI Purchase event → Meta lo atribuye | 2–4h después de enviado |

---

## Comportamiento normal vs bug real

### NORMAL (no son bugs)

**Anuncios pausados siguen apareciendo en insights históricos**
Meta devuelve todos los ads que corrieron en el rango de fechas, independientemente del status actual.
Un ad PAUSED sigue siendo parte de los datos del día en que corrió. Eso es correcto.
→ Filtrar por `effective_status` solo cuando se quieren datos de ads ACTUALMENTE activos.

**Purchases Meta aparecen tarde**
El proceso es humano: entrega → confirmación → marca manual → CAPI event → Meta procesa.
El delay no es técnico, es el ciclo operativo Paraguay de 1–3 días.

**Meta re-atribuye purchases días después**
La ventana 7d click / 1d view permite que una compra marcada hoy se atribuya a un ad de hace 7 días.
D1 attribution es permanente y no cambia → usar D1 como source of truth.

**Leads sin respuesta el mismo día**
Normal en Paraguay. No interpretar como lead muerto. Ver `dam-vertex-core.md` — ciclo de vida de leads.

### BUGS REALES (requieren corrección técnica)

**operational_date_py timezone incorrecto**
Causa: Cloudflare Workers ICU puede calcular `America/Asuncion` con UTC-3 en vez de UTC-4.
Fix: usar hardcoded `-4 * 3600 * 1000` en `getParaguayDate()` en `functions/api/leads.js`.
Estado: **CORREGIDO en código local. Requiere redeploy.**
Afecta: leads entre 23:00–23:59 PY (03:00–03:59 UTC siguiente día) que quedan en el día siguiente.

**purchased_at almacenado en UTC**
`datetime('now')` en SQLite = UTC. Al mostrar en admin o analizar, convertir sumando -4h para ver hora PY.
No es un bug crítico si se conoce — pero puede confundir en análisis nocturnos.

---

## Estructura del análisis por sesión — formato obligatorio

Cuando se analiza rendimiento de campañas, incluir siempre estas secciones:

```
## VENTANA OPERATIVA ACTIVA
Hora actual PY: [HH:MM]
Ventana: [Intención T+Xh / Operativo T+24h / Agresivo T+48h / Definitivo T+72h+]
Confianza del análisis: [30% / 55% / 80% / 95%]

## 1. HECHOS CONFIRMADOS
[Solo datos verificados en esta sesión: D1 queries + Meta API consultados ahora]

## 2. DATOS TODAVÍA INMADUROS
[Qué métricas no son confiables en esta ventana y por qué]

## 3. RECOMENDACIONES SUAVES
[Solo las que corresponden a la ventana actual]

## 4. RECOMENDACIONES AGRESIVAS
[Solo si la ventana lo permite (T+48h+). Si no aplica: "No disponibles en esta ventana."]

## 5. NIVEL DE CONFIANZA
[Porcentaje + qué lo limita]
```

---

## Reglas de separación datos legacy vs datos nuevos

A partir del lead ID 164 (approx): `operational_date_py` y `attribution_confidence` están populados.
Para leads anteriores: usar fallback `WHERE created_at >= 'YYYY-MM-DD 04:00:00'` (UTC medianoche PY = UTC-4).

**Nunca mezclar** leads con `operational_date_py IS NULL` (legacy) con leads nuevos en análisis de precisión.
Los legacy se incluyen en conteos totales pero con flag de menor confianza de attribution.

---

## Checklist pre-análisis

Antes de cualquier análisis de campañas:

- [ ] Determinar hora actual PY (UTC - 4h)
- [ ] Identificar ventana operativa activa
- [ ] Consultar Meta API (campañas + insights del período)
- [ ] Consultar D1 real con fecha correcta (operational_date_py o fallback UTC)
- [ ] Invalidar datos de sesiones anteriores
- [ ] Separar leads nuevos (attribution_confidence != NULL) de legacy
- [ ] Separar Gran Asunción de Interior antes de evaluar conversion rate
- [ ] Verificar purchased_at en UTC (+4h para hora PY real)

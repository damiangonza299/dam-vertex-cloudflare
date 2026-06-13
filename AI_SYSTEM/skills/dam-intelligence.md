---
name: dam-intelligence
description: "Skill operacional para análisis de leads, compradores y scoring de calidad. Cubre BQE (Buyer Quality Engine), lead_quality, leads vencidos, alertas y métricas de Dam Intelligence. Cargar cuando se analiza comportamiento de leads o se trabaja con el sistema de alertas."
allowed-tools: Read Glob Grep Bash
metadata:
  type: skill
  version: "1.0"
  author: DAM Vertex AI System
---

# Dam Intelligence — Análisis de Leads y Compradores

Dam Intelligence es el sistema de inteligencia interna de DAM Vertex. No es un dashboard de Meta. Sus métricas vienen de D1 — la fuente de verdad real del negocio.

---

## Cuándo Usar Este Skill

- Analizar calidad de leads recientes
- Revisar scoring de compradores (BQE)
- Investigar leads vencidos o cancelados
- Configurar o interpretar alertas de intelligence
- Analizar distribución de buyer_type
- Verificar funcionamiento del stale scanner

---

## Fuente de Verdad

```
D1 → leads table → la verdad del negocio
D1 → lead_quality table → scoring BQE
D1 → purchased_manual → compras reales confirmadas

NO Meta purchase — es métrica reportada, no verificada.
NO admin panel estimaciones — siempre consultar D1 directo.
```

---

## BQE — Buyer Quality Engine

Archivo: `functions/api/intelligence/_bqe-scorer.js`

Score de 0–100 por lead. Se calcula automáticamente en `autoScorePurchase` al confirmar una compra.

### Factores de Score

| Factor | Peso | Descripción |
|---|---|---|
| Tiempo hasta compra | Alto | Compra < 24h = FastBuyer, máx score |
| Valor de compra | Alto | ≥ 199.000 Gs = alto_valor, ≥ 300.000 = vip |
| Ciudad | Medio | Asunción/Gran Asunción = datos completos |
| Teléfono válido | Medio | Normalizado a 595XXXXXXXXX |
| Nombre completo | Bajo | fn + ln disponibles |
| IP conocida | Bajo | IP guardada vs null |

### Constantes en _bqe-scorer.js

```javascript
ALTO_VALOR_PYG = 199000
VIP_PYG        = 300000
ULTRA_VIP_PYG  = 500000
FAST_BUYER_H   = 24      // horas desde lead hasta compra
```

**Prohibido modificar estas constantes sin decisión de negocio documentada en CLAUDE.md.**

---

## Tabla lead_quality en D1

```sql
CREATE TABLE lead_quality (
  lead_id      INTEGER PRIMARY KEY,
  score        INTEGER,           -- 0–100
  buyer_type   TEXT,              -- 'rapido', 'alto_valor', 'vip', 'ultra_vip', null
  scored_at    TEXT,
  score_detail TEXT               -- JSON con desglose
);
```

Consulta de diagnóstico:
```sql
SELECT lq.score, lq.buyer_type, l.name, l.value, l.created_at, l.purchased_at
FROM lead_quality lq
JOIN leads l ON l.id = lq.lead_id
ORDER BY lq.scored_at DESC
LIMIT 50;
```

---

## Buyer Types — Mapping Completo

| buyer_type | Condición | Evento CAPI |
|---|---|---|
| `rapido` | Compra < 24h desde lead | `FastBuyer` |
| `alto_valor` | Valor ≥ Gs. 199.000 | `HighValuePurchase` |
| `vip` | Valor ≥ Gs. 300.000 | `HighValuePurchase` + `VIPPurchase` |
| `ultra_vip` | Valor ≥ Gs. 500.000 | Cubierto por VIPPurchase, sin evento CAPI dedicado |
| null | Lead sin compra confirmada | — |

Un lead puede tener múltiples clasificaciones (ej: `rapido` + `vip`).

---

## Leads Vencidos / Stale Scanner

Un lead vencido es un lead que entró al Admin Panel pero no fue atendido en tiempo.

### Definición operativa

- Lead `status='pending'` con `created_at` > **5 días (120h)** → vencido según `STALE_DAYS = 5` en `_bqe-scorer.js`
- Lead `status='cancelled'` → cerrado explícitamente
- Lead `status='pending'` con múltiples intentos de contacto sin respuesta → stale

### Consulta de stale leads

```sql
SELECT id, name, phone, product_name, value, created_at, status
FROM leads
WHERE status = 'pending'
  AND created_at < datetime('now', '-5 days')
ORDER BY created_at ASC;
```

> Fuente de verdad: `STALE_DAYS = 5` en `functions/api/intelligence/_bqe-scorer.js`.
> El stale-scanner importa esta constante y calcula `now - (5 * 24 * 3600)` en segundos.
> No usar -48 hours — es incorrecto.

### Regla para leads vencidos que vuelven a comprar

Si un lead `status='cancelled'` o `status='pending-stale'` vuelve a escribir al WhatsApp:
1. No crear nuevo lead automáticamente — verificar si el lead original puede reactivarse
2. No disparar QualifiedLead de nuevo si ya se disparó — duplica la señal CAPI
3. Cambiar `status='pending'` en el lead original y documentar en notas internas

---

## Alertas — Endpoints

```
GET  /api/intelligence/alerts       → alertas activas del sistema
GET  /api/intelligence/ping-telegram → test de conectividad Telegram
```

Las alertas se configuran en `functions/api/intelligence/` y se disparan via Telegram.

Archivos clave:
```
functions/api/intelligence/_bqe-scorer.js       ← scoring lógica
functions/api/intelligence/alerts.js            ← generación de alertas
```

---

## Cómo Interpretar Métricas

### ROAS Real

```
ROAS real = purchased_manual en D1 / gasto Meta (de Meta API)
```

No usar el ROAS reportado por Meta. Meta cuenta conversiones atribuidas — no ventas confirmadas reales.

### Tasa de Conversión Real

```
CVR real = leads con status='purchased' / total leads período
```

No usar Meta's conversion rate. Un lead en `status='pending'` no es una venta.

### CPA Real

```
CPA = gasto Meta período / count leads status='purchased' período
```

---

## Reglas de No Contaminación

- **No crear leads de prueba en producción** — contamina el scoring histórico
- **No confirmar compras ficticias** — activa CAPI Purchase real hacia Meta
- **No ejecutar autoScorePurchase manualmente** fuera del flujo de confirm-purchase
- **No modificar lead_quality directamente** vía SQL en producción — los scores deben ser los calculados por BQE

---

## Anti-Patrones

- **NO** analizar leads usando solo el panel de Meta — siempre cruzar con D1
- **NO** modificar buyer_type manualmente sin pasar por la lógica BQE
- **NO** eliminar leads de lead_quality — los históricos son datos de entrenamiento del sistema
- **NO** cambiar constantes de umbrales sin documentar en CLAUDE.md y ejecutar plan de migración

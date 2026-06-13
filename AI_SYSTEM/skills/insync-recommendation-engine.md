---
name: insync-recommendation-engine
description: "Skill para el InSync Recommendation Engine. Cubre arquitectura, source of truth, normalización canónica y reglas de escritura segura para landing_intelligence. Cargar cuando se trabaja en CAPA A (Structure Engine), anotación de principios, o integración con Product Studio."
allowed-tools: Read Write Edit Glob Grep Bash
metadata:
  type: skill
  version: "1.0"
  author: DAM Vertex AI System
---

# InSync Recommendation Engine

El Recommendation Engine hace que DAM Vertex aprenda de sus propias landings. No copia bloques ni estilos — extrae **principios de marketing** que explican por qué algo funciona.

Pipeline completo:
```
Producto → Brief → Landing → InSync (behavior_events) → Recommendation Engine → Nuevo Brief mejorado
```

---

## Cuándo Usar Este Skill

- Trabajar en `structure-patterns.js` (CAPA A)
- Anotar `angle_family` o `mechanism_family` en un producto
- Leer o escribir `landing_intelligence` en `product_briefs`
- Diseñar o extender el Principle Engine (CAPA B)
- Integrar con Product Studio (Fase 3 — aún no implementado)

---

## Arquitectura de Dos Capas

### CAPA A — Structure Engine

Analiza **contenedores estructurales** de la landing (secciones) con métricas de comportamiento.

- Fuente: `behavior_events` (raw events de InSync)
- Dimensión de análisis: `section` normalizada
- Métricas: `reach_pct`, `avg_time_s`, `attention_score`, `cta_rate`
- Agrupación: por `category` (desde `product_briefs.op_json.category`)
- Output: patrones de secciones FUERTE / NEUTRO / DÉBIL por categoría

CAPA A **no interpreta** por qué una sección funciona. Solo mide cuánto funciona.

### CAPA B — Principle Engine

Analiza **principios de marketing** que explican el éxito de una landing.

- Fuente: `product_briefs.insights_json.landing_intelligence` (anotación manual o automática)
- Dimensión de análisis: `angle_family`, `mechanism_family`, `principles`
- **No implementado todavía.** El slot `landing_intelligence` está reservado para cuando CAPA A entregue suficiente evidencia validada.

**CAPA A ≠ CAPA B.** `hero`, `faq`, `testimonios` son contenedores estructurales (CAPA A). `regalo`, `presencia`, `transformacion` son principios de marketing (CAPA B). No mezclar.

---

## Source of Truth

**Una sola tabla. Sin excepciones.**

| Dimensión | Tabla | Campo | Estado |
|---|---|---|---|
| `category` | `product_briefs` | `op_json.category` | Existe, texto libre |
| `desire_family` | `product_briefs` | `strategic_json.desire_type` | Existe, vocabulario controlado |
| `angle_family` | `product_briefs` | `insights_json.landing_intelligence.angle_family` | Existe el slot, datos pendientes |
| `mechanism_family` | `product_briefs` | `insights_json.landing_intelligence.mechanism_family` | Existe el slot, datos pendientes |
| `principles` | `product_briefs` | `insights_json.landing_intelligence.principles` | Existe el slot, datos pendientes |
| InSync snapshot | `product_briefs` | `insights_json.insync` | Se escribe via `refresh_insync` |

**No existe `landing_metadata`.** Fue evaluada y descartada — duplicaría datos ya existentes en `product_briefs`.

**No existe `create_brief` endpoint.** Ver sección Invariantes.

---

## Invariantes del Sistema

### No existe `create_brief` para productos existentes

El único camino oficial para crear un producto con su brief es `handleCreate` en `product-registry.js` (Product Studio). Los productos legacy fueron backfilled via `migrate25.sql` — no via endpoint.

Si aparece un producto nuevo sin brief, la solución es usar Product Studio, no crear un endpoint nuevo.

### Product Studio NO se integra todavía

La integración de CAPA A / CAPA B con Product Studio es Fase 3. No implementar hasta que los patrones de CAPA A estén validados manualmente. Product Studio sigue siendo el dueño de `category` y `desire_type` — el engine solo los lee, nunca los escribe.

---

## Regla Crítica: Escritura Segura de `insights_json`

**NUNCA actualizar `insights_json` completo via PATCH cuando se trabaja con `landing_intelligence`.**

El PATCH de `product-registry.js` reemplaza el campo completo. Enviar `{ insights_json: { landing_intelligence: {...} } }` via PATCH destruye el snapshot `insync`.

### Camino correcto para escribir `landing_intelligence`

Usar únicamente la acción `update_landing_intelligence`:

```http
POST /api/product-registry
Authorization: Bearer ADMIN_PASSWORD
Content-Type: application/json

{
  "action": "update_landing_intelligence",
  "slug": "reloj-imperial-verde",
  "landing_intelligence": {
    "angle_family": "presencia",
    "mechanism_family": "diseno_premium",
    "principles": {},
    "annotation_source": "manual",
    "annotation_confidence": 1.0
  }
}
```

Esta acción:
1. Lee `insights_json` actual de la DB
2. Preserva `insync` sin tocarlo
3. Reemplaza solo `landing_intelligence`
4. Valida vocabularios antes de escribir
5. Retorna el `insights_json` final completo

### Camino correcto para escribir `insync`

Usar únicamente la acción `refresh_insync` (ya implementada). Nunca escribir `insync` manualmente.

---

## Normalización Canónica

Estas reglas son la fuente única de verdad para todo el ecosistema. Cualquier código que las contradiga está equivocado.

### `category`

**Cuándo:** Solo al leer (en el engine). Nunca modificar lo almacenado.

**Algoritmo:**
1. `toLowerCase()`
2. `.trim()`
3. Strip diacritics: `ñ→n`, `á→a`, `é→e`, `í→i`, `ó→o`, `ú→u`
4. Espacios internos → `_`

**Ejemplos:**
```
"Relojes"          → "relojes"
"Joyería"          → "joyeria"
"Higiene Personal" → "higiene_personal"
"Lentes"           → "lentes"
```

**Vocabulario actual en DB:**

| Almacenado | Normalizado | Productos |
|---|---|---|
| "Relojes" | `relojes` | reloj, reloj-imperial-verde |
| "Joyería" | `joyeria` | cadena |
| "Lentes" | `lentes` | lentes |
| "Higiene Personal" | `higiene_personal` | cepillo |

---

### Section names

**Cuándo:** Solo al leer en el engine (`structure-patterns.js`). Los valores en `behavior_events.section` se almacenan raw — nunca modificar.

**Algoritmo:**
```javascript
name.trim().toLowerCase().replace(/^section-/, '').replace(/-section$/, '')
```

**Ejemplos:**
```
"section-hero"        → "hero"
"hero-section"        → "hero"
"hero"                → "hero"
"section-testimonios" → "testimonios"
"beneficios"          → "beneficios"
"HERO"                → "hero"
```

**Límite:** El strip solo aplica a prefijo o sufijo exacto. `mi-section-hero` permanece `mi-section-hero`.

---

### `angle_family`

**Cuándo:** Al escribir (validar en `update_landing_intelligence`). Vocabulario cerrado.

**Valores permitidos:**

| Valor | Descripción comercial |
|---|---|
| `regalo` | El producto como regalo perfecto |
| `presencia` | Proyección de imagen, estilo, status |
| `transformacion` | Cambio visible antes/después |
| `precio` | Precio rebajado o comparativa de valor |
| `escasez` | Stock limitado o tiempo limitado |
| `novedad` | Producto nuevo o exclusivo |
| `bienestar` | Mejora de salud, comodidad, calidad de vida |
| `practicidad` | Resuelve un problema concreto eficientemente |

**Cardinalidad:** String singular (ángulo primario dominante). No array.

**Algoritmo de normalización:** `value.trim().toLowerCase()` antes de validar.

---

### `mechanism_family`

**Cuándo:** Al escribir (validar en `update_landing_intelligence`). Vocabulario cerrado.

**Valores permitidos:**

| Valor | Descripción comercial |
|---|---|
| `diseno_premium` | El diseño visual o estético es el diferenciador |
| `material_premium` | La calidad del material o construcción |
| `gift_ready` | Presentación como regalo (caja, packaging) |
| `tecnologia` | Innovación técnica o funcional |
| `comodidad` | Facilidad de uso o ergonomía |
| `estetica_minimalista` | Simplicidad visual como diferenciador |
| `funcional` | Utilidad pura — resuelve el problema |

**Cardinalidad:** String singular. No array.

---

### `desire_type` (ya existente)

Campo controlado en `strategic_json`. No se normaliza — ya tiene vocabulario controlado desde Product Studio.

Valores: `status`, `estetica`, `regalo`, `uso_personal`, `practicidad`, `salud`, `comodidad`.

---

## Estructura de `landing_intelligence`

```json
{
  "angle_family":         null,
  "mechanism_family":     null,
  "principles":           {},
  "annotation_source":    null,
  "annotation_confidence": null
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `angle_family` | string \| null | Ángulo creativo primario de la landing |
| `mechanism_family` | string \| null | Mecanismo diferenciador principal |
| `principles` | object | Mapa sección → principio (CAPA B, futuro) |
| `annotation_source` | string \| null | `"manual"` \| `"suggested"` \| `"automatic"` |
| `annotation_confidence` | number \| null | 0.0 a 1.0 |

---

## Evolución de la Anotación

| Fase | `annotation_source` | Quién escribe | Cómo |
|---|---|---|---|
| Inicial (ahora) | `"manual"` | Admin, vía `update_landing_intelligence` | Manual |
| Intermedia (futuro) | `"suggested"` | Engine sugiere, admin confirma | Sugerido desde `strategic_json` |
| Avanzada (futuro) | `"automatic"` | Engine escribe si confidence ≥ umbral | Automático |

El campo `annotation_source` es lo que permite distinguir las tres fases sin cambio de schema.

---

## Métricas de CAPA A — Referencia

| Métrica | Fórmula | Umbral mínimo |
|---|---|---|
| `reach_pct` | `views / sessions * 100` | — |
| `attention_score` | `reach_pct * 0.5 + time_score * 0.5` | 30 vistas de sección |
| `time_score` | `min((avg_time_s / 15) * 100, 100)` | — |
| `cta_rate` | `cta_clicks / sessions * 100` | — |

Sección clasificada como **FUERTE** si `reach_pct ≥ 60` y `attention_score ≥ 55`.
Sección clasificada como **DÉBIL** si `reach_pct < 30` y `attention_score < 30`.
Todo lo demás: **NEUTRO**.
Todas como **PENDIENTE** si `total_sessions < 100` (umbral mínimo cross-landing).

---

## Anti-Patrones

- **NO** hacer PATCH de `insights_json` completo cuando se anota `landing_intelligence` — destruye `insync`
- **NO** crear tabla `landing_metadata` — los datos viven en `product_briefs`
- **NO** crear endpoint `create_brief` — es una puerta trasera a Product Studio
- **NO** tratar sección names como principios — `hero`, `faq`, `testimonios` son contenedores estructurales
- **NO** integrar con Product Studio todavía — Fase 3 requiere validación manual primero
- **NO** escribir `insync` directamente — solo via acción `refresh_insync`

---

## Archivos Clave

```
functions/api/product-registry.js      → CRUD + update_landing_intelligence
functions/api/insync-report.js         → report endpoint (solo lectura)
public/assets/js/insync.js             → cliente InSync (no tocar)
migrate23.sql                          → schema de product_briefs
migrate25.sql                          → backfill de briefs legacy
```

---

## Estado de Implementación

| Componente | Estado |
|---|---|
| `behavior_events` schema | ✅ Producción |
| `product_briefs` schema | ✅ Producción |
| 5 briefs en DB (4 legacy + 1 PS) | ✅ Producción |
| `update_landing_intelligence` action | ✅ Implementado |
| `structure-patterns.js` (CAPA A) | ✅ Implementado — `GET /api/insync/structure-patterns` |
| Anotación manual de landings | ⏳ Pendiente post-Fase 1 |
| Dashboard de comparación (CAPA A) | ⏳ Pendiente Fase 2 |
| `Principle Engine` (CAPA B) | ⏳ Pendiente Fase 3+ |
| Integración Product Studio | ⏳ Pendiente Fase 3 |

---
name: plan-audiencia-similar
description: "Diseña estrategias de audiencia similar con selección de audiencia de origen, tiers de porcentaje y framework de pruebas. Úsalo cuando planees targeting pagado en ad para encontrar clientes nuevos similares a tus mejores existentes."
allowed-tools: Read Write Glob
metadata:
  author: Imperio Digital
  version: "1.0"
---

# Plan de Audiencia Similar

## Principio Fundamental

LA CALIDAD DE UNA AUDIENCIA SIMILAR SOLO ES TAN BUENA COMO LA AUDIENCIA DE ORIGEN — COMIENZA CON TUS CLIENTES DE MAYOR VALOR, NO TU LISTA MÁS GRANDE.

---

## Cuándo Usar Este Skill

- Construir una estrategia de audiencia similar para Facebook, Google u otras plataformas de ad
- Seleccionar las mejores audiencias de origen de tus datos de clientes existentes
- Planificar tiers de porcentaje y secuencias de pruebas para expansión de audiencia similar
- Crear un plan de rollout estructurado para escalar gasto en ad con lookalikes

**NO USES** este skill para targeting basado en intereses, configuración de retargeting, o construcción de audiencia orgánica. Esto es específicamente para estrategias de audiencia similar/lookalike en plataformas pagadas.

---

## Fase 1: Auditoría de Origen

Antes de construir lookalikes, identifica y evalúa audiencias de origen disponibles.

### Inputs Requeridos

| Input | Qué Preguntar | Default |
|---|---|---|
| **Plataforma de ad** | "¿Qué plataforma? (Meta, Google, TikTok, LinkedIn)" | Meta (Facebook/Instagram) |
| **Datos de cliente disponibles** | "¿Qué listas de clientes o datos de pixel tienes? (listas de email, compradores, leads, visitantes de sitio)" | Sin default — debe ser proporcionado |
| **AOV / LTV promedio** | "¿Cuál es el valor de cliente promedio o lifetime value?" | Desconocido |
| **Presupuesto mensual de ads** | "¿Cuál es tu presupuesto mensual de gasto en ad?" | $2,000/mes |
| **Objetivos geográficos** | "¿Qué países o regiones diriges?" | Estados Unidos |

**PUNTO DE CONTROL: No procedas hasta que el usuario confirme sus fuentes de datos disponibles y plataforma.**

---

## Fase 2: Estrategia de Audiencia de Origen

### Jerarquía de Calidad de Fuente de Origen

Ordena tus fuentes disponibles de mejor a peor para lookalike:

| Prioridad | Fuente | Por Qué Es Mejor | Tamaño Mínimo |
|---|---|---|---|
| **1 (Mejor)** | Compradores de alto LTV (top 25%) | Los más valiosos — lookalike copia sus señales | 1,000+ |
| **2** | Lista completa de compradores | Todos los que pagaron — alta intención validada | 1,000+ |
| **3** | Compradores del pixel (evento Purchase) | Datos de comportamiento, no solo email | 1,000+ |
| **4** | Add to Cart (sin compra) | Alta intención, casi conversos | 2,000+ |
| **5** | Leads / emails de prospectos | Intención media — cuidado con calidad | 5,000+ |
| **6** | Visitantes de sitio (pixel) | Baja intención — amplio | 10,000+ |

### Evaluación de Fuente

```
## Auditoría de Fuentes Disponibles

**Fuente 1:** [Descripción]
- Tamaño: [X personas / registros]
- Calidad estimada: [Alta / Media / Baja]
- Disponible en: [Meta Custom Audience / CSV upload / Pixel event]
- Usar como base para lookalike: [SÍ / NO — razón]

**Fuente 2:** [Descripción]
[misma estructura]

**Fuente recomendada para primer lookalike:** [Nombre]
**Razón:** [Por qué esta fuente producirá el mejor lookalike]
```

---

## Fase 3: Estructura de Tiers de Lookalike

### Framework de Tiers por Porcentaje

| Tier | Porcentaje | Tamaño Audiencia | Similitud | Mejor Para |
|---|---|---|---|---|
| **Tier 1 — Estrecho** | 1% | ~2M (EE.UU.) | Muy alta | Mayor calidad, menor volumen |
| **Tier 2 — Moderado** | 2-3% | ~4-6M | Alta | Balance calidad/volumen |
| **Tier 3 — Amplio** | 5-7% | ~10-14M | Media | Escalar después de validar |
| **Tier 4 — Expansión** | 10% | ~20M | Baja-Media | Solo si los anteriores funcionan |

### Reglas de Tiers

- Siempre comenzar con 1% — validar antes de escalar
- No saltar a 5%+ sin data de 1-3% funcionando primero
- Cada porcentaje es audiencia incremental (1% ≠ subconjunto de 2%)
- En países pequeños, comenzar con 3-5% (audiencia 1% demasiado pequeña)

---

## Fase 4: Plan de Pruebas

### Secuencia de Testing de Lookalike

**Semana 1-2: Validación de Fuente**
```
Test: 2-3 fuentes de origen diferentes, misma audiencia de porcentaje (1%)
Objetivo: Identificar qué fuente produce el CPA más bajo
Presupuesto: Dividir igualmente entre fuentes
Ganador: Menor CPA con volumen suficiente
```

**Semana 3-4: Expansión de Porcentaje (con fuente ganadora)**
```
Test: Fuente ganadora en 1%, 2-3%, 5%
Objetivo: Encontrar el porcentaje óptimo costo/volumen
Ganador: Menor CPM + CPA dentro de target
```

**Semana 5+: Escalar con Estructura Ganadora**
```
- Aumentar presupuesto máximo 20% cada 3-4 días
- Mantener creative fresco (rotar cada 3-4 semanas)
- Monitorear frequency — si sube de 3, expandir porcentaje
```

---

## Fase 5: Setup Técnico en Meta Ads

### Configuración de Lookalike Audience en Meta

```
## Setup Técnico — Meta Lookalike

**Paso 1 — Crear Custom Audience (fuente):**
Ads Manager → Audiences → Create Audience → Custom Audience
Tipo: [Customer list / Website / App activity]
Fuente: [Upload CSV / Pixel event Purchase / etc.]
Nombre: "LAL-Source-[Nombre]-[Fecha]"

**Paso 2 — Crear Lookalike:**
Desde Custom Audience → Actions → Create Lookalike
País/región: [Target geográfico]
Audience size: [1-3% para comenzar]
Nombre: "LAL-1pct-[Fuente]-[País]-[Fecha]"

**Paso 3 — Ad Set:**
- Usar lookalike como audiencia
- Age/gender: Broad (dejar que el algoritmo optimice)
- Placements: Automatic (para escala)
- Excluir: Custom Audience de compradores existentes

**Verificación antes de lanzar:**
□ Tamaño de lookalike > 500,000
□ Exclusión de compradores existentes configurada
□ Pixel de conversión disparando correctamente
□ Presupuesto asignado adecuado para fase de aprendizaje (50 eventos/semana)
```

---

## Fase 6: Métricas de Evaluación

### KPIs de Lookalike por Etapa

| Métrica | Semana 1-2 | Semana 3-4 | Semana 5+ |
|---|---|---|---|
| CPM | Referencia | vs. Baseline | Debería bajar |
| CTR | Referencia | vs. Baseline | Estable o sube |
| CPC | Referencia | vs. Baseline | Debería bajar |
| CVR | Referencia | vs. Baseline | Key metric |
| CPA | Meta | Comparar tiers | Mantenerse bajo target |
| Frequency | <2 | <3 | <4 antes de rotar creative |

---

## Anti-Patrones

- **NO** usar lista de email no segmentada como fuente — los no-compradores diluyen la señal
- **NO** crear lookalike de audiencia de origen menor a 1,000 personas — señal insuficiente
- **NO** lanzar 5%+ sin validar 1% primero — escalar sin datos es quemar presupuesto
- **NO** overlapping sin exclusiones — asegura que retargeting no compita con lookalike
- **NO** actualizar la fuente de origen con datos viejos — usar los compradores más recientes
- **NO** esperar que lookalike funcione con presupuesto insuficiente para aprendizaje — mínimo $50/día por ad set

---

## Outputs Esperados

Al completar este skill, el usuario tiene:
1. Jerarquía de fuentes de origen evaluada y priorizada
2. Estructura de tiers de lookalike por porcentaje
3. Plan de pruebas semana por semana con objetivos claros
4. Setup técnico en Meta con checklist de verificación
5. Métricas de evaluación y umbrales de éxito por etapa

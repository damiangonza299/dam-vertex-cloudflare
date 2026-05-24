---
name: calculadora-gasto-ad
description: "Calcula presupuestos de gasto en ads basándote en objetivos de ingresos, tasas de conversión y objetivos de costo-por-adquisición. Úsalo cuando planees cuánto gastar en ads para alcanzar metas de ingresos."
allowed-tools: Read Write Glob
metadata:
  author: Imperio Digital
  version: "1.0"
---

# Calculadora de Gasto en Ads

## Principio Fundamental

EL GASTO EN ADS ES UNA ECUACIÓN DE INVERSIÓN — CADA DÓLAR QUE ENTRA DEBE PRODUCIR UN RETORNO MEDIBLE, Y LAS MATEMÁTICAS DEBEN FUNCIONAR ANTES DEL PRIMER DÓLAR GASTADO.

---

## Cuándo Usar Este Skill

- Calcular cuánto gasto en ads es necesario para alcanzar una meta de ingresos
- Determinar objetivos CPA viables basándote en márgenes de producto
- Construir un plan de asignación de presupuesto en plataformas y campañas
- Modelar diferentes escenarios de gasto para encontrar el nivel óptimo de inversión

**NO USES** este skill para presupuestos de marketing orgánico, presupuestación general de negocio, o estrategia de creative de ad. Esto es específicamente para calcular presupuestos de publicidad pagada.

---

## Fase 1: Inputs

### Inputs Requeridos

| Input | Qué Preguntar | Default |
|---|---|---|
| **Meta de ingresos** | "¿Cuál es tu meta de ingresos mensual de ads?" | Sin default — debe ser proporcionado |
| **Valor promedio de orden (AOV)** | "¿Cuál es el valor promedio de venta u orden?" | Sin default — debe ser proporcionado |
| **Margen de ganancia** | "¿Cuál es tu margen de ganancia por venta (después de COGS)?" | 60% |
| **Tasa de conversión** | "¿Qué porcentaje de clics de ad se convierten en ventas?" | 2% (promedio de industria) |
| **CPC promedio** | "¿Cuál es tu costo promedio por clic?" | $1.50 (estimado) |
| **Plataformas de ad** | "¿Dónde estás ejecutando ads?" | Meta + Google |

**PUNTO DE CONTROL: No procedas sin meta de ingresos y AOV.**

---

## Fase 2: Cálculos Principales

### Matemáticas del Funnel

```
## Calculadora de Gasto en Ads

### Inputs
- Meta de ingresos mensual: $[X]
- Valor promedio de orden: $[X]
- Margen de ganancia: [X]%
- Tasa de conversión: [X]%
- CPC promedio: $[X]

### Métricas Calculadas

Ventas necesarias = Meta de ingresos / AOV
Ventas necesarias = $[X] / $[X] = [X] ventas/mes

Clics necesarios = Ventas necesarias / Tasa de conversión
Clics necesarios = [X] / [X]% = [X] clics/mes

Gasto en ads necesario = Clics necesarios × CPC promedio
Gasto en ads necesario = [X] × $[X] = $[X]/mes

ROAS objetivo = Meta de ingresos / Gasto en ads
ROAS objetivo = $[X] / $[X] = [X]x

CPA máximo = AOV × Margen de ganancia
CPA máximo = $[X] × [X]% = $[X]

CPA objetivo (conservador) = CPA máximo × 70%
CPA objetivo = $[X] × 70% = $[X]
```

---

## Fase 3: Escenarios de Inversión

### Modelo de Tres Escenarios

```
## Escenarios de Gasto

| Escenario | Gasto Mensual | ROAS Requerido | Ventas Proyectadas | Ingresos Proyectados |
|---|---|---|---|---|
| Conservador | $[X] | [X]x | [X] ventas | $[X] |
| Objetivo | $[X] | [X]x | [X] ventas | $[X] |
| Agresivo | $[X] | [X]x | [X] ventas | $[X] |

Notas:
- Conservador asume CPC 20% más alto y CVR 20% más bajo
- Objetivo usa métricas de input exactas
- Agresivo asume mejoras del 20% en CPC y CVR por optimización
```

---

## Fase 4: Asignación por Plataforma

### Distribución Recomendada de Presupuesto

| Tipo de Campaña | % del Presupuesto | Justificación |
|---|---|---|
| Prospecting (audiencia fría) | 60-70% | Escalar adquisición nueva |
| Retargeting (audiencia caliente) | 20-30% | Mayor CVR, menor CPA |
| Retención / Upsell existentes | 10% | AOV más alto, menor CPA |

### Distribución por Plataforma (si Meta + Google)

| Plataforma | % Recomendado | Mejor Para |
|---|---|---|
| Meta (Facebook/Instagram) | 60-70% | Awareness + conversión, audiencias visuales |
| Google Search | 20-30% | Intención alta, búsqueda activa del producto |
| Google Display/YouTube | 10% | Retargeting, branding visual |

---

## Fase 5: CPA Máximo por Tipo de Producto

### Guardarraíles de CPA

```
## Análisis de CPA

Producto: [Nombre]
AOV: $[X]
Margen bruto: [X]%
Ganancia por venta antes de ads: $[X]

CPA Máximo Absoluto (0% ganancia): $[X]
CPA Máximo Sostenible (20% margen mínimo): $[X]
CPA Objetivo (50% margen conservado): $[X]
CPA Agresivo de Crecimiento (break-even en LTV): $[X]

→ NUNCA exceder CPA Máximo Sostenible en campañas activas.
→ CPA Agresivo solo si tienes LTV validado y estrategia de retención.
```

---

## Anti-Patrones

- **NO** calcular presupuesto sin conocer el margen — gastar sin guardarraíles destruye el negocio
- **NO** asumir CVR de industria sin datos propios después de 30 días — ajustar siempre
- **NO** asignar 100% a prospecting — sin retargeting, se desperdicia tráfico caliente
- **NO** ignorar LTV — algunos CPA parecen altos pero son rentables a largo plazo
- **NO** cambiar presupuesto más de 20% cada 3-4 días — resetea el aprendizaje del algoritmo

---

## Outputs Esperados

Al completar este skill, el usuario tiene:
1. Presupuesto mensual calculado para alcanzar meta de ingresos
2. CPA máximo y objetivo definidos con guardarraíles de margen
3. Tres escenarios de inversión (conservador / objetivo / agresivo)
4. Distribución de presupuesto por plataforma y tipo de campaña
5. Métricas de referencia para monitorear desempeño semanal

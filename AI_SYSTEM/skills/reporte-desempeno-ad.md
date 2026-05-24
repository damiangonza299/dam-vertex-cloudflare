---
name: reporte-desempeno-ad
description: "Crea plantillas de reporte de desempeño de ad con análisis de ROAS, insights de creative, y recomendaciones de optimización. Úsalo cuando necesites reportes estructurados de campañas de ad."
allowed-tools: Read Write Glob
metadata:
  author: Imperio Digital
  version: "1.0"
---

# Reporte de Desempeño de Ad

## Principio Fundamental

CADA MÉTRICA EN EL REPORTE DEBE LLEVAR A UNA ACCIÓN — SI UN NÚMERO NO INFORMA UNA DECISIÓN, REMUÉVELO.

---

## Cuándo Usar

- Crear reporte semanal o mensual de desempeño de ad
- Analizar ROAS, CPA y otras métricas clave de publicidad
- Entregar insights de desempeño de creative y recomendaciones de optimización
- Construir plantilla de reporte reutilizable para campañas continuas

---

## Fase 1: Setup del Reporte

### Inputs Requeridos

| Input | Qué Preguntar | Default |
|---|---|---|
| **Plataformas de ad** | "¿Qué plataformas? (Meta, Google, TikTok, LinkedIn, todas)" | Meta + Google |
| **Período de reporte** | "¿Qué rango de fechas? (semanal, mensual, custom)" | Últimos 30 días |
| **Objetivos de campaña** | "KPI primario? (ROAS, CPA, leads, tráfico)" | ROAS |
| **Gasto total** | "¿Cuál fue el gasto total este período?" | Sin default — debe ser proporcionado |
| **Ingresos o conversiones** | "¿Qué ingresos o conversión resultó?" | Sin default — debe ser proporcionado |
| **Período de comparación** | "¿Comparar contra qué? (período previo, año pasado)" | Período previo |

**PUNTO DE CONTROL: No construir reporte sin datos reales del período — no usar estimaciones.**

---

## Fase 2: Análisis de Métricas

### Métricas Principales

```
## Métricas Principales

| Métrica | Este Período | Período Pasado | Cambio |
|---|---|---|---|
| Gasto Total | $X | $X | +/-X% |
| Ingresos | $X | $X | +/-X% |
| ROAS | X.Xx | X.Xx | +/-X% |
| CPA/CPL | $X | $X | +/-X% |
| Impresiones | X | X | +/-X% |
| Clics | X | X | +/-X% |
| CTR | X.X% | X.X% | +/-X% |
| CPC | $X.XX | $X.XX | +/-X% |
```

### Métricas por Plataforma

```
## Desglose por Plataforma

| Plataforma | Gasto | Ingresos | ROAS | CPA | CTR |
|---|---|---|---|---|---|
| Meta (FB/IG) | $X | $X | X.Xx | $X | X.X% |
| Google Search | $X | $X | X.Xx | $X | X.X% |
| Google Display | $X | $X | X.Xx | $X | X.X% |
| TikTok | $X | $X | X.Xx | $X | X.X% |
| **Total** | **$X** | **$X** | **X.Xx** | **$X** | **X.X%** |
```

---

## Fase 3: Análisis por Campaña

### Framework de Clasificación de Campaña

Clasificar cada campaña activa en una de estas categorías:

| Categoría | Criterio | Acción |
|---|---|---|
| **Escalar** | ROAS > target + volumen sólido | Aumentar presupuesto 20%/semana |
| **Mantener** | ROAS en target, estable | No tocar, monitorear |
| **Optimizar** | ROAS bajo target pero > break-even | Revisar audience, creative, landing |
| **Pausar** | ROAS < break-even por 7+ días | Pausar, analizar causa raíz |

```
## Análisis por Campaña

| Campaña | Gasto | ROAS | CPA | Estado | Acción |
|---|---|---|---|---|---|
| [Nombre Campaña 1] | $X | X.Xx | $X | [Escalar/Mantener/Optimizar/Pausar] | [Acción específica] |
| [Nombre Campaña 2] | $X | X.Xx | $X | [...] | [...] |
```

---

## Fase 4: Análisis de Creative

### Performance de Creative por Campaña

```
## Top Creatives del Período

| Creative | Formato | Impresiones | CTR | CVR | CPA | Estado |
|---|---|---|---|---|---|---|
| [Nombre/ID] | [Imagen/Video] | X | X.X% | X.X% | $X | 🏆 Ganador |
| [Nombre/ID] | [Imagen/Video] | X | X.X% | X.X% | $X | ✓ En uso |
| [Nombre/ID] | [Imagen/Video] | X | X.X% | X.X% | $X | ⚠ Fatiga |
| [Nombre/ID] | [Imagen/Video] | X | X.X% | X.X% | $X | ✗ Pausar |

### Insights de Creative

**Qué funcionó:**
- [Formato / ángulo / hook que tuvo mejor performance]
- [Patrón en los top 3 creatives]

**Qué no funcionó:**
- [Formato o ángulo de bajo rendimiento]
- [Por qué probablemente no funcionó]

**Próximas pruebas recomendadas:**
- [ ] Probar [variación basada en ganador actual]
- [ ] Reemplazar [creative en fatiga] con [nuevo ángulo]
```

---

## Fase 5: Análisis de Audiencia

### Performance por Segmento de Audiencia

```
## Performance de Audiencias

| Audiencia | Tipo | Gasto | ROAS | CPA | Frequency | Acción |
|---|---|---|---|---|---|---|
| [Lookalike 1%] | Frío | $X | X.Xx | $X | X.X | [Acción] |
| [Retargeting 7d] | Caliente | $X | X.Xx | $X | X.X | [Acción] |
| [Intereses] | Frío | $X | X.Xx | $X | X.X | [Acción] |

### Señales de Fatiga de Audiencia

Frequency > 4 en 7 días → Rotar creative o ampliar audiencia
CTR cayendo semana a semana → Señal de saturación
CPM subiendo sin causa externa → Competencia interna o fatiga
```

---

## Fase 6: Diagnóstico del Funnel

### Análisis de Caída por Etapa

```
## Diagnóstico de Funnel

Impresiones: [X]
↓ CTR: [X.X%]
Clics: [X]
↓ CVR Landing (clics → acción): [X.X%]
Acciones (Lead/ATC/IC): [X]
↓ CVR Checkout (ATC → compra): [X.X%]
Compras: [X]
↓ ROAS: [X.Xx]
Ingresos: $[X]

**¿Dónde está la pérdida mayor?**
- CTR bajo → Problema en creative/hook
- Landing CVR bajo → Problema en landing page
- Checkout CVR bajo → Fricción en proceso de compra
- ROAS bajo → Problema en oferta o precio
```

---

## Fase 7: Recomendaciones de Optimización

### Framework de Priorización

```
## Recomendaciones — Período [Fechas]

**Prioridad Alta (hacer esta semana):**
1. [Acción específica] — [Por qué / métrica que lo justifica]
2. [Acción específica] — [Por qué / métrica que lo justifica]

**Prioridad Media (hacer este mes):**
3. [Acción específica] — [Por qué / métrica que lo justifica]
4. [Acción específica] — [Por qué / métrica que lo justifica]

**Prioridad Baja / Experimentar:**
5. [Prueba a considerar] — [Hipótesis]

**No tocar:**
- [Qué está funcionando bien — no interrumpir]
```

---

## Anti-Patrones

- **NO** reportar métricas sin acción asociada — cada número debe informar una decisión
- **NO** incluir vanity metrics que no impactan ROAS (shares, likes) en reporte ejecutivo
- **NO** comparar períodos sin contextar diferencias (estacionalidad, cambios de presupuesto)
- **NO** hacer recomendaciones de pausa basadas en menos de 3-7 días de data
- **NO** reportar solo el total — siempre desglosar por campaña y plataforma
- **NO** omitir análisis de creative — es la palanca más accionable para optimizar

---

## Outputs Esperados

Al completar este skill, el usuario tiene:
1. Dashboard de métricas principales con comparativo período anterior
2. Desglose por plataforma y campaña con clasificación acción
3. Análisis de creative con top performers y próximas pruebas
4. Diagnóstico de funnel con identificación del cuello de botella
5. Recomendaciones priorizadas por impacto (alta/media/baja)
6. Plantilla reutilizable para el siguiente ciclo de reporte

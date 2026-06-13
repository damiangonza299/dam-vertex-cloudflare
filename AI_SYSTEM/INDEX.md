# AI_SYSTEM — Índice Maestro de Conocimiento DAM Vertex

Punto de entrada único para sesiones nuevas. Leer este archivo, luego cargar **solo** lo que la tarea requiera.

---

## Carga Obligatoria al Iniciar

Estos 3 archivos van siempre, sin excepción:

| Archivo | Por qué |
|---|---|
| `core/dam-vertex-core.md` | Contexto del proyecto, mercado Paraguay, prioridades |
| `router/skill-router.md` | Routing de intención → skill correcto, reglas de carga |
| `execution/cloudcode-execution-rules.md` | Deploy, umbrales CAPI, reglas técnicas, anti-patrones |

---

## Carga por Contexto — Solo Si Aplica

Cargar **únicamente** el área relevante a la tarea. No cargar todo el árbol.

### Product Studio — cuando se trabaja en productos nuevos o edición de existentes

```
skills/product-studio.md        ← flujo PS completo, Blueprint V3, InSync, prohibiciones
execution/new-product-checklist.md  ← 11 puntos obligatorios antes de activar
```

### Dam Intelligence — cuando se analizan leads, compradores, scoring o alertas

```
skills/dam-intelligence.md      ← BQE, lead_quality, stale, alertas, endpoints
```

### Meta Ads — cuando se tocan campañas, creatives, performance o ROAS

```
meta-ads/meta-strict-mode.md    ← Strict Mode: 6 reglas + Regla 6 Ampliado
meta-ads/meta-operational-windows.md  ← ventanas horarias, frecuencia
skills/router.md                ← 14 skills de marketing, cuál cargar
```
Activar `META_ANALYSIS_MODE=STRICT` automáticamente.

### Tracking / CAPI — cuando se modifica Pixel, CAPI, eventos o user_data

```
skills/tracking-capi.md         ← auditoría obligatoria antes de tocar cualquier evento
```
**Prohibido tocar Purchase sin auditoría previa.**

### Dam Finanzas / Reportes financieros

```
core/dam-vertex-core.md         ← sección "Separación de responsabilidades"
```
DAM Vertex envía datos. Dam Finanzas calcula. No replicar lógica financiera.

### Stock / Inventario

```
skills/stock-inventory.md       ← productos, variantes, flujo de descuento
```

### WhatsApp / Cierre de ventas

```
skills/whatsapp-closing.md      ← flujo Paraguay, Central vs Interior, reglas de delivery
```

### Landings / CRO

```
skills/pagina-ventas.md         ← estructura de landing, copywriting
skills/insync-cro.md            ← lectura de InSync, decisiones basadas en datos
landing-cro/mobile-first-landing.md
```

### InSync Recommendation Engine — cuando se trabaja en patrones de landing, CAPA A, anotación de principios

```
skills/insync-recommendation-engine.md  ← arquitectura, normalización canónica, escritura segura de landing_intelligence
```
**Cargar siempre antes de tocar `structure-patterns.js`, `landing_intelligence`, `angle_family` o `mechanism_family`.**

---

## Límite Canónico de Carga

```
Máximo 4 archivos grandes por tarea.
Máximo 2–3 skills de marketing por sesión.
Excepción solo en tareas críticas multi-área explícitamente declaradas.
```

---

## Regla de Prioridad — Conflictos entre Archivos

Si dos archivos dan instrucciones contradictorias, usar este orden:

1. **Archivo especializado más reciente** — el más específico al área gana
2. **`execution/cloudcode-execution-rules.md`** — para decisiones de ejecución técnica
3. **`meta-ads/meta-strict-mode.md`** — para decisiones sobre Meta Ads
4. **`GEMINI.md` / `CLAUDE.md`** — solo como referencia general si no hay especializado

---

## Regla de No Carga Total

**No cargar `AI_SYSTEM/` completo por defecto.**

Cada sesión carga solo lo que la tarea necesita.
Carga bajo demanda = contexto limpio = respuestas más precisas.

---

## Árbol de Skills Disponibles

```
AI_SYSTEM/skills/
├── router.md                   ← índice de los 14 skills de marketing
│
├── — Marketing (14 skills) —
├── brief-creative-ad.md
├── calculadora-gasto-ad.md
├── campana-facebook-ads.md
├── copia-ad.md
├── creador-bundles.md
├── estrategia-descuentos.md
├── estrategia-retargeting.md
├── estrategia-venta-cruzada.md
├── guion-ad-podcast.md
├── guion-ad-tiktok.md
├── oferta-tripwire.md
├── pagina-ventas.md
├── plan-audiencia-similar.md
├── reporte-desempeno-ad.md
│
└── — Operacionales DAM Vertex (7 skills) —
    ├── product-studio.md                  ← constructor de productos nuevos
    ├── dam-intelligence.md                ← análisis de leads y compradores
    ├── tracking-capi.md                   ← Pixel + CAPI + auditoría de eventos
    ├── whatsapp-closing.md                ← cierre Paraguay + delivery
    ├── insync-cro.md                      ← datos de comportamiento en landing
    ├── stock-inventory.md                 ← productos, variantes, inventario
    └── insync-recommendation-engine.md    ← patrones de landing, CAPA A/B, normalización
```

---

## Routing Rápido por Intención

| Si el usuario pide... | Cargar |
|---|---|
| Nuevo producto / activar producto | `skills/product-studio.md` + `execution/new-product-checklist.md` |
| Análisis de leads / scoring / alertas | `skills/dam-intelligence.md` |
| Tocar Pixel / CAPI / eventos | `skills/tracking-capi.md` |
| Cierre WhatsApp / delivery | `skills/whatsapp-closing.md` |
| Leer comportamiento en landing | `skills/insync-cro.md` |
| Patrones de landing / CAPA A / anotar principios | `skills/insync-recommendation-engine.md` |
| Stock / inventario | `skills/stock-inventory.md` |
| Campaña Meta / creatives / ROAS | `meta-ads/meta-strict-mode.md` + `skills/router.md` |
| Landing / copy | `skills/pagina-ventas.md` + `skills/insync-cro.md` |
| Deploy | `execution/cloudcode-execution-rules.md` (sección deploy) |

---

*Última actualización: 2026-06-13*

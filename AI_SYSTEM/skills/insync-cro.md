---
name: insync-cro
description: "Skill operacional para lectura e interpretación de datos InSync de comportamiento en landing. Cubre top_sections, scroll_funnel, attention_score, section_views y cómo usar estos datos para mejorar conversión. No tomar decisiones de layout por gusto — siempre basar en datos."
allowed-tools: Read Glob Grep
metadata:
  type: skill
  version: "1.0"
  author: DAM Vertex AI System
---

# InSync CRO — Comportamiento Real en Landing

InSync registra lo que los usuarios realmente hacen en la landing: qué secciones ven, cuánto tiempo atienden, hasta dónde hacen scroll. Estas métricas son la fuente de verdad para decisiones de CRO — no la opinión del equipo ni las métricas de Meta.

---

## Cuándo Usar Este Skill

- Analizar por qué la conversión bajó
- Identificar secciones que se saltean o no se ven
- Priorizar qué mejorar en una landing existente
- Tomar decisiones de layout en Blueprint V3 (Tab Landing de Product Studio)
- Validar si un cambio de landing tuvo impacto en comportamiento

---

## Regla Fundamental

**Ninguna decisión visual o de estructura se toma solo por gusto o criterio estético.**

Toda propuesta de cambio en una landing debe estar respaldada por al menos uno de:
- Datos InSync (section_views, attention_score, scroll_funnel)
- Test A/B con muestra suficiente (mínimo 200 sesiones por variante)
- Framework de copywriting documentado (Eugene Schwartz awareness, Hormozi offer)

---

## Instrumentación — Prerequisito

Para que InSync registre datos, cada sección visible de la landing necesita un `id` único.

```html
<section id="section-hero">...</section>
<section id="section-problema">...</section>
<section id="section-solucion">...</section>
<section id="section-prueba-social">...</section>
<section id="section-oferta">...</section>
<section id="section-faq">...</section>
<section id="section-cierre">...</section>
```

**Convención canónica DAM Vertex:** prefijo `section-` obligatorio.
Fuente de verdad: `AI_SYSTEM/execution/landing-insync-instrumentation.md` y `public/reloj/index.html`.

> `insync.js` usa `document.querySelectorAll('section[id]')` — técnicamente acepta cualquier `id`.
> Pero la convención del sistema es `section-{nombre}`. Las landings `/cepillo/` y `/cadena/`
> usan `id="hero-section"` en el hero — inconsistencia heredada, no una convención alternativa.
> Toda landing nueva debe seguir el prefijo `section-`.

Sin `id`, la sección es invisible para InSync. Sin datos, no hay CRO posible.

Si una landing no está instrumentada: el primer paso es instrumentarla antes de cualquier análisis.

---

## Métricas InSync — Definiciones

### section_views

Cantidad de veces que esa sección entró al viewport del usuario. Una sección que el usuario nunca scrollea hasta ver tiene `section_views = 0`.

**Uso:** Identifica la sección donde se pierde el scroll. Si `seccion_X.section_views` baja bruscamente respecto a la anterior, ahí está el punto de abandono.

### attention_score

Tiempo activo promedio que el usuario pasó con esa sección visible en pantalla. Medido en segundos ponderados (no tiempo real de reloj).

**Uso:** Una sección con alto `section_views` pero bajo `attention_score` se ve pero no se lee. El copy no engancha o el visual no retiene.

### scroll_funnel

Porcentaje de usuarios que llegaron a cada profundidad de la página. Es el funnel del scroll.

```
Ejemplo:
hero          → 100% (todos llegan)
problema      →  78% (22% rebotó antes)
solucion      →  61%
prueba-social →  43%  ← caída significativa aquí
oferta        →  35%
faq           →  28%
```

**Uso:** Si hay una caída > 20% entre dos secciones consecutivas, esa transición es el cuello de botella.

### top_sections

Las N secciones con mayor `attention_score` del período. Indica qué realmente lee y retiene el usuario.

**Uso:** Si `prueba-social` aparece en top_sections pero `oferta` no, el precio o el CTA es el problema — no la prueba social.

---

## Diagnóstico — Cómo Leer los Datos

### Problema: CVR bajo pero tráfico normal

1. Revisar `scroll_funnel` — ¿llega el usuario a la sección de oferta?
2. Si no llega a oferta: el problema está antes — `problema` o `solucion` no convencen
3. Si llega a oferta pero no convierte: el problema es precio, CTA o fricción del WhatsApp

### Problema: Bounce alto (< 30 sec en página)

1. `section_views` del hero es bajo → el hook visual no funciona
2. Tiempo en `hero` es < 3 segundos → headline no detiene el scroll
3. Acción: fortalecer headline y visual del hero antes de cambiar otras secciones

### Problema: Mucha gente llega a FAQ pero no convierte

1. FAQ con alto `attention_score` indica que hay objeciones no resueltas antes
2. Las preguntas reales de WhatsApp deben estar en el FAQ — el usuario busca respuestas que la landing no da

---

## Uso dentro de Product Studio Blueprint

Al generar el Blueprint V3 de una landing nueva (Tab Landing de Product Studio), InSync informa el diseño de las secciones existentes del mismo producto o de productos similares:

1. Leer `top_sections` de la landing más reciente del mismo producto (si existe)
2. Verificar en qué sección se pierde el scroll actualmente
3. Diseñar el nuevo blueprint priorizando las secciones que retienen
4. No reubicar secciones con alto `attention_score` — si algo funciona, no moverlo

Para landings completamente nuevas (primer producto): usar los frameworks de copywriting como base hasta tener datos propios (mínimo 100 sesiones).

---

## Endpoints y Archivos

```
/api/intelligence/alerts            → incluye señales de comportamiento en landing
functions/api/intelligence/         → módulo de análisis
```

Los datos de InSync se almacenan en D1 o KV según el tipo de evento. Para consultar datos crudos usar la interfaz de Admin Panel → Intelligence, o consultar D1 directamente con autorización.

---

## Anti-Patrones

- **NO** cambiar el orden de secciones sin datos que justifiquen el cambio
- **NO** agregar secciones solo porque "quedan bien" — cada sección es fricción adicional
- **NO** eliminar una sección con alto `attention_score` porque "parece redundante"
- **NO** usar InSync de una landing diferente (otro producto) para tomar decisiones — los usuarios son distintos
- **NO** tomar decisiones con menos de 50 sesiones — muestra insuficiente para señal confiable
- **NO** mezclar datos de A/B tests activos con datos normales — contamina el análisis base

---

## Uso al Crear una Landing Nueva — Extracción de Patrones Históricos

Cuando se crea una landing nueva, InSync de landings existentes actúa como referencia de patrones, **no como plantilla**.

### Flujo obligatorio antes de escribir HTML

```
1. Identificar landings del mismo producto o categoría similar
2. Leer InSync de esas landings: top_sections, attention_score, scroll_funnel
3. Clasificar bloques históricos:
   GANADOR  → attention_score alto + retención + bajo abandono posterior
   NEUTRO   → retiene algo pero no cambia intención
   DÉBIL    → caída fuerte después + bajo attention_score
4. Usar bloques ganadores como referencia de FUNCIÓN comercial
5. Adaptar al producto actual — no copiar contenido
6. Recién después escribir el HTML
```

### Qué se extrae de InSync histórico

| Extrae | Descripción |
|---|---|
| Orden de secciones | Qué secuencia retuvo mejor en productos similares |
| Peso de bloques | Qué secciones generaron más intención de compra |
| Dónde colocar precio | En qué posición el precio retuvo mejor |
| Dónde va la confianza | Cuándo mostrar envío, pago al recibir, garantía |
| Dónde va prueba social | Antes o después de la oferta según retención |
| Secciones a evitar | Bloques con caída consistente de retención |

### Qué NO se copia entre landings

- Colores, paleta, fondo
- Imágenes o productos anteriores
- Nombres de variantes
- Testimonios ni copy literal
- Diseño exacto si el producto tiene otro contexto visual

### Regla de priorización: Brief vs InSync

- **Brief manda** sobre: nombre, precio, specs, variantes, material, oferta, restricciones técnicas
- **InSync manda** sobre: orden de secciones, peso de bloques, ubicación de precio/confianza/prueba social
- Si InSync sugiere un ángulo diferente al brief (ej: "regalo" retuvo más que "uso personal"):
  proponer ese ángulo como principal, mantener el del brief como secundario, explicar brevemente

### Cuando no hay datos InSync propios

- Si el producto es nuevo (< 50 sesiones): usar frameworks de copywriting como base
- Referenciar landings del mismo producto (si existe histórico) o categoría más cercana
- No forzar un patrón de InSync de otra categoría — priorizar lógica comercial del brief
- Documentar que la decisión fue por framework, no por dato real

# REGLA PERMANENTE — Instrumentación InSync en Landings

## Activación

Obligatoria en TODA landing nueva y TODA modificación de estructura de secciones.

---

## Estándar completo — Triple atributo por sección

La referencia canónica es `/reloj-imperial-verde/index.html`.

Toda sección visible debe tener los tres atributos en el tag `<section>`:

```html
<section id="section-{nombre}" data-insync-section="{nombre}">
```

Y todo CTA principal dentro de esa sección:

```html
<button data-scroll-form data-insync-cta="{nombre}">CTA text</button>
```

donde `{nombre}` es **el mismo valor** en los tres atributos.

### Ejemplo completo

```html
<section id="section-hero" data-insync-section="hero">
  ...contenido...
  <button data-scroll-form data-insync-cta="hero">Elegir mi modelo →</button>
</section>

<section id="section-beneficios" data-insync-section="beneficios">
  ...contenido...
  <button data-scroll-form data-insync-cta="beneficios">Quiero el mío →</button>
</section>

<section id="section-faq" data-insync-section="faq">
  ...contenido...
</section>

<section id="section-cierre" data-insync-section="cierre">
  <button data-scroll-form data-insync-cta="cierre">Pedí al WhatsApp →</button>
</section>
```

### CTAs fuera de sección (excepciones permitidas)

```html
<!-- Barra de navegación — cta fuera de sección de contenido -->
<a data-scroll-form data-insync-cta="nav">Quiero este reloj</a>

<!-- Sticky bar — cta flotante global -->
<button data-scroll-form data-insync-cta="sticky">Pedí al WhatsApp →</button>
```

`nav` y `sticky` son los únicos valores permitidos que no corresponden a una sección específica.

---

## Por qué son obligatorios los tres atributos

### 1. `id="section-{nombre}"`

InSync observa via IntersectionObserver:

```javascript
document.querySelectorAll('section[id], [data-insync-section]').forEach(el => io.observe(el));
```

Sin `id`, la sección no es observada. No se registran `section_view` ni `section_time`.

### 2. `data-insync-section="{nombre}"`

Cuando el observador dispara, el nombre de sección registrado en `behavior_events.section` es:

```javascript
var name = el.dataset.insyncSection || el.id || null;
```

- Con `data-insync-section="hero"` → `behavior_events.section = "hero"` ✅
- Sin `data-insync-section`, solo `id="section-hero"` → `behavior_events.section = "section-hero"` 

En el segundo caso, `normalizeSection("section-hero")` lo convierte a `"hero"` — técnicamente funciona, pero el valor raw en la DB es inconsistente. El atributo explícito es la única forma de garantizar el nombre correcto desde el origen.

### 3. `data-insync-cta="{nombre}"` debe coincidir con el nombre de la sección

El Structure Engine (CAPA A) hace CTA enrichment buscando secciones por nombre de cta_type:

```javascript
const name = normalizeSection(r.cta_type || '');  // usa cta_type del evento
if (!name || !sectionData[name]) return;           // ignora si no existe esa sección
sectionData[name].ctaClicks += r.clicks;
```

**Si `data-insync-cta="oferta"` y no existe sección llamada "oferta" → cta_rate = 0 para todas las secciones.**

La regla es: `data-insync-cta` debe tener el mismo valor que `data-insync-section` de la sección que lo contiene. Esto es lo que cierra el loop CTA → sección en el análisis.

---

## Nombres de sección — convención

Prefijo `section-` en el `id`. Nombre descriptivo sin prefijo en `data-insync-section` y `data-insync-cta`.

```
id="section-hero"             → data-insync-section="hero"
id="section-transformacion"   → data-insync-section="transformacion"
id="section-producto"         → data-insync-section="producto"
id="section-beneficios"       → data-insync-section="beneficios"
id="section-testimonios"      → data-insync-section="testimonios"
id="section-modelos"          → data-insync-section="modelos"
id="section-combo"            → data-insync-section="combo"
id="section-faq"              → data-insync-section="faq"
id="section-cierre"           → data-insync-section="cierre"
```

Nombres deben ser en español, cortos, sin espacios, sin prefijo "section-".

---

## Checklist — verificación antes de deploy

- [ ] Cada sección visible tiene `id="section-{nombre}"`
- [ ] Cada sección visible tiene `data-insync-section="{nombre}"`
- [ ] Ambos atributos usan el mismo `{nombre}`
- [ ] Cada CTA principal dentro de una sección tiene `data-insync-cta="{nombre}"` donde `{nombre}` = sección que lo contiene
- [ ] CTAs fuera de sección usan solo `"nav"` o `"sticky"`
- [ ] Ningún `<section>` sin `id` (excepto `display:none`)
- [ ] Ningún `data-insync-cta` con valor genérico como `"oferta"` que no matchee ninguna sección

---

## Secciones estándar por Blueprint V3

Verificar que cada sección relevante está instrumentada:

- [ ] Hero — `id="section-hero"` / `data-insync-section="hero"`
- [ ] Problema o Transformación — `id="section-{nombre}"` / `data-insync-section="{nombre}"`
- [ ] Producto / Mecanismo — si existe
- [ ] Beneficios — si existe
- [ ] Prueba social / Testimonios — si existe
- [ ] Modelos / Variantes — si existe
- [ ] Combo — si existe
- [ ] FAQ — `id="section-faq"` / `data-insync-section="faq"`
- [ ] Cierre — `id="section-cierre"` / `data-insync-section="cierre"`

---

## PROHIBIDO

```html
<!-- Incorrecto: falta data-insync-section -->
<section id="section-beneficios">
  <button data-insync-cta="oferta">...</button>
</section>

<!-- Incorrecto: data-insync-cta no matchea sección -->
<section id="section-beneficios" data-insync-section="beneficios">
  <button data-insync-cta="oferta">...</button>   ← "oferta" no existe como sección
</section>

<!-- Incorrecto: sección sin id ni data-insync-section -->
<section class="faq">
  ...
</section>
```

---

## Orden en el flujo de creación

Cuando se crea una nueva landing:

1. Crear estructura visual
2. Crear modales
3. Crear tracking (Pixel + CAPI via tracking.js)
4. Crear integración de stock
5. Crear integración de leads
6. Crear integración de DAM Finanzas
7. **Verificar triple atributo en todas las secciones ← este paso**
8. Verificar compatibilidad con InSync
9. Correr PRODUCT_COMPLETION_CHECKLIST completo

La landing no se considera terminada hasta completar los 9 pasos.

---

## Antecedente

Esta regla se estableció el 2026-06-05 después de descubrir que en `/reloj/` solo 1 de 7 secciones tenía ID, y en `/cadena/` solo 2 de 9. El 85% del contenido era invisible para InSync. Se corrigió en R1 y se volvió regla permanente.

El requisito de `data-insync-section` y la convención de `data-insync-cta = nombre de sección` se establecieron el 2026-06-13 al descubrir que el CTA enrichment del Structure Engine (CAPA A) requiere que `cta_type` coincida exactamente con el nombre de la sección contenedora. La referencia canónica es `/reloj-imperial-verde/index.html`.

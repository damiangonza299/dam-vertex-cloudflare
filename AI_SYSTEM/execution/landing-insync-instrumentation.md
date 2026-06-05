# REGLA PERMANENTE — Instrumentación InSync en Landings

## Activación

Obligatoria en TODA landing nueva y TODA modificación de estructura de secciones.

---

## Regla

Toda sección visual importante debe tener un `id` único antes del primer deploy.

**Sin ID → InSync no puede medir esa sección.**

```html
<section id="section-hero">
<section id="section-beneficios">
<section id="section-comparacion">
<section id="section-prueba-social">
<section id="section-modelos">
<section id="section-combo">
<section id="section-faq">
<section id="section-cierre">
```

IDs deben describir la sección. No usar IDs genéricos (`section-1`, `block-a`).

---

## Por qué es obligatorio

InSync usa:

```javascript
document.querySelectorAll('section[id], [data-insync-section]')
```

para registrar `section_view` y `section_time` mediante IntersectionObserver (threshold 0.3).

CTA attribution también requiere el ID:

```javascript
btn.closest('section[id]') ? btn.closest('section[id]').id : null
```

Si una sección no tiene ID:
- No se registra `section_view`
- No se registra `section_time` (permanencia)
- CTAs de esa sección aparecen con `section: null` en behavior_events
- Análisis CRO de esa sección es imposible

---

## Checklist — Secciones obligatorias en nueva landing

Verificar que cada sección relevante tiene ID antes de hacer deploy:

- [ ] Hero — `id="section-hero"`
- [ ] Beneficios — `id="section-beneficios"` (si existe)
- [ ] Comparación — `id="section-comparacion"` (si existe)
- [ ] Prueba social / testimonios — `id="section-social-proof"` (si existe)
- [ ] Modelos / variantes — `id="section-modelos"` (si existe)
- [ ] Combo — `id="section-combo"` (si existe)
- [ ] Materiales / construcción — `id="section-materiales"` (si existe)
- [ ] Stock — `id="section-stock"` (si existe)
- [ ] FAQ — `id="section-faq"`
- [ ] Cierre / CTA final — `id="section-cierre"`

Secciones ocultas (`display:none`) no requieren ID — IntersectionObserver no las detecta.

---

## PROHIBIDO

No entregar una landing nueva con secciones así:

```html
<section class="beneficios">
<section class="faq">
<section class="cierre">
```

sin `id`. Toda sección principal debe quedar identificada.

---

## Orden en el flujo de creación

Cuando se cree una nueva landing:

1. Crear estructura visual
2. Crear modales
3. Crear tracking (Pixel + CAPI)
4. Crear integración de stock
5. Crear integración de leads
6. Crear integración de DAM Finanzas
7. **Verificar IDs en todas las secciones ← este paso**
8. Verificar compatibilidad con InSync

La landing no se considera terminada hasta completar los 8 pasos.

---

## Filosofía

No construir páginas que solo vendan.

Construir páginas que además permitan medir exactamente por qué venden:
- ¿Qué sección genera más atención?
- ¿Dónde abandona la gente?
- ¿Qué sección aumenta la intención de compra?
- ¿Qué sección es ignorada?
- ¿Qué contenido debe eliminarse?
- ¿Qué contenido debe ampliarse?

---

## Antecedente

Esta regla se estableció el 2026-06-05 después de descubrir que en `/reloj/` solo 1 de 7 secciones tenía ID, y en `/cadena/` solo 2 de 9. El 85% del contenido era invisible para InSync. Se corrigió en R1 y se volvió regla permanente.

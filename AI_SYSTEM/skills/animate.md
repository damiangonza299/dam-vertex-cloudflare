---
name: animate
description: "Animaciones CSS y microinteracciones para landings DAM Vertex. Fade-in on scroll, hover effects, transiciones. Sin JS pesado — solo CSS transitions y IntersectionObserver mínimo."
allowed-tools: Read Write Edit Glob Grep
metadata:
  type: skill
  version: "1.0"
  author: DAM Vertex AI System
---

# Animate — Microinteracciones y Scroll Effects

## Cuándo usar este skill

Al generar o mejorar landings. Las animaciones deben ser sutiles, mobile-friendly y no interferir con el tracking. Aplicar junto a `frontend-design.md`.

---

## Principios

1. **Propósito** — animar solo para guiar atención o confirmar interacción. No decorar.
2. **Sutileza** — duración < 400ms para hover, < 700ms para scroll fade-in.
3. **Performance** — usar solo `opacity` + `transform`. Nunca animar `width`, `height`, `top`, `left` — causan reflow.
4. **Accesibilidad** — respetar `prefers-reduced-motion`.
5. **No JS pesado** — solo CSS transitions + IntersectionObserver mínimo cuando sea necesario.

---

## Scroll fade-in (obligatorio en secciones below-fold)

### Implementación estándar

```css
/* Agregar al <style> de la landing */

/* Guard: solo si JS está disponible */
.js-anim section .section__inner,
.js-anim .animable {
  opacity: 0;
  transform: translateY(22px);
  transition: opacity .65s ease, transform .65s ease;
}

.js-anim section.is-visible .section__inner,
.js-anim .animable.is-visible {
  opacity: 1;
  transform: translateY(0);
}

/* Stagger para grids */
.js-anim section.is-visible .grid-item:nth-child(1) { transition-delay: .05s; }
.js-anim section.is-visible .grid-item:nth-child(2) { transition-delay: .15s; }
.js-anim section.is-visible .grid-item:nth-child(3) { transition-delay: .25s; }
.js-anim section.is-visible .grid-item:nth-child(4) { transition-delay: .35s; }

/* Respetar preferencias de accesibilidad */
@media (prefers-reduced-motion: reduce) {
  .js-anim section .section__inner,
  .js-anim .animable { opacity: 1; transform: none; transition: none; }
}
```

```javascript
/* Script mínimo al final del body */
document.documentElement.classList.add('js-anim');
document.addEventListener('DOMContentLoaded', function() {
  if (!('IntersectionObserver' in window)) return;
  var obs = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (e.isIntersecting) { e.target.classList.add('is-visible'); obs.unobserve(e.target); }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('section[id]').forEach(function(el) {
    if (el.id !== 'section-hero') obs.observe(el); // no animar hero
  });
});
```

### Regla crítica: NO animar el hero

El hero está above-fold. Animarlo causa un flash de contenido invisible que daña la experiencia. Solo animar secciones **below-fold**.

---

## Hover microinteracciones

### Cards (grid de beneficios, prueba social, materiales)

```css
.card-item {
  transition: transform .22s ease, background .22s ease;
}
.card-item:hover {
  transform: translateY(-3px);
  background: rgba(255,255,255,.03); /* Sobre negro */
}
```

### Imágenes de galería (grid de estilos)

```css
.gallery-item { overflow: hidden; }
.gallery-item__img { transition: transform .38s ease; }
.gallery-item:hover .gallery-item__img { transform: scale(1.04); }
```

### Botones primarios

```css
.btn-primary {
  transition: opacity .18s, transform .18s;
}
.btn-primary:hover {
  opacity: .88;
  transform: translateY(-1px);
}
.btn-primary:active {
  transform: translateY(0);
  opacity: 1;
}
```

### Links secundarios

```css
.btn-secondary { transition: border-color .18s, color .18s; }
.btn-secondary:hover { border-color: rgba(255,255,255,.35); color: #fff; }
```

---

## Animaciones de estado

### Dot de disponibilidad (pulsante)

```css
.status-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: rgba(255,255,255,.45);
  animation: pulse-status 2s ease-in-out infinite;
}
@keyframes pulse-status {
  0%, 100% { opacity: 1; }
  50% { opacity: .25; }
}
```

### Spinner de carga (submit button)

```css
.spinner {
  width: 16px; height: 16px;
  border: 2px solid rgba(255,255,255,.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin .7s linear infinite;
  display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }
```

### Modal open/close

```css
.modal-overlay {
  opacity: 0;
  pointer-events: none;
  transition: opacity .2s ease;
}
.modal-overlay.active {
  opacity: 1;
  pointer-events: auto;
}
.modal-box {
  transform: translateY(20px);
  transition: transform .25s cubic-bezier(.4,0,.2,1);
}
.modal-overlay.active .modal-box {
  transform: translateY(0);
}
```

---

## Sticky CTA — slide-up

```css
.sticky-cta {
  transform: translateY(100%);
  transition: transform .3s cubic-bezier(.4,0,.2,1);
}
.sticky-cta.visible { transform: translateY(0); }
```

```javascript
/* Aparece cuando el hero sale del viewport */
var obs = new IntersectionObserver(
  ([entry]) => stickyCta.classList.toggle('visible', !entry.isIntersecting),
  { threshold: 0 }
);
obs.observe(heroSection);
```

---

## Lo que NO hacer

- NO animar `width`, `height`, `top`, `left`, `margin` — causan layout reflow
- NO usar `animation-duration > 1s` — se siente lento
- NO animar más de 3 propiedades simultáneamente
- NO usar `jQuery.animate()` — obsoleto
- NO poner IntersectionObserver en scroll handler — usar el API directamente
- NO animar elementos ocultos con `display:none` (cambia a `visibility:hidden` si necesitás animar)

---

## Integración con Lighthouse Standards

Este skill opera junto a `lighthouse-geo-standards.md`.
Toda decisión de diseño debe respetar:
- Imágenes en WebP con dimensiones declaradas
- Animaciones con `prefers-reduced-motion`
- Contraste mínimo 4.5:1 para texto normal
- No usar `document.write` ni scripts síncronos
- Scripts de terceros (Maps, analytics, widgets) NUNCA en el critical path. Usar lazy injection on user interaction. Ver patrones en: `AI_SYSTEM/skills/lighthouse-geo-standards.md` sección **Errores Críticos Confirmados en Producción**.

Ver checklist completo en: `AI_SYSTEM/skills/lighthouse-geo-standards.md`

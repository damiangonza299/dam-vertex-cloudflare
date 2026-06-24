---
name: frontend-design
description: "Principios de diseño frontend moderno y responsive para landings de alta conversión en DAM Vertex. Cubre grid, tipografía, espaciado, jerarquía visual y performance."
allowed-tools: Read Write Edit Glob Grep
metadata:
  type: skill
  version: "1.0"
  author: DAM Vertex AI System
---

# Frontend Design — Principios para Landings de Alta Conversión

## Cuándo usar este skill

Antes de generar o modificar cualquier archivo HTML de landing. Aplicar junto a `ui-ux-pro-max.md`, `animate.md` y `web-design-guidelines.md`.

---

## Grid y Layout

### Mobile-first siempre

```css
/* Base: mobile */
.section__inner { display: flex; flex-direction: column; gap: 24px; padding: 48px 20px; }

/* Tablet+ */
@media (min-width: 700px) { .section__inner { gap: 48px; padding: 64px 40px; } }

/* Desktop */
@media (min-width: 1100px) { .section__inner { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; padding: 80px 64px; } }
```

### Reglas de grid

- Columnas máximas: 2 para hero/split, 3 para grids de cards
- `max-width` en contenedores: 1100px para split, 900px para grids de cards, 680px para texto centrado
- Gap entre columnas: 48px mobile mínimo → 64px desktop
- Nunca grids de 4 columnas en landings de conversión — fragmentan atención

---

## Tipografía

### Jerarquía obligatoria

```css
/* H1 hero: */
font-size: clamp(30px, 5.5vw, 54px);
font-weight: 800;
line-height: 1.08;
letter-spacing: -0.02em;

/* H2 secciones: */
font-size: clamp(22px, 4vw, 36px);
font-weight: 800;
line-height: 1.13;
letter-spacing: -0.01em;

/* Body copy: */
font-size: clamp(14px, 1.8vw, 16px);
line-height: 1.7;

/* Labels / overlines: */
font-size: 10px;
font-weight: 600;
letter-spacing: 0.22em;
text-transform: uppercase;
```

### Reglas

- Headline siempre `font-weight: 800`, nunca 700
- Subheadline: opacidad reducida (0.52 sobre negro, 0.65 sobre blanco)
- Usar `clamp()` en todos los font-size — nunca valores fijos para headings
- No más de 3 niveles tipográficos por sección (overline, h, body)

---

## Espaciado

### Sistema de spacing

| Token | Valor | Uso |
|---|---|---|
| XS | 8px | Gap entre badges, items inline |
| S | 16px | Padding interno de cards |
| M | 24px | Gap entre elementos relacionados |
| L | 40px | Separación entre secciones en mobile |
| XL | 64px | Separación entre secciones en desktop |
| XXL | 80–100px | Hero padding-top |

### Padding de sección (obligatorio)

```css
padding: clamp(48px, 9vw, 80px) clamp(20px, 5vw, 64px);
```

Nunca valores fijos de padding en secciones — usan clamp para adaptarse al viewport.

---

## Performance

- Imágenes hero: `loading="eager"` + `fetchpriority="high"` + preload link en head
- Imágenes below-fold: `loading="lazy"` obligatorio
- Scripts externos: siempre `defer` — nunca bloquear render
- CSS crítico: inline en `<style>` en el `<head>`
- Google Fonts: usar font-display: swap

---

## Reglas de contraste

- Texto sobre negro: opacidad mínima 0.45 para texto secundario, 0.28 para overlines
- Texto sobre blanco: nunca 100% negro — usar `#111` o `#0a0a0a`
- Botones primarios: contraste mínimo 4.5:1 (WCAG AA)
- Nunca texto gris sobre fondo gris

---

## Anti-patrones

- NO usar `!important` — refactorizar la especificidad
- NO margins negativos para layout — usar gap / grid
- NO heights fijos en contenedores de texto
- NO `overflow: hidden` sin `border-radius` visible
- NO usar `px` para font-size en body (usar `rem` o `clamp`)

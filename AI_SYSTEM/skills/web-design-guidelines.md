---
name: web-design-guidelines
description: "Guidelines de consistencia visual para el ecosistema DAM Vertex. Paleta, tokens, jerarquía de marca, coherencia entre landings. Basado en luna-mini y reloj-imperial-verde como referencias."
allowed-tools: Read Write Edit Glob Grep
metadata:
  type: skill
  version: "1.0"
  author: DAM Vertex AI System
---

# Web Design Guidelines — Consistencia Visual DAM Vertex

## Cuándo usar este skill

Al crear una nueva landing o revisar una existente. Garantiza coherencia entre todas las landings del ecosistema. Aplicar junto a `frontend-design.md` y `ui-ux-pro-max.md`.

---

## Sistema de temas (theming)

Cada landing tiene su propio tema visual. El tema se aplica con `class="theme-{producto}"` en el `<body>`.

### Estructura de tema

```html
<body class="theme-{producto}">
```

```css
/* Override de variables globales para el tema */
.theme-{producto} {
  --accent: #color-principal;        /* Color de acento del producto */
}

/* Override de componentes específicos del tema */
.theme-{producto} .btn-primary {
  background: var(--accent);
  color: #000; /* o #fff según contraste */
}

.theme-{producto} .offer-badge {
  background: rgba(var(--accent-rgb), .12);
  border-color: rgba(var(--accent-rgb), .3);
  color: var(--accent);
}
```

### Temas existentes (referencias)

| Producto | Clase | Color de acento | Fondo |
|---|---|---|---|
| Reloj | `theme-reloj` | `#9ca3af` (plata) | `#000` (negro) |
| Luna Mini | `theme-luna` | `#E91E63` (rosa) | `#0d0d0d` |
| Reloj Imperial Verde | `theme-reloj-iv` | `#6ee7b7` (verde) | `#000` |
| Cadena Apex | `theme-cadena` | `#9ca3af` (plata/negro) | `#000` |

---

## Variables globales del sistema (styles.css)

```css
:root {
  --green:    #4ade80;   /* Confirmación, éxito */
  --red:      #f87171;   /* Error, stock agotado */
  --muted:    rgba(255,255,255,.45);  /* Texto secundario sobre negro */
  --border:   rgba(255,255,255,.08); /* Bordes sutiles */
}
```

Nunca hardcodear `#4ade80` o `#f87171` directamente — usar las variables.

---

## Paleta por tipo de landing

### Landings oscuras (masculino, premium)

- Fondo: `#000` o `#050505`
- Secciones alternadas: `#080808`, `#060606`
- Separadores: `border-top: 1px solid rgba(255,255,255,.05)`
- Texto: `#fff` para headings, `rgba(255,255,255,.52)` para body
- Overlines: `rgba(255,255,255,.28)`

### Landings claras (femenino, accesible)

- Fondo: `#fff` o `#fafafa`
- Secciones alternadas: `#f5f5f5`, `#f0f0f0`
- Separadores: `border-top: 1px solid rgba(0,0,0,.06)`
- Texto: `#111` para headings, `#555` para body
- Overlines: `#888`

---

## Componentes estándar (no customizar sin razón)

### Offer bar (top de página)

Fondo blanco, texto negro, íconos SVG. Consistente en todas las landings.

```html
<div class="offer-bar">
  <span>Entrega en Central</span>
  <span class="ob-sep">|</span>
  <span>Pago al recibir</span>
  <span class="ob-sep">|</span>
  <span>Envío gratis</span>
</div>
```

### Logistics strip

Debajo del hero, siempre. Muestra pasos de despacho con estado activo.

### Nav

Logo DAM VERTEX + botón CTA. Sin cambiar la estructura del nav entre landings.

### Footer

`© {año} Dam Vertex` — igual en todas las landings.

---

## Badges y labels de oferta

### Offer badges en modal

```html
<div class="offer-badge">🔥 Más elegido</div>
<div class="offer-badge offer-badge--best">⭐ Mayor ahorro</div>
```

Los badges usan colores del `styles.css` global — solo override si el tema lo requiere explícitamente.

### Delivery badges

```html
<span class="db-badge db-green">🚚 Entrega en el día</span>
<span class="db-badge db-green">✓ Envío gratis</span>
<span class="db-badge">💳 Pago al recibir · Central</span>
```

---

## Tipografía del sistema

El sistema usa la fuente del sistema con prioridad a Inter/SF/Helvetica (via `font-family: -apple-system, BlinkMacSystemFont, 'Inter', ...` en styles.css). No importar fuentes externas por landing individual.

---

## Consistencia de secciones entre landings

Aunque cada landing tiene contenido único, las secciones siguen patrones consistentes:

| Sección | Patrón visual | Fondo |
|---|---|---|
| Hero | Split 2 cols (desktop) / stacked (mobile) | Base del tema |
| Sección split A | Imagen izquierda / texto derecha | Variación +5% |
| Sección split B | Texto izquierda / imagen derecha | Base |
| Grid cards | 3 columnas | Variación +3% |
| Social proof | 3 tarjetas | Variación +5% |
| FAQ | Acordeón | Base |
| Cierre | Centrado | Variación +2% |

---

## Reglas de identidad visual por producto

Cada landing nueva parte del producto, no de la landing anterior:

1. **Color** — Material del producto → paleta base
2. **Tono** — Percepción deseada (premium/casual/masculino/funcional) → densidad visual
3. **Precio** — Posiciona el nivel de sofisticación visual
4. **No copiar** otro look de landing a menos que el producto lo justifique

---

## Checklist visual antes de deploy

- [ ] `body class="theme-{producto}"` está definido
- [ ] `--accent` está overrideado con el color del producto
- [ ] `.btn-primary` tiene el color de acento del tema
- [ ] Badges de combo usan el color de acento (no genérico)
- [ ] Secciones tienen fondos alternados sutilmente (no todas iguales)
- [ ] Offer bar presente y consistente con otras landings
- [ ] Footer idéntico a las demás landings
- [ ] No hay fuentes externas importadas por esta landing
- [ ] Todos los colores hardcodeados son solo para este tema (ninguno global roto)

---
name: lighthouse-geo-standards
description: "Estándares obligatorios de Performance, Accessibility, Best Practices y SEO (Lighthouse 90+) y GEO (Generative Engine Optimization) para todas las landings DAM Vertex. Aplicar en toda landing nueva y en cualquier cambio de HTML."
allowed-tools: Read Write Edit Glob Grep Bash
metadata:
  type: skill
  version: "1.0"
  author: DAM Vertex AI System
---

# Lighthouse & GEO Standards — Estándar Obligatorio

## Objetivo
Toda landing del sistema debe alcanzar y mantener:
- Performance: 90+
- Accessibility: 90+
- Best Practices: 96+
- SEO: 100
- GEO (Generative Engine Optimization): apto para IA

## REGLAS DE IMÁGENES (obligatorias siempre)
- Formato: WebP únicamente. Nunca PNG ni JPG en producción.
- Hero image: máximo 700px ancho, calidad 82, fetchpriority="high", loading="eager"
- Imágenes de sección: máximo 600px ancho, loading="lazy"
- Siempre declarar width y height exactos en el <img>
- Nunca usar imágenes de CDN externo (Shopify, etc.) — siempre /assets/img/ local
- Reducción esperada: PNG 1.5MB → WebP ~30-70KB (95%+ reducción)
- Si una imagen no está disponible aún: usar placeholder WebP de 1px transparente
  con comentario <!-- IMG_PENDIENTE: descripción -->
  NO dejar slots vacíos ni src rotos

## REGLAS DE SCRIPTS (obligatorias siempre)
- tracking.js: siempre con defer
- Nunca document.write para inyectar scripts
- Usar createElement('script') + async para scripts de terceros
- Scripts propios: siempre al final del body con defer
- Versión actualizada en query string: ?v=XX

## REGLAS DE HTML SEMÁNTICO (obligatorias siempre)
- Viewport: <meta name="viewport" content="width=device-width, initial-scale=1.0">
  NUNCA user-scalable=no ni maximum-scale=1
- Siempre incluir <main> envolviendo el contenido principal
- Todas las imágenes deben tener alt descriptivo
- Estructura semántica: <header>, <main>, <section>, <footer>
- Un solo <h1> por página
- Jerarquía de headings: h1 → h2 → h3 (nunca saltar niveles)

## REGLAS SEO (obligatorias siempre)
- <title> único y descriptivo por página (50-60 caracteres)
- <meta name="description"> único (150-160 caracteres)
- <meta property="og:*"> completo para redes sociales
- <link rel="canonical"> en cada landing
- Structured data (JSON-LD): Product schema en landings de producto

## REGLAS GEO — Generative Engine Optimization
Para que ChatGPT, Perplexity y Google AI Overview puedan
indexar y citar el contenido:
- JSON-LD con schema.org/Product en cada landing
- FAQPage schema en la sección FAQ
- Contenido semántico claro: el H1 debe describir el producto
- Párrafos con respuestas directas a preguntas frecuentes
- Nombre de marca + producto en title, h1 y primer párrafo

## REGLAS DE PERFORMANCE
- LCP objetivo: < 2.5 segundos
- TBT objetivo: < 200 ms
- CLS objetivo: 0
- FCP objetivo: < 1.5 segundos
- Cache-Control en APIs: s-maxage=300, stale-while-revalidate=60

## CHECKLIST ANTES DE CUALQUIER DEPLOY
- [ ] Todas las imágenes en WebP con dimensiones declaradas
- [ ] Ningún document.write en el HTML
- [ ] viewport sin user-scalable=no
- [ ] <main> presente
- [ ] <title> y <meta description> únicos
- [ ] JSON-LD Product schema presente
- [ ] FAQPage schema en sección FAQ
- [ ] tracking.js con defer y versión actualizada
- [ ] Lighthouse score verificado: 90+ en todas las categorías

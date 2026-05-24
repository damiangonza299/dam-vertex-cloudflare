---
generated: 2026-05-24
version: "1.0"
status: CLEAN
---

# SKILL AUDIT — AI_SYSTEM/skills/

## Resumen Ejecutivo

| Total skills | Completas | Parciales | Eliminadas | Duplicados |
|---|---|---|---|---|
| 14 | 14 | 0 | 0 | 0 |

**Estado: SISTEMA LIMPIO — todos los skills son completos y operativos.**

---

## Inventario Detallado

| # | Archivo | Nombre | Estado | Categoría | Calidad | Prioridad |
|---|---|---|---|---|---|---|
| 1 | `brief-creative-ad.md` | Brief Creative Ad | COMPLETA | ads + copywriting | Alta | CRÍTICA |
| 2 | `calculadora-gasto-ad.md` | Calculadora Gasto Ad | COMPLETA | ads + finanzas | Alta | MEDIA |
| 3 | `campana-facebook-ads.md` | Campaña Facebook Ads | COMPLETA | meta-ads + strategy | Alta | CRÍTICA |
| 4 | `copia-ad.md` | Copia de Ad | COMPLETA | copywriting + ads | Alta | CRÍTICA |
| 5 | `creador-bundles.md` | Creador Bundles | COMPLETA | ecommerce + AOV | Alta | CRÍTICA |
| 6 | `estrategia-descuentos.md` | Estrategia Descuentos | COMPLETA | pricing + promos | Alta | MEDIA |
| 7 | `estrategia-retargeting.md` | Estrategia Retargeting | COMPLETA | meta-ads + funnel | Alta | CRÍTICA |
| 8 | `estrategia-venta-cruzada.md` | Estrategia Venta Cruzada | COMPLETA | ecommerce + retention | Alta | ALTA |
| 9 | `guion-ad-podcast.md` | Guión Ad Podcast | COMPLETA | audio + copywriting | Alta | BAJA |
| 10 | `guion-ad-tiktok.md` | Guión Ad TikTok | COMPLETA | video + social | Alta | ALTA |
| 11 | `oferta-tripwire.md` | Oferta Tripwire | COMPLETA | funnels + pricing | Alta | ALTA |
| 12 | `pagina-ventas.md` | Página de Ventas | COMPLETA | CRO + copywriting | Alta | CRÍTICA |
| 13 | `plan-audiencia-similar.md` | Plan Audiencia Similar | COMPLETA | meta-ads + targeting | Alta | ALTA |
| 14 | `reporte-desempeno-ad.md` | Reporte Desempeño Ad | COMPLETA | analytics + reporting | Alta | CRÍTICA |

---

## Skills Prioritarias (CRÍTICAS — núcleo DAM Vertex)

1. `brief-creative-ad` — producción de creatives para Meta Ads
2. `copia-ad` — copy para Facebook/Instagram/Google
3. `campana-facebook-ads` — arquitectura de campaña Meta completa
4. `reporte-desempeno-ad` — análisis ROAS + D1 + tasa de cierre
5. `creador-bundles` — aumentar AOV en funnel WhatsApp
6. `estrategia-retargeting` — recuperar leads que no compraron
7. `pagina-ventas` — landing conversion optimizada

---

## Conexiones Entre Skills

```
brief-creative-ad ←→ copia-ad ←→ campana-facebook-ads
       ↓                               ↓
guion-ad-tiktok              estrategia-retargeting
       ↓                               ↓
reporte-desempeno-ad ←→ plan-audiencia-similar
       ↓
calculadora-gasto-ad

pagina-ventas ←→ oferta-tripwire ←→ creador-bundles
       ↓                               ↓
estrategia-descuentos    estrategia-venta-cruzada
```

---

## Compatibilidad DAM Vertex

**Funnel soportado:** Meta Ads → Landing → WhatsApp → Pending → Delivery → Purchased Manual

| Etapa del Funnel | Skills Aplicables |
|---|---|
| Meta Ads (tráfico) | `campana-facebook-ads`, `copia-ad`, `brief-creative-ad`, `guion-ad-tiktok` |
| Landing (conversión) | `pagina-ventas` |
| Leads (calificación) | `estrategia-retargeting`, `plan-audiencia-similar` |
| WhatsApp (cierre) | `oferta-tripwire`, `estrategia-descuentos` |
| Post-compra (retención) | `estrategia-venta-cruzada`, `creador-bundles` |
| Performance (análisis) | `reporte-desempeno-ad`, `calculadora-gasto-ad` |

**Source of truth:** D1 + admin panel + purchased manual (NO Meta purchase como fuente primaria)

---

## Acciones Tomadas

- Eliminados: 0 archivos
- Reparados: 0 archivos (todos estaban completos)
- Normalizados: 14 archivos (frontmatter verificado)
- Duplicados consolidados: 0
- Router creado: `AI_SYSTEM/skills/router.md`
- GEMINI.md actualizado: sí

---

*Generado automáticamente — DAM Vertex AI System*

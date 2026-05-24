---
name: skills-router
description: "Índice maestro de todos los skills modulares de marketing. Cargarlo para routing automático de intención → skill correcto."
metadata:
  type: router
  version: "2.0"
  author: DAM Vertex AI System
---

# Skills Router — Índice Maestro

## Regla de Carga

- Máximo 2–3 skills por tarea
- Siempre verificar compatibilidad con funnel DAM Vertex antes de aplicar
- Source of truth: D1 + admin panel + purchased manual (NO Meta purchase)
- Funnel: Meta Ads → Landing → WhatsApp → Pending → Delivery → Purchased Manual

---

## Directorio Completo de Skills

| Skill | Archivo | Categoría | Prioridad | Cuándo Cargar |
|---|---|---|---|---|
| Brief Creative Ad | `brief-creative-ad.md` | ads + copywriting | CRÍTICA | Producción de creatives, dirección visual, briefear diseñador |
| Calculadora Gasto Ad | `calculadora-gasto-ad.md` | ads + finanzas | MEDIA | Presupuesto, CPA objetivo, proyecciones de gasto |
| Campaña Facebook Ads | `campana-facebook-ads.md` | meta-ads + strategy | CRÍTICA | Estructura de campaña Meta completa, targeting, testing |
| Copia de Ad | `copia-ad.md` | copywriting + ads | CRÍTICA | Escribir copy para Facebook, Instagram, Google, LinkedIn |
| Creador Bundles | `creador-bundles.md` | ecommerce + AOV | CRÍTICA | Crear bundles, aumentar valor promedio de orden |
| Estrategia Descuentos | `estrategia-descuentos.md` | pricing + promos | MEDIA | Promos, ventas, pricing con margen protegido |
| Estrategia Retargeting | `estrategia-retargeting.md` | meta-ads + funnel | CRÍTICA | Retargetear visitantes o leads que no compraron |
| Estrategia Venta Cruzada | `estrategia-venta-cruzada.md` | ecommerce + retention | ALTA | Cross-sell a clientes existentes, aumentar LTV |
| Guión Ad Podcast | `guion-ad-podcast.md` | audio + copywriting | BAJA | Scripts host-read, sponsorships de podcast |
| Guión Ad TikTok | `guion-ad-tiktok.md` | video + social | ALTA | Scripts video nativo TikTok, UGC, Spark Ads |
| Oferta Tripwire | `oferta-tripwire.md` | funnels + pricing | ALTA | Oferta bajo-ticket ($7–$47), convertir leads en compradores |
| Página de Ventas | `pagina-ventas.md` | CRO + copywriting | CRÍTICA | Sales page largo formato, landing de conversión |
| Plan Audiencia Similar | `plan-audiencia-similar.md` | meta-ads + targeting | ALTA | Lookalike strategy, escalar con nuevos clientes |
| Reporte Desempeño Ad | `reporte-desempeno-ad.md` | analytics + reporting | CRÍTICA | Análisis ROAS, reporting estructurado, D1 cruzado |

---

## Routing por Intención

### CREATIVES Y COPY

**Si pide:** creatives / brief de creative / dirección visual / imagen de ad / video ad
→ `brief-creative-ad.md` + `copia-ad.md`

**Si pide:** escribir ad / copy / texto de anuncio / variaciones A/B / Facebook ad copy
→ `copia-ad.md` (+ `brief-creative-ad.md` si también pide dirección visual)

**Si pide:** guión TikTok / video corto / UGC / Spark Ad / TikTok native
→ `guion-ad-tiktok.md` (+ `copia-ad.md` si necesita también copy estático)

**Si pide:** guión podcast / sponsorship / host-read / mid-roll / pre-roll
→ `guion-ad-podcast.md`

---

### CAMPAÑAS Y AUDIENCIAS

**Si pide:** campaña Meta / campaña Facebook / estructura de campaña / ad sets
→ `campana-facebook-ads.md`

**Si pide:** retargeting / remarketing / visitantes que no compraron / recuperar leads
→ `estrategia-retargeting.md`

**Si pide:** lookalike / audiencia similar / escalar con nuevos / LAL
→ `plan-audiencia-similar.md`

---

### LANDING Y CONVERSIÓN

**Si pide:** landing page / página de ventas / sales page / conversión / CRO
→ `pagina-ventas.md`

**Si pide:** tripwire / oferta bajo-ticket / convertir leads / primer compra
→ `oferta-tripwire.md`

---

### PRICING Y OFERTAS

**Si pide:** bundles / kits / agrupar productos / aumentar AOV / gift set
→ `creador-bundles.md`

**Si pide:** descuento / promo / venta / precio promocional / flash sale / Black Friday
→ `estrategia-descuentos.md`

**Si pide:** venta cruzada / cross-sell / recomendar productos / clientes existentes
→ `estrategia-venta-cruzada.md`

---

### PRESUPUESTO Y REPORTING

**Si pide:** presupuesto de ads / cuánto gastar / CPA máximo / proyecciones
→ `calculadora-gasto-ad.md`

**Si pide:** reporte de campañas / análisis ROAS / performance / métricas / qué pausar
→ `reporte-desempeno-ad.md`
⚠️ **ACTIVAR META_ANALYSIS_MODE=STRICT** + leer `meta-ads/meta-strict-mode.md`

---

## Combinaciones Frecuentes (Multi-Skill)

| Tarea | Skills a cargar |
|---|---|
| Lanzar nueva campaña Meta desde cero | `campana-facebook-ads` + `copia-ad` + `brief-creative-ad` |
| Producir creative de ad completo | `brief-creative-ad` + `copia-ad` |
| Analizar performance y decidir qué hacer | `reporte-desempeno-ad` + `campana-facebook-ads` |
| Escalar campaña ganadora | `plan-audiencia-similar` + `campana-facebook-ads` |
| Recuperar leads perdidos | `estrategia-retargeting` + `copia-ad` |
| Aumentar ticket de venta | `creador-bundles` + `oferta-tripwire` |
| Crear landing de alto ROAS | `pagina-ventas` + `copia-ad` |
| Planificar promo estacional | `estrategia-descuentos` + `calculadora-gasto-ad` |
| Producir contenido TikTok + retargeting | `guion-ad-tiktok` + `estrategia-retargeting` |
| Retener y crecer clientes existentes | `estrategia-venta-cruzada` + `creador-bundles` |

---

## Inputs Esperados por Skill

| Skill | Inputs Mínimos Obligatorios |
|---|---|
| `brief-creative-ad` | Producto + audiencia + plataforma + objetivo |
| `calculadora-gasto-ad` | Meta de ingresos + AOV + margen |
| `campana-facebook-ads` | Objetivo + oferta + landing page + audiencia + presupuesto |
| `copia-ad` | Producto + audiencia + plataforma + CTA + objetivo |
| `creador-bundles` | Catálogo + precios + COGS + AOV objetivo |
| `estrategia-descuentos` | Precio + COGS + margen bruto + objetivo de promo |
| `estrategia-retargeting` | Tráfico mensual + pixel confirmado + etapas del funnel |
| `estrategia-venta-cruzada` | Catálogo + historial de compra + canal de comunicación |
| `guion-ad-podcast` | Producto + oferta + puntos clave + género de podcast |
| `guion-ad-tiktok` | Producto + audiencia + formato + CTA |
| `oferta-tripwire` | Oferta principal + audiencia + nicho + precio principal |
| `pagina-ventas` | Producto + precio + audiencia + resultado + objeción #1 |
| `plan-audiencia-similar` | Plataforma + listas de clientes disponibles + presupuesto |
| `reporte-desempeno-ad` | Plataformas + período + gasto total + ingresos/conversiones |

---

## Compatibilidad con Funnel DAM Vertex

```
ETAPA               SKILLS PRIORITARIAS
──────────────────────────────────────────────────────
Meta Ads (entrada)  campana-facebook-ads
                    copia-ad
                    brief-creative-ad
                    guion-ad-tiktok
                    plan-audiencia-similar

Landing             pagina-ventas

Leads calientes     estrategia-retargeting
                    oferta-tripwire

WhatsApp / Cierre   estrategia-descuentos
                    creador-bundles

Post-compra         estrategia-venta-cruzada
                    creador-bundles

Análisis / ROAS     reporte-desempeno-ad ← D1 como truth
                    calculadora-gasto-ad
```

**IMPORTANTE:** `reporte-desempeno-ad` siempre debe usar D1 + admin panel como source of truth.
Meta purchase es referencia, no verdad absoluta.

---

## Skills Relacionadas por Área

```
brief-creative-ad
  → copia-ad (el copy de cada variación)
  → campana-facebook-ads (integrar en arquitectura de campaña)
  → guion-ad-tiktok (si el formato es video vertical nativo)
  → reporte-desempeno-ad (para evaluar qué creative ganó)

campana-facebook-ads
  → copia-ad (copy para los ads)
  → estrategia-retargeting (capa de retargeting de la campaña)
  → plan-audiencia-similar (lookalike para escalar)
  → calculadora-gasto-ad (calcular presupuesto antes)

reporte-desempeno-ad
  → campana-facebook-ads (qué ajustar en campaña)
  → estrategia-retargeting (si la pérdida está en el funnel medio)
  → pagina-ventas (si CVR de landing es el cuello de botella)

pagina-ventas
  → oferta-tripwire (versión bajo-ticket de la misma landing)
  → creador-bundles (si la oferta es un bundle)
  → estrategia-descuentos (si hay urgencia de precio)

oferta-tripwire
  → pagina-ventas (la core offer después del tripwire)
  → estrategia-venta-cruzada (cross-sell post-tripwire)
```

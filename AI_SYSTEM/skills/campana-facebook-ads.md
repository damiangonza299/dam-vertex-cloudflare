---
name: campana-facebook-ads
description: "Planifica campañas de Facebook/Meta ad con targeting de audiencia, briefs de creative de ad, asignación de presupuesto y estrategia de pruebas. Úsalo cuando ejecutes ads pagados en plataformas Meta."
allowed-tools: Read Write Glob
metadata:
  author: Imperio Digital
  version: "1.0"
---

# Campaña de Anuncios en Facebook

## Principio Fundamental

LOS FACEBOOK ADS RENTABLES SE CONSTRUYEN EN TRES PILARES: LA AUDIENCIA CORRECTA, UNA OFERTA CONVINCENTE, Y CREATIVE QUE DETIENE EL SCROLL — CONSIGUE LOS TRES CORRECTOS Y EL ALGORITMO HACE EL RESTO.

---

## Cuándo Usar Este Skill

- Planificar campaña de Facebook o Instagram advertising de cero
- Definir targeting de audiencia, creative de ad y asignación de presupuesto
- Construir estrategia de pruebas para ad sets, audiencias y creatives
- Crear copy de ad y briefs de creative para múltiples variaciones de ad

---

## Fase 1: Brief de Campaña

### Inputs Requeridos

| Input | Qué Preguntar | Default |
|---|---|---|
| **Objetivo de campaña** | "¿Cuál es el objetivo? (leads, ventas, tráfico, conciencia)" | Sin default — debe ser proporcionado |
| **Oferta** | "¿Qué estás promocionando?" | Sin default — debe ser proporcionado |
| **Landing page** | "¿Dónde envía el ad a las personas?" | Sin default — debe ser proporcionado |
| **Presupuesto** | "¿Cuál es tu presupuesto diario o mensual?" | $20-50/día |
| **Audiencia destino** | "¿Quién es tu cliente ideal?" | Sin default — debe ser proporcionado |
| **Experiencia previa** | "¿Has ejecutado Meta ads antes?" | Sin datos previos |

**PUNTO DE CONTROL: No avanzar sin objetivo, oferta, landing page y audiencia confirmados.**

---

## Fase 2: Arquitectura de Campaña

### Estructura de Campaña

```
## Setup de Campaña

**Nivel de Campaña:**
- Objetivo: [Conversiones / Leads / Tráfico]
- Campaign Budget Optimization: ON
- Presupuesto diario: $[X]

**Ad Set 1: Targeting Basado en Intereses**
- Audiencia: [Intereses específicos relacionados al producto]
- Edad: [Rango definido por cliente ideal]
- Ubicación: [País/ciudad objetivo]
- Placement: Automático (dejar que el algoritmo optimice)
- Presupuesto: CBO gestiona distribución

**Ad Set 2: Audiencias Similares (Lookalike)**
- Fuente: [Lista de compradores / Pixel compradores / Top 25% LTV]
- Porcentaje: 1-3% (comenzar estrecho)
- Misma configuración de edad/ubicación

**Ad Set 3: Retargeting**
- Audiencia: Visitantes de sitio últimos 30 días
- Excluir: Compradores existentes
- Presupuesto: 20-30% del total
```

---

## Fase 3: Estrategia de Audiencias

### Tiers de Audiencia

| Tier | Tipo | Temperatura | Mensaje | Presupuesto % |
|---|---|---|---|---|
| **Tier 1** | Retargeting (visitantes, abandonos) | Caliente | Urgencia, objeción, recordatorio | 20-30% |
| **Tier 2** | Lookalike 1-3% de compradores | Tibio | Beneficio, prueba social | 40-50% |
| **Tier 3** | Intereses amplios / prospecting frío | Frío | Educación, problema, conciencia | 20-30% |

### Tamaños de Audiencia Recomendados

| Audiencia | Tamaño Mínimo | Tamaño Óptimo |
|---|---|---|
| Retargeting personalizada | 1,000+ | 10,000-100,000 |
| Fuente lookalike | 1,000+ | 10,000+ compradores |
| Lookalike resultante | 500,000+ | 1M-5M |
| Intereses amplios | 1M+ | 5M-20M |

---

## Fase 4: Creative y Copy

### Framework de Ad por Objetivo

**Campaña de Conversiones (ventas directas):**
```
Headline: [Beneficio específico o resultado concreto — máx 40 chars]
Texto primario:
"¿[Pregunta que activa el problema]?

[Agitar el problema — 1-2 oraciones]

[Producto] [mecanismo único cómo resuelve].

[Resultado específico que obtienen].

[CTA con urgencia o escasez si aplica]"

CTA Button: Comprar ahora / Ver oferta
```

**Campaña de Leads:**
```
Headline: [Promesa específica del lead magnet — máx 40 chars]
Texto primario:
"[Resultado que obtienen al descargar/registrarse].

[Por qué esto funciona / diferenciador].

[Quién lo necesita — audiencia específica].

→ [CTA claro: Descarga gratis / Regístrate hoy]"

CTA Button: Registrarse / Más información
```

---

## Fase 5: Estrategia de Pruebas

### Framework de Testing Estructurado

**Semana 1-2: Prueba de Audiencias**
- Misma creative, 3 audiencias diferentes
- Presupuesto igual por ad set
- Ganador = menor CPL / CPA con mayor volumen

**Semana 3-4: Prueba de Creatives**
- Audiencia ganadora, 3-5 creatives diferentes
- Probar: imagen vs video, ángulo Dolor vs Beneficio vs Social Proof
- Ganador = mejor CTR + menor CPA combinado

**Semana 5+: Escalar Ganadores**
- Incrementar presupuesto máximo 20% cada 3 días
- Mantener ad sets perdedores apagados
- Lanzar nuevas variaciones del creative ganador

---

## Fase 6: Métricas de Referencia y Alarmas

### KPIs a Monitorear

| Métrica | Bueno | Alarma | Acción |
|---|---|---|---|
| CTR (link) | >1.5% | <0.8% | Revisar hook/imagen |
| CPC | <$1.50 | >$3.00 | Revisar audiencia o creative |
| CPM | <$15 | >$35 | Revisar relevancia o audiencia |
| CVR landing | >2% | <1% | Revisar landing page |
| ROAS | >2.5x | <1.5x | Escalar o apagar |
| Frequency | <3 | >5 | Rotar creatives o ampliar audiencia |

---

## Anti-Patrones

- **NO** lanzar sin Pixel instalado y evento de conversión validado
- **NO** usar Broad Targeting sin datos de pixel establecidos (mínimo 50 conversiones/semana)
- **NO** tocar presupuesto dentro de las primeras 72h de lanzamiento — el algoritmo necesita aprender
- **NO** crear demasiados ad sets con presupuesto pequeño — fragmenta el aprendizaje
- **NO** mezclar múltiples objetivos en la misma campaña
- **NO** apagar ads con menos de 3 días de data — demasiado pronto para juzgar
- **NO** duplicar campañas ganadoras sin ajustar audiencia — se canibaliza el tráfico

---

## Outputs Esperados

Al completar este skill, el usuario tiene:
1. Arquitectura completa de campaña (campaña → ad sets → ads)
2. Targeting de audiencia definido por tier
3. Copy de ad escrito para 2-3 variaciones
4. Brief de creative para cada variación
5. Plan de pruebas semana por semana
6. KPIs de referencia y umbrales de alarma

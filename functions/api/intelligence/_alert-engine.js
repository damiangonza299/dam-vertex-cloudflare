/* =========================================================
   _alert-engine.js — Motor de alertas v3
   Importado por: alerts.js, send-alerts.js
   NO es una ruta de Cloudflare Pages (prefijo _).

   REGLA FUNDAMENTAL: Compras reales = señal principal.
   Leads/pedidos = señal secundaria y de contexto.
   Nunca declarar ganador algo sin compras suficientes.

   Tipos de alerta:
     creative_dead       — creativo sin compras con leads vencidos altos
     creative_scalable   — creativo ganador (purchase_rate + score + revenue)
     garbage_risk        — tráfico basura (creativo: vencidos; ciudad: stale)
     city_risk           — ciudad con muchos leads pero baja conversión vs nacional
     winning_city        — ciudad con purchase_rate > promedio nacional del producto
     buyer_type_increase — compradores premium aumentaron vs semana anterior
     conversion_drop     — caída de compras (diferencia demanda vs cierre)
     product_winner      — producto con mejor conversión real y revenue > 0
     product_risk        — producto con muchos leads pero pocas compras
     cpa_high            — CPA real elevado o gasto sin compras
     roas_alert          — ROAS por debajo del punto de equilibrio

   Períodos (misma ventana para Meta spend y D1):
     30 días: creative_*, garbage_risk, city_*, product_*, cpa_high, roas_alert
      7 días: buyer_type_increase, conversion_drop (vs 7d anteriores)

   Umbrales:
     MIN_LEADS     = 10  (mínimo de leads para activar cualquier alerta de creativo)
     MIN_PURCHASES =  3  (mínimo de compras reales para alertas de ganador)
     MIN_DAYS      =  3  (días mínimos de datos)
     CITY_MIN_LEADS = 10 (mínimo para winning_city)
     CITY_RISK_MIN  = 15 (mínimo para city_risk)
     CITY_MIN_BUYS  =  2 (mínimo compras para winning_city)

   options.activeAdIds       — Set<string> de ad_ids activos en Meta (filtra en el motor)
   options.metaSpendMap      — Map<ad_id, {spend}> con gasto Meta 30 días (para CPA/ROAS)
   options.activeFilterReason — motivo si activeAdIds es null: TOKEN_MISSING | META_ERROR |
                                 NETWORK_ERROR | RATE_LIMIT

   FILTRO OPERATIVO (v4): product_winner, product_risk, winning_city y city_risk
   SOLO se generan para productos con al menos un anuncio activo en Meta
   (derivado de activeAdIds vía fetchActiveProductSlugs). Si activeAdIds es null
   (Meta no respondió o no está configurado), estas 4 alertas se SUPRIMEN
   completamente — se prefiere ausencia de alerta a un diagnóstico falso sobre
   campañas pausadas/archivadas. Se loguea INTELLIGENCE_ACTIVE_FILTER_UNAVAILABLE.
   Si Meta respondió pero ningún producto activo alcanza MIN_LEADS (10) en D1,
   se suprimen product_winner y winning_city y se loguea INTELLIGENCE_NO_ACTIVE_PRODUCT_DATA.
   creative_dead, creative_scalable, garbage_risk, cpa_high y roas_alert NO cambian:
   siguen filtrando por ad_id activo como antes (o sin filtro si Meta no responde).

   NO toca Meta Ads. NO pausa campañas. NO modifica datos.
   ========================================================= */

const MIN_LEADS      = 10;
const MIN_PURCHASES  = 3;
const MIN_DAYS       = 3;
const CITY_MIN_LEADS = 10;
const CITY_RISK_MIN  = 15;
const CITY_MIN_BUYS  = 2;
const PERIOD_30      = 30;
const PERIOD_7       = 7;

export async function generateAlerts(DB, options = {}) {
  const { metaSpendMap = new Map(), activeAdIds = null, activeFilterReason = null } = options;

  const now     = Date.now();
  const since30 = new Date(now - 30 * 86400000).toISOString().slice(0, 10);
  const since7  = new Date(now -  7 * 86400000).toISOString().slice(0, 10);
  const since14 = new Date(now - 14 * 86400000).toISOString().slice(0, 10);

  const [creativeLeads, creativeLQ, cityProductData, buyerTrend, convTrend, productStats, globalStats, activeProductSlugs] =
    await Promise.all([
      fetchCreativeLeads(DB, since30),
      fetchCreativeLQ(DB, since30),
      fetchCityDataByProduct(DB, since30),
      fetchBuyerTrend(DB, since7, since14),
      fetchConversionTrend(DB, since7, since14),         // v3: incluye prev_leads
      fetchProductStats(DB, since30),                     // v4: devuelve rows + rateMap (sin winner/loser)
      fetchGlobalStats(DB, since30),
      fetchActiveProductSlugs(DB, since30, activeAdIds),  // v4: product_slug con al menos 1 ad activo
    ]);

  const alerts = [];
  const globalConvRate = globalStats.total_leads > 0
    ? globalStats.total_purchased / globalStats.total_leads
    : 0;

  // rateMap: tasa de conversión nacional por producto (histórico, SIN filtrar por actividad —
  // sirve de baseline de comparación, no de criterio de disparo)
  const { rows: productStatsRows, rateMap: productNationalRateMap } = productStats;

  // ── Filtro operativo: product_winner/product_risk/winning_city/city_risk requieren
  // producto con tráfico Meta activo. Si no se puede determinar, se suprimen las 4. ──
  if (activeProductSlugs === null) {
    console.warn('INTELLIGENCE_ACTIVE_FILTER_UNAVAILABLE', activeFilterReason || 'UNKNOWN_REASON');
  }

  let productWinner = null;
  let productLoser  = null;
  if (activeProductSlugs !== null) {
    const activeRows = productStatsRows.filter(r => activeProductSlugs.has(String(r.product_slug)));

    // Si Meta respondió pero ningún producto activo tiene suficiente muestra, suprimir
    // product_winner y winning_city y registrar la razón operativa.
    const hasQualifyingActiveProduct = activeRows.some(r => Number(r.total_leads) >= MIN_LEADS);
    if (!hasQualifyingActiveProduct) {
      console.warn('INTELLIGENCE_NO_ACTIVE_PRODUCT_DATA', {
        active_slugs:      [...activeProductSlugs],
        active_rows_count: activeRows.length,
        reason: activeProductSlugs.size === 0
          ? 'no_active_ads_in_meta'
          : 'active_products_below_min_leads',
      });
      // productWinner y productLoser permanecen null → product_winner y winning_city no se generan
    }

    // Ganador: mejor purchase_rate CON compras reales + revenue > 0, SOLO entre productos activos
    productWinner = activeRows.find(r =>
      r.purchased >= MIN_PURCHASES &&
      r.purchase_rate >= 0.2 &&
      Number(r.revenue) > 0
    ) || null;

    // En riesgo: muchos leads pero conversión < 5%, SOLO entre productos activos
    const activeLosers = activeRows.filter(r =>
      Number(r.total_leads) >= MIN_LEADS && r.purchase_rate < 0.05
    ).sort((a, b) => a.purchase_rate - b.purchase_rate);

    productLoser = (activeLosers[0] && (!productWinner || activeLosers[0].product_slug !== productWinner.product_slug))
      ? activeLosers[0]
      : null;
  }

  // Mapa lead_quality por ad_id
  const lqMap = new Map();
  creativeLeads.forEach(r => lqMap.set(String(r.ad_id), { dead_leads: 0, avg_score: 0 }));
  creativeLQ.forEach(r => { if (r.ad_id) lqMap.set(String(r.ad_id), r); });

  // ── Alertas por creativo ────────────────────────────────────────────────────
  for (const cr of creativeLeads) {
    if (!cr.ad_id) continue;
    const adId = String(cr.ad_id);

    // Filtrar inactivos si se pasó el Set desde Meta
    if (activeAdIds !== null && !activeAdIds.has(adId)) continue;

    const lq            = lqMap.get(adId) || {};
    const total_leads   = Number(cr.total_leads  || 0);
    const purchased     = Number(cr.purchased    || 0);
    const cancelled     = Number(cr.cancelled    || 0);
    const data_days     = Number(cr.data_days    || 1);
    const dead_leads    = Number(lq.dead_leads   || 0);
    const avg_score     = Number(lq.avg_score    || 0);
    const revenue       = Number(cr.revenue      || 0);
    const campaign_name = String(cr.campaign_name || '').slice(0, 80);
    const name          = (cr.ad_name || adId).slice(0, 60);

    const purchase_rate  = total_leads > 0 ? purchased  / total_leads : 0;
    const dead_lead_rate = total_leads > 0 ? dead_leads / total_leads : 0;
    const cancel_rate    = total_leads > 0 ? cancelled  / total_leads : 0;

    const hasData      = total_leads >= MIN_LEADS && data_days >= MIN_DAYS;
    const hasPurchases = purchased >= MIN_PURCHASES;

    // Datos Meta (misma ventana 30d para spend y revenue desde D1)
    const metaInfo   = metaSpendMap.get(adId);
    const meta_spend = metaInfo ? Number(metaInfo.spend || 0) : 0;
    const cpa_real   = hasPurchases && meta_spend > 0 ? Math.round(meta_spend / purchased) : null;
    const roas       = meta_spend > 0 && revenue > 0 ? Math.round((revenue / meta_spend) * 100) / 100 : null;
    const avg_ticket = hasPurchases && revenue > 0 ? Math.round(revenue / purchased) : null;

    // 1. Creativo muerto: leads vencidos altos + sin compras
    if (hasData && dead_lead_rate >= 0.6 && purchase_rate < 0.05) {
      alerts.push({
        tipo:        'creative_dead',
        severidad:   'alta',
        periodo:     `últimos ${PERIOD_30} días`,
        titulo:      `Creativo muerto: ${name}`,
        explicacion: `${pct(dead_lead_rate)}% leads vencidos, ${pct(purchase_rate)}% compras reales.${meta_spend > 0 ? ` Gasto: ${fmt(meta_spend)} Gs. sin retorno.` : ''}`,
        evidencia: {
          ad_id: adId, ad_name: cr.ad_name, campaign_name,
          total_leads, purchased, dead_leads,
          purchase_rate_pct:  pct(purchase_rate),
          dead_lead_rate_pct: pct(dead_lead_rate),
          revenue, data_days, periodo: PERIOD_30,
          ...(meta_spend > 0 && { meta_spend: Math.round(meta_spend) }),
          ...(cpa_real !== null && { cpa_real }),
        },
        accion_sugerida: meta_spend > 0
          ? `Pausar creativo. Gasto sin retorno: ${fmt(meta_spend)} Gs. con 0 compras en ${total_leads} leads.`
          : 'Pausar creativo si el gasto lo justifica. Revisar coherencia anuncio → landing → precio.',
        requiere_aprobacion: true,
      });
    }

    // 2. Creativo escalable: purchase_rate alta + score + revenue real
    if (hasData && hasPurchases && purchase_rate >= 0.25 && avg_score >= 70 && dead_lead_rate < 0.4 && revenue > 0) {
      alerts.push({
        tipo:        'creative_scalable',
        severidad:   'info',
        periodo:     `últimos ${PERIOD_30} días`,
        titulo:      `Creativo escalable: ${name}`,
        explicacion: `${pct(purchase_rate)}% compras reales, score ${Math.round(avg_score)}/100, ${pct(dead_lead_rate)}% vencidos. Revenue: ${fmt(revenue)} Gs.`,
        evidencia: {
          ad_id: adId, ad_name: cr.ad_name, campaign_name,
          total_leads, purchased, revenue,
          purchase_rate_pct:  pct(purchase_rate),
          avg_score:          Math.round(avg_score),
          dead_lead_rate_pct: pct(dead_lead_rate),
          periodo: PERIOD_30,
          ...(roas      !== null && { roas }),
          ...(cpa_real  !== null && { cpa_real }),
          ...(avg_ticket !== null && { avg_ticket }),
          ...(meta_spend > 0 && { meta_spend: Math.round(meta_spend) }),
        },
        accion_sugerida: roas !== null
          ? `Subir presupuesto 15-20% si lleva 48h+ estable. ROAS actual: ${roas}x. Duplicar este creativo en un conjunto separado.`
          : 'Candidato para escalar. Conectar META_MARKETING_TOKEN para validar ROAS real antes de subir presupuesto.',
        requiere_aprobacion: true,
      });
    }

    // 3. Tráfico basura por creativo (distinto al muerto: no llega a threshold de dead_rate pero hay stale alto)
    if (
      hasData && dead_lead_rate >= 0.5 && total_leads >= 15 &&
      !alerts.some(a => a.tipo === 'creative_dead' && a.evidencia?.ad_id === adId)
    ) {
      alerts.push({
        tipo:        'garbage_risk',
        severidad:   'alta',
        periodo:     `últimos ${PERIOD_30} días`,
        titulo:      `Tráfico basura: ${name}`,
        explicacion: `${pct(dead_lead_rate)}% de leads vencen sin compra. ${pct(cancel_rate)}% cancelados.`,
        evidencia: {
          ad_id: adId, ad_name: cr.ad_name, campaign_name,
          total_leads, purchased, dead_leads,
          dead_lead_rate_pct: pct(dead_lead_rate),
          cancel_rate_pct:    pct(cancel_rate),
          purchase_rate_pct:  pct(purchase_rate),
          periodo: PERIOD_30,
        },
        accion_sugerida: 'Verificar coherencia anuncio → landing → precio → producto. Analizar 72h antes de pausar para no reiniciar aprendizaje.',
        requiere_aprobacion: false,
      });
    }

    // 4a. Gasto sin compras (CPA infinito) — prioridad sobre cpa_high normal
    if (hasData && meta_spend > 0 && purchased === 0) {
      alerts.push({
        tipo:        'cpa_high',
        severidad:   'alta',
        periodo:     `últimos ${PERIOD_30} días`,
        titulo:      `Gasto sin compras: ${name}`,
        explicacion: `${fmt(meta_spend)} Gs. invertidos, ${total_leads} leads, 0 compras reales en ${PERIOD_30} días.`,
        evidencia: {
          ad_id: adId, ad_name: cr.ad_name, campaign_name,
          total_leads, purchased: 0,
          meta_spend: Math.round(meta_spend),
          purchase_rate_pct: 0,
          periodo: PERIOD_30,
        },
        accion_sugerida: 'Pausar inmediatamente. No hay retorno sobre la inversión. Revisar coherencia entre anuncio, landing y precio.',
        requiere_aprobacion: true,
      });
    }

    // 4b. CPA alto (compras reales existen pero CPA supera el ticket)
    if (hasData && hasPurchases && cpa_real !== null && avg_ticket !== null && avg_ticket > 0 && purchased > 0) {
      const cpa_ratio = cpa_real / avg_ticket;
      if (cpa_ratio >= 0.8) {
        const sev = cpa_ratio >= 1.0 ? 'alta' : 'media';
        alerts.push({
          tipo:        'cpa_high',
          severidad:   sev,
          periodo:     `últimos ${PERIOD_30} días`,
          titulo:      `CPA elevado: ${name}`,
          explicacion: `CPA real ${fmt(cpa_real)} Gs. vs ticket promedio ${fmt(avg_ticket)} Gs. (${Math.round(cpa_ratio * 100)}%).`,
          evidencia: {
            ad_id: adId, ad_name: cr.ad_name, campaign_name,
            total_leads, purchased, revenue,
            meta_spend:    Math.round(meta_spend),
            cpa_real, avg_ticket,
            cpa_ratio_pct: Math.round(cpa_ratio * 100),
            purchase_rate_pct: pct(purchase_rate),
            periodo: PERIOD_30,
          },
          accion_sugerida: cpa_ratio >= 1.0
            ? `CPA supera el ticket. Pausar y redistribuir presupuesto a creativos con CPA < ${fmt(Math.round(avg_ticket * 0.6))} Gs.`
            : `CPA en ${Math.round(cpa_ratio * 100)}% del ticket. Optimizar segmentación para bajar CPA al 50-60%.`,
          requiere_aprobacion: cpa_ratio >= 1.0,
        });
      }
    }

    // 5. ROAS deteriorado — misma ventana 30d para spend y revenue
    if (hasData && hasPurchases && roas !== null) {
      let roasSev = null, roasTipo = null;
      if      (roas < 0.8) { roasTipo = 'crítico';     roasSev = 'alta'; }
      else if (roas < 1.5) { roasTipo = 'deteriorado'; roasSev = 'media'; }

      if (roasTipo) {
        alerts.push({
          tipo:        'roas_alert',
          severidad:   roasSev,
          periodo:     `últimos ${PERIOD_30} días`,
          titulo:      `ROAS ${roasTipo}: ${name}`,
          explicacion: `ROAS ${roas}x — por cada Gs. invertido se recuperan ${roas} Gs. en ingresos reales.`,
          evidencia: {
            ad_id: adId, ad_name: cr.ad_name, campaign_name,
            total_leads, purchased, revenue,
            meta_spend:    Math.round(meta_spend),
            roas, roas_tipo: roasTipo,
            purchase_rate_pct: pct(purchase_rate),
            periodo: PERIOD_30,
          },
          accion_sugerida: roas < 0.8
            ? 'ROAS crítico: el gasto supera los ingresos. Pausar inmediatamente y redistribuir presupuesto.'
            : 'ROAS bajo punto de equilibrio. Revisar creativos, segmentación y precio del producto.',
          requiere_aprobacion: roas < 0.8,
        });
      }
    }
  }

  // ── Alertas por ciudad con contexto de producto ────────────────────────────
  // El mapa agrupa filas por ciudad; cada ciudad puede tener múltiples productos.
  // La fila con más compras determina el producto principal de la alerta.
  const cityMap = new Map();
  for (const cp of cityProductData) {
    const key = String(cp.city || '').toLowerCase().trim();
    if (!key || key === 'sin_ciudad') continue;
    if (!cityMap.has(key)) cityMap.set(key, []);
    cityMap.get(key).push(cp);
  }

  for (const productRows of cityMap.values()) {
    const sorted    = productRows.sort((a, b) => Number(b.purchased || 0) - Number(a.purchased || 0));
    const best      = sorted[0];
    const total     = Number(best.total_leads || 0);
    const purchased = Number(best.purchased   || 0);
    const stale     = Number(best.stale       || 0);
    const data_days = Number(best.data_days   || 1);
    const revenue   = Number(best.revenue     || 0);

    if (total < CITY_MIN_LEADS) continue;

    const purchase_rate  = total > 0 ? purchased / total : 0;
    const stale_rate     = total > 0 ? stale     / total : 0;
    const product_name   = best.product_name || best.product_slug || 'Sin nombre';
    const campaign_name  = best.campaign_name || '';
    const confidence     = getConfidence(total, purchased);

    // Tasa nacional del producto — fallback a tasa global si no hay muestra
    const productNatRate = productNationalRateMap.get(String(best.product_slug || '')) ?? globalConvRate;
    const nat_pct        = pct(productNatRate);
    const city_pct       = pct(purchase_rate);
    const delta_pp       = city_pct - nat_pct;

    // Filtro operativo: solo si el producto tiene tráfico Meta activo
    const isProductActive = activeProductSlugs !== null && activeProductSlugs.has(String(best.product_slug || ''));

    // Ciudad ganadora: purchase_rate > promedio nacional del producto + mínimo de compras
    if (isProductActive && purchased >= CITY_MIN_BUYS && purchase_rate > productNatRate && data_days >= MIN_DAYS) {
      alerts.push({
        tipo:        'winning_city',
        severidad:   'info',
        periodo:     `últimos ${PERIOD_30} días`,
        titulo:      `Ciudad ganadora: ${best.city} — ${product_name}`,
        explicacion: `${city_pct}% conversión en ${best.city} para ${product_name}. Nacional: ${nat_pct}%. +${delta_pp}pp sobre la media.`,
        evidencia: {
          city:              best.city,
          product_slug:      best.product_slug,
          product_name,
          campaign_name,
          total_leads:       total,
          purchased,
          revenue,
          purchase_rate_pct: city_pct,
          national_rate_pct: nat_pct,
          delta_vs_national: delta_pp,
          data_days,
          confidence,
          periodo:           PERIOD_30,
        },
        accion_sugerida: `Crear conjunto de anuncios específico para ${best.city} con creativo de ${product_name}. Conversión local ${city_pct}% vs ${nat_pct}% nacional.`,
        requiere_aprobacion: false,
      });
    }

    // Ciudad de riesgo: muchos leads pero purchase_rate < 50% del promedio nacional
    if (isProductActive && total >= CITY_RISK_MIN && purchase_rate < productNatRate * 0.5 && purchased < CITY_MIN_BUYS) {
      alerts.push({
        tipo:        'city_risk',
        severidad:   'media',
        periodo:     `últimos ${PERIOD_30} días`,
        titulo:      `Ciudad con baja conversión: ${best.city} — ${product_name}`,
        explicacion: `${city_pct}% conversión en ${best.city} vs ${nat_pct}% nacional para ${product_name}. ${delta_pp}pp por debajo.`,
        evidencia: {
          city:              best.city,
          product_slug:      best.product_slug,
          product_name,
          campaign_name,
          total_leads:       total,
          purchased,
          revenue,
          purchase_rate_pct: city_pct,
          national_rate_pct: nat_pct,
          delta_vs_national: delta_pp,
          data_days,
          confidence,
          periodo:           PERIOD_30,
        },
        accion_sugerida: `No invertir más en ${best.city} para ${product_name} sin diagnóstico. Revisar targeting y landing específicos de esta ciudad.`,
        requiere_aprobacion: false,
      });
    }

    // Tráfico basura por ciudad (stale alto)
    if (stale_rate >= 0.5 && total >= 15) {
      alerts.push({
        tipo:        'garbage_risk',
        severidad:   'alta',
        periodo:     `últimos ${PERIOD_30} días`,
        titulo:      `Tráfico basura desde: ${best.city}`,
        explicacion: `${pct(stale_rate)}% de leads de ${best.city} vencieron sin compra en ${PERIOD_30} días.`,
        evidencia: {
          city:           best.city,
          product_slug:   best.product_slug,
          product_name,
          total_leads:    total,
          stale,
          purchased,
          stale_rate_pct: pct(stale_rate),
          purchase_rate_pct: city_pct,
          periodo:        PERIOD_30,
        },
        accion_sugerida: `Excluir ${best.city} de los conjuntos con mayor gasto si el patrón persiste más de 7 días.`,
        requiere_aprobacion: false,
      });
    }
  }

  // ── Buyer type premium aumentó ─────────────────────────────────────────────
  const premiumLabels = { rapido: 'rápidos', vip: 'VIP', alto_valor: 'alto valor', reincidente: 'reincidentes' };
  for (const row of buyerTrend) {
    if (!premiumLabels[row.buyer_type]) continue;
    const recent = Number(row.recent || 0);
    const prev   = Number(row.prev   || 0);

    if (recent >= MIN_PURCHASES && prev > 0 && recent > prev * 1.5) {
      const delta = Math.round(((recent - prev) / prev) * 100);
      alerts.push({
        tipo:        'buyer_type_increase',
        severidad:   'info',
        periodo:     `últimos ${PERIOD_7} días vs 7 días anteriores`,
        titulo:      `+${delta}% compradores ${premiumLabels[row.buyer_type]}`,
        explicacion: `Compradores ${premiumLabels[row.buyer_type]}: ${recent} esta semana vs ${prev} la anterior (+${delta}%).`,
        evidencia: {
          buyer_type: row.buyer_type,
          recent_7d:  recent,
          prev_7d:    prev,
          delta_pct:  delta,
          periodo:    `${PERIOD_7}d vs 7d anteriores`,
        },
        accion_sugerida: `Identificar qué creativos y ciudades atraen compradores ${premiumLabels[row.buyer_type]}. Duplicar esos anuncios.`,
        requiere_aprobacion: false,
      });
    }
  }

  // ── Caída de conversión — diferencia entre caída de demanda y caída de cierre ──
  const recentLeads     = Number(convTrend?.recent_leads     || 0);
  const prevLeads       = Number(convTrend?.prev_leads       || 0);
  const recentPurchased = Number(convTrend?.recent_purchased || 0);
  const prevPurchased   = Number(convTrend?.prev_purchased   || 0);

  const leadsDrop    = prevLeads > 0 && recentLeads < prevLeads * 0.5;
  const purchaseDrop = prevPurchased >= MIN_PURCHASES && recentPurchased < prevPurchased * 0.6;

  // Solo alertar si hay tráfico activo (no si campañas están pausadas y leads cayeron también)
  if (purchaseDrop && recentLeads >= MIN_LEADS) {
    const delta       = Math.round(((recentPurchased - prevPurchased) / prevPurchased) * 100);
    const tipo_caida  = leadsDrop ? 'demanda_y_cierre' : 'cierre';
    const accionCaida = leadsDrop
      ? 'Caída de demanda y compras a la vez — posible pausa de campaña. Verificar estado en Meta antes de actuar.'
      : 'Tráfico activo pero caen las compras. Revisar equipo de ventas, seguimiento por WhatsApp y proceso de cierre.';

    alerts.push({
      tipo:        'conversion_drop',
      severidad:   'alta',
      periodo:     `últimos ${PERIOD_7} días vs 7 días anteriores`,
      titulo:      tipo_caida === 'cierre'
        ? `Caída de cierre: ${Math.abs(delta)}% menos compras con tráfico activo`
        : `Caída total: ${Math.abs(delta)}% menos compras`,
      explicacion: `${recentPurchased} compras esta semana vs ${prevPurchased} la anterior (${delta}%). Leads: ${recentLeads} vs ${prevLeads} anterior.`,
      evidencia: {
        recent_purchased: recentPurchased,
        prev_purchased:   prevPurchased,
        recent_leads:     recentLeads,
        prev_leads:       prevLeads,
        delta_pct:        delta,
        tipo_caida,
        periodo:          `${PERIOD_7}d vs 7d anteriores`,
      },
      accion_sugerida: accionCaida,
      requiere_aprobacion: false,
    });
  }

  // ── Producto ganador — señal principal: compras reales + revenue + tasa ───
  if (productWinner) {
    const w = productWinner;
    alerts.push({
      tipo:        'product_winner',
      severidad:   'info',
      periodo:     `últimos ${PERIOD_30} días`,
      titulo:      `Producto ganador: ${w.product_name}`,
      explicacion: `${w.product_name}: ${pct(w.purchase_rate)}% conversión, ${w.purchased} compras reales, Gs. ${fmt(w.revenue)} revenue.`,
      evidencia: {
        product_slug:      w.product_slug,
        product_name:      w.product_name,
        total_leads:       w.total_leads,
        purchased:         w.purchased,
        revenue:           w.revenue,
        purchase_rate_pct: pct(w.purchase_rate),
        periodo:           PERIOD_30,
      },
      accion_sugerida: `Aumentar presupuesto en campañas de ${w.product_name}. Duplicar los creativos ganadores de este producto.`,
      requiere_aprobacion: false,
    });
  }

  // ── Producto en riesgo — muchos leads, pocas compras ─────────────────────
  if (productLoser) {
    const l = productLoser;
    const deadRate   = Number(l.total_leads) > 0 ? Number(l.dead_leads || 0) / Number(l.total_leads) : 0;
    const posible_causa = Number(l.purchased) === 0
      ? 'Sin ninguna compra — revisar landing, precio y promesa del anuncio'
      : deadRate >= 0.5
        ? 'Alta tasa de leads vencidos — probable problema de calidad de tráfico'
        : 'Conversión muy baja — investigar proceso de cierre y seguimiento';

    alerts.push({
      tipo:        'product_risk',
      severidad:   'media',
      periodo:     `últimos ${PERIOD_30} días`,
      titulo:      `Producto en riesgo: ${l.product_name}`,
      explicacion: `${l.product_name}: ${pct(l.purchase_rate)}% conversión con ${l.total_leads} leads y solo ${l.purchased} compras reales.`,
      evidencia: {
        product_slug:      l.product_slug,
        product_name:      l.product_name,
        total_leads:       l.total_leads,
        purchased:         l.purchased,
        revenue:           l.revenue || 0,
        purchase_rate_pct: pct(l.purchase_rate),
        dead_leads:        l.dead_leads || 0,
        dead_rate_pct:     pct(deadRate),
        posible_causa,
        periodo:           PERIOD_30,
      },
      accion_sugerida: `${posible_causa}. Reducir presupuesto si la tendencia persiste más de 7 días.`,
      requiere_aprobacion: false,
    });
  }

  // Ordenar: alta → media → info
  const severityOrder = { alta: 0, media: 1, info: 2 };
  alerts.sort((a, b) => (severityOrder[a.severidad] ?? 3) - (severityOrder[b.severidad] ?? 3));

  return {
    alerts,
    generated_at:         new Date().toISOString(),
    global_conv_rate_pct: pct(globalConvRate),
    period_days:          PERIOD_30,
  };
}

// ── Queries ──────────────────────────────────────────────────────────────────

async function fetchCreativeLeads(DB, since) {
  const { results } = await DB.prepare(`
    SELECT
      ad_id,
      MAX(ad_name)                                                             AS ad_name,
      MAX(campaign_name)                                                       AS campaign_name,
      COUNT(*)                                                                 AS total_leads,
      SUM(CASE WHEN status = 'purchased' THEN 1 ELSE 0 END)                   AS purchased,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)                   AS cancelled,
      SUM(CASE WHEN status = 'purchased' THEN COALESCE(value, 0) ELSE 0 END)  AS revenue,
      CAST((julianday(MAX(created_at)) - julianday(MIN(created_at))) AS INTEGER) + 1 AS data_days
    FROM leads
    WHERE created_at >= ? AND ad_id IS NOT NULL
    GROUP BY ad_id
    ORDER BY total_leads DESC
    LIMIT 50
  `).bind(since).all();
  return results || [];
}

async function fetchCreativeLQ(DB, since) {
  try {
    const { results } = await DB.prepare(`
      SELECT
        ad_id,
        SUM(CASE WHEN is_dead_lead = 1 THEN 1 ELSE 0 END)                    AS dead_leads,
        AVG(CASE WHEN status_snapshot = 'purchased' THEN quality_score END)   AS avg_score
      FROM lead_quality
      WHERE processed_at >= ? AND ad_id IS NOT NULL
      GROUP BY ad_id
    `).bind(since).all();
    return results || [];
  } catch (e) {
    console.warn('ALERT_ENGINE_LQ_WARN', e.message);
    return [];
  }
}

// Agrupa por (ciudad, producto) — una fila por combinación única
async function fetchCityDataByProduct(DB, since) {
  const { results } = await DB.prepare(`
    SELECT
      LOWER(TRIM(COALESCE(location_city, city, 'sin_ciudad')))                       AS city,
      COALESCE(product_slug, 'sin_producto')                                          AS product_slug,
      MAX(COALESCE(product_name, product_slug, 'Sin nombre'))                         AS product_name,
      MAX(campaign_name)                                                               AS campaign_name,
      COUNT(*)                                                                         AS total_leads,
      SUM(CASE WHEN status = 'purchased' THEN 1 ELSE 0 END)                           AS purchased,
      SUM(CASE WHEN status = 'purchased' THEN COALESCE(value, 0) ELSE 0 END)          AS revenue,
      SUM(CASE WHEN status = 'pending' AND created_at < datetime('now', '-5 days')
               THEN 1 ELSE 0 END)                                                     AS stale,
      CAST((julianday(MAX(created_at)) - julianday(MIN(created_at))) AS INTEGER) + 1  AS data_days
    FROM leads
    WHERE created_at >= ?
      AND (location_city IS NOT NULL OR city IS NOT NULL)
    GROUP BY LOWER(TRIM(COALESCE(location_city, city, 'sin_ciudad'))),
             COALESCE(product_slug, 'sin_producto')
    HAVING total_leads >= 5
    ORDER BY purchased DESC, total_leads DESC
    LIMIT 100
  `).bind(since).all();
  return results || [];
}

async function fetchBuyerTrend(DB, since7, since14) {
  try {
    const { results } = await DB.prepare(`
      SELECT
        lq.buyer_type,
        SUM(CASE WHEN l.purchased_at >= ?                         THEN 1 ELSE 0 END) AS recent,
        SUM(CASE WHEN l.purchased_at >= ? AND l.purchased_at < ?  THEN 1 ELSE 0 END) AS prev
      FROM lead_quality lq
      JOIN leads l ON l.id = lq.lead_id
      WHERE l.status = 'purchased'
        AND lq.buyer_type IN ('rapido', 'vip', 'alto_valor', 'reincidente')
      GROUP BY lq.buyer_type
    `).bind(since7, since14, since7).all();
    return results || [];
  } catch (e) {
    console.warn('ALERT_ENGINE_BUYER_TREND_WARN', e.message);
    return [];
  }
}

// v3: incluye prev_leads para diferenciar caída de demanda vs caída de cierre
async function fetchConversionTrend(DB, since7, since14) {
  try {
    const { results } = await DB.prepare(`
      SELECT
        COUNT(CASE WHEN created_at >= ? THEN 1 END)                                 AS recent_leads,
        COUNT(CASE WHEN created_at >= ? AND created_at < ? THEN 1 END)              AS prev_leads,
        COUNT(CASE WHEN status = 'purchased' AND purchased_at >= ? THEN 1 END)      AS recent_purchased,
        COUNT(CASE WHEN status = 'purchased' AND purchased_at >= ?
                        AND purchased_at < ? THEN 1 END)                            AS prev_purchased
      FROM leads
      WHERE created_at >= ?
    `).bind(since7, since14, since7, since7, since14, since7, since14).all();
    return results?.[0] || {};
  } catch (e) {
    console.warn('ALERT_ENGINE_CONV_TREND_WARN', e.message);
    return {};
  }
}

// v4: devuelve rows + rateMap (product_slug → purchase_rate). NO selecciona winner/loser
// aquí — esa selección requiere el filtro de actividad Meta y se hace en generateAlerts.
// rateMap es histórico (sin filtrar), usado como baseline de comparación para ciudades.
async function fetchProductStats(DB, since30) {
  try {
    const { results } = await DB.prepare(`
      SELECT
        COALESCE(l.product_slug, 'sin_producto')                    AS product_slug,
        MAX(COALESCE(l.product_name, l.product_slug, 'Sin nombre')) AS product_name,
        COUNT(*)                                                     AS total_leads,
        SUM(CASE WHEN l.status = 'purchased' THEN 1 ELSE 0 END)    AS purchased,
        SUM(CASE WHEN l.status = 'purchased'
                 THEN COALESCE(l.value, 0) ELSE 0 END)             AS revenue,
        COUNT(CASE WHEN lq.is_dead_lead = 1 THEN 1 END)             AS dead_leads
      FROM leads l
      LEFT JOIN lead_quality lq ON lq.lead_id = l.id
      WHERE l.created_at >= ?
        AND l.product_slug IS NOT NULL AND l.product_slug != ''
      GROUP BY COALESCE(l.product_slug, 'sin_producto')
      HAVING total_leads >= ?
      ORDER BY purchased DESC
      LIMIT 20
    `).bind(since30, MIN_LEADS).all();

    const rows = (results || []).map(r => ({
      ...r,
      purchase_rate: Number(r.total_leads) > 0 ? Number(r.purchased) / Number(r.total_leads) : 0,
    }));

    const rateMap = new Map();
    for (const r of rows) rateMap.set(String(r.product_slug), r.purchase_rate);

    return { rows, rateMap };
  } catch (e) {
    console.warn('ALERT_ENGINE_PRODUCT_WARN', e.message);
    return { rows: [], rateMap: new Map() };
  }
}

// v4: product_slug con al menos un ad_id activo en Meta, dentro de la ventana de 30 días.
// activeAdIds === null  → filtro no disponible (Meta no respondió) → devuelve null (fail-safe)
// activeAdIds.size === 0 → Meta respondió pero no hay ningún ad activo → devuelve Set vacío
async function fetchActiveProductSlugs(DB, since30, activeAdIds) {
  if (activeAdIds === null) return null;
  if (activeAdIds.size === 0) return new Set();

  try {
    const { results } = await DB.prepare(`
      SELECT DISTINCT ad_id, product_slug
      FROM leads
      WHERE created_at >= ?
        AND ad_id IS NOT NULL
        AND product_slug IS NOT NULL AND product_slug != ''
    `).bind(since30).all();

    const slugs = new Set();
    for (const r of (results || [])) {
      if (activeAdIds.has(String(r.ad_id))) slugs.add(String(r.product_slug));
    }
    return slugs;
  } catch (e) {
    console.warn('ALERT_ENGINE_ACTIVE_SLUGS_WARN', e.message);
    return null; // error de D1 → tratar como filtro no disponible, fail-safe
  }
}

async function fetchGlobalStats(DB, since) {
  try {
    const { results } = await DB.prepare(`
      SELECT
        COUNT(*)                                               AS total_leads,
        SUM(CASE WHEN status = 'purchased' THEN 1 ELSE 0 END) AS total_purchased
      FROM leads
      WHERE created_at >= ?
    `).bind(since).all();
    return results?.[0] || { total_leads: 0, total_purchased: 0 };
  } catch (e) {
    console.warn('ALERT_ENGINE_GLOBAL_WARN', e.message);
    return { total_leads: 0, total_purchased: 0 };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function pct(rate) { return Math.round((rate || 0) * 100); }

function fmt(n) { return Math.round(n || 0).toLocaleString('es-PY'); }

function getConfidence(total_leads, purchased) {
  if (total_leads >= 50 || purchased >= 10) return 'Alta';
  if (total_leads >= 20 || purchased >= 5)  return 'Media';
  return 'Baja';
}

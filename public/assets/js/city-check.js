(function () {
  'use strict';

  var WA_NUMBER = '595993471550';

  var VALID_CITIES = [
    // Alto Paraná
    'ciudad del este','colonia iguazu','hernan darias','juan leon mallorquin',
    'minga iguazu','presidente franco','san alberto','santa rita iguazu',
    // Amambay
    'pedro juan caballero',
    // Caaguazú
    'caaguazu','coronel oviedo','felix perez cardoso','mauricio jose troche',
    'natalicio talavera','repatriacion','san jose de los arroyos','yataiti del norte',
    // Central
    'asuncion','luque','san lorenzo','capiata','lambare','fernando de la mora',
    'limpio','nemby','villa elisa','mariano roque alonso','ita','ypane','aregua',
    'itaugua','nueva italia central','guarambare','juan de mena','ypacarai','villeta',
    'san antonio',
    // Cordillera
    'altos','atira','caacupe','caraguatay','emboscada','eusebio ayala',
    'itacurubi de la cordillera','loma grande','nueva italia','piribebu',
    'san bernardino','santa elena','tobati','tupacai',
    // Guairá
    'borja','bocayatu','villarrica',
    // Paraguarí
    'carapegua','escobar','general bernardino caballero',
    'paraguari','pirayu','sapucai','yaguaron',
    // Presidente Hayes
    'benjamin aceval','remansito','villa hayes',
  ];

  function normalizeCity(str) {
    if (!str) return '';
    return str.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .trim().replace(/\s+/g, ' ');
  }

  function isCityCovered(city) {
    if (!city) return false;
    var n = normalizeCity(city);
    return VALID_CITIES.some(function (c) { return normalizeCity(c) === n; });
  }

  function buildMsg(body) {
    var city = (body.city || '').trim();
    var express = !!body.express;
    var lines = [
      'NUEVO PEDIDO DAM VERTEX ✅',
      'Total: Gs. ' + Number(body.value || 0).toLocaleString('es-PY') + (express ? ' (express incluido)' : ''),
    ];
    lines.push('Producto: ' + (body.product_name || body.product_slug || ''));
    lines.push('Nombre: ' + (body.name || ''));
    lines.push('Teléfono: ' + (body.phone || ''));
    lines.push('Ciudad: ' + (city || '(no especificada)'));
    lines.push('Cantidad: ' + (body.quantity || 1));
    if (body.street) lines.push('Dirección: ' + body.street);
    return lines.join('\n');
  }

  var _pendingWaUrl = null;

  /* Intercepta fetch a /api/dcanp-lead y guarda la URL de WA si la ciudad no está cubierta */
  var _origFetch = window.fetch.bind(window);
  window.fetch = async function (url, opts) {
    var res = await _origFetch(url, opts);
    if (typeof url === 'string' && url === '/api/dcanp-lead') {
      try {
        var body = JSON.parse((opts && opts.body) || '{}');
        if (!isCityCovered(body.city)) {
          _pendingWaUrl = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(buildMsg(body));
        }
      } catch (_) {}
    }
    return res;
  };

  /* Observa la pantalla de éxito DCANP: si se activa y hay pendiente → redirige a WA.
     Soporta dos patrones de activación:
     1. classList.add('visible') en elemento con class="dcanp-success"
     2. style.display='block'/'flex'/'' en elemento con id="dcanp-success" */
  function redirectIfPending(el) {
    if (!_pendingWaUrl) return;
    var url = _pendingWaUrl;
    _pendingWaUrl = null;
    /* Ocultar el elemento para que el usuario no vea la pantalla de éxito antes del redirect */
    try { el.style.display = 'none'; el.classList.remove('visible'); } catch (_) {}
    window.location.href = url;
  }

  function observe() {
    var obs = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        var el = m.target;
        /* Patrón 1: .dcanp-success con clase 'visible' */
        if (m.attributeName === 'class' && el.classList.contains('dcanp-success') && el.classList.contains('visible')) {
          redirectIfPending(el);
        }
        /* Patrón 2: #dcanp-success o .dcanp-success con style.display cambiado a visible */
        if (m.attributeName === 'style') {
          var d = el.style.display;
          if (d && d !== 'none') redirectIfPending(el);
        }
      });
    });

    /* Observar elementos con class dcanp-success (incluye variantes con prefijo) */
    var byClass = document.querySelectorAll('.dcanp-success');
    byClass.forEach(function (el) {
      obs.observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
    });

    /* Observar elemento con id dcanp-success (patrón antiguo sin clase) */
    var byId = document.getElementById('dcanp-success');
    if (byId && !byId.classList.contains('dcanp-success')) {
      obs.observe(byId, { attributes: true, attributeFilter: ['style'] });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observe);
  } else {
    observe();
  }
})();

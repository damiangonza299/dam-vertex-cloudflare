/* =========================================================
   Dam Vertex — Location Picker v2 (Google Places + Mapa Inmediato)
   Mapa visible desde apertura del modal — default center Paraguay/Central
   DV.initLocationPicker('m',  window.DV_MAPS_KEY)   → order-modal
   DV.initLocationPicker('cm', window.DV_MAPS_KEY)   → combo-modal
   ========================================================= */

window.DV = window.DV || {};

(function () {
  'use strict';

  console.log('[DV-LOC VERSION] 20260529 city-guard v55 loaded');

  var DEFAULT_CENTER = { lat: -25.3397, lng: -57.5088 };
  var DEFAULT_ZOOM   = 10;

  var _mapsLoaded    = false;
  var _mapsLoading   = false;
  var _mapsCallbacks = [];

  /* Dark mode para el dropdown de Places — DEBE ser oscuro, no blanco */
  (function () {
    var s = document.createElement('style');
    s.textContent =
      '.pac-container{z-index:999999!important;background:#111!important;border:1px solid #2a2a2a;border-radius:8px;margin-top:2px;box-shadow:0 8px 24px rgba(0,0,0,.85)}' +
      '.pac-item{font-size:13px;padding:8px 12px;cursor:pointer;border-top:1px solid #1f1f1f;color:#ccc;background:transparent}' +
      '.pac-item:hover,.pac-item-selected{background:#1e1e1e!important}' +
      '.pac-item-query{font-size:13px;color:#fff}' +
      '.pac-secondary-text{font-size:11px;color:rgba(255,255,255,.45)}' +
      '.pac-matched{font-weight:700;color:#fff}' +
      '.pac-icon{filter:invert(1) brightness(.55)}' +
      '[id$="-location-map-canvas"]{touch-action:none}' +
      '.gm-style-cc{display:none!important}';
    document.head.appendChild(s);
  })();

  function loadMapsApi(key, cb) {
    if (_mapsLoaded) { cb(); return; }
    _mapsCallbacks.push(cb);
    if (_mapsLoading) return;
    _mapsLoading = true;
    var s = document.createElement('script');
    s.async = true;
    s.defer = true;
    s.src = 'https://maps.googleapis.com/maps/api/js'
      + '?key=' + encodeURIComponent(key)
      + '&libraries=places&language=es&region=PY';
    s.onload = function () {
      _mapsLoaded = true;
      var cbs = _mapsCallbacks.slice();
      _mapsCallbacks = [];
      cbs.forEach(function (fn) { fn(); });
    };
    s.onerror = function () {
      console.warn('DV LocationPicker: error al cargar Google Maps API');
      _mapsLoading = false;
      _mapsCallbacks = [];
    };
    document.head.appendChild(s);
  }

  function extractCity(components) {
    var priority = ['locality', 'postal_town', 'administrative_area_level_3', 'administrative_area_level_2', 'sublocality_level_1', 'sublocality', 'neighborhood'];
    for (var t = 0; t < priority.length; t++) {
      for (var i = 0; i < components.length; i++) {
        if (components[i].types && components[i].types.indexOf(priority[t]) !== -1) {
          return components[i].long_name;
        }
      }
    }
    return '';
  }

  DV.initLocationPicker = function (prefix, mapsKey) {
    var p = prefix || 'm';

    var inputEl = document.getElementById(p + '-location');
    if (!inputEl) return;
    if (inputEl._dvLocInit) return;
    inputEl._dvLocInit = true;

    var addrEl    = document.getElementById(p + '-loc-address');
    var locCityEl = document.getElementById(p + '-loc-city');
    var latEl     = document.getElementById(p + '-loc-lat');
    var lngEl     = document.getElementById(p + '-loc-lng');
    var mapsUrlEl = document.getElementById(p + '-loc-maps-url');
    var placeIdEl = document.getElementById(p + '-loc-place-id');
    var mapDiv    = document.getElementById(p + '-location-map');
    var mapCanvas = document.getElementById(p + '-location-map-canvas');

    var cityHiddenEl = document.getElementById(p === 'm' ? 'm-city' : 'cm-city');
    var citySearchEl = document.getElementById(p === 'm' ? 'm-city-search' : null);
    var manualWrapEl = document.getElementById(p === 'm' ? 'city-manual-wrap' : null);

    var _map      = null;
    var _marker   = null;
    var _geocoder = null;
    var _overlay  = null;
    var _noticeEl = null;

    /* ── OVERLAY (bloquea mapa hasta place_changed) ──────────────────── */
    function buildOverlay() {
      if (!mapDiv) return null;
      var ov = document.createElement('div');
      ov.style.cssText =
        'position:absolute;inset:0;z-index:10;display:flex;flex-direction:column;' +
        'align-items:center;justify-content:center;background:rgba(0,0,0,0.60);' +
        'border-radius:inherit;pointer-events:all;cursor:default;text-align:center;' +
        'padding:20px;box-sizing:border-box;user-select:none;';
      ov.innerHTML =
        '<svg style="margin-bottom:10px;opacity:.85" width="32" height="32" fill="none" stroke="#fff" stroke-width="1.8" viewBox="0 0 24 24">' +
          '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>' +
        '</svg>' +
        '<p style="color:#fff;font-size:14px;font-weight:700;margin:0 0 6px;line-height:1.4;text-shadow:0 1px 4px rgba(0,0,0,.6)">' +
          'Primero buscá tu ciudad o referencia.' +
        '</p>' +
        '<p style="color:rgba(255,255,255,.8);font-size:12px;margin:0;line-height:1.5">' +
          'Luego ajustá el pin si hace falta.' +
        '</p>';
      ['click', 'mousedown', 'touchstart', 'wheel', 'touchmove'].forEach(function (ev) {
        ov.addEventListener(ev, function (e) {
          e.stopPropagation();
          if (ev !== 'click') e.preventDefault && e.preventDefault();
        }, { passive: false });
      });
      return ov;
    }

    function lockMap() {
      if (_marker) _marker.setDraggable(false);
      if (_map) _map.setOptions({ gestureHandling: 'none', draggable: false, scrollwheel: false });
      if (mapDiv && !_overlay) {
        _overlay = buildOverlay();
        if (_overlay) {
          mapDiv.style.position = 'relative';
          mapDiv.appendChild(_overlay);
        }
      }
      inputEl._dvMapUnlocked   = false;
      inputEl._dvPlaceSelected = false;
    }

    function unlockMap() {
      if (_marker) _marker.setDraggable(true);
      if (_map) _map.setOptions({ gestureHandling: 'greedy', draggable: true, scrollwheel: true });
      if (_overlay && _overlay.parentNode) {
        _overlay.parentNode.removeChild(_overlay);
        _overlay = null;
      }
      inputEl._dvMapUnlocked = true;
    }

    /* ── AVISO debajo del mapa ───────────────────────────────────────── */
    function buildNotice() {
      if (!mapDiv || !mapDiv.parentNode) return null;
      var el = document.createElement('div');
      el.style.cssText =
        'display:none;margin-top:8px;padding:9px 14px;border-radius:8px;' +
        'background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35);' +
        'font-size:12px;color:#fecaca;line-height:1.5;text-align:center;';
      mapDiv.parentNode.insertBefore(el, mapDiv.nextSibling);
      return el;
    }

    function showNotice(msg) {
      if (!_noticeEl) _noticeEl = buildNotice();
      if (!_noticeEl) return;
      _noticeEl.textContent = msg;
      _noticeEl.style.display = 'block';
    }

    function hideNotice() {
      if (_noticeEl) _noticeEl.style.display = 'none';
    }

    /* ── FILL / CLEAR ────────────────────────────────────────────────── */
    function fillFields(lat, lng, addr, city, pid) {
      var mapsUrl = 'https://www.google.com/maps?q=' + lat + ',' + lng;
      if (addrEl)    addrEl.value    = addr;
      if (locCityEl) locCityEl.value = city;
      if (latEl)     latEl.value     = lat;
      if (lngEl)     lngEl.value     = lng;
      if (mapsUrlEl) mapsUrlEl.value = mapsUrl;
      if (placeIdEl) placeIdEl.value = pid || '';
      if (city) {
        if (cityHiddenEl) cityHiddenEl.value = city;
        if (citySearchEl) citySearchEl.value = city;
        if (manualWrapEl) manualWrapEl.style.display = 'none';
      }
      inputEl._dvPlaceSelected = true;
      inputEl._dvSelectedCity  = city;  /* ciudad baseline — nunca se borra */
      hideNotice();
      var grp = inputEl.closest && inputEl.closest('.form-group');
      if (grp) {
        var errEl = grp.querySelector('.form-error-msg');
        if (errEl) errEl.classList.remove('visible');
        inputEl.classList.remove('error');
      }
    }

    function clearFields() {
      if (addrEl)    addrEl.value    = '';
      if (locCityEl) locCityEl.value = '';
      if (latEl)     latEl.value     = '';
      if (lngEl)     lngEl.value     = '';
      if (mapsUrlEl) mapsUrlEl.value = '';
      if (placeIdEl) placeIdEl.value = '';
      inputEl._dvPlaceSelected = false;
      inputEl._dvSelectedCity  = '';
      hideNotice();
      lockMap();
      if (_marker) _marker.setPosition(DEFAULT_CENTER);
      if (_map)    { _map.setCenter(DEFAULT_CENTER); _map.setZoom(DEFAULT_ZOOM); }
    }

    /* ── MAPA ────────────────────────────────────────────────────────── */
    function buildMap(center, zoom) {
      if (!mapCanvas) return;
      if (mapDiv) mapDiv.style.display = 'block';

      if (!_map) {
        _map = new google.maps.Map(mapCanvas, {
          center:           center,
          zoom:             zoom,
          disableDefaultUI: true,
          zoomControl:      true,
          gestureHandling:  'none',
          draggable:        false,
          scrollwheel:      false,
        });

        _marker = new google.maps.Marker({
          position:  center,
          map:       _map,
          draggable: false,
          title:     'Mové para ajustar tu ubicación exacta',
        });

        _geocoder = new google.maps.Geocoder();

        /* Overlay inicial */
        if (mapDiv) {
          mapDiv.style.position = 'relative';
          _overlay = buildOverlay();
          if (_overlay) mapDiv.appendChild(_overlay);
        }

        /* dragend — solo activo tras unlock */
        _marker.addListener('dragend', function () {
          if (!inputEl._dvMapUnlocked) return;

          var pos    = _marker.getPosition();
          var newLat = pos.lat();
          var newLng = pos.lng();

          /* Siempre actualizar lat/lng/maps_url con la posición real del pin */
          if (latEl)     latEl.value     = newLat;
          if (lngEl)     lngEl.value     = newLng;
          if (mapsUrlEl) mapsUrlEl.value = 'https://www.google.com/maps?q=' + newLat + ',' + newLng;

          _geocoder.geocode({ location: { lat: newLat, lng: newLng } }, function (results, status) {

            if (status !== 'OK' || !results || !results.length) {
              showNotice('Revisá que la ciudad que buscaste coincida con el lugar exacto del pin rojo para una entrega rápida y segura.');
              return;
            }

            var addr = results[0].formatted_address || '';
            var pid  = results[0].place_id || '';

            var newCity = '';
            for (var ri = 0; ri < results.length && !newCity; ri++) {
              newCity = extractCity(results[ri].address_components || []);
            }

            /* Actualizar dirección visible siempre */
            if (addr) {
              if (addrEl)  addrEl.value  = addr;
              if (inputEl) inputEl.value = addr;
            }
            if (pid && placeIdEl) placeIdEl.value = pid;

            if (newCity) {
              /* Geocoder detectó ciudad — actualizar */
              if (locCityEl)    locCityEl.value    = newCity;
              if (cityHiddenEl) cityHiddenEl.value = newCity;
              if (citySearchEl) citySearchEl.value = newCity;

              var base = inputEl._dvSelectedCity || '';
              if (base && newCity !== base) {
                /* Ciudad cambió respecto a la seleccionada — avisar */
                showNotice('Detectamos que el pin está en ' + newCity + '. Usaremos esa ubicación para la entrega.');
              } else {
                /* Misma ciudad o sin baseline — sin aviso */
                hideNotice();
              }
            } else {
              showNotice('Revisá que la ciudad que buscaste coincida con el lugar exacto del pin rojo para una entrega rápida y segura.');
            }
          });
        });

        /* ResizeObserver: redibuja automáticamente cuando el modal se hace visible */
        if (typeof ResizeObserver !== 'undefined') {
          new ResizeObserver(function () {
            if (_map) {
              google.maps.event.trigger(_map, 'resize');
              _map.setCenter(_map.getCenter());
            }
          }).observe(mapCanvas);
        }

      } else {
        /* Mapa ya existe — solo mover centro y marker */
        _map.setCenter(center);
        _map.setZoom(zoom);
        _marker.setPosition(center);
      }

      /* Fallback resize para modales con overflow:hidden */
      setTimeout(function () {
        google.maps.event.trigger(_map, 'resize');
        _map.setCenter(center);
      }, 150);
    }

    /* ── PLACE SELECTED ──────────────────────────────────────────────── */
    function onPlaceSelected(ac) {
      var place = ac.getPlace();
      if (!place || !place.geometry || !place.geometry.location) {
        clearFields();
        return;
      }
      var lat  = place.geometry.location.lat();
      var lng  = place.geometry.location.lng();
      var addr = place.formatted_address || place.name || inputEl.value;
      var pid  = place.place_id || '';
      var city = extractCity(place.address_components || []);
      fillFields(lat, lng, addr, city, pid);
      buildMap({ lat: lat, lng: lng }, 16);
      unlockMap();
    }

    if (!mapsKey) {
      console.warn('DV LocationPicker: window.DV_MAPS_KEY no está configurado. Input funciona como texto libre.');
      return;
    }

    /* Carga INMEDIATA — el mapa aparece al abrir el modal, bloqueado con overlay */
    loadMapsApi(mapsKey, function () {
      buildMap(DEFAULT_CENTER, DEFAULT_ZOOM);

      var bounds = new google.maps.LatLngBounds(
        new google.maps.LatLng(-27.59, -62.64),
        new google.maps.LatLng(-19.28, -54.24)
      );
      var ac = new google.maps.places.Autocomplete(inputEl, {
        bounds:                bounds,
        componentRestrictions: { country: 'py' },
        fields:                ['formatted_address', 'geometry', 'place_id', 'address_components', 'name'],
        strictBounds:          false,
      });
      ac.addListener('place_changed', function () { onPlaceSelected(ac); });
    });

    /* Si el usuario borra el campo → re-bloquear mapa */
    inputEl.addEventListener('input', function () {
      if (!inputEl.value.trim()) clearFields();
    });
  };

})();

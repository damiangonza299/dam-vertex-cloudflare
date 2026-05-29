/* =========================================================
   Dam Vertex — Location Picker v2 (Google Places + Mapa Inmediato)
   Mapa visible desde apertura del modal — default center Paraguay/Central
   DV.initLocationPicker('m',  window.DV_MAPS_KEY)   → order-modal
   DV.initLocationPicker('cm', window.DV_MAPS_KEY)   → combo-modal
   ========================================================= */

window.DV = window.DV || {};

(function () {
  'use strict';

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
      inputEl._dvLocConfirmed = true;
      var grp = inputEl.closest && inputEl.closest('.form-group');
      if (grp) {
        var errEl = grp.querySelector('.form-error-msg');
        if (errEl) errEl.classList.remove('visible');
        inputEl.classList.remove('error');
      }
    }

    /* Limpiar campos — el mapa queda visible, marker vuelve al centro default */
    function clearFields() {
      if (addrEl)    addrEl.value    = '';
      if (locCityEl) locCityEl.value = '';
      if (latEl)     latEl.value     = '';
      if (lngEl)     lngEl.value     = '';
      if (mapsUrlEl) mapsUrlEl.value = '';
      if (placeIdEl) placeIdEl.value = '';
      inputEl._dvLocConfirmed = false;
      if (_marker) _marker.setPosition(DEFAULT_CENTER);
      if (_map)    { _map.setCenter(DEFAULT_CENTER); _map.setZoom(DEFAULT_ZOOM); }
    }

    /* Construye o actualiza el mapa. Primera llamada: center=DEFAULT_CENTER */
    function buildMap(center, zoom) {
      if (!mapCanvas) return;
      if (mapDiv) mapDiv.style.display = 'block';

      if (!_map) {
        _map = new google.maps.Map(mapCanvas, {
          center:           center,
          zoom:             zoom,
          disableDefaultUI: true,
          zoomControl:      true,
          gestureHandling:  'greedy',
        });

        _marker = new google.maps.Marker({
          position:  center,
          map:       _map,
          draggable: true,
          title:     'Mové para ajustar tu ubicación exacta',
        });

        _geocoder = new google.maps.Geocoder();

        /* Reverse geocoding al soltar el pin */
        _marker.addListener('dragend', function () {
          var pos    = _marker.getPosition();
          var newLat = pos.lat();
          var newLng = pos.lng();

          /* Lat/lng/maps_url se graban de inmediato (sync) */
          if (latEl)     latEl.value     = newLat;
          if (lngEl)     lngEl.value     = newLng;
          if (mapsUrlEl) mapsUrlEl.value = 'https://www.google.com/maps?q=' + newLat + ',' + newLng;

          /* NO confirmar hasta que geocoder responda — evita submit con city vacío */
          inputEl._dvLocConfirmed    = false;
          inputEl._dvGeocoderPending = true;

          /* Limpiar ciudad previa — evita contaminación durante geocoding */
          if (locCityEl)    locCityEl.value    = '';
          if (cityHiddenEl) cityHiddenEl.value = '';
          if (citySearchEl) citySearchEl.value = '';

          console.log('[DV-LOC] dragend lat:', newLat, 'lng:', newLng);

          /* Geocoding inverso — confirma y escribe ciudad cuando responde */
          _geocoder.geocode({ location: { lat: newLat, lng: newLng } }, function (results, status) {
            console.log('[DV-LOC] geocoder status:', status, '| results:', results ? results.length : 0);

            /* Confirmar siempre — lat/lng son válidos independientemente del geocoder */
            inputEl._dvLocConfirmed    = true;
            inputEl._dvGeocoderPending = false;

            /* Limpiar error "Detectando..." si se estaba mostrando */
            var grp2 = inputEl.closest && inputEl.closest('.form-group');
            if (grp2) {
              var errEl2 = grp2.querySelector('.form-error-msg');
              if (errEl2) errEl2.classList.remove('visible');
              inputEl.classList.remove('error');
            }

            if (status !== 'OK' || !results || !results.length) {
              console.log('[DV-LOC] geocoder falló — sin ciudad, lat/lng confirmados');
              return;
            }

            if (results[0] && results[0].address_components) {
              console.log('[DV-LOC] components[0..4]:', results[0].address_components.slice(0, 5).map(function (c) {
                return c.long_name + '[' + (c.types || []).join(',') + ']';
              }));
            }

            var addr = results[0].formatted_address || '';
            var pid  = results[0].place_id || '';

            /* Buscar ciudad en TODOS los results — results[0] suele ser plus_code sin locality */
            var city = '';
            for (var ri = 0; ri < results.length && !city; ri++) {
              city = extractCity(results[ri].address_components || []);
            }
            console.log('[DV-LOC] city encontrada:', city || '(ninguna)');

            if (addr) {
              if (addrEl)  addrEl.value  = addr;
              if (inputEl) inputEl.value = addr;
            }
            if (city) {
              if (locCityEl)    locCityEl.value    = city;
              if (cityHiddenEl) cityHiddenEl.value = city;
              if (citySearchEl) citySearchEl.value = city;
              if (manualWrapEl) manualWrapEl.style.display = 'none';
            }
            if (pid && placeIdEl) placeIdEl.value = pid;

            console.log('[DV-LOC] locCityEl final:', locCityEl ? locCityEl.value : 'null');
            console.log('[DV-LOC] cityHiddenEl final:', cityHiddenEl ? cityHiddenEl.value : 'null');
          });
        });

        /* ResizeObserver: redibuja automáticamente cuando el modal se hace visible
           (el canvas pasa de dimensiones 0 a dimensiones reales) */
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
    }

    if (!mapsKey) {
      console.warn('DV LocationPicker: window.DV_MAPS_KEY no está configurado. Input funciona como texto libre.');
      return;
    }

    /* Carga INMEDIATA — no lazy. El mapa aparece al abrir el modal. */
    loadMapsApi(mapsKey, function () {
      /* Mostrar mapa en centro default de Paraguay */
      buildMap(DEFAULT_CENTER, DEFAULT_ZOOM);

      /* Autocomplete con boundary Paraguay */
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

    /* Si el usuario borra el campo → mapa queda pero marker vuelve al default */
    inputEl.addEventListener('input', function () {
      if (!inputEl.value.trim()) clearFields();
    });
  };

})();

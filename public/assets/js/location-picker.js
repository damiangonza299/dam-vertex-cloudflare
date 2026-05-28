/* =========================================================
   Dam Vertex — Location Picker (Google Places + Mapa Interactivo)
   Uso: DV.initLocationPicker('m', window.DV_MAPS_KEY)
        DV.initLocationPicker('cm', window.DV_MAPS_KEY)
   Prefijo 'm'  → campos del order-modal estándar
   Prefijo 'cm' → campos del combo-modal
   ========================================================= */

window.DV = window.DV || {};

(function () {
  'use strict';

  var _mapsLoaded    = false;
  var _mapsLoading   = false;
  var _mapsCallbacks = [];

  /* CSS para que el dropdown de Places quede sobre el modal */
  (function () {
    var s = document.createElement('style');
    s.textContent =
      '.pac-container { z-index: 999999 !important; border-radius: 8px; margin-top: 2px; }' +
      '.pac-item { font-size: 13px; padding: 8px 12px; cursor: pointer; }' +
      '.pac-item:hover { background: #1a1a1a; }' +
      '.pac-item-query { font-size: 13px; color: #fff; }' +
      '.pac-secondary-text { font-size: 11px; color: rgba(255,255,255,.45); }' +
      '.pac-matched { font-weight: 700; }';
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
    /* language=es, region=PY → mejores sugerencias para Paraguay */
    s.src = 'https://maps.googleapis.com/maps/api/js'
      + '?key=' + encodeURIComponent(key)
      + '&libraries=places'
      + '&language=es'
      + '&region=PY';
    s.onload = function () {
      _mapsLoaded = true;
      var cbs = _mapsCallbacks.slice();
      _mapsCallbacks = [];
      cbs.forEach(function (fn) { fn(); });
    };
    s.onerror = function () {
      console.warn('DV LocationPicker: no se pudo cargar Google Maps API');
      _mapsLoading   = false;
      _mapsCallbacks = [];
    };
    document.head.appendChild(s);
  }

  /* Extrae ciudad/localidad de address_components de Places/Geocoder */
  function extractCity(components) {
    var priority = ['locality', 'sublocality_level_1', 'sublocality', 'administrative_area_level_2'];
    for (var t = 0; t < priority.length; t++) {
      for (var i = 0; i < components.length; i++) {
        if (components[i].types && components[i].types.indexOf(priority[t]) !== -1) {
          return components[i].long_name;
        }
      }
    }
    return '';
  }

  /* Estilos oscuros del mapa (coherente con el tema negro de DAM Vertex) */
  var DARK_STYLES = [
    { elementType: 'geometry',                stylers: [{ color: '#1c1c1c' }] },
    { elementType: 'labels.text.fill',        stylers: [{ color: '#888' }] },
    { elementType: 'labels.text.stroke',      stylers: [{ color: '#111' }] },
    { featureType: 'road',  elementType: 'geometry',         stylers: [{ color: '#2a2a2a' }] },
    { featureType: 'road',  elementType: 'labels.text.fill', stylers: [{ color: '#666' }] },
    { featureType: 'water', elementType: 'geometry',         stylers: [{ color: '#0d0d0d' }] },
    { featureType: 'poi',   elementType: 'geometry',         stylers: [{ color: '#1a1a1a' }] },
    { featureType: 'poi',   elementType: 'labels.text.fill', stylers: [{ color: '#555' }] },
  ];

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

    /* Campos de ciudad de compatibilidad (city picker existente) */
    var cityHiddenEl = document.getElementById(p === 'm' ? 'm-city'        : 'cm-city');
    var citySearchEl = document.getElementById(p === 'm' ? 'm-city-search' : null);
    var manualWrapEl = document.getElementById(p === 'm' ? 'city-manual-wrap' : null);

    /* Instancias del mapa — se crean una sola vez por picker */
    var _map      = null;
    var _marker   = null;
    var _geocoder = null;

    function clearLocation() {
      if (addrEl)    addrEl.value    = '';
      if (locCityEl) locCityEl.value = '';
      if (latEl)     latEl.value     = '';
      if (lngEl)     lngEl.value     = '';
      if (mapsUrlEl) mapsUrlEl.value = '';
      if (placeIdEl) placeIdEl.value = '';
      if (mapDiv)    mapDiv.style.display = 'none';
    }

    function fillFields(lat, lng, addr, city, pid) {
      var mapsUrl = 'https://www.google.com/maps?q=' + lat + ',' + lng;
      if (addrEl)    addrEl.value    = addr;
      if (locCityEl) locCityEl.value = city;
      if (latEl)     latEl.value     = lat;
      if (lngEl)     lngEl.value     = lng;
      if (mapsUrlEl) mapsUrlEl.value = mapsUrl;
      if (placeIdEl) placeIdEl.value = pid || '';

      /* Auto-poblar campo ciudad si se detectó */
      if (city) {
        if (cityHiddenEl) cityHiddenEl.value = city;
        if (citySearchEl) citySearchEl.value = city;
        if (manualWrapEl) manualWrapEl.style.display = 'none';
      }

      /* Limpiar error del campo de búsqueda */
      var grp = inputEl.closest && inputEl.closest('.form-group');
      if (grp) {
        var errEl = grp.querySelector('.form-error-msg');
        if (errEl) errEl.classList.remove('visible');
        inputEl.classList.remove('error');
      }
    }

    function initInteractiveMap(lat, lng) {
      if (!mapCanvas) return;
      var center = { lat: lat, lng: lng };

      /* Mostrar contenedor antes de inicializar el mapa para que lea dimensiones */
      if (mapDiv) mapDiv.style.display = 'block';

      if (!_map) {
        /* Primera vez: crear mapa, marker y geocoder */
        _map = new google.maps.Map(mapCanvas, {
          center:           center,
          zoom:             16,
          disableDefaultUI: true,
          zoomControl:      true,
          gestureHandling:  'cooperative',
          styles:           DARK_STYLES,
        });

        _marker = new google.maps.Marker({
          position:  center,
          map:       _map,
          draggable: true,
          title:     'Arrastrá para ajustar',
        });

        _geocoder = new google.maps.Geocoder();

        /* Reverse geocoding al soltar el pin */
        _marker.addListener('dragend', function () {
          var pos    = _marker.getPosition();
          var newLat = pos.lat();
          var newLng = pos.lng();

          /* Usar valores actuales como fallback si el geocoder falla */
          var currentAddr = addrEl    ? addrEl.value    : inputEl.value;
          var currentCity = locCityEl ? locCityEl.value : '';

          _geocoder.geocode({ location: { lat: newLat, lng: newLng } }, function (results, status) {
            var addr = currentAddr;
            var city = currentCity;
            var pid  = '';
            if (status === 'OK' && results[0]) {
              addr = results[0].formatted_address || addr;
              city = extractCity(results[0].address_components || []) || city;
              pid  = results[0].place_id || '';
              /* Actualizar campo de texto visible con la dirección geocodificada */
              inputEl.value = addr;
            }
            fillFields(newLat, newLng, addr, city, pid);
          });
        });

      } else {
        /* Mapa ya existe: mover centro y pin */
        _map.setCenter(center);
        _map.setZoom(16);
        _marker.setPosition(center);
      }

      /* Forzar redibujado — necesario dentro de modals con overflow:hidden */
      setTimeout(function () {
        google.maps.event.trigger(_map, 'resize');
        _map.setCenter(center);
      }, 150);
    }

    function onPlaceSelected(autocomplete) {
      var place = autocomplete.getPlace();
      if (!place || !place.geometry || !place.geometry.location) {
        clearLocation();
        return;
      }

      var lat  = place.geometry.location.lat();
      var lng  = place.geometry.location.lng();
      var addr = place.formatted_address || place.name || inputEl.value;
      var pid  = place.place_id || '';
      var city = extractCity(place.address_components || []);

      fillFields(lat, lng, addr, city, pid);
      initInteractiveMap(lat, lng);
    }

    if (!mapsKey) {
      /* Sin key — el input queda como texto libre, nunca bloquea el pedido */
      console.warn('DV LocationPicker: window.DV_MAPS_KEY no está configurado. Campo funciona como texto libre.');
      return;
    }

    var _acInit = false;
    var _ac     = null;

    function initAutocomplete() {
      if (_acInit) return;
      _acInit = true;

      /* Boundary centrada en Paraguay */
      var bounds = new google.maps.LatLngBounds(
        new google.maps.LatLng(-27.59, -62.64),
        new google.maps.LatLng(-19.28, -54.24)
      );

      _ac = new google.maps.places.Autocomplete(inputEl, {
        bounds:                bounds,
        componentRestrictions: { country: 'py' },
        fields:                ['formatted_address', 'geometry', 'place_id', 'address_components', 'name'],
        strictBounds:          false,
        /* Sin restricción de type → incluye negocios, calles, barrios */
      });

      _ac.addListener('place_changed', function () {
        onPlaceSelected(_ac);
      });
    }

    /* Carga lazy: primer focus o primer input del usuario */
    function triggerLoad() {
      loadMapsApi(mapsKey, initAutocomplete);
    }
    inputEl.addEventListener('focus', triggerLoad, { once: true });
    inputEl.addEventListener('input', triggerLoad, { once: true });

    /* Si el usuario borra el campo, limpiar location data */
    inputEl.addEventListener('input', function () {
      if (!inputEl.value.trim()) clearLocation();
    });
  };

})();

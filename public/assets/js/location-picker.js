/* =========================================================
   Dam Vertex — Location Picker v2 (Google Places + Mapa Inmediato)
   Mapa visible desde apertura del modal — default center Paraguay/Central
   DV.initLocationPicker('m',  window.DV_MAPS_KEY)   → order-modal
   DV.initLocationPicker('cm', window.DV_MAPS_KEY)   → combo-modal
   ========================================================= */

window.DV = window.DV || {};

(function () {
  'use strict';

  var DEFAULT_CENTER = { lat: -25.30066, lng: -57.63591 };
  var DEFAULT_ZOOM   = 12;

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
      '.pac-icon{filter:invert(1) brightness(.55)}';
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
          gestureHandling:  'cooperative',
          styles:           DARK_STYLES,
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
          var currentAddr = addrEl ? addrEl.value : inputEl.value;
          var currentCity = locCityEl ? locCityEl.value : '';
          _geocoder.geocode({ location: { lat: newLat, lng: newLng } }, function (results, status) {
            var addr = currentAddr;
            var city = currentCity;
            var pid  = '';
            if (status === 'OK' && results[0]) {
              addr = results[0].formatted_address || addr;
              city = extractCity(results[0].address_components || []) || city;
              pid  = results[0].place_id || '';
              inputEl.value = addr;
            }
            fillFields(newLat, newLng, addr, city, pid);
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

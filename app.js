/* "¿Cómo llego al Teatro?" - lógica de la página.
 * Sin dependencias. Usa la Maps JavaScript API (DirectionsService) para traer
 * la mejor ruta en transporte público y listar los pasos en la propia página.
 * La parte pura (armado de URLs y mensajes) se exporta para los tests. */
(function (global) {
  'use strict';

  var cfg = (typeof CONFIG !== 'undefined' && CONFIG) || {};
  var DESTINO = cfg.DESTINO || 'Teatro Argentino, Av. 51 702, La Plata';
  var CALLBACK_LIB = '__comoLlegoLibLista';

  // Limpia lo que tipeó el usuario: sin espacios de más, con tope de largo.
  function normalizarOrigen(valor) {
    return String(valor == null ? '' : valor).trim().slice(0, 200);
  }

  // URL de carga de la Maps JavaScript API (la lib que calcula rutas).
  // Lanza Error si falta la key: el bug se ve, no se esconde.
  function buildMapsLibUrl(apiKey) {
    var k = String(apiKey == null ? '' : apiKey).trim();
    if (!k) { throw new Error('Falta la API key (config.js)'); }
    return 'https://maps.googleapis.com/maps/api/js' +
      '?key=' + encodeURIComponent(k) +
      '&language=es&region=AR&loading=async&callback=' + CALLBACK_LIB;
  }

  // URL para abrir la ruta en Google Maps / app del celu. No necesita key.
  function buildMapsAppUrl(origen) {
    var o = normalizarOrigen(origen);
    if (!o) { throw new Error('Falta la dirección de origen'); }
    return 'https://www.google.com/maps/dir/?api=1' +
      '&origin=' + encodeURIComponent(o) +
      '&destination=' + encodeURIComponent(DESTINO) +
      '&travelmode=transit';
  }

  // Estados del DirectionsService a mensaje humano.
  var ERRORES_DIRECTIONS = {
    NOT_FOUND: 'No encontré esa dirección como punto de partida. Probá con dos esquinas (ej: Calle 12 y 71) o sumá la ciudad.',
    ZERO_RESULTS: 'No hay ruta en transporte público desde ahí. Probá con otro punto de partida.',
    OVER_QUERY_LIMIT: 'Se llenó la cuota de rutas de Google por ahora. Probá en un rato o usá el botón verde.',
    REQUEST_DENIED: 'Google rechazó la key. Habilitá "Maps JavaScript API" en el proyecto de Cloud (ver README, sección API key).',
    INVALID_REQUEST: 'Esa dirección no la pude interpretar. Probá con dos esquinas, ej: Calle 12 y 71.'
  };
  function traducirErrorDirections(status) {
    return ERRORES_DIRECTIONS[status] ||
      ('No pude calcular la ruta (' + status + '). Usá el botón verde mientras tanto.');
  }

  function tieneKey() {
    return !!(cfg.GOOGLE_MAPS_API_KEY && String(cfg.GOOGLE_MAPS_API_KEY).trim());
  }

  /* --- Carga lazy de la lib de Google: una sola vez, al primer uso. --- */
  var libEstado = 'sin-cargar'; // sin-cargar | cargando | lista | error
  var colaCallbacks = [];

  // La lib de Google llama a esta función global cuando terminó de cargar.
  global[CALLBACK_LIB] = function () {
    libEstado = 'lista';
    vaciarCola();
  };

  function vaciarCola() {
    while (colaCallbacks.length) { colaCallbacks.shift()(); }
  }

  function cargarLib(callback) {
    if (libEstado === 'lista') { callback(); return; }
    colaCallbacks.push(callback);
    if (libEstado !== 'sin-cargar') { return; }
    libEstado = 'cargando';
    var s = document.createElement('script');
    s.src = buildMapsLibUrl(cfg.GOOGLE_MAPS_API_KEY);
    s.async = true;
    s.onerror = function () {
      libEstado = 'error';
      vaciarCola(); // cada callback se defiende solo si no hay google.maps
    };
    document.head.appendChild(s);
  }

  /* --- Mapa y renderer: se crean una sola vez. --- */
  var mapa = null;
  var renderer = null;

  function asegurarMapa() {
    if (mapa) { return; }
    mapa = new global.google.maps.Map(document.getElementById('mapa-canvas'), {
      zoom: 13,
      center: { lat: -34.921, lng: -57.955 }, // La Plata
      mapTypeControl: false,
      streetViewControl: false
    });
    renderer = new global.google.maps.DirectionsRenderer({
      draggable: false,
      panel: document.getElementById('pasos')
    });
    renderer.setMap(mapa);
  }

  // Pide la ruta y deja la mejor opción (routes[0]) dibujada en el mapa
  // y listada paso a paso en el panel #pasos.
  function buscarRuta(origen, alTerminar) {
    cargarLib(function () {
      if (!(global.google && global.google.maps && global.google.maps.DirectionsService)) {
        alTerminar(new Error('No se pudo cargar la API de Google Maps. Revisá la conexión o la key.'));
        return;
      }
      asegurarMapa();
      var svc = new global.google.maps.DirectionsService();
      svc.route(
        {
          origin: origen,
          destination: DESTINO,
          travelMode: global.google.maps.TravelMode.TRANSIT
        },
        function (result, status) {
          if (status === global.google.maps.DirectionsStatus.OK) {
            renderer.setDirections(result); // routes[0] = mejor opción
            alTerminar(null, result.routes[0]);
          } else {
            alTerminar(new Error(traducirErrorDirections(status)));
          }
        }
      );
    });
  }

  /* --- DOM: solo si hay documento (en los tests de node no hay). --- */
  function init() {
    if (typeof document === 'undefined') { return; }

    var form = document.getElementById('form-ruta');
    var input = document.getElementById('origen');
    var error = document.getElementById('error');
    var resultado = document.getElementById('resultado');
    var abrirApp = document.getElementById('abrir-app');
    var avisoKey = document.getElementById('aviso-key');
    var estado = document.getElementById('estado');
    var errorRuta = document.getElementById('error-ruta');

    if (!form || !input) { return; }

    // Google llama a gm_authFailure cuando la key no autoriza la JS API
    // (API sin habilitar, o key restringida a otra API). Sin esto, el
    // "Buscando..." quedaria colgado para siempre.
    global.gm_authFailure = global.gm_authFailure || function () {
      if (estado) { estado.hidden = true; }
      if (errorRuta) {
        errorRuta.textContent = traducirErrorDirections('REQUEST_DENIED');
        errorRuta.hidden = false;
      }
    };

    function mostrar(mensaje) {
      error.textContent = mensaje || '';
      error.hidden = !mensaje;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var origen = normalizarOrigen(input.value);
      if (!origen) {
        mostrar('Escribí una dirección, por ejemplo: Diagonal 74 y 50, La Plata');
        resultado.hidden = true;
        return;
      }
      mostrar('');

      // El botón a la app funciona siempre.
      abrirApp.href = buildMapsAppUrl(origen);

      // Sin key no hay ruta calculable: aviso honesto, no lo disimulo.
      if (!tieneKey()) {
        avisoKey.hidden = false;
        resultado.hidden = false;
        estado.hidden = true;
        errorRuta.hidden = true;
        return;
      }
      avisoKey.hidden = true;
      resultado.hidden = false;
      estado.textContent = 'Buscando la mejor ruta en colectivo...';
      estado.hidden = false;
      errorRuta.hidden = true;
      buscarRuta(origen, function (err) {
        estado.hidden = true;
        if (err) {
          errorRuta.textContent = err.message;
          errorRuta.hidden = false;
        }
      });
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  /* Export para tests (node) y para consola (browser). */
  var api = {
    DESTINO: DESTINO,
    normalizarOrigen: normalizarOrigen,
    buildMapsLibUrl: buildMapsLibUrl,
    buildMapsAppUrl: buildMapsAppUrl,
    traducirErrorDirections: traducirErrorDirections,
    tieneKey: tieneKey
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  global.ComoLlego = api;
})(typeof window !== 'undefined' ? window : globalThis);

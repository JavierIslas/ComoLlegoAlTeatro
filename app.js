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

  // Interpretación para el damero platense: calles con NOMBRE numérico.
  // "414 bis 3770" o "44 1206" solos son puros números y el geocoder de
  // Google no distingue nombre de vía de altura. Y no hay forma de saber si
  // la vía numerada es "Calle" o "Avenida" (la 44 a esa altura es Av. 44):
  // se generan VARIANTES y se prueban en orden hasta que una resuelva.
  var PATRON_NUMERICO = [
    /^\d{1,3}\s+bis\s+\d{1,5}$/i,      // 414 bis 3770
    /^\d{1,3}\s+\d{1,5}$/,             // 51 1206 (o Av. 44 1206)
    /^\d{1,3}\s+bis$/i                 // 414 bis
  ];
  var YA_TIENE_VIA = /^(calle|c\/|av|avda|avenida|diag|diagonal|boulevard|boul|bv|ruta|camino|pasaje|pje|autopista|auto)\b/i;

  // Localidades del Gran La Plata: si Google resuelve el origen a una de
  // estas SOLA (sin calle, sin "&" de esquina), geocodificó al centro del
  // pueblo y no a la dirección pedida. Descartar esa variante.
  var LOCALIDAD_SOLA = /^(la\s+plata|tolosa|gonnet|city\s+bell|los\s+hornos|ringuelet|arturo\s+seguí|hernández|villa\s+elvira|altos\s+de\s+san\s+lorenzo|olmos|abasto|berisso|ensenada|punta\s+lara|villa\s+elisa|villa\s+bosch|gorina|gutiérrez|etcheverry|melchor\s+romero|san\s+carlos|transradio)\b[,\s]/i;

  function inicioEsGenerico(startAddress) {
    var s = String(startAddress || '');
    return LOCALIDAD_SOLA.test(s) &&
      s.indexOf('&') === -1 &&
      !/calle|avenida|\bav\.?\b|diagonal|plaza|estaci|ruta|camino|terminal/i.test(s);
  }

  /* --- Tope de cortesía por navegador: MAX_POR_HORA búsquedas por hora.
   * Es freno de fricción (se borra limpiando el navegador), no seguridad;
   * la protección real es la restricción de la key por sitio. --- */
  var MAX_POR_HORA = 12;
  var VENTANA_MS = 60 * 60 * 1000;
  var LS_CLAVE = 'cl_busquedas';

  function dentroDeVentana(stamps, ahora, ventanaMs) {
    return (stamps || []).filter(function (t) {
      return (ahora - t) >= 0 && (ahora - t) < ventanaMs;
    });
  }

  function leerHistorial() {
    try {
      var crudo = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_CLAVE) : null;
      var parsed = crudo ? JSON.parse(crudo) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  }

  function guardarHistorial(stamps) {
    try {
      if (typeof localStorage !== 'undefined') { localStorage.setItem(LS_CLAVE, JSON.stringify(stamps)); }
    } catch (e) { /* modo incógnito o storage lleno: seguimos sin tope */ }
  }

  function conCiudad(o) {
    return /la\s+plata$/i.test(o) ? [o] : [o, o + ', La Plata'];
  }

  // Candidatos a origen, en orden de preferencia. El primero es lo que el
  // usuario quiso decir; los demás son reintentos si Google no resuelve.
  function variantesOrigen(origen) {
    var o = normalizarOrigen(origen);
    if (!o) { return []; }

    // Esquina de dos vías numeradas: "68 y 4", "calle 68 y 4", "80 y 44".
    // Google solo la entiende con las dos vías tipadas y la ciudad.
    var e = o.match(/^(?:(?:calle|c\/|av|avda|avenida|diag|diagonal)\s+)?(\d{1,3})\s+(bis)\s+(?:y|e)\s+(\d{1,3})(?:\s*,\s*la\s+plata)?$/i) ||
            o.match(/^(?:(?:calle|c\/|av|avda|avenida|diag|diagonal)\s+)?(\d{1,3})\s+(?:y|e)\s+(\d{1,3})(?:\s*,\s*la\s+plata)?$/i);
    if (e) {
      var conBis = e.length === 4 && /^bis$/i.test(e[2]);
      var via1 = e[1] + (conBis ? ' bis' : '');
      var via2 = e[e.length - 1];
      var tipadas = [
        'Calle ' + via1 + ' y Calle ' + via2 + ', La Plata',
        'Av. ' + via1 + ' y Av. ' + via2 + ', La Plata',
        'Diagonal ' + via1 + ' y ' + via2 + ', La Plata'
      ];
      var propia = o + (/, la plata$/i.test(o) ? '' : ', La Plata');
      // Si ya escribió un tipo de vía (ej. "Diagonal 74 y 50"), respetarlo
      // primero y probar las tipadas como reintentos.
      return /^(calle|c\/|av|avda|avenida|diag|diagonal)\b/i.test(o)
        ? [propia].concat(tipadas.filter(function (t) {
            return t.toLowerCase() !== propia.toLowerCase();
          }))
        : tipadas.concat([propia]);
    }

    if (YA_TIENE_VIA.test(o)) { return conCiudad(o); }
    for (var i = 0; i < PATRON_NUMERICO.length; i++) {
      if (PATRON_NUMERICO[i].test(o)) {
        return ['Calle ' + o, 'Av. ' + o, o + ', La Plata'];
      }
    }
    return conCiudad(o);
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
    ZERO_RESULTS: 'No hay ruta en transporte público desde ahí. Si la dirección es de otra localidad (Ensenada, Berisso, Tolosa...), sumala; si no, probá con otro punto de partida.',
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

  // Pide la ruta probando variantes del origen en orden (Calle, Av., a secas)
  // hasta que una resuelva. Deja la mejor opción (routes[0]) dibujada en el
  // mapa y listada paso a paso en el panel #pasos.
  function buscarRuta(origen, alProbar, alTerminar) {
    cargarLib(function () {
      if (!(global.google && global.google.maps && global.google.maps.DirectionsService)) {
        alTerminar(new Error('No se pudo cargar la API de Google Maps. Revisá la conexión o la key.'));
        return;
      }
      asegurarMapa();
      var variantes = variantesOrigen(origen);
      var svc = new global.google.maps.DirectionsService();
      var ultimoError = null;
      var i = 0;

      function siguiente() {
        if (i >= variantes.length) {
          alTerminar(new Error(ultimoError || 'No pude calcular la ruta.'));
          return;
        }
        var v = variantes[i++];
        alProbar(v);
        svc.route(
          {
            origin: v,
            destination: DESTINO,
            travelMode: global.google.maps.TravelMode.TRANSIT
          },
          function (result, status) {
            var inicio = (result && result.routes && result.routes[0] &&
              result.routes[0].legs && result.routes[0].legs[0])
                ? result.routes[0].legs[0].start_address : '';
            if (status === global.google.maps.DirectionsStatus.OK && !inicioEsGenerico(inicio)) {
              renderer.setDirections(result); // routes[0] = mejor opción
              alTerminar(null, v, result.routes[0]);
            } else {
              ultimoError = (status === global.google.maps.DirectionsStatus.OK)
                ? 'Google ubicó "' + v + '" en el centro de una localidad, no en tu dirección. Probá con otra forma de escribirla.'
                : traducirErrorDirections(status);
              siguiente();
            }
          }
        );
      }
      siguiente();
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

    var buscando = false;
    var boton = form.querySelector('button');

    function liberarBoton() {
      buscando = false;
      if (boton) { boton.disabled = false; }
    }

    // Google llama a gm_authFailure cuando la key no autoriza la JS API
    // (API sin habilitar, o key restringida a otra API). Sin esto, el
    // "Buscando..." quedaria colgado para siempre.
    global.gm_authFailure = global.gm_authFailure || function () {
      liberarBoton();
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
      if (buscando) { return; } // ya hay una búsqueda en curso

      var origen = normalizarOrigen(input.value);
      if (!origen) {
        mostrar('Escribí una dirección, por ejemplo: Diagonal 74 y 50, La Plata');
        resultado.hidden = true;
        return;
      }
      mostrar('');

      // Variantes del origen: la página prueba "Calle N", "Av. N" y "N, La
      // Plata" para los números pelados, y avisa cómo va buscando.
      var pasosPanel = document.getElementById('pasos');
      if (pasosPanel) { pasosPanel.innerHTML = ''; } // sin pasos viejos colgando

      // El botón a la app funciona siempre (con lo que escribió el usuario).
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

      // Tope de cortesía (una sola vez, justo antes de gastar cuota):
      // MAX_POR_HORA búsquedas por hora por navegador.
      var ahora = Date.now();
      var historial = dentroDeVentana(leerHistorial(), ahora, VENTANA_MS);
      if (historial.length >= MAX_POR_HORA) {
        estado.hidden = true;
        errorRuta.textContent = 'Llegaste al tope de ' + MAX_POR_HORA +
          ' búsquedas por hora (cuidamos los costos del mapa). ' +
          'El botón verde sigue funcionando.';
        errorRuta.hidden = false;
        return;
      }
      guardarHistorial(historial.concat([ahora]));

      buscando = true;
      if (boton) { boton.disabled = true; }
      estado.textContent = 'Buscando la mejor ruta en colectivo...';
      estado.hidden = false;
      errorRuta.hidden = true;
      buscarRuta(
        origen,
        function (variante) {
          estado.textContent = variante === origen
            ? 'Buscando la mejor ruta en colectivo...'
            : 'Buscando como "' + variante + '"...';
        },
        function (err) {
          liberarBoton();
          estado.hidden = true;
          if (err) {
            errorRuta.textContent = err.message;
            errorRuta.hidden = false;
            if (pasosPanel) { pasosPanel.innerHTML = ''; }
          }
        }
      );
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
    variantesOrigen: variantesOrigen,
    buildMapsLibUrl: buildMapsLibUrl,
    buildMapsAppUrl: buildMapsAppUrl,
    traducirErrorDirections: traducirErrorDirections,
    inicioEsGenerico: inicioEsGenerico,
    dentroDeVentana: dentroDeVentana,
    MAX_POR_HORA: MAX_POR_HORA,
    VENTANA_MS: VENTANA_MS,
    tieneKey: tieneKey
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  global.ComoLlego = api;
})(typeof window !== 'undefined' ? window : globalThis);

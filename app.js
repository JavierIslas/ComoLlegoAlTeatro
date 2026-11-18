/* "¿Cómo llego al Teatro?" - lógica de la página.
 * Sin dependencias. La parte pura (armado de URLs) se exporta para los tests. */
(function (global) {
  'use strict';

  var cfg = (typeof CONFIG !== 'undefined' && CONFIG) || {};
  var DESTINO = cfg.DESTINO || 'Teatro Argentino, Av. 51 702, La Plata';

  // Limpia lo que tipeó el usuario: sin espacios de más, con tope de largo.
  function normalizarOrigen(valor) {
    return String(valor == null ? '' : valor).trim().slice(0, 200);
  }

  // URL del iframe: Maps Embed API en modo transporte público.
  // Lanza Error si falta el origen o la key (así el bug se ve, no se esconde).
  function buildEmbedUrl(origen, apiKey) {
    var o = normalizarOrigen(origen);
    var k = String(apiKey == null ? '' : apiKey).trim();
    if (!o) { throw new Error('Falta la dirección de origen'); }
    if (!k) { throw new Error('Falta la API key (config.js)'); }
    return 'https://www.google.com/maps/embed/v1/directions' +
      '?key=' + encodeURIComponent(k) +
      '&origin=' + encodeURIComponent(o) +
      '&destination=' + encodeURIComponent(DESTINO) +
      '&mode=transit&language=es&region=ar';
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

  function tieneKey() {
    return !!(cfg.GOOGLE_MAPS_API_KEY && String(cfg.GOOGLE_MAPS_API_KEY).trim());
  }

  /* --- DOM: solo si hay documento (en los tests de node no hay). --- */
  function init() {
    if (typeof document === 'undefined') { return; }

    var form = document.getElementById('form-ruta');
    var input = document.getElementById('origen');
    var error = document.getElementById('error');
    var resultado = document.getElementById('resultado');
    var mapa = document.getElementById('mapa');
    var abrirApp = document.getElementById('abrir-app');
    var avisoKey = document.getElementById('aviso-key');

    if (!form || !input) { return; }

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

      // El embed necesita key: si falta, aviso honesto y no lo disimulo.
      if (!tieneKey()) {
        avisoKey.hidden = false;
        resultado.hidden = false;
        mapa.removeAttribute('src');
        mapa.hidden = true;
        return;
      }
      avisoKey.hidden = true;
      mapa.hidden = false;
      mapa.src = buildEmbedUrl(origen, cfg.GOOGLE_MAPS_API_KEY);
      resultado.hidden = false;
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
    buildEmbedUrl: buildEmbedUrl,
    buildMapsAppUrl: buildMapsAppUrl,
    tieneKey: tieneKey
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  global.ComoLlego = api;
})(typeof window !== 'undefined' ? window : globalThis);

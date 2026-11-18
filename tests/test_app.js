/* Tests de la lógica pura de app.js. Corré: node tests/test_app.js */
'use strict';

const assert = require('assert');
const path = require('path');
const app = require(path.join(__dirname, '..', 'app.js'));

let pasados = 0;
function test(nombre, fn) {
  fn();
  pasados += 1;
  console.log('ok - ' + nombre);
}

test('DESTINO apunta al Teatro Argentino', () => {
  assert.match(app.DESTINO, /Teatro Argentino/);
  assert.match(app.DESTINO, /51/);
});

test('normalizarOrigen trimea y limita a 200', () => {
  assert.strictEqual(app.normalizarOrigen('  diagonal 74 y 50  '), 'diagonal 74 y 50');
  assert.strictEqual(app.normalizarOrigen(null), '');
  assert.strictEqual(app.normalizarOrigen(undefined), '');
  assert.strictEqual(app.normalizarOrigen('x'.repeat(500)).length, 200);
});

test('variantesOrigen genera Calle, Av. y a secas para los patrones numericos', () => {
  assert.deepStrictEqual(app.variantesOrigen('414 bis 3770'),
    ['Calle 414 bis 3770', 'Av. 414 bis 3770', '414 bis 3770, La Plata']);
  assert.deepStrictEqual(app.variantesOrigen('44 1206'),
    ['Calle 44 1206', 'Av. 44 1206', '44 1206, La Plata']);
  assert.deepStrictEqual(app.variantesOrigen('  51 y 10  '),
    ['Calle 51 y Calle 10, La Plata', 'Av. 51 y Av. 10, La Plata',
     'Diagonal 51 y 10, La Plata', '51 y 10, La Plata']);
  assert.deepStrictEqual(app.variantesOrigen('414 bis'),
    ['Calle 414 bis', 'Av. 414 bis', '414 bis, La Plata']);
});

test('variantesOrigen arma esquinas con las dos vias tipadas y ciudad', () => {
  assert.deepStrictEqual(app.variantesOrigen('68 y 4'),
    ['Calle 68 y Calle 4, La Plata', 'Av. 68 y Av. 4, La Plata',
     'Diagonal 68 y 4, La Plata', '68 y 4, La Plata']);
  assert.deepStrictEqual(app.variantesOrigen('calle 68 y 4'),
    ['calle 68 y 4, La Plata', 'Calle 68 y Calle 4, La Plata',
     'Av. 68 y Av. 4, La Plata', 'Diagonal 68 y 4, La Plata']);
  assert.deepStrictEqual(app.variantesOrigen('68 bis y 4'),
    ['Calle 68 bis y Calle 4, La Plata', 'Av. 68 bis y Av. 4, La Plata',
     'Diagonal 68 bis y 4, La Plata', '68 bis y 4, La Plata']);
  // La esquina escrita con su via va primera, sin duplicarse.
  assert.deepStrictEqual(app.variantesOrigen('Diagonal 74 y 50, La Plata'),
    ['Diagonal 74 y 50, La Plata', 'Calle 74 y Calle 50, La Plata',
     'Av. 74 y Av. 50, La Plata']);
  // Esquinas con palabras que no son vias numeradas no se reescriben.
  assert.deepStrictEqual(app.variantesOrigen('Plaza Italia y 10'),
    ['Plaza Italia y 10', 'Plaza Italia y 10, La Plata']);
});

test('inicioEsGenerico detecta localidades solas pero no direcciones reales', () => {
  assert.strictEqual(app.inicioEsGenerico('La Plata, Provincia de Buenos Aires, Argentina'), true);
  assert.strictEqual(app.inicioEsGenerico('Tolosa, La Plata, Argentina'), true);
  assert.strictEqual(app.inicioEsGenerico('C. 4 & C. 68, B1904 La Plata, Provincia de Buenos Aires'), false);
  assert.strictEqual(app.inicioEsGenerico('Estación Tolosa, La Plata, Argentina'), false);
  assert.strictEqual(app.inicioEsGenerico('Plaza Italia, La Plata, Argentina'), false);
  assert.strictEqual(app.inicioEsGenerico('Av. 44 1206, B1900 La Plata'), false);
  assert.strictEqual(app.inicioEsGenerico(''), false);
});

test('variantesOrigen no reescribe lo que ya tiene via y reintenta sumando ciudad', () => {
  assert.deepStrictEqual(app.variantesOrigen('av 44 1206'), ['av 44 1206', 'av 44 1206, La Plata']);
  assert.deepStrictEqual(app.variantesOrigen('Av. 44 1206'), ['Av. 44 1206', 'Av. 44 1206, La Plata']);
  assert.deepStrictEqual(app.variantesOrigen('camino centenario km 27'),
    ['camino centenario km 27', 'camino centenario km 27, La Plata']);
  assert.deepStrictEqual(app.variantesOrigen('Diagonal 74 y 50, La Plata'),
    ['Diagonal 74 y 50, La Plata', 'Calle 74 y Calle 50, La Plata',
     'Av. 74 y Av. 50, La Plata']);
  assert.deepStrictEqual(app.variantesOrigen('Plaza Italia'), ['Plaza Italia', 'Plaza Italia, La Plata']);
  assert.deepStrictEqual(app.variantesOrigen(''), []);
});

test('buildMapsLibUrl arma la URL de la Maps JavaScript API', () => {
  const url = app.buildMapsLibUrl('AIzaSyTest123');
  assert.strictEqual(url.startsWith('https://maps.googleapis.com/maps/api/js?'), true);
  const params = new URLSearchParams(url.slice(url.indexOf('?') + 1));
  assert.strictEqual(params.get('key'), 'AIzaSyTest123');
  assert.strictEqual(params.get('language'), 'es');
  assert.strictEqual(url.includes('callback='), true);
  assert.strictEqual(url.includes(' '), false);
  assert.throws(() => app.buildMapsLibUrl(''), /API key/i);
  assert.throws(() => app.buildMapsLibUrl(null), /API key/i);
});

test('traducirErrorDirections devuelve mensajes humanos por estado', () => {
  assert.match(app.traducirErrorDirections('REQUEST_DENIED'), /Maps JavaScript API/);
  assert.match(app.traducirErrorDirections('ZERO_RESULTS'), /transporte público/i);
  assert.match(app.traducirErrorDirections('NOT_FOUND'), /esquinas/i);
  assert.match(app.traducirErrorDirections('OVER_QUERY_LIMIT'), /cuota/i);
  // Estado desconocido: no truena, avisa con el estado crudo.
  assert.match(app.traducirErrorDirections('STATUS_RARO'), /STATUS_RARO/);
});

test('buildMapsAppUrl usa la Maps URL oficial con travelmode transit', () => {
  const url = app.buildMapsAppUrl('Estación Tolosa');
  assert.strictEqual(url.startsWith('https://www.google.com/maps/dir/?api=1&'), true);
  assert.strictEqual(url.includes('travelmode=transit'), true);
  const params = new URLSearchParams(url.slice(url.indexOf('?') + 1));
  assert.strictEqual(params.get('origin'), 'Estación Tolosa');
  assert.match(params.get('destination'), /Teatro Argentino/);
  assert.throws(() => app.buildMapsAppUrl('  '), /origen/i);
});

test('buildMapsAppUrl no requiere key', () => {
  const url = app.buildMapsAppUrl('Plaza Italia, La Plata');
  assert.strictEqual(url.includes('key='), false);
});

test('dentroDeVentana filtra la ventana de una hora para el tope', () => {
  const H = 3600 * 1000;
  const ahora = 10 * H;
  assert.strictEqual(app.dentroDeVentana([ahora - 5, ahora - 60, ahora - H + 1, 0], ahora, H).length, 3);
  assert.strictEqual(app.dentroDeVentana([0, 1, 2], ahora, H).length, 0);
  assert.strictEqual(app.dentroDeVentana([ahora + 5000], ahora, H).length, 0);
  const lleno = Array(app.MAX_POR_HORA).fill(0).map((_, i) => ahora - i * 1000);
  assert.strictEqual(app.dentroDeVentana(lleno, ahora, app.VENTANA_MS).length, app.MAX_POR_HORA);
  assert.strictEqual(app.MAX_POR_HORA, 12);
});

test('el HTML referencia config, app y estilo, y tiene el form', () => {
  const fs = require('fs');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  for (const pieza of [
    'config.js', 'app.js', 'style.css',
    'id="form-ruta"', 'id="origen"', 'id="mapa-canvas"', 'id="pasos"',
    'id="abrir-app"', 'id="estado"', 'id="error-ruta"', 'lang="es"'
  ]) {
    assert.ok(html.includes(pieza), 'falta en index.html: ' + pieza);
  }
});

console.log('\n' + pasados + ' tests OK');

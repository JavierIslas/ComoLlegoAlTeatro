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

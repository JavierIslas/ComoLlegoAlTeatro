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

test('buildEmbedUrl arma la URL del embed en modo transit', () => {
  const url = app.buildEmbedUrl('Calle 12 y 71, La Plata', 'AIzaSyTest123');
  assert.strictEqual(url.startsWith('https://www.google.com/maps/embed/v1/directions?'), true);
  const params = new URLSearchParams(url.slice(url.indexOf('?') + 1));
  assert.strictEqual(params.get('key'), 'AIzaSyTest123');
  assert.strictEqual(params.get('origin'), 'Calle 12 y 71, La Plata');
  assert.strictEqual(params.get('mode'), 'transit');
  assert.strictEqual(params.get('language'), 'es');
  assert.strictEqual(params.get('region'), 'ar');
  assert.match(params.get('destination'), /Teatro Argentino/);
});

test('buildEmbedUrl codifica caracteres especiales', () => {
  const url = app.buildEmbedUrl('Ñandú 305, Berazategui', 'AIzaSyTest123');
  const params = new URLSearchParams(url.slice(url.indexOf('?') + 1));
  // decodeURIComponent debe devolver el original: nada crudo sin codificar.
  assert.strictEqual(decodeURIComponent(params.get('origin')), 'Ñandú 305, Berazategui');
  assert.strictEqual(url.includes(' '), false);
});

test('buildEmbedUrl exige origen y key', () => {
  assert.throws(() => app.buildEmbedUrl('', 'AIzaSyTest123'), /origen/i);
  assert.throws(() => app.buildEmbedUrl('Calle 1', ''), /API key/i);
  assert.throws(() => app.buildEmbedUrl('   ', 'AIzaSyTest123'), /origen/i);
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
    'id="form-ruta"', 'id="origen"', 'id="mapa"', 'id="abrir-app"',
    'lang="es"'
  ]) {
    assert.ok(html.includes(pieza), 'falta en index.html: ' + pieza);
  }
});

console.log('\n' + pasados + ' tests OK');

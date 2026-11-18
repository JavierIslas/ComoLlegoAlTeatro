# ¿Cómo llego al Teatro?

Página estática para la sede La Plata de la Global Game Jam 2027: escribís una
dirección de partida (sin geolocalización) y te muestra la mejor ruta en
transporte público hasta el Teatro Argentino (Av. 51 702, La Plata), con el
mapa de Google y la lista de pasos (qué línea tomar, dónde subir y bajar) en la
propia página, más una lista curada de líneas que llegan.

Sin build, sin dependencias, sin backend: 4 archivos servibles desde cualquier
lado. Funciona igual en GitHub Pages y en itch.io.

## Estructura

| Archivo | Qué es |
| --- | --- |
| `index.html` | La página. |
| `config.js` | Toda la configuración: API key, destino, datos de la edición. |
| `app.js` | Lógica: valida el origen y arma las URLs de Google Maps. |
| `style.css` | Estilos. |
| `tests/` | Tests (node puro, sin dependencias). |

## API key (una sola vez, 5 minutos)

El cálculo de rutas usa la **Maps JavaScript API** de Google (servicio
Directions). Conviene saber qué es gratis y qué no:

- Cargar el mapa: 10.000 cargas gratis por mes.
- Calcular cada ruta: 10.000 búsquedas gratis por mes.

Para una página de difusión de una jam eso es imposible de gastar, pero para
quedar tranquilo con la tarjeta, ponete un tope diario (ver paso 5).

1. Entrá a <https://console.cloud.google.com/> y creá un proyecto (nombre
   sugerido: `como-llego-teatro`).
2. Menú **APIs y servicios, Biblioteca**, y habilitalas las dos:
   - **Maps JavaScript API** (dibuja el mapa).
   - **Directions API** (calcula las rutas; es la clásica, no la "Routes API"
     nueva). Si falta esta, el mapa carga pero toda búsqueda de ruta falla con
     un rechazo genérico de key.
   (Si antes usaste la Maps Embed API en este proyecto, podés dejarla
   habilitada o quitarla, ya no se usa.)
3. **APIs y servicios, Credenciales, Crear credenciales, Clave de API**.
4. Google te va a pedir asociar una **cuenta de facturación** (tarjeta): es un
   requisito del proyecto de Cloud. Con la key restringida a tu sitio (paso 5),
   el uso lo genera tu página y las 10.000 gratis por mes no se gastan ni cerca.
5. **Muy recomendado**, protegé la key para que solo la use esta página: en
   Credenciales, editá la clave, sección **Restricciones de aplicación,
   Referenciadores HTTP**, y agregá `TU-USUARIO.github.io/*` (y los dominios de
   itch si la subís ahí). Así nadie puede usar tu key desde otro sitio, que es
   el único costo real posible. Nota: las cuotas diarias de Maps ya no son
   editables en la consola de Cloud (quedaron fijas o "Ilimitado"); si querés
   alarma de gasto, creá un presupuesto con alertas en **Facturación,
   Presupuestos y alertas**.
6. **Recomendado también**, restringí la clave: en Credenciales, editá la
   clave, sección **Restricciones de API**, dejá marcada solo
   *Maps JavaScript API*.
7. Pegá la clave en `config.js`, campo `GOOGLE_MAPS_API_KEY`.

Sobre la restricción por *referrer*: si la página va a vivir solo en GitHub
Pages, podés restringir a `TU-USUARIO.github.io/*`. En itch.io el HTML corre
dentro de un iframe con dominios propios de itch (`*.itch.zone`, CDN), que
cambian; para itch conviene dejar la restricción solo por API (paso 6) y no por
referrer.

Sin key la página no se rompe: el cálculo queda deshabilitado con un aviso, y
el botón verde (que abre la ruta en la app de Google Maps, sin key) sigue
funcionando.

## Publicar

### GitHub Pages

1. Creá el repo en GitHub (por ejemplo `TU-USUARIO/como-llego-al-teatro`) y
   subí esto a `main`:

   ```bash
   git remote add origin git@github.com:TU-USUARIO/como-llego-al-teatro.git
   git push -u origin main
   ```

2. En el repo: **Settings, Pages**, Branch `main`, carpeta `/ (root)`, Save.
   En un par de minutos queda en `https://TU-USUARIO.github.io/como-llego-al-teatro/`.

### itch.io

itch.io acepta proyectos HTML que corren en el navegador:

1. Zipeá los 4 archivos (el zip tiene que tener `index.html` en la raíz):

   ```bash
   zip como-llego-teatro.zip index.html config.js app.js style.css
   ```

2. En <https://itch.io>: **Upload new project**.
3. **Kind of project**: `HTML`.
4. Subí el zip en la sección de archivos (Uploaded file) y activá
   **This file will be played in the browser**.
5. En **Viewport** ajustá el tamaño del embed (sugerido: 960 x 720) o marcá
   fullscreen.
6. **Save and view page**. Listo: tenés URL propia tipo
   `https://tu-usuario.itch.io/como-llego-al-teatro`.

## Tests

```bash
bash tests/run_tests.sh
```

Corre tres capas: chequeo de sintaxis (`node --check`), tests de la lógica de
URLs (`tests/test_app.js`) y un humo HTTP que verifica que los 4 archivos se
sirvan con 200.

## Datos de las líneas

Las líneas y paradas de la sección "Cómo acercarse en transporte público"
fueron verificadas en noviembre de 2026 contra el sitio oficial del Teatro
Argentino (Av. 51 entre 9 y 10), Moovit y Omnilíneas. Corrección del
organizador (dato de terreno): la estación de tren La Plata y la terminal de
micros NO están pegadas al Teatro (unas 14 cuadras por diagonal 80 y 74
respectivamente); la referencia útil para el transporte son la Plaza San
Martín y la Plaza Moreno, que rodean al Teatro. Si algo cambia antes de la
jam, se edita la lista en `index.html` (sección `class="fijo"`), no hay más
ciencia.

## Calles con nombre numérico (casos "414 bis 3770" y "Av. 44 1206")

El geocoder de Google no resuelve puros números como dirección: "414 bis 3770"
da NOT_FOUND porque no puede distinguir nombre de vía de altura. Y no hay
forma de saber de antemano si una vía numerada es "Calle" o "Avenida" (la 44
a esa altura es Av. 44). La página lo maneja probando variantes en orden
(`variantesOrigen` en `app.js`): para números pelados intenta "Calle N",
"Av. N" y "N, La Plata" hasta que una resuelve, y avisa en pantalla cómo va
buscando. Para cualquier otra dirección que falle, reintenta sumando
", La Plata" al final. Los km de rutas y caminos ("Camino Centenario km 27")
los resuelve Google directamente.

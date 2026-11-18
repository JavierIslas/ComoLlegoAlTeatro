# ¿Cómo llego al Teatro?

Página estática para la sede La Plata de la Global Game Jam 2027: escribís una
dirección de partida (sin geolocalización) y te muestra la ruta en transporte
público hasta el Teatro Argentino (Av. 51 702, La Plata), con el mapa de Google
embebido más una lista curada de líneas que llegan.

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

El mapa embebido usa la **Maps Embed API** de Google. Es gratuita y sin límite
de uso, pero exige una API key propia:

1. Entrá a <https://console.cloud.google.com/> y creá un proyecto (nombre
   sugerido: `como-llego-teatro`).
2. Menú **APIs y servicios, Biblioteca**, buscá **Maps Embed API** y
   habilitala.
3. **APIs y servicios, Credenciales, Crear credenciales, Clave de API**.
4. Google te va a pedir asociar una **cuenta de facturación** (tarjeta): es un
   requisito del proyecto de Cloud, pero la Maps Embed API se factura en cero,
   sin límite de requests. No genera cargos por más visitas que tenga la página.
5. **Recomendado**, restringí la clave: en Credenciales, editá la clave,
   sección **Restricciones de API**, dejá marcada solo *Maps Embed API*.
6. Pegá la clave en `config.js`, campo `GOOGLE_MAPS_API_KEY`.

Sobre la restricción por *referrer*: si la página va a vivir solo en GitHub
Pages, podés restringir a `TU-USUARIO.github.io/*`. En itch.io el HTML corre
dentro de un iframe con dominios propios de itch (`*.itch.zone`, CDN), que
cambian; para itch conviene dejar la restricción solo por API (paso 5) y no por
referrer.

Sin key la página no se rompe: el mapa embebido queda oculto con un aviso, y el
botón verde (que abre la ruta en la app de Google Maps, sin key) sigue
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

Las líneas de la sección "Líneas que ya sabés que llegan" fueron verificadas en
noviembre de 2026 contra el sitio oficial del Teatro Argentino (Av. 51 entre 9
y 10), Moovit y Omnilíneas. Si algo cambia antes de la jam, se edita la lista
en `index.html` (sección `class="fijo"`), no hay más ciencia.

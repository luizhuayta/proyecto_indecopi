# Portal institucional educativo

Plantilla maestra de portal institucional para universidades e institutos, con panel de administración y editor visual de páginas. Construida sobre **Angular 21 + PHP 8.1 + MariaDB**, pensada para hosting compartido cPanel.

## Qué incluye

- **Portal público** con páginas reales, menú, buscador, noticias y comunicados, SEO (`sitemap.xml`, `robots.txt`) y formulario de contacto.
- **Panel de administración** con gestión de páginas, noticias, medios, identidad de la institución, apariencia, usuarios y bandeja de mensajes.
- **Editor visual por bloques** (23 bloques y 6 plantillas) con vista previa por dispositivo, historial y publicación con borrador separado.
- **API REST en PHP** sin framework, con control de acceso por roles, sesión y CSRF.

## Diseño

El portal sigue el lenguaje visual del diseño de referencia (`referencia-diseno-pcanadiense/`): franja de accesos sobre la cabecera, héroe carrusel, banda de cifras, rejilla de accesos institucionales, novedades, marquesina de entidades y pie oscuro con borde de acento. La estructura es fija; el color, la tipografía, el logo y el contenido los elige la institución desde el panel.

- **Roles de color.** Solo dos mandos: `color_primario` pinta lo estructural (héroes, banda de cifras, pie, enlaces, foco) y `color_acento` lo de acción en relleno (franja, botones principales, borde del pie). Ningún componente lleva un hex propio: todo lee `var(--color-*)` y los tonos derivados se calculan con `color-mix()`. El texto sobre el acento lo decide el tema (`--color-sobre-acento`, blanco o negro) para mantener el contraste ≥ 4.5:1 con cualquier color elegido.
- **Tipografía.** Poppins es la fuente por defecto, autohospedada en `frontend/public/fonts/` (pesos 400–800, latin y latin-ext). Source Serif 4 e IBM Plex Sans siguen disponibles en Apariencia.
- **Marco editable.** En Apariencia se definen `accesos` (hasta 6 enlaces con icono para la franja superior), `botones_cabecera` (hasta 2, estilo principal o contorno) y `whatsapp` (número con código de país: habilita el botón flotante `wa.me`).
- **Bloques propios.** `accesos` (grupos de tarjetas con icono, título y descripción) y `novedades` (últimas noticias y comunicados publicados, con destacada) se añadieron al catálogo; la plantilla `home` ya los incluye en el orden del diseño de referencia.
- **Noticias y comunicados.** Módulo completo: tabla `noticias`, API (`/api/noticias` para el panel, `/api/publico/noticias` para el sitio), pantalla `/admin/noticias` (el editor redacta borradores; solo el administrador publica y elimina), páginas públicas `/noticias` y `/noticias/:slug`, e integración con `sitemap.xml` y la búsqueda. En una base existente basta volver a importar `API/esquema.sql`: es idempotente y crea la tabla sin tocar los datos. Tras publicar o despublicar muchas noticias conviene reindexar (`tools/reindexar-busqueda.php`), aunque el módulo ya mantiene el índice en cada guardado.
- **Panel.** El panel tiene 5 paletas fijas (rojo, azul, celeste, naranja, amarillo — por defecto rojo institucional) y modo oscuro, elegidos en «Mi cuenta» y guardados en el navegador (`admin-paleta`, `admin-modo`, `admin-nav-colapsado`). Son independientes del color del sitio: la vista previa del editor y la de Apariencia siempre muestran los colores reales del portal.
- **Iconos.** `frontend/public/iconos.svg` es un sprite propio (subconjunto de Lucide, licencia ISC) sin CDN. La lista blanca vive en `frontend/src/app/cms/iconos.ts`. Tras editarla: `python3 tools/generar-iconos.py` regenera el sprite y `python3 tools/sincronizar-iconos.py` propaga las opciones a `cms/blocks.json` (después, `python3 tools/generar-bloques.py` como siempre).
- **Accesibilidad de la portada.** Panel del visitante (texto grande, alto contraste, resaltar enlaces, detener animaciones, fuente legible, espaciado; persiste en el navegador), aparición al desplazar con `prefers-reduced-motion` respetado, carrusel con pausa y puntos accesibles, y foco visible en todo el marco.

## Requisitos

| Componente | Versión |
|---|---|
| PHP | 8.1 o superior, con `pdo_mysql`, `gd`, `mbstring`, `openssl`, `curl`, `fileinfo`, `iconv` |
| Node.js | 20 o superior (solo para compilar el frontend) |
| MariaDB / MySQL | 10.6 o superior |
| Docker | Para el entorno de desarrollo |

## Puesta en marcha

```bash
# 1. Dependencias del frontend
cd frontend && npm install && cd ..

# 2. Base de datos (MariaDB en el puerto 3307)
docker compose up -d

# 3. API (http://127.0.0.1:8000)
mkdir -p "$HOME/.local/share/plantilla-almacen"
docker run -d --name plantilla_portal_api -p 8000:8000 \
  --add-host=host.docker.internal:host-gateway \
  -e DB_HOST=host.docker.internal -e DB_PORT=3307 \
  -e ALMACEN_DIR=/almacen \
  -v "$PWD":/app -v "$HOME/.local/share/plantilla-almacen:/almacen" \
  -w /app plantilla-php81 php -S 0.0.0.0:8000 -t API API/entrada.php

# 4. Frontend (http://127.0.0.1:4200)
cd frontend && npm start
```

La configuración del API se lee de `API/.env` (copiar desde `API/.env.example`). La carpeta de archivos subidos debe quedar fuera del directorio público. Si el puerto de MariaDB del compose no es 3307 en tu equipo, ajusta `DB_PORT` en el comando del API.

### Correo de avisos (SMTP)

Sin las variables `SMTP_*` en `API/.env`, el correo no se envía: los mensajes del formulario de contacto y del libro de reclamaciones quedan guardados en la bandeja del panel, sin notificación. Al rellenar `SMTP_HOST`, `SMTP_REMITENTE` (y usuario/clave si el servidor los pide), cada mensaje nuevo de contacto o reclamo avisa al correo de la institución (o a `SMTP_REMITENTE` si la institución no tiene correo), y el panel puede responder avisando al visitante con la casilla «Avisar por correo». Un fallo del servidor de correo nunca pierde el mensaje: queda en la bandeja y el fallo se registra en el log.

## Compilar

```bash
cd frontend && npm run build
```

## Pruebas

```bash
# API (suite propia, requiere PHP 8.1 con pdo_mysql). Con el contenedor del
# API ya levantado, ejecuta la suite dentro de él:
docker exec plantilla_portal_api php /app/API/pruebas/ejecutar.php

# Alternativa sin el API levantado (usa la MariaDB del compose):
docker run --rm --network container:plantilla_mariadb -v "$PWD":/app -w /app \
  -e DB_HOST=127.0.0.1 -e DB_PORT=3306 -e DB_NAME=plantilla_cms \
  -e DB_USER=plantilla -e DB_PASSWORD=plantilla_local \
  plantilla-php81 php API/pruebas/ejecutar.php

# Reindexar la búsqueda (tras importar contenido o cambiar rutas):
docker exec plantilla_portal_api php tools/reindexar-busqueda.php

# Frontend (Vitest)
cd frontend && npm test

# Tipos
cd frontend && npx tsc -p tsconfig.app.json --noEmit

# Prueba de humo end-to-end contra el API en vivo (requiere BD y contenedor
# del API levantados; CLAVE_ADMIN es la contraseña del usuario admin):
CLAVE_ADMIN=... ./tools/humo-e2e.sh
```

## Estructura

```
API/        API REST en PHP (núcleo, módulos, pruebas)
frontend/   Aplicación Angular (panel, editor, portal público)
cms/        Catálogo de bloques (fuente única)
tools/      Utilidades de generación y verificación
```

## Instalación en cPanel

1. Crea la base de datos y su usuario en cPanel («Bases de datos MySQL») y asígnale todos los permisos.
2. Compila el frontend (`cd frontend && npm run build`) y sube el contenido de `frontend/dist/plantilla-educativa/browser/` a `public_html`. Incluye el `.htaccess` generado: enruta `/api`, `/sitemap.xml` y `/robots.txt`, y deja el resto a la aplicación Angular.
3. Sube la carpeta `API/` dentro de `public_html/API` (la regla de `/api` apunta allí). El `API/.htaccess` bloquea el acceso HTTP a todo menos `entrada.php`; no lo borres.
4. Copia `API/.env.example` como `API/.env` con las credenciales de la base y `URL_BASE` de tu dominio. Confirma que el servidor no sirve ese archivo (el `.htaccess` lo bloquea).
5. Importa `API/esquema.sql` en phpMyAdmin (o `backup_bd.sql` para restaurar también los datos y usuarios de prueba ya creados). En una base **ya existente**, vuelve a pasar el mismo `esquema.sql` al actualizar: es idempotente (`CREATE TABLE IF NOT EXISTS`) y crea las tablas nuevas (por ejemplo `noticias`) sin tocar los datos. En el entorno local: `docker exec -i plantilla_mariadb mariadb -uplantilla -pplantilla_local plantilla_cms < API/esquema.sql`.
6. Crea el administrador en la tabla `usuarios`: `usuario`, `hash_contrasena` (generado con `password_hash()`), `rol` = `admin` y `activo` = 1.
7. Deja la carpeta de archivos subidos fuera de `public_html`, con permisos 700, y apunta `ALMACEN_DIR` a ella.
8. Comprueba `https://tu-dominio/sitemap.xml` y `https://tu-dominio/robots.txt` después de publicar al menos la portada.

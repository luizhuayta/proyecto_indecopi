# AGENTS.md — proyecto_indecopi-master

## Entorno local (Linux con podman rootless; `docker` = podman)
- En un equipo nuevo: seguir el README «Puesta en marcha» (construir `docker build -t plantilla-php81 -f tools/Dockerfile.php81 .`; el compose publica 3307). Los puertos de abajo son los de ESTE equipo.
- MariaDB: `docker start plantilla_mariadb` (no usar `docker compose up -d`: intenta recrear el contenedor). Puerto real **127.0.0.1:3308**.
- API (desde la raíz; `host.docker.internal` no funciona con pasta, usar red del host):
  `docker run -d --name plantilla_portal_api --network host -e DB_HOST=127.0.0.1 -e DB_PORT=3308 -e ALMACEN_DIR=/almacen -v "$PWD":/app -v "$HOME/.local/share/plantilla-almacen:/almacen" -w /app plantilla-php81 php -S 0.0.0.0:8000 -t API API/entrada.php`
- Frontend: `cd frontend && npm start` (http://localhost:4200).
- Pruebas: `cd frontend && npx vitest run --config vitest.config.ts`, `npx tsc -p tsconfig.app.json --noEmit`, `npm run build`; API: `docker exec plantilla_portal_api php /app/API/pruebas/ejecutar.php`.
- Capturas: Firefox headless captura demasiado pronto en esta SPA; usar Playwright (`chromium-headless-shell` ya instalado) con `wait_until="networkidle"` + ~2.5 s.

## Rediseño Peruano Canadiense (completado, nov-2026)
- Spec: `docs/superpowers/specs/2026-11-21-diseno-pc-design.md`; plan ejecutado por fases: `docs/superpowers/plans/2026-11-21-diseno-pc.md` (registro de ejecución y «Estado del rediseño» al final del archivo).
- Qué quedó: marco PC (franja/cabecera/pie/WhatsApp), bloques `accesos` y `novedades`, módulo `noticias` completo, carrusel accesible, `appReveal`, panel de accesibilidad, CMS con sidebar/topbar/5 paletas/modo oscuro/login split. Capturas: `referencia-diseno-pcanadiense/capturas/resultado/fase-final/`; qué se portó pieza a pieza: `referencia-diseno-pcanadiense/GUIA-ADAPTACION-INDECOPI.md` §6.
- Ningún hex de marca en SCSS/TS de UI: todo lee `var(--color-*)` (excepciones documentadas: sombras/velos `#fff`/`#000`, WhatsApp `#25d366`, paletas fijas del panel `[data-paleta]`).
- Tras editar `cms/blocks.json`: `python3 tools/generar-bloques.py`. Sprite de iconos: `python3 tools/generar-iconos.py`; propagar nombres de icono a `blocks.json`: `python3 tools/sincronizar-iconos.py`.

## Cuentas locales del panel (/admin)
- `admin` / `ClaveHumo123` — rol admin (cuenta original).
- `administracion` / `AdministracionHumo123` — rol admin (cuenta de la casa, Fase G).
- `secretaria` / `SecretariaHumo123` — rol `secretaria` (Fase G): bandeja de mensajes completa, noticias como editor (borradores; no publica ni elimina) y medios; sin páginas, identidad, apariencia, usuarios ni contenido del sitio. La API es la autoridad; el menú filtrado es solo UX.
- Ojo: login con rate-limit de 8 intentos/5 min por IP (`API/tmp/ratelimit/login_*.json`); si un script falla al entrar, borrar el JSON o esperar 5 min.

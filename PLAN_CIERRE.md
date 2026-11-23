# Plan de cierre — Portal institucional (Angular + PHP + MariaDB)

> **Para agentes:** ejecutar tarea por tarea. Cada tarea termina con una prueba que falla antes del cambio y pasa después. No hay repositorio git en la carpeta de entrega: si se inicializa uno, hacer un commit al final de cada tarea; si no, dejar el árbol limpio y anotar la verificación.

**Objetivo:** cerrar los huecos que quedan fuera del alcance ya auditado (correo real, tolerancia a fallos de disco y prueba de despliegue Apache), sin tocar el diseño ni las funciones que ya pasan sus pruebas.

**Arquitectura:** PHP 8.1 sin framework (núcleo + módulos + rutas), Angular 21 standalone con servicios de estado por signals, MariaDB 10.6+. El panel y el portal comparten el catálogo `cms/blocks.json`; el API lo copia a `API/cms/blocks.json` y el frontend a `block-catalog.generated.ts` con `tools/generar-bloques.py`.

**Tech Stack:** PHP 8.1 (`pdo_mysql`, `gd`, `mbstring`, `openssl`), Angular 21, Vitest, MariaDB 11, Apache 2.4/cPanel con `mod_rewrite`.

**Spec:** `README.md` + este plan + el informe de auditoría de la sesión.

## Estado de partida (no rehacer)

- API: **73 pruebas, 0 fallos, 0 omitidas**.
- Frontend: **24 archivos, 114 pruebas, 0 fallos**.
- `ng build` de producción: correcto (383 kB iniciales, 106 kB transferidos).
- `tsc -p tsconfig.app.json --noEmit`: sin errores.
- Detector Impeccable sobre `frontend/src` y las rutas públicas: sin hallazgos.
- Corregido en esta auditoría: persistencia de la apariencia en instalación nueva, campos del formulario de contacto, DNI y consentimiento del libro de reclamaciones, avisos PHP de mensajes, listado `/paginas` sin sesión, índice de búsqueda al cambiar ruta/título o borrar, tablas y editor en móvil, títulos duplicados del panel, botón “Agregar red”, estado de borrador al crear página, metadatos de página, historial de revisiones, roles en la navegación y por URL, `sitemap.xml`/`robots.txt` en la raíz, `.htaccess` de API y build.

## Restricciones globales

- Mantener PHP 8.1 y Angular 21; no añadir frameworks ni dependencias nuevas.
- Todo texto visible en español neutro; no romper las claves de contrato existentes (`slug`, `version`, `contenido`, `items`).
- No guardar credenciales ni cuerpos de mensajes en la auditoría.
- Los fallos de correo o de disco no deben perder el mensaje ni la página ya guardada.
- Respetar `API/.htaccess` (solo `entrada.php` por HTTP) y `frontend/public/.htaccess` (rewrites de `/api`, SEO y SPA).

## Review Focus

- Un SMTP mal configurado no debe tumbar el alta del mensaje: el mensaje se guarda y el fallo se registra.
- Un encabezado de correo con `\r\n` no debe permitir inyectar cabeceras ni destinatarios.
- Un fallo de `copy()`/`imagewebp()` no debe crear una fila de medio apuntando a un archivo inexistente.
- El despliegue Apache debe servir `/api/...`, `/sitemap.xml` y `/robots.txt` sin exponer `API/.env`, `API/tmp`, `API/pruebas` ni `API/src`.

---

### Tarea 1: Correo real por SMTP

> **Completada el 2026-11-16.** API: 78 pruebas, 0 fallos (antes 74). Frontend: 125 pruebas, 0 fallos (antes 124). `tsc` y `ng build` correctos. Ciclo rojo-verde verificado en cada paso.

**Files:**
- Create: `API/src/nucleo/correo.php`
- Modify: `API/src/modulos/mensajes/servicio.php`
- Modify: `API/src/modulos/mensajes/controlador.php` (solo si hace falta pasar el destinatario)
- Modify: `API/pruebas/mensajes_pruebas.php`
- Modify: `frontend/src/app/admin/admin-mensajes.ts` (volver a mostrar “Avisar por correo” solo cuando el envío exista)
- Modify: `frontend/src/app/admin/admin-mensajes.spec.ts`

**Interfaces:**
- `function smtpConfigurado(): bool` — true si `SMTP_HOST` y `SMTP_REMITENTE` no están vacíos.
- `function enviarCorreo(string $para, string $asunto, string $cuerpo, ?array $config = null): bool` — nunca lanza; devuelve true solo si el servidor aceptó el mensaje.
- `function construirCorreo(string $remitente, string $para, string $asunto, string $cuerpo): string` — construye las cabeceras y el cuerpo MIME; úsala en la prueba unitaria de inyección de cabeceras.
- En `crearMensaje()`: tras guardar el mensaje, si `smtpConfigurado()` y el tipo es `contacto` o `reclamo`, enviar a `SMTP_REMITENTE` con asunto `Nuevo mensaje <ticket>` y el cuerpo; el flag `notificado` del mensaje se actualiza a true solo si `enviarCorreo()` devuelve true. Un fallo se registra con `error_log('[correo] ...')` y no cambia la respuesta al visitante.
- En `responderMensaje()`: si `$notificar` es true, enviar a `$cuerpo['correo']` la respuesta; `notificado` refleja el resultado.
- Decidir el destinatario del aviso con `institucion()['correo']` y caer a `SMTP_REMITENTE`; no confiar en `destinationEmail` del bloque para elegir el destinatario. El campo `destinationEmail` del catálogo queda como texto informativo o se retira en una tarea de contenido aparte.

- [x] **Paso 1:** en `API/pruebas/mensajes_pruebas.php`, agregar una prueba que construya un correo con `Para: a@b.test\r\nBcc: evil@b.test` y afirme que `construirCorreo()` elimina los CR/LF y no contiene `Bcc`.
- [x] **Paso 2:** ejecutar `docker exec plantilla_portal_api php /app/API/pruebas/ejecutar.php`; debe fallar porque `construirCorreo` no existe.
- [x] **Paso 3:** crear `API/src/nucleo/correo.php` con `smtpConfigurado()`, `construirCorreo()` y `enviarCorreo()`.
  - Usar `configurar('SMTP_HOST')`, `SMTP_PORT` (465 por defecto), `SMTP_CIFRADO` (`ssl`/`tls`), `SMTP_USUARIO`, `SMTP_CLAVE`, `SMTP_REMITENTE`.
  - `stream_socket_client('ssl://host:port', ..., 10)` para `ssl`; `tcp://` + `STARTTLS` para `tls`; `EHLO`, `AUTH LOGIN` con base64, `MAIL FROM`, `RCPT TO`, `DATA`, punto final, `QUIT`.
  - Rechazar `\r`/`\n` en remitente, destinatario y asunto; codificar asunto y cuerpo en UTF-8 con `mb_encode_mimeheader`/base64; hacer dot-stuffing del cuerpo.
  - Devolver false y registrar el error en cualquier fallo; cerrar el socket en `finally`.
- [x] **Paso 4:** ejecutar la prueba del paso 1; debe pasar.
- [x] **Paso 5:** conectar `crearMensaje()` y `responderMensaje()` según las interfaces; agregar una prueba con `SMTP_HOST=''` que compruebe que el mensaje se guarda y `notificado` queda false.
- [x] **Paso 6:** en `admin-mensajes.ts`, volver a mostrar el checkbox “Avisar por correo” y enviar `notificar`; en el detalle, mostrar “Aviso enviado” solo si `m.notificado`.
- [x] **Paso 7:** actualizar `admin-mensajes.spec.ts` para el nuevo checkbox y ejecutar `npm test -- --run`.
- [x] **Paso 8:** documentar en `README.md` que sin `SMTP_*` el correo no se envía y el mensaje queda en la bandeja.

### Tarea 2: Escrituras de medios sin filas huérfanas

**Files:**
- Modify: `API/src/modulos/medios/servicio.php`
- Modify: `API/pruebas/medios_pruebas.php`

**Interfaces:**
- `function escribirArchivo(string $origen, string $destino): void` — lanza `error_app('No se pudo guardar el archivo.', 500)` si `copy()` falla; no deja el destino parcial.
- `function guardarImagenProcesada($imagen, string $destino, bool $webp): void` — comprueba `imagewebp()`/`imagejpeg()`; lanza el mismo error si falla.
- En `procesarImagenSubida()`, `recortarMedio()` y `restaurarVersionMedio()`: usar estos helpers antes de insertar filas; si falla, borrar el archivo parcial y no tocar la base.

- [ ] **Paso 1:** agregar a `medios_pruebas.php` una prueba que apunte `ALMACEN_DIR` a una ruta no escribible (por ejemplo, un archivo regular donde se espera una carpeta) y afirme que `guardarMedio()` lanza un error 500 y no deja filas en `medios`.
- [ ] **Paso 2:** ejecutar la suite del API; debe fallar.
- [ ] **Paso 3:** implementar `escribirArchivo()` y `guardarImagenProcesada()` y usarlos en los tres flujos.
- [ ] **Paso 4:** ejecutar la suite; debe pasar y no dejar archivos temporales.

### Tarea 3: Prueba de humo del despliegue Apache

**Files:**
- Create: `tools/probar-despliegue-apache.sh`
- Modify: `README.md` (sección cPanel) solo si el script descubre una diferencia.

**Interfaces:**
- El script construye `frontend/dist/plantilla-educativa/browser`, monta el proyecto en `php:8.1-apache` con `mod_rewrite` y `AllowOverride All`, importa `API/esquema.sql` en una MariaDB de prueba, arranca el contenedor y ejecuta:
  - `GET /` -> 200 y contiene `app-root`.
  - `GET /api/publico/sitio` -> 200 JSON.
  - `GET /sitemap.xml` -> 200 `application/xml`.
  - `GET /robots.txt` -> 200 `text/plain`.
  - `GET /API/.env`, `/API/tmp/`, `/API/pruebas/` -> 403/404.
  - `GET /oferta` -> 200 (fallback SPA) si la página existe; si no, 200 con el portal.
- Debe imprimir `TODO OK` y salir 0; cualquier fallo sale 1.

- [ ] **Paso 1:** escribir el script con `set -euo pipefail`, `trap` de limpieza y las comprobaciones de arriba.
- [ ] **Paso 2:** ejecutarlo en un equipo con Docker/Podman; corregir las reglas de `.htaccess` si falla.
- [ ] **Paso 3:** documentar el comando en `README.md` como verificación previa a cPanel.

### Tarea 4: Cierre de calidad

**Files:**
- No code; solo verificación.

- [ ] **Paso 1:** ejecutar la suite completa del API y del frontend, `tsc`, `ng build` y `tools/probar-despliegue-apache.sh`.
- [ ] **Paso 2:** repetir la matriz de navegador de la auditoría (1440×900, 768×1024, 390×844) en Chromium y Firefox; confirmar `document.documentElement.scrollWidth === clientWidth` en todas las rutas.
- [ ] **Paso 3:** probar con un lector de pantalla básico (NVDA/VoiceOver) el alta de un mensaje, el libro de reclamaciones y el editor.
- [ ] **Paso 4:** actualizar este archivo marcando las tareas y anotar la fecha y el resultado.
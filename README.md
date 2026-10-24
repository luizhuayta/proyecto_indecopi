# Portal institucional educativo

Plantilla maestra de portal institucional para universidades e institutos, con panel de administración y editor visual de páginas. Construida sobre **Angular 21 + PHP 8.1 + MariaDB**, pensada para hosting compartido cPanel.

## Qué incluye

- **Portal público** con páginas reales, menú, buscador, SEO (`sitemap.xml`, `robots.txt`) y formulario de contacto.
- **Panel de administración** con gestión de páginas, medios, identidad de la institución, apariencia, usuarios y bandeja de mensajes.
- **Editor visual por bloques** (20 bloques y 6 plantillas) con vista previa por dispositivo, historial y publicación con borrador separado.
- **API REST en PHP** sin framework, con control de acceso por roles, sesión y CSRF.

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
docker run -d --name plantilla_portal_api --network plibre_default -p 8000:8000 \
  -v "$PWD":/app \
  -v "$HOME/.local/share/plibre-almacen":/tmp/opencode/plibre-almacen \
  -w /app plantilla-php81 php -S 0.0.0.0:8000 -t API API/entrada.php

# 4. Frontend (http://127.0.0.1:4200)
cd frontend && npm start
```

La configuración del API se lee de `API/.env` (copiar desde `API/.env.example`). La carpeta de archivos subidos debe quedar fuera del directorio público.

## Compilar

```bash
cd frontend && npm run build
```

## Pruebas

```bash
# API (suite propia, requiere PHP 8.1 con pdo_mysql)
docker run --rm --network plibre_default -v "$PWD":/app -w /app \
  -e DB_HOST=plantilla_mariadb -e DB_PORT=3306 \
  plantilla-php81 php API/pruebas/ejecutar.php

# Atajo si el contenedor del API ya está corriendo:
docker exec plantilla_portal_api php /app/API/pruebas/ejecutar.php
# Ojo: ejecutar "php API/pruebas/ejecutar.php" directamente en el host omite
# las pruebas de base de datos si el PHP local no tiene la extensión pdo_mysql.

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
2. Sube el proyecto a `public_html` y copia `API/.env.example` como `API/.env` con las credenciales de la base y `URL_BASE` de tu dominio.
3. Importa `API/esquema.sql` en phpMyAdmin.
4. Crea el administrador en la tabla `usuarios`: `usuario`, `hash_contrasena` (generado con `password_hash()`), `rol` = `admin` y `activo` = 1.
5. Deja la carpeta de archivos subidos fuera de `public_html`, con permisos 700.

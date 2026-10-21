<?php
declare(strict_types=1);

/**
 * Almacén de archivos fuera del directorio público y verificación de la firma
 * real del contenido (no de la extensión ni del Content-Type declarado).
 *
 * Porta el almacén de `Backend/src/modulos/archivos/archivos.servicio.js`
 * (Perucanadiense): binarios en `ALMACEN_DIR/AAAA/MM/<id>.<ext>`, carpetas 700,
 * archivos 600, deduplicación por sha256 y sin servir nunca el binario por
 * ruta. La verificación de firma porta `Backend/src/middlewares/subida.js`.
 */

require_once __DIR__ . '/configuracion.php';
require_once __DIR__ . '/../http/errores.php';

/** Permisos del almacén: carpetas 700, archivos 600. */
const PERMISO_CARPETA_ALMACEN = 0700;
const PERMISO_ARCHIVO_ALMACEN = 0600;

/**
 * Raíz pública del sitio: la carpeta que contiene el frontend (index.html),
 * es decir, la raíz del proyecto. `archivos.php` vive en `API/src/nucleo`,
 * así que tres niveles arriba queda la raíz del proyecto.
 */
function rutaPublicaRaiz(): string
{
    return dirname(__DIR__, 3);
}

/**
 * Ruta del almacén de archivos. Lee `ALMACEN_DIR` del entorno (.env); si está
 * vacío, usa `API/almacen/`. La ruta se devuelve sin barra final.
 */
function rutaAlmacen(): string
{
    $dir = trim(configurar('ALMACEN_DIR'));
    if ($dir === '') {
        $dir = dirname(__DIR__, 2) . '/almacen';
    }
    return rtrim($dir, '/');
}

/**
 * ¿La ruta queda dentro de la raíz pública del sitio?
 */
function esRutaDentroDePublico(string $ruta): bool
{
    $publica = rtrim(rutaPublicaRaiz(), '/');
    $normalizada = rtrim($ruta, '/');
    if ($normalizada === $publica) {
        return true;
    }
    return str_starts_with($normalizada . '/', $publica . '/');
}

/**
 * Rechaza la operación si el almacén configurado queda dentro del directorio
 * público. La raíz del almacén la fija quien despliega; aquí solo se garantiza
 * que el binario nunca viva donde el servidor web pueda servirlo por ruta.
 */
function verificarAlmacenFueraDePublico(): void
{
    if (esRutaDentroDePublico(rutaAlmacen())) {
        error_app(
            'El almacén de archivos no puede vivir dentro del directorio público. Configura ALMACEN_DIR fuera de public_html.',
            500
        );
    }
}

/**
 * Firmas reales del contenido por mime. La extensión y el Content-Type se
 * pueden falsear; aquí se leen los bytes.
 */
function firmasDeArchivo(): array
{
    return [
        'application/pdf' => ["%PDF"],
        'image/jpeg' => ["\xFF\xD8\xFF"],
        'image/png' => ["\x89PNG"],
        'image/gif' => ["GIF8"],
        'image/webp' => ["RIFF"], // + "WEBP" en el byte 8
    ];
}

/**
 * ¿El archivo en `$ruta` tiene la firma real correspondiente a `$mime`?
 */
function firmaDeArchivo(string $ruta, string $mime): bool
{
    $firmas = firmasDeArchivo()[$mime] ?? null;
    if ($firmas === null) {
        return false;
    }
    $fp = @fopen($ruta, 'rb');
    if ($fp === false) {
        return false;
    }
    $bytes = fread($fp, 12);
    fclose($fp);
    if ($bytes === false || strlen($bytes) < 12) {
        return false;
    }
    foreach ($firmas as $firma) {
        if (strncmp($bytes, $firma, strlen($firma)) === 0) {
            if ($mime === 'image/webp') {
                return substr($bytes, 8, 4) === 'WEBP';
            }
            return true;
        }
    }
    return false;
}

/**
 * Detecta el mime real del contenido a partir de la firma, ignorando por
 * completo la extensión y el Content-Type declarado. Devuelve null si el
 * contenido no corresponde a ningún tipo admitido.
 */
function detectarMimeArchivo(string $ruta): ?string
{
    foreach (array_keys(firmasDeArchivo()) as $mime) {
        if (firmaDeArchivo($ruta, $mime)) {
            return $mime;
        }
    }
    return null;
}

/**
 * ¿El mime es una imagen (a diferencia de un PDF)?
 */
function esImagenMime(string $mime): bool
{
    return in_array($mime, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], true);
}

/**
 * Extensión de archivo canónica para un mime.
 */
function extensionParaMime(string $mime): string
{
    return match ($mime) {
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
        'application/pdf' => 'pdf',
        default => 'bin',
    };
}

/**
 * Cierra el archivo (600) y las carpetas AAAA/MM y la raíz (700) recién
 * creados, con chmod DESPUÉS de escribir, porque la umask del proceso en
 * cPanel deja 755/644.
 */
function asegurarPermisosAlmacen(string $rutaArchivo): void
{
    if (is_file($rutaArchivo)) {
        @chmod($rutaArchivo, PERMISO_ARCHIVO_ALMACEN);
    }
    $raiz = rtrim(rutaAlmacen(), '/');
    $carpeta = dirname($rutaArchivo);
    while (true) {
        if (is_dir($carpeta)) {
            @chmod($carpeta, PERMISO_CARPETA_ALMACEN);
        }
        if ($carpeta === $raiz || $carpeta === '' || $carpeta === '/' || $carpeta === dirname($carpeta)) {
            break;
        }
        $carpeta = dirname($carpeta);
    }
    if (is_dir($raiz)) {
        @chmod($raiz, PERMISO_CARPETA_ALMACEN);
    }
}

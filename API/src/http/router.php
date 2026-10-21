<?php
declare(strict_types=1);

/**
 * Normalización de la ruta de entrada.
 *
 * El API se sirve de tres maneras y todas deben funcionar:
 *   - en el servidor de desarrollo, con el proxy de Angular: /api/auth/me
 *   - en cPanel, dentro de public_html/api/ y reescrito por .htaccess: /auth/me
 *   - en cPanel, con el frontal api.php: /api.php/auth/me
 *
 * Por eso se quita el prefijo que corresponda y se deja siempre la ruta
 * interna del módulo (/auth, /paginas, /configuracion).
 */

/**
 * Ruta interna de la petición, sin prefijo de instalación y sin barra final.
 */
function rutaDePeticion(): string
{
    $ruta = parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH) ?: '/';

    if (str_starts_with($ruta, '/api.php')) {
        $ruta = substr($ruta, strlen('/api.php'));
    } elseif (str_starts_with($ruta, '/api')) {
        $ruta = substr($ruta, strlen('/api'));
    }

    $ruta = '/' . trim($ruta, '/');
    return $ruta === '/' ? '/' : rtrim($ruta, '/');
}

/**
 * ¿La petición viene del navegador wanting CORS? El API y el sitio público
 * se sirven en el mismo dominio en producción, pero en desarrollo el Angular
 * corre en otro puerto.
 */
function peticionConPrefijoApi(): bool
{
    $ruta = parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH) ?: '/';
    return str_starts_with($ruta, '/api');
}

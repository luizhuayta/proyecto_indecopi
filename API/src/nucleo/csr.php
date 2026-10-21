<?php
declare(strict_types=1);

/**
 * Protección CSRF por sesión.
 * Portado de API/security.php (Matt): csrf_token() y require_csrf().
 * Token aleatorio de 32 bytes (64 caracteres hexadecimales) por sesión.
 */

require_once __DIR__ . '/sesion.php';

/**
 * Devuelve (o crea) el token CSRF de la sesión actual.
 */
function tokenCsrf(): string
{
    arrancarSesionPhp();
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return (string) $_SESSION['csrf'];
}

/**
 * Exige la cabecera X-CSRF-Token con el token de la sesión. Lanza prohibido()
 * (403) si no coincide, comparando con hash_equals.
 */
function exigirCsrf(): void
{
    arrancarSesionPhp();
    $enviado = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    $esperado = (string) ($_SESSION['csrf'] ?? '');
    if ($esperado === '' || $enviado === '' || !hash_equals($esperado, $enviado)) {
        prohibido('Token CSRF inválido.');
    }
}

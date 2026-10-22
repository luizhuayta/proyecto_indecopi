<?php
declare(strict_types=1);

/**
 * Sesión con revalidación por petición.
 *
 * Porta la cookie y la sesión de API/security.php (Matt) y la revalidación de
 * Backend/src/middlewares/auth.js (Perucanadiense): en cada petición autenticada
 * se lee de la base el `id`, el `rol`, el estado `activo` y la fecha de cambio
 * de contraseña (`contrasena_actualizada_en`). El rol se toma SIEMPRE de la
 * base, nunca de la variable de sesión.
 *
 * La identidad de la sesión vive en `$_SESSION` (cookie) en las peticiones
 * reales y en un registro en memoria (`fijarSesionDePrueba`) durante las
 * pruebas. Ambas se leen a través de `sesionEnMemoria()`.
 */

require_once __DIR__ . '/base_datos.php';
require_once __DIR__ . '/../http/errores.php';

/**
 * Nombre de la cookie de sesión.
 */
function nombreCookieSesion(): string
{
    return 'plibre_sesion';
}

/**
 * ¿La petición actual viaja por HTTPS? Tiene en cuenta proxies de cPanel.
 */
function peticionEsHttps(): bool
{
    $https = strtolower((string) ($_SERVER['HTTPS'] ?? ''));
    if ($https !== '' && $https !== 'off') {
        return true;
    }
    return strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
}

/**
 * Parámetros de la cookie de sesión: HttpOnly, SameSite=Lax, Secure en HTTPS,
 * ruta '/'.
 */
function parametrosCookieSesion(): array
{
    return [
        'lifetime' => 0,
        'path' => '/',
        'domain' => '',
        'secure' => peticionEsHttps(),
        'httponly' => true,
        'samesite' => 'Lax',
    ];
}

/**
 * Arranca la sesión PHP con la cookie endurecida, si no está activa.
 */
function arrancarSesionPhp(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_name(nombreCookieSesion());
    session_set_cookie_params(parametrosCookieSesion());
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.use_cookies', '1');
    session_start();
}

/**
 * Estado de la sesión actual: `['usuario_id' => int, 'sesion_version' => int]`.
 * Prefiere la sesión fijada en memoria por las pruebas; si no, lee `$_SESSION`.
 *
 * `sesion_version` es el contador de credenciales del usuario en el momento en
 * que se emitió la sesión. Si la contraseña cambia, el contador sube y las
 * sesiones emitidas antes dejan de valer. Se compara un entero, no una marca
 * de tiempo: cambiar la contraseña dos veces en el mismo segundo también
 * invalida, sin excepciones ni ventanas.
 */
function sesionEnMemoria(): array
{
    if (isset($GLOBALS['__sesion_prueba']) && is_array($GLOBALS['__sesion_prueba'])) {
        return [
            'usuario_id' => (int) ($GLOBALS['__sesion_prueba']['usuario_id'] ?? 0),
            'sesion_version' => (int) ($GLOBALS['__sesion_prueba']['sesion_version'] ?? 0),
        ];
    }
    arrancarSesionPhp();
    return [
        'usuario_id' => (int) ($_SESSION['usuario_id'] ?? 0),
        'sesion_version' => (int) ($_SESSION['sesion_version'] ?? 0),
    ];
}

/**
 * Fija el identificador de usuario de la sesión (lo usa el login antes de
 * `iniciarSesion()`).
 */
function fijarUsuarioDeSesion(int $usuarioId): void
{
    arrancarSesionPhp();
    $_SESSION['usuario_id'] = $usuarioId;
}

/**
 * Contador de credenciales del usuario: sube cada vez que se cambia la
 * contraseña, para invalidar las sesiones emitidas antes del cambio.
 */
function versionSesionDeUsuario(int $usuarioId): int
{
    $usuario = usuarioDeSesionPorId($usuarioId);
    return $usuario === null ? 0 : (int) ($usuario['sesion_version'] ?? 0);
}

/**
 * Finaliza un inicio de sesión: regenera el identificador (contra fijación de
 * sesión) y sella el contador de credenciales del usuario.
 */
function iniciarSesion(): void
{
    arrancarSesionPhp();
    session_regenerate_id(true);
    $_SESSION['sesion_version'] = versionSesionDeUsuario((int) ($_SESSION['usuario_id'] ?? 0));
}

/**
 * SOLO PARA PRUEBAS: fija en memoria la sesión actual (usuario + contador de
 * credenciales) sin tocar cookies ni `$_SESSION`. `exigirSesion()` revalida
 * contra la base igual que en una petición real. Con null se cierra la sesión
 * de prueba.
 */
function fijarSesionDePrueba(?int $usuarioId): void
{
    if ($usuarioId === null) {
        unset($GLOBALS['__sesion_prueba']);
        return;
    }
    $GLOBALS['__sesion_prueba'] = [
        'usuario_id' => $usuarioId,
        'sesion_version' => versionSesionDeUsuario($usuarioId),
    ];
}

/**
 * Lee del usuario actual (id, usuario, rol, activo, sesion_version).
 * Es una consulta mínima de revalidación propia del núcleo; la capa de
 * repositorio del módulo `sesion_usuarios` repite el acceso a `usuarios` para
 * el resto de operaciones.
 */
function usuarioDeSesionPorId(int $id): ?array
{
    $stmt = conexion()->prepare(
        'SELECT id, usuario, rol, activo, sesion_version
           FROM usuarios WHERE id = ? LIMIT 1'
    );
    $stmt->execute([$id]);
    $fila = $stmt->fetch();
    return $fila === false ? null : $fila;
}

/**
 * Destruye la sesión (cookie, datos y la sesión de prueba en memoria).
 */
function destruirSesion(): void
{
    unset($GLOBALS['__sesion_prueba']);
    if (session_status() !== PHP_SESSION_ACTIVE) {
        return;
    }
    $_SESSION = [];
    $p = parametrosCookieSesion();
    setcookie(nombreCookieSesion(), '', [
        'expires' => time() - 42000,
        'path' => $p['path'],
        'domain' => $p['domain'],
        'secure' => (bool) $p['secure'],
        'httponly' => (bool) $p['httponly'],
        'samesite' => $p['samesite'],
    ]);
    session_destroy();
}

/**
 * Revalida la sesión contra la base y devuelve
 * `['id' => int, 'usuario' => string, 'rol' => string]`, o null si no es
 * válida. Destruye la sesión cuando la cuenta está inactiva o cuando las
 * credenciales cambiaron después de emitir la sesión.
 */
function revalidarSesion(): ?array
{
    $estado = sesionEnMemoria();
    $id = (int) $estado['usuario_id'];
    if ($id <= 0) {
        return null;
    }

    $usuario = usuarioDeSesionPorId($id);
    if ($usuario === null || (int) $usuario['activo'] !== 1) {
        destruirSesion();
        return null;
    }

    if ((int) $usuario['sesion_version'] !== (int) $estado['sesion_version']) {
        destruirSesion();
        return null;
    }

    return [
        'id' => (int) $usuario['id'],
        'usuario' => (string) $usuario['usuario'],
        'rol' => (string) $usuario['rol'],
    ];
}

/**
 * Usuario revalidado actual, o null si no hay sesión válida.
 */
function usuarioActual(): ?array
{
    return revalidarSesion();
}

/**
 * ¿Hay una sesión válida en este momento?
 */
function sesionActiva(): bool
{
    return revalidarSesion() !== null;
}

/**
 * Exige una sesión válida; lanza noAutorizado() (401) si no la hay.
 */
function exigirSesion(): array
{
    $usuario = revalidarSesion();
    if ($usuario === null) {
        noAutorizado('Debes iniciar sesión.');
    }
    return $usuario;
}

/**
 * Exige que el rol actual esté en la lista; si no, lanza prohibido() (403).
 * Devuelve el usuario actual (con el rol leído de la base).
 */
function exigirRol(string ...$roles): array
{
    $usuario = exigirSesion();
    if (!in_array($usuario['rol'], $roles, true)) {
        prohibido('Se requiere rol ' . implode(' o ', $roles) . '.');
    }
    return $usuario;
}

/**
 * Dirección IP del cliente, saneada.
 */
function clienteIp(): string
{
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
    return preg_replace('/[^0-9a-fA-F:.]/', '', $ip) ?: '0.0.0.0';
}

/**
 * Directorio de los archivos de límite de intentos (fuera de public_html).
 */
function directorioRateLimit(): string
{
    return dirname(__DIR__, 2) . '/tmp/ratelimit';
}

/**
 * Límite de intentos de login por IP: 8 cada 5 minutos. Porta el rate_limit
 * por archivo de API/security.php (Matt).
 */
function limiteIntentosLogin(): void
{
    $dir = directorioRateLimit();
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    $clave = preg_replace('/[^a-z0-9._-]/i', '_', 'login_' . clienteIp()) ?: 'login_ip';
    $archivo = $dir . '/' . $clave . '.json';
    $ahora = time();

    $intentos = [];
    if (is_file($archivo)) {
        $intentos = json_decode((string) file_get_contents($archivo), true) ?: [];
    }
    $intentos = array_values(array_filter(
        $intentos,
        static fn ($t) => is_int($t) && $t > $ahora - 300
    ));
    if (count($intentos) >= 8) {
        error_app('Demasiados intentos de inicio de sesión. Inténtalo más tarde.', 429);
    }
    $intentos[] = $ahora;
    file_put_contents($archivo, json_encode($intentos), LOCK_EX);
}

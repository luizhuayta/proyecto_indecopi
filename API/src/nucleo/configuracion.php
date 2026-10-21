<?php
declare(strict_types=1);

/**
 * Lectura de configuración.
 * Portado de API/config.php (Matt): env_load() y cfg().
 * Los valores por defecto salen de app_config() con literales neutros;
 * ninguna clave ni credencial de ejemplo va dentro del código.
 */

/**
 * Carga variables de un archivo .env en el entorno, si existe.
 */
function env_load(string $ruta): void
{
    if (!is_file($ruta)) {
        return;
    }
    foreach (file($ruta, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $linea) {
        $linea = trim($linea);
        if ($linea === '' || str_starts_with($linea, '#')) {
            continue;
        }
        [$clave, $valor] = array_pad(explode('=', $linea, 2), 2, '');
        $clave = trim($clave);
        $valor = trim($valor, " \t\"'");
        if ($clave !== '' && getenv($clave) === false) {
            putenv("$clave=$valor");
            $_ENV[$clave] = $valor;
        }
    }
}

/**
 * Valores por defecto neutros para el entorno de desarrollo local.
 */
function app_config(): array
{
    return [
        'DB_HOST' => '127.0.0.1',
        'DB_PORT' => '3307',
        'DB_NAME' => 'plantilla_cms',
        'DB_USER' => 'plantilla',
        'DB_PASSWORD' => 'plantilla_local',
    ];
}

/**
 * Devuelve el valor de una clave de configuración.
 * Orden de precedencia: variable de entorno (.env), $porDefecto, app_config().
 */
function configurar(string $clave, string $porDefecto = ''): string
{
    $valor = $_ENV[$clave] ?? getenv($clave);
    if ($valor !== false && $valor !== null && $valor !== '') {
        return (string) $valor;
    }
    if ($porDefecto !== '') {
        return $porDefecto;
    }
    $defectos = app_config();
    return (string) ($defectos[$clave] ?? '');
}

env_load(__DIR__ . '/../../.env');

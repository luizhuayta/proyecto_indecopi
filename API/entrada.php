<?php
declare(strict_types=1);

/**
 * Punto de entrada del API.
 *
 * Mínimo por ahora: carga el núcleo y despacha al módulo de sesión/usuarios.
 * Cuando exista el enrutador central (src/http/router.php) este archivo lo
 * usará; hoy deriva la petición al módulo `sesion_usuarios`.
 */

require_once __DIR__ . '/src/http/errores.php';
require_once __DIR__ . '/src/http/respuesta.php';
require_once __DIR__ . '/src/nucleo/base_datos.php';
require_once __DIR__ . '/src/nucleo/sesion.php';
require_once __DIR__ . '/src/nucleo/csr.php';
require_once __DIR__ . '/src/nucleo/auditoria.php';
require_once __DIR__ . '/src/modulos/sesion_usuarios/rutas.php';

$metodo = (string) ($_SERVER['REQUEST_METHOD'] ?? 'GET');
$ruta = parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH) ?: '/';
if ($ruta !== '/' && str_ends_with($ruta, '/')) {
    $ruta = rtrim($ruta, '/');
}

try {
    manejarRutasSesionUsuarios($metodo, $ruta);
} catch (ErrorApp $e) {
    json_out(['error' => $e->getMessage()], $e->codigoHttp);
} catch (Throwable $e) {
    json_out(['error' => 'Error interno del servidor.'], 500);
}

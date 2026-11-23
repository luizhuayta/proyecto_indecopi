<?php
declare(strict_types=1);

/**
 * Punto de entrada del API.
 *
 * Carga el núcleo y despacha por prefijo de ruta a los módulos:
 *   /auth          -> sesión y usuarios
 *   /paginas       -> páginas, contenido y publicación
 *   /noticias      -> noticias y comunicados (gestión del panel)
 *   /configuracion -> configuración del sitio
 */

require_once __DIR__ . '/src/http/errores.php';
require_once __DIR__ . '/src/http/respuesta.php';
require_once __DIR__ . '/src/http/router.php';
require_once __DIR__ . '/src/nucleo/base_datos.php';
require_once __DIR__ . '/src/nucleo/sesion.php';
require_once __DIR__ . '/src/nucleo/csr.php';
require_once __DIR__ . '/src/nucleo/auditoria.php';
require_once __DIR__ . '/src/nucleo/json.php';
require_once __DIR__ . '/src/nucleo/documento.php';
require_once __DIR__ . '/src/modulos/sesion_usuarios/rutas.php';
require_once __DIR__ . '/src/modulos/paginas/rutas.php';
require_once __DIR__ . '/src/modulos/contenido/rutas.php';
require_once __DIR__ . '/src/modulos/medios/rutas.php';
require_once __DIR__ . '/src/modulos/identidad/rutas.php';
require_once __DIR__ . '/src/modulos/publico/rutas.php';
require_once __DIR__ . '/src/modulos/mensajes/rutas.php';
require_once __DIR__ . '/src/modulos/noticias/rutas.php';

$metodo = (string) ($_SERVER['REQUEST_METHOD'] ?? 'GET');
$ruta = rutaDePeticion();

// El servidor web reescribe las rutas SEO de la raíz a este punto de entrada.
if ($ruta === '/sitemap.xml') {
    $ruta = '/publico/sitemap.xml';
} elseif ($ruta === '/robots.txt') {
    $ruta = '/publico/robots.txt';
}

try {
    if (str_starts_with($ruta, '/publico/')) {
        manejarRutasPublico($metodo, $ruta);
    } elseif (str_starts_with($ruta, '/mensajes')) {
        manejarRutasMensajes($metodo, $ruta);
    } elseif (str_starts_with($ruta, '/noticias')) {
        manejarRutasNoticias($metodo, $ruta);
    } elseif (str_starts_with($ruta, '/auth')) {
        manejarRutasSesionUsuarios($metodo, $ruta);
    } elseif (str_starts_with($ruta, '/paginas')) {
        manejarRutasPaginas($metodo, $ruta);
    } elseif (str_starts_with($ruta, '/medios')) {
        manejarRutasMedios($metodo, $ruta);
    } elseif (str_starts_with($ruta, '/identidad') || str_starts_with($ruta, '/configuracion/apariencia')) {
        manejarRutasIdentidad($metodo, $ruta);
    } elseif (str_starts_with($ruta, '/configuracion')) {
        manejarRutasContenido($metodo, $ruta);
    } else {
        noEncontrado('Ruta no encontrada.');
    }
} catch (ErrorApp $e) {
    json_out(
        array_merge(
            ['error' => $e->getMessage(), 'message' => $e->getMessage()],
            $e->extra
        ),
        $e->codigoHttp
    );
} catch (Throwable $e) {
    json_out(['error' => 'Error interno del servidor.', 'message' => 'Error interno del servidor.'], 500);
}

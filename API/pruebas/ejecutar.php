<?php
declare(strict_types=1);

/**
 * Corredor de pruebas del API.
 *
 * Incluye todos los archivos `*_pruebas.php` de este directorio, ejecuta cada
 * prueba y muestra OK/FAIL una por una. No requiere base de datos: las pruebas
 * que necesiten base se omiten con un aviso si la conexión no está disponible.
 *
 * Uso: php API/pruebas/ejecutar.php
 */

// La salida se guarda hasta el final: así las pruebas que abren sesión no
// encuentran las cabeceras ya enviadas por los mensajes OK/FAIL.
ob_start();

$GLOBALS['__pruebas'] = [];
$GLOBALS['__ultimo_error_codigo'] = null;

/**
 * Registra una prueba con su nombre y su función.
 */
function probar(string $nombre, callable $funcion): void
{
    $GLOBALS['__pruebas'][] = ['nombre' => $nombre, 'funcion' => $funcion];
}

/**
 * Afirma una condición; lanza una excepción si no se cumple.
 */
function afirmar(bool $condicion, string $mensaje): void
{
    if (!$condicion) {
        throw new RuntimeException($mensaje);
    }
}

/**
 * Ejecuta $funcion capturando las excepciones y guardando el código HTTP
 * del error lanzado, para que la prueba pueda comprobarlo después.
 */
function intentar(callable $funcion): void
{
    $GLOBALS['__ultimo_error_codigo'] = null;
    try {
        $funcion();
    } catch (Throwable $e) {
        $codigo = $e->getCode();
        $GLOBALS['__ultimo_error_codigo'] = (is_int($codigo) && $codigo >= 100 && $codigo < 600) ? $codigo : null;
    }
}

/**
 * Código HTTP del último error capturado por intentar(), o null.
 */
function error_ultimo_codigo(): ?int
{
    return $GLOBALS['__ultimo_error_codigo'];
}

$raiz = dirname(__DIR__);

require_once $raiz . '/src/nucleo/configuracion.php';
require_once $raiz . '/src/nucleo/base_datos.php';
require_once $raiz . '/src/nucleo/fechas.php';
require_once $raiz . '/src/nucleo/slug.php';
require_once $raiz . '/src/nucleo/codigos.php';
require_once $raiz . '/src/nucleo/validacion.php';
require_once $raiz . '/src/nucleo/json.php';
require_once $raiz . '/src/http/respuesta.php';
require_once $raiz . '/src/http/errores.php';

$archivosPrueba = glob(__DIR__ . '/*_pruebas.php') ?: [];
sort($archivosPrueba);
foreach ($archivosPrueba as $archivo) {
    require_once $archivo;
}

$total = count($GLOBALS['__pruebas']);
$fallos = 0;
$omitidas = 0;

foreach ($GLOBALS['__pruebas'] as $prueba) {
    try {
        $prueba['funcion']();
        echo "OK   {$prueba['nombre']}\n";
    } catch (PDOException $e) {
        $omitidas++;
        echo "OMIT {$prueba['nombre']} — base de datos no disponible\n";
    } catch (Throwable $e) {
        $fallos++;
        echo "FAIL {$prueba['nombre']} — {$e->getMessage()}\n";
    }
}

echo "\n{$total} pruebas, {$fallos} fallos, {$omitidas} omitidas.\n";

ob_end_flush();

exit($fallos === 0 ? 0 : 1);

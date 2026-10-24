<?php
declare(strict_types=1);

/**
 * Reconstruye el índice de búsqueda público desde las páginas publicadas.
 *
 * El índice se llena al publicar; este script lo rehace por completo, útil
 * cuando cambia la forma de indexar o cuando se corrigen contenidos ya
 * publicados.
 *
 * Uso (dentro del contenedor de PHP 8.1):
 *   docker run --rm --network plibre_default -v "$PWD":/app -w /app \
 *     -e DB_HOST=plantilla_mariadb -e DB_PORT=3306 \
 *     plantilla-php81 php tools/reindexar-busqueda.php
 */

require_once __DIR__ . '/../API/src/nucleo/base_datos.php';
require_once __DIR__ . '/../API/src/nucleo/json.php';
require_once __DIR__ . '/../API/src/modulos/busqueda/servicio.php';

$stmt = conexion()->query('SELECT slug, locale, titulo, ruta, contenido FROM paginas');
$filas = $stmt->fetchAll(PDO::FETCH_ASSOC);

$paginadas = 0;
$omitidas = 0;
foreach ($filas as $fila) {
    $contenido = json_decode((string) ($fila['contenido'] ?? ''), true);
    if (!is_array($contenido) || $contenido === []) {
        $omitidas++;
        continue;
    }
    $ruta = (string) ($fila['ruta'] ?? '');
    if ($ruta === '') {
        $ruta = '/' . (string) $fila['slug'];
    }
    indexarPagina($ruta, (string) $fila['locale'], (string) $fila['titulo'], $contenido);
    $paginadas++;
}

// Las rutas que ya no existen en paginas deben salir del índice.
$stmt = conexion()->query('SELECT DISTINCT ruta FROM trabajos_busqueda');
foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $fila) {
    $ruta = (string) $fila['ruta'];
    $existe = false;
    foreach ($filas as $filaPagina) {
        $rutaPagina = (string) ($filaPagina['ruta'] ?? '');
        if ($rutaPagina === '') {
            $rutaPagina = '/' . (string) $filaPagina['slug'];
        }
        if ($rutaPagina === $ruta) {
            $existe = true;
            break;
        }
    }
    if (!$existe) {
        quitarDelIndice($ruta, 'es');
    }
}

echo "Índice reconstruido: {$paginadas} páginas indexadas, {$omitidas} sin contenido publicado.\n";

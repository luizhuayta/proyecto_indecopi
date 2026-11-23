<?php
declare(strict_types=1);

/**
 * Reconstruye el índice de búsqueda público desde las páginas publicadas y
 * las noticias publicadas.
 *
 * El índice se llena al publicar; este script lo rehace por completo, útil
 * cuando cambia la forma de indexar o cuando se corrigen contenidos ya
 * publicados.
 *
 * Uso (con el contenedor del API levantado):
 *   docker exec plantilla_portal_api php tools/reindexar-busqueda.php
 *
 * Alternativa sin el API levantado (MariaDB del compose):
 *   docker run --rm --network container:plantilla_mariadb -v "$PWD":/app -w /app \
 *     -e DB_HOST=127.0.0.1 -e DB_PORT=3306 -e DB_NAME=plantilla_cms \
 *     -e DB_USER=plantilla -e DB_PASSWORD=plantilla_local \
 *     plantilla-php81 php tools/reindexar-busqueda.php
 */

require_once __DIR__ . '/../API/src/nucleo/base_datos.php';
require_once __DIR__ . '/../API/src/nucleo/json.php';
require_once __DIR__ . '/../API/src/modulos/busqueda/servicio.php';
require_once __DIR__ . '/../API/src/modulos/noticias/repositorio.php';

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

// Las noticias publicadas también forman parte del índice, con la misma forma
// que usa el servicio de noticias al publicar.
$noticias = conexion()->query(
    "SELECT slug, titulo, resumen, cuerpo FROM noticias WHERE estado = 'publicado' AND publicado_en <= NOW()"
)->fetchAll(PDO::FETCH_ASSOC);
$rutasNoticias = [];
foreach ($noticias as $noticia) {
    $ruta = '/noticias/' . $noticia['slug'];
    $rutasNoticias[] = $ruta;
    indexarPagina($ruta, 'es', (string) $noticia['titulo'], ['blocks' => [['props' => [
        'resumen' => (string) $noticia['resumen'],
        'cuerpo' => (string) ($noticia['cuerpo'] ?? ''),
    ]]]]);
}

// Las rutas que ya no existen en paginas ni en noticias deben salir del índice.
$stmt = conexion()->query('SELECT DISTINCT ruta FROM trabajos_busqueda');
foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $fila) {
    $ruta = (string) $fila['ruta'];
    $existe = in_array($ruta, $rutasNoticias, true);
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

$totalNoticias = count($noticias);
echo "Índice reconstruido: {$paginadas} páginas indexadas, {$omitidas} sin contenido publicado, {$totalNoticias} noticias indexadas.\n";

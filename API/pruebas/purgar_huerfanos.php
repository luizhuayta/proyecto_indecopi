<?php
declare(strict_types=1);

/**
 * Mantenimiento: purga las filas huérfanas de `medios` (y sus variantes y
 * versiones) cuyo binario ya no existe en el almacén.
 *
 * No termina en `_pruebas.php`, así que el corredor no lo ejecuta: es un
 * script de mantenimiento para lanzar a mano cuando el almacén se pierde (p.
 * ej. el contenedor era efímero) y en la base quedan filas cuyos binarios ya
 * no están: al listar medios aparecen «archivos muertos».
 *
 * Uso:
 *
 *   # Solo listar (no borra nada):
 *   php API/pruebas/purgar_huerfanos.php
 *
 *   # Listar y eliminar:
 *   php API/pruebas/purgar_huerfanos.php ejecutar
 *
 * Desde el host, con la base y el almacén reales (el almacén debe estar
 * montado en la ruta de `ALMACEN_DIR`, o la comprobación `is_file` no verá los
 * binarios y purgaría filas válidas):
 *
 *   docker exec plantilla_portal_api php /app/API/pruebas/purgar_huerfanos.php [ejecutar]
 *
 * El contenedor del API ya monta el almacén en `ALMACEN_DIR`. Desde el host,
 * usa el volumen o la carpeta reales y pasa el mismo `ALMACEN_DIR`.
 */

require_once __DIR__ . '/../src/nucleo/configuracion.php';
require_once __DIR__ . '/../src/nucleo/base_datos.php';
require_once __DIR__ . '/../src/nucleo/archivos.php';
require_once __DIR__ . '/../src/modulos/medios/repositorio.php';

$ejecutar = isset($argv[1]) && $argv[1] === 'ejecutar';
$raiz = rutaAlmacen();

echo "Almacén: {$raiz}\n";
echo ($ejecutar ? 'MODO: purgar (lista y elimina)' : 'MODO: listado (añade "ejecutar" para eliminar)') . "\n\n";

$todos = mediosTodosBd();
$huérfanos = [];
foreach ($todos as $fila) {
    $ruta = $raiz . '/' . (string) $fila['nombre_guardado'];
    if (!is_file($ruta)) {
        $huérfanos[(int) $fila['id']] = $fila;
    }
}

// Y los hijos (variantes/recortes) de un padre huérfano también quedan
// inaccesibles: se purgan aunque su binario siga existe, más su binario.
foreach ($todos as $fila) {
    $padre = (int) ($fila['padre_id'] ?? 0);
    if ($padre > 0 && isset($huérfanos[$padre])) {
        $huérfanos[(int) $fila['id']] = $fila;
    }
}

if ($huérfanos === []) {
    echo "Sin filas huérfanas: no hay que purgar nada.\n";
    exit(0);
}

foreach ($huérfanos as $fila) {
    $ruta = $raiz . '/' . (string) $fila['nombre_guardado'];
    echo sprintf(
        "huérfano id=%d tipo=%s nombre=%s archivo=%s (padre=%s)\n",
        (int) $fila['id'],
        (string) $fila['tipo'],
        (string) $fila['nombre_original'],
        (string) $fila['nombre_guardado'],
        $fila['padre_id'] !== null ? (string) $fila['padre_id'] : '—'
    );
}

if (!$ejecutar) {
    echo "\n" . count($huérfanos) . " filas huérfanas listadas. No se ha borrado nada.\n";
    exit(0);
}

echo "\nPurgando…\n";
$eliminadas = 0;
foreach ($huérfanos as $id => $fila) {
    // Versiones (historial) del medio y binario best effort.
    foreach (versionesDeMedioBd($id) as $version) {
        $rutaVersion = $raiz . '/' . (string) $version['nombre_guardado'];
        if (is_file($rutaVersion)) {
            @unlink($rutaVersion);
        }
    }
    eliminarVersionesMedioBd($id);

    foreach (mediosHijasBd($id) as $hija) {
        $rutaHija = $raiz . '/' . (string) $hija['nombre_guardado'];
        if (is_file($rutaHija)) {
            @unlink($rutaHija);
        }
    }

    if (is_file($raiz . '/' . (string) $fila['nombre_guardado'])) {
        @unlink($raiz . '/' . (string) $fila['nombre_guardado']);
    }
    eliminarMedioBd($id);
    $eliminadas++;
}

echo "Eliminadas {$eliminadas} filas de `medios` huérfanas.\n";
exit(0);

<?php
declare(strict_types=1);

/**
 * Búsqueda del sitio público.
 *
 * El índice se llena al publicar una página: ruta, título y texto plano. La
 * búsqueda solo devuelve páginas con contenido publicado, de modo que un
 * borrador nunca llega a los resultados aunque esté indexado de una versión
 * anterior.
 */

require_once __DIR__ . '/../../nucleo/base_datos.php';
require_once __DIR__ . '/../../nucleo/json.php';

/**
 * Texto plano de un contenido de bloques (todos los campos de texto).
 */
function textoPlanoDeContenido(array $contenido): string
{
    $partes = [];
    $recorrer = function (mixed $valor) use (&$recorrer, &$partes): void {
        if (is_string($valor)) {
            $limpio = trim(strip_tags($valor));
            if ($limpio !== '') {
                $partes[] = $limpio;
            }
            return;
        }
        if (is_array($valor)) {
            foreach ($valor as $hijo) {
                $recorrer($hijo);
            }
        }
    };
    $recorrer($contenido['blocks'] ?? []);
    return implode("\n", $partes);
}

/**
 * Indexa (o actualiza) una página publicada en el índice de búsqueda.
 */
function indexarPagina(string $ruta, string $locale, string $titulo, array $contenido): void
{
    $stmt = conexion()->prepare(
        'INSERT INTO trabajos_busqueda (ruta, locale, titulo, texto)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE titulo = VALUES(titulo), texto = VALUES(texto)'
    );
    $stmt->execute([$ruta, $locale, $titulo, textoPlanoDeContenido($contenido)]);
}

/**
 * Quita una página del índice de búsqueda (al eliminarla).
 */
function quitarDelIndice(string $ruta, string $locale): void
{
    $stmt = conexion()->prepare('DELETE FROM trabajos_busqueda WHERE ruta = ? AND locale = ?');
    $stmt->execute([$ruta, $locale]);
}

/**
 * Busca en las páginas publicadas. Devuelve título, ruta y un fragmento.
 */
function buscar(string $texto, string $locale, int $limite = 20): array
{
    $consulta = trim($texto);
    if ($consulta === '') {
        return [];
    }
    $limite = max(1, min(50, $limite));
    $patron = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $consulta) . '%';

    $stmt = conexion()->prepare(
        'SELECT i.ruta, i.titulo, i.texto
           FROM trabajos_busqueda i
           JOIN paginas p ON p.ruta = i.ruta AND p.locale = i.locale AND p.contenido IS NOT NULL
          WHERE i.locale = ? AND (i.titulo LIKE ? OR i.texto LIKE ?)
          ORDER BY (i.titulo LIKE ?) DESC, i.titulo
          LIMIT ' . $limite
    );
    $stmt->execute([$locale, $patron, $patron, $patron]);
    $filas = $stmt->fetchAll();

    $resultados = [];
    foreach ($filas as $fila) {
        $texto = (string) ($fila['texto'] ?? '');
        $posicion = mb_stripos($texto, $consulta);
        $inicio = $posicion === false ? 0 : max(0, $posicion - 40);
        $fragmento = trim(mb_substr($texto, $inicio, 160));
        $resultados[] = [
            'titulo' => (string) ($fila['titulo'] ?? ''),
            'ruta' => (string) ($fila['ruta'] ?? ''),
            'fragmento' => ($inicio > 0 ? '…' : '') . $fragmento . '…',
        ];
    }
    return $resultados;
}

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
require_once __DIR__ . '/../identidad/servicio.php';

/**
 * Texto plano de un contenido de bloques (todos los campos de texto).
 *
 * Solo se indexa el contenido de cada bloque. 'id' y 'type' son metadatos
 * internos del constructor visual: indexarlos metía en los resultados cadenas
 * como «b4 richText content» que no significan nada para quien busca.
 *
 * Los tokens de la institución se resuelven al indexar para que el resultado
 * muestre el nombre real y no «{{institucion.nombre}}».
 */
function textoPlanoDeContenido(array $contenido): string
{
    $partes = [];
    $recorrer = function (mixed $valor, string $clave = '') use (&$recorrer, &$partes): void {
        // 'icon' guarda el nombre de un icono («bi-geo-alt»): es un identificador
        // decorativo, no texto que un visitante quiera encontrar.
        if ($clave === 'icon') {
            return;
        }
        if (is_string($valor)) {
            // Un salto de línea o un cierre de párrafo se convierte en un
            // espacio: si no, dos frases quedan pegadas («…de gestión.La
            // matrícula…») y el texto no sirve ni para el índice ni para la
            // descripción del portal.
            $limpio = trim(strip_tags(preg_replace('#</(?:p|div|li|h[1-6])>|<br\s*/?>#i', ' ', resolverTokens($valor)) ?? ''));
            if ($limpio !== '') {
                $partes[] = $limpio;
            }
            return;
        }
        if (is_array($valor)) {
            foreach ($valor as $k => $hijo) {
                $recorrer($hijo, is_string($k) ? $k : '');
            }
        }
    };
    foreach (($contenido['blocks'] ?? []) as $bloque) {
        if (is_array($bloque)) {
            $recorrer($bloque['props'] ?? []);
        }
    }
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

    // Los resultados deben llevar a una página visible: o una página con
    // contenido publicado, o una noticia publicada y ya vigente (los dos
    // LEFT JOIN + el IS NOT NULL actúan como el antiguo INNER JOIN).
    $stmt = conexion()->prepare(
        'SELECT DISTINCT i.ruta, i.titulo, i.texto
           FROM trabajos_busqueda i
           LEFT JOIN paginas p ON p.ruta = i.ruta AND p.locale = i.locale AND p.contenido IS NOT NULL
           LEFT JOIN noticias n ON i.ruta = CONCAT(\'/noticias/\', n.slug)
               AND n.estado = \'publicado\' AND n.publicado_en <= NOW()
          WHERE i.locale = ? AND (i.titulo LIKE ? OR i.texto LIKE ?)
            AND (p.slug IS NOT NULL OR n.slug IS NOT NULL)
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

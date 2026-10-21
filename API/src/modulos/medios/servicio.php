<?php
declare(strict_types=1);

/**
 * Lógica de negocio de medios: subida, recorte, variantes, historial y
 * restauración. Capa servicio: valida, autoriza y coordina núcleo +
 * repositorio. El binario nunca se sirve por ruta: la única puerta es
 * GET /medios/{id}.
 */

require_once __DIR__ . '/../../nucleo/archivos.php';
require_once __DIR__ . '/../../nucleo/sesion.php';
require_once __DIR__ . '/../../nucleo/auditoria.php';
require_once __DIR__ . '/../../nucleo/validacion.php';
require_once __DIR__ . '/../../nucleo/fechas.php';
require_once __DIR__ . '/../../http/errores.php';
require_once __DIR__ . '/esquemas.php';
require_once __DIR__ . '/repositorio.php';

/** URL pública de un medio. */
function urlMedio(int $id): string
{
    return '/api/medios/' . $id;
}

/** ¿GD está disponible para procesar imágenes? */
function gdDisponible(): bool
{
    return function_exists('imagecreatetruecolor') && function_exists('imagejpeg');
}

/** ¿La extensión GD genera WebP? */
function soportaWebp(): bool
{
    return function_exists('imagewebp');
}

/** Decodifica la columna `variantes` (JSON) en un array. */
function decodificarVariantes(mixed $valor): array
{
    if (is_array($valor)) {
        return $valor;
    }
    if (is_string($valor) && $valor !== '') {
        $decodificado = json_decode($valor, true);
        return is_array($decodificado) ? $decodificado : [];
    }
    return [];
}

/** Resumen de una fila de medio para las respuestas del API. */
function respuestaMedioDesdeFila(array $fila): array
{
    return [
        'id' => (int) ($fila['id'] ?? 0),
        'nombre_original' => (string) ($fila['nombre_original'] ?? ''),
        'url' => (string) ($fila['url'] ?? ''),
        'mime' => (string) ($fila['mime'] ?? ''),
        'tamano' => (int) ($fila['tamano'] ?? 0),
        'ancho' => isset($fila['ancho']) && $fila['ancho'] !== null ? (int) $fila['ancho'] : null,
        'alto' => isset($fila['alto']) && $fila['alto'] !== null ? (int) $fila['alto'] : null,
        'variantes' => decodificarVariantes($fila['variantes'] ?? null),
        'creado_en' => aIso(isset($fila['creado_en']) ? (string) $fila['creado_en'] : null),
    ];
}

/** Abre una imagen con GD, o null si no se puede. */
function abrirImagenGd(string $ruta, string $mime)
{
    $tipo = match ($mime) {
        'image/jpeg' => IMAGETYPE_JPEG,
        'image/png' => IMAGETYPE_PNG,
        'image/webp' => IMAGETYPE_WEBP,
        'image/gif' => IMAGETYPE_GIF,
        default => null,
    };
    if ($tipo === null) {
        return null;
    }
    $src = match ($tipo) {
        IMAGETYPE_JPEG => @imagecreatefromjpeg($ruta),
        IMAGETYPE_PNG => @imagecreatefrompng($ruta),
        IMAGETYPE_WEBP => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($ruta) : false,
        IMAGETYPE_GIF => @imagecreatefromgif($ruta),
        default => false,
    };
    return $src === false ? null : $src;
}

/** Redimensiona (manteniendo proporción) y guarda una imagen. */
function redimensionarImagenGd($src, int $srcW, int $srcH, int $max, string $ruta, bool $webp): void
{
    $nuevoW = $srcW;
    $nuevoH = $srcH;
    if ($srcW > $max || $srcH > $max) {
        if ($srcW >= $srcH) {
            $nuevoW = $max;
            $nuevoH = (int) round($srcH * ($max / $srcW));
        } else {
            $nuevoH = $max;
            $nuevoW = (int) round($srcW * ($max / $srcH));
        }
    }
    $dst = imagecreatetruecolor($nuevoW, $nuevoH);
    imagealphablending($dst, false);
    imagesavealpha($dst, true);
    $transparente = imagecolorallocatealpha($dst, 0, 0, 0, 127);
    imagefilledrectangle($dst, 0, 0, $nuevoW, $nuevoH, $transparente);
    imagecopyresampled($dst, $src, 0, 0, 0, 0, $nuevoW, $nuevoH, $srcW, $srcH);
    if ($webp) {
        imagewebp($dst, $ruta, 82);
    } else {
        imagejpeg($dst, $ruta, 82);
    }
    imagedestroy($dst);
}

/**
 * Procesa una imagen subida: genera la versión principal (máx. 1920 px) y una
 * variante de 960 px si la imagen es mayor, en WebP si GD lo permite y si no en
 * JPEG. Devuelve el resultado de disco de la principal y de la variante.
 */
function procesarImagenSubida(string $tmp, string $mime, string $id, string $raiz, string $carpeta): array
{
    $src = abrirImagenGd($tmp, $mime);
    if ($src === null) {
        // Sin GD o sin poder leer: se guarda el binario tal cual, sin variantes.
        $ext = extensionParaMime($mime);
        $nombreGuardado = $carpeta . '/' . $id . '.' . $ext;
        copy($tmp, $raiz . '/' . $nombreGuardado);
        asegurarPermisosAlmacen($raiz . '/' . $nombreGuardado);
        $info = @getimagesize($raiz . '/' . $nombreGuardado);
        return [
            'nombre_guardado' => $nombreGuardado,
            'mime' => $mime,
            'tamano' => (int) (filesize($raiz . '/' . $nombreGuardado) ?: 0),
            'ancho' => is_array($info) ? (int) $info[0] : null,
            'alto' => is_array($info) ? (int) $info[1] : null,
            'variante' => null,
        ];
    }

    $srcW = imagesx($src);
    $srcH = imagesy($src);
    $webp = soportaWebp();
    $ext = $webp ? 'webp' : 'jpg';
    $mimeSalida = $webp ? 'image/webp' : 'image/jpeg';

    $nombreGuardado = $carpeta . '/' . $id . '.' . $ext;
    redimensionarImagenGd($src, $srcW, $srcH, 1920, $raiz . '/' . $nombreGuardado, $webp);
    asegurarPermisosAlmacen($raiz . '/' . $nombreGuardado);
    $mainInfo = @getimagesize($raiz . '/' . $nombreGuardado);
    $ancho = is_array($mainInfo) ? (int) $mainInfo[0] : min(1920, $srcW);
    $alto = is_array($mainInfo) ? (int) $mainInfo[1] : min(1920, $srcH);
    $tamano = (int) (filesize($raiz . '/' . $nombreGuardado) ?: 0);

    $variante = null;
    if ($srcW > 960 || $srcH > 960) {
        $varNombre = $carpeta . '/' . $id . '-960.' . $ext;
        redimensionarImagenGd($src, $srcW, $srcH, 960, $raiz . '/' . $varNombre, $webp);
        asegurarPermisosAlmacen($raiz . '/' . $varNombre);
        $varInfo = @getimagesize($raiz . '/' . $varNombre);
        $variante = [
            'nombre_guardado' => $varNombre,
            'mime' => $mimeSalida,
            'tamano' => (int) (filesize($raiz . '/' . $varNombre) ?: 0),
            'ancho' => is_array($varInfo) ? (int) $varInfo[0] : 960,
            'alto' => is_array($varInfo) ? (int) $varInfo[1] : null,
            'sha256' => hash('sha256', (string) file_get_contents($raiz . '/' . $varNombre)),
        ];
    }
    imagedestroy($src);

    return [
        'nombre_guardado' => $nombreGuardado,
        'mime' => $mimeSalida,
        'tamano' => $tamano,
        'ancho' => $ancho,
        'alto' => $alto,
        'variante' => $variante,
    ];
}

/** Extrae el id de un medio desde su URL pública (p. ej. /api/medios/5). */
function idDesdeUrlMedio(string $url): int
{
    if (preg_match('~/medios/(\d+)(?:[/?#]|$)~', $url, $m) === 1) {
        return (int) $m[1];
    }
    solicitudInvalida('La URL del medio no es válida.', ['campo' => 'url']);
}

/**
 * Sube un medio: verifica la firma real, el tamaño, la ruta del almacén y la
 * deduplicación por sha256; procesa imágenes y guarda el binario fuera del
 * directorio público. Exige sesión.
 */
function guardarMedio(array $archivo, ?int $usuarioId): array
{
    $usuario = exigirSesion();
    $usuarioId = $usuarioId ?? (int) $usuario['id'];

    verificarAlmacenFueraDePublico();

    $tmp = (string) ($archivo['tmp_name'] ?? '');
    $nombreOriginal = basename((string) ($archivo['name'] ?? ''));
    $error = (int) ($archivo['error'] ?? UPLOAD_ERR_OK);

    if ($tmp === '' || !is_file($tmp) || !is_readable($tmp)) {
        solicitudInvalida('No se recibió ningún archivo en el campo "file".');
    }
    if ($error !== UPLOAD_ERR_OK) {
        solicitudInvalida('No se pudo subir el archivo.');
    }

    $mime = detectarMimeArchivo($tmp);
    if ($mime === null || !firmaDeArchivo($tmp, $mime)) {
        tipoNoSoportado('El contenido del archivo no corresponde a un tipo permitido (PDF, JPEG, PNG o WebP).');
    }

    $tamano = (int) (filesize($tmp) ?: 0);
    $max = esImagenMime($mime) ? 8 * 1024 * 1024 : 20 * 1024 * 1024;
    if ($tamano > $max) {
        demasiadoGrande('El archivo supera el máximo de ' . round($max / 1048576) . ' MB para este tipo.');
    }

    $sha256 = hash('sha256', (string) file_get_contents($tmp));

    // Deduplicación (en esta versión solo hay archivos públicos).
    $existente = medioPorSha256Bd($sha256, true);
    if ($existente !== null) {
        registrarAuditoria('subir_medio', 'medios', (string) $existente['id'], [
            'deduplicado' => true,
            'nombre_original' => $nombreOriginal,
        ]);
        return respuestaMedioDesdeFila($existente);
    }

    $raiz = rutaAlmacen();
    $ahora = new DateTimeImmutable('now', new DateTimeZone('UTC'));
    $carpeta = $ahora->format('Y') . '/' . $ahora->format('m');
    $dirCarpeta = $raiz . '/' . $carpeta;
    if (!is_dir($dirCarpeta)) {
        @mkdir($dirCarpeta, 0700, true);
    }

    $id = bin2hex(random_bytes(8));

    if (esImagenMime($mime) && gdDisponible()) {
        $resultado = procesarImagenSubida($tmp, $mime, $id, $raiz, $carpeta);
    } else {
        $ext = extensionParaMime($mime);
        $nombreGuardado = $carpeta . '/' . $id . '.' . $ext;
        $destino = $raiz . '/' . $nombreGuardado;
        if (!copy($tmp, $destino)) {
            error_app('No se pudo guardar el archivo.', 500);
        }
        asegurarPermisosAlmacen($destino);
        $info = esImagenMime($mime) ? @getimagesize($destino) : false;
        $resultado = [
            'nombre_guardado' => $nombreGuardado,
            'mime' => $mime,
            'tamano' => (int) (filesize($destino) ?: 0),
            'ancho' => is_array($info) ? (int) $info[0] : null,
            'alto' => is_array($info) ? (int) $info[1] : null,
            'variante' => null,
        ];
    }

    $medioId = enTransaccion(static function () use ($resultado, $nombreOriginal, $sha256): int {
        $pid = insertarMedioBd([
            'nombre_original' => $nombreOriginal,
            'nombre_guardado' => $resultado['nombre_guardado'],
            'url' => '',
            'mime' => $resultado['mime'],
            'tamano' => $resultado['tamano'],
            'ancho' => $resultado['ancho'],
            'alto' => $resultado['alto'],
            'variantes' => null,
            'padre_id' => null,
            'tipo' => 'subida',
            'original_guardado' => null,
            'sha256' => $sha256,
            'publico' => 1,
        ]);
        fijarUrlMedioBd($pid, urlMedio($pid));

        if ($resultado['variante'] !== null) {
            $variante = $resultado['variante'];
            $vid = insertarMedioBd([
                'nombre_original' => $nombreOriginal,
                'nombre_guardado' => $variante['nombre_guardado'],
                'url' => '',
                'mime' => $variante['mime'],
                'tamano' => $variante['tamano'],
                'ancho' => $variante['ancho'],
                'alto' => $variante['alto'],
                'variantes' => null,
                'padre_id' => $pid,
                'tipo' => 'variante',
                'original_guardado' => null,
                'sha256' => $variante['sha256'],
                'publico' => 1,
            ]);
            fijarUrlMedioBd($vid, urlMedio($vid));
            actualizarVariantesMedioBd(
                $pid,
                json_encode(
                    [['ancho' => $variante['ancho'], 'url' => urlMedio($vid)]],
                    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
                )
            );
        }
        return $pid;
    });

    registrarAuditoria('subir_medio', 'medios', (string) $medioId, [
        'nombre_original' => $nombreOriginal,
        'mime' => $mime,
        'tamano' => $tamano,
    ]);

    $fila = medioPorIdBd($medioId);
    return respuestaMedioDesdeFila($fila ?? []);
}

/**
 * Fila completa de un medio por id, o null.
 */
function medioPorId(int $id): ?array
{
    return medioPorIdBd($id);
}

/**
 * Listado de medios (biblioteca del panel). Exige sesión.
 */
function listarMedios(): array
{
    exigirSesion();
    $items = array_map(
        static fn (array $fila): array => respuestaMedioDesdeFila($fila),
        mediosTodosBd()
    );
    return ['items' => $items];
}

/**
 * Elimina un medio, sus variantes y su historial, junto con los binarios en
 * disco. Exige sesión.
 */
function eliminarMedio(int $id): void
{
    exigirSesion();

    $medio = medioPorIdBd($id);
    if ($medio === null) {
        noEncontrado('Archivo no encontrado.');
    }

    $raiz = rutaAlmacen();

    foreach (mediosHijasBd($id) as $hija) {
        $ruta = $raiz . '/' . (string) $hija['nombre_guardado'];
        if (is_file($ruta)) {
            @unlink($ruta);
        }
        eliminarMedioBd((int) $hija['id']);
    }

    foreach (versionesDeMedioBd($id) as $version) {
        $ruta = $raiz . '/' . (string) $version['nombre_guardado'];
        if (is_file($ruta)) {
            @unlink($ruta);
        }
    }
    eliminarVersionesMedioBd($id);

    $principal = $raiz . '/' . (string) $medio['nombre_guardado'];
    if (is_file($principal)) {
        @unlink($principal);
    }
    if (!empty($medio['original_guardado'])) {
        $original = $raiz . '/' . (string) $medio['original_guardado'];
        if (is_file($original)) {
            @unlink($original);
        }
    }
    eliminarMedioBd($id);

    registrarAuditoria('eliminar_medio', 'medios', (string) $id, [
        'nombre_original' => (string) $medio['nombre_original'],
    ]);
}

/**
 * Recorta una imagen y guarda el resultado como una versión nueva (motivo
 * 'recorte'), sin sobrescribir el original. Devuelve la URL nueva.
 */
function recortarMedio(string $url, array $recorte): array
{
    exigirSesion();
    verificarAlmacenFueraDePublico();

    $fallo = validar($recorte, esquemasMedios()['recorte']);
    if ($fallo !== []) {
        solicitudInvalida($fallo['mensaje'], $fallo);
    }

    $medioId = idDesdeUrlMedio($url);
    $medio = medioPorIdBd($medioId);
    if ($medio === null) {
        noEncontrado('Archivo no encontrado.');
    }
    if (!esImagenMime((string) $medio['mime'])) {
        solicitudInvalida('Solo se pueden recortar imágenes.');
    }
    if (!gdDisponible()) {
        error_app('El servidor no tiene la extensión GD para recortar imágenes.', 500);
    }

    $x = (int) $recorte['x'];
    $y = (int) $recorte['y'];
    $w = (int) $recorte['w'];
    $h = (int) $recorte['h'];
    if ($w < 8 || $h < 8) {
        solicitudInvalida('El recorte es demasiado pequeño.');
    }

    $srcPath = rutaAlmacen() . '/' . (string) $medio['nombre_guardado'];
    if (!is_file($srcPath)) {
        noEncontrado('El archivo ya no está disponible.');
    }

    $src = abrirImagenGd($srcPath, (string) $medio['mime']);
    if ($src === null) {
        error_app('No se pudo leer la imagen para recortar.', 400);
    }
    $srcW = imagesx($src);
    $srcH = imagesy($src);
    $x = max(0, min($x, $srcW - 1));
    $y = max(0, min($y, $srcH - 1));
    $w = max(8, min($w, $srcW - $x));
    $h = max(8, min($h, $srcH - $y));
    $crop = imagecrop($src, ['x' => $x, 'y' => $y, 'width' => $w, 'height' => $h]);
    imagedestroy($src);
    if ($crop === false) {
        error_app('No se pudo recortar la imagen.', 400);
    }

    $webp = soportaWebp();
    $ext = $webp ? 'webp' : 'jpg';
    $mimeSalida = $webp ? 'image/webp' : 'image/jpeg';
    $nuevoId = bin2hex(random_bytes(8));
    $ahora = new DateTimeImmutable('now', new DateTimeZone('UTC'));
    $carpeta = $ahora->format('Y') . '/' . $ahora->format('m');
    $nombreGuardado = $carpeta . '/' . $nuevoId . '.' . $ext;
    $destino = rutaAlmacen() . '/' . $nombreGuardado;
    $dir = dirname($destino);
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }
    if ($webp) {
        imagewebp($crop, $destino, 82);
    } else {
        imagejpeg($crop, $destino, 82);
    }
    $ancho = imagesx($crop);
    $alto = imagesy($crop);
    imagedestroy($crop);
    asegurarPermisosAlmacen($destino);

    $tamano = (int) (filesize($destino) ?: 0);
    $sha256 = hash('sha256', (string) file_get_contents($destino));

    $nuevoMedioId = enTransaccion(static function () use (
        $medioId,
        $nombreGuardado,
        $mimeSalida,
        $tamano,
        $ancho,
        $alto,
        $sha256,
        $medio
    ): int {
        $nid = insertarMedioBd([
            'nombre_original' => (string) $medio['nombre_original'],
            'nombre_guardado' => $nombreGuardado,
            'url' => '',
            'mime' => $mimeSalida,
            'tamano' => $tamano,
            'ancho' => $ancho,
            'alto' => $alto,
            'variantes' => null,
            'padre_id' => $medioId,
            'tipo' => 'recorte',
            'original_guardado' => null,
            'sha256' => $sha256,
            'publico' => 1,
        ]);
        fijarUrlMedioBd($nid, urlMedio($nid));
        insertarVersionMedioBd($medioId, $nombreGuardado, urlMedio($nid), $mimeSalida, $tamano, $ancho, $alto, 'recorte');
        return $nid;
    });

    registrarAuditoria('recortar_medio', 'medios', (string) $medioId, ['nuevo_id' => $nuevoMedioId]);

    return ['url' => urlMedio($nuevoMedioId), 'ancho' => $ancho, 'alto' => $alto, 'id' => $nuevoMedioId];
}

/**
 * Historial de versiones (recortes) de un medio.
 */
function versionesDeMedio(int $id): array
{
    exigirSesion();

    if (medioPorIdBd($id) === null) {
        noEncontrado('Archivo no encontrado.');
    }
    $items = array_map(static function (array $fila): array {
        return [
            'id' => (int) $fila['id'],
            'url' => (string) $fila['url'],
            'mime' => (string) $fila['mime'],
            'tamano' => (int) $fila['tamano'],
            'ancho' => isset($fila['ancho']) && $fila['ancho'] !== null ? (int) $fila['ancho'] : null,
            'alto' => isset($fila['alto']) && $fila['alto'] !== null ? (int) $fila['alto'] : null,
            'motivo' => (string) $fila['motivo'],
            'creado_en' => aIso(isset($fila['creado_en']) ? (string) $fila['creado_en'] : null),
        ];
    }, versionesDeMedioBd($id));
    return ['items' => $items];
}

/**
 * Restaura una versión de un medio: copia el binario de la versión elegida
 * como archivo actual y archiva el actual. Sin `versionId`, restaura al
 * original si está guardado; si no, devuelve el estado actual.
 */
function restaurarVersionMedio(int $id, ?int $versionId): array
{
    exigirSesion();

    $medio = medioPorIdBd($id);
    if ($medio === null) {
        noEncontrado('Archivo no encontrado.');
    }

    $version = null;
    if ($versionId !== null) {
        $version = versionMedioPorIdBd($id, $versionId);
        if ($version === null) {
            noEncontrado('Versión no encontrada.');
        }
    }

    $raiz = rutaAlmacen();
    $origen = null;
    if ($version !== null) {
        $origen = $raiz . '/' . (string) $version['nombre_guardado'];
    } elseif (!empty($medio['original_guardado'])) {
        $origen = $raiz . '/' . (string) $medio['original_guardado'];
    }

    if ($origen === null || !is_file($origen)) {
        // No hay nada que restaurar: se devuelve el estado actual.
        return ['url' => (string) $medio['url'], 'id' => $id];
    }

    $nuevoId = bin2hex(random_bytes(8));
    $carpeta = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y/m');
    $ext = pathinfo($origen, PATHINFO_EXTENSION) ?: 'bin';
    $nombreGuardado = $carpeta . '/' . $nuevoId . '.' . $ext;
    $destino = $raiz . '/' . $nombreGuardado;
    $dir = dirname($destino);
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }
    copy($origen, $destino);
    asegurarPermisosAlmacen($destino);

    $mime = $version !== null ? (string) $version['mime'] : (string) $medio['mime'];
    $tamano = (int) (filesize($destino) ?: 0);
    $ancho = $version !== null ? (isset($version['ancho']) && $version['ancho'] !== null ? (int) $version['ancho'] : null) : null;
    $alto = $version !== null ? (isset($version['alto']) && $version['alto'] !== null ? (int) $version['alto'] : null) : null;

    enTransaccion(static function () use ($id, $medio, $nombreGuardado, $mime, $tamano, $ancho, $alto): void {
        insertarVersionMedioBd(
            $id,
            (string) $medio['nombre_guardado'],
            (string) $medio['url'],
            (string) $medio['mime'],
            (int) $medio['tamano'],
            isset($medio['ancho']) && $medio['ancho'] !== null ? (int) $medio['ancho'] : null,
            isset($medio['alto']) && $medio['alto'] !== null ? (int) $medio['alto'] : null,
            'restauracion'
        );
        actualizarArchivoMedioBd($id, $nombreGuardado, $mime, $tamano, $ancho, $alto);
    });

    registrarAuditoria('restaurar_medio', 'medios', (string) $id, ['version_id' => $versionId]);

    return ['url' => (string) $medio['url'], 'id' => $id];
}

<?php
declare(strict_types=1);

/**
 * Pruebas de medios, identidad y apariencia: firma real, permisos del almacén,
 * deduplicación por sha256, recorte, variante WebP optimizada, tokens de
 * identidad y contraste de color. Requieren base de datos; se omiten si la
 * conexión no está disponible.
 *
 * No dejan rastro en la base de desarrollo: cada subida de prueba lleva el
 * prefijo `prueba-` y sus filas (medios, variantes, versiones y usuario) se
 * borran al terminar la suite; la identidad y la apariencia se restauran al
 * valor que tenían en un snapshot tomado al cargar este archivo.
 */

require_once __DIR__ . '/../src/nucleo/sesion.php';
require_once __DIR__ . '/../src/nucleo/archivos.php';
require_once __DIR__ . '/../src/nucleo/auditoria.php';
require_once __DIR__ . '/../src/nucleo/documento.php';
require_once __DIR__ . '/../src/modulos/medios/servicio.php';
require_once __DIR__ . '/../src/modulos/identidad/servicio.php';

/** Prefijo del nombre original de TODA subida de prueba. */
const PREFIJO_SUBIDA_PRUEBA = 'prueba-';

/**
 * Almacén temporal FUERA de la raíz pública para las pruebas. Los binarios que
 * se suban viven aquí y se eliminan al terminar (nunca en el almacén real).
 */
$GLOBALS['__almacen_pruebas'] = rtrim(sys_get_temp_dir(), '/') . '/plibre-almacen-' . bin2hex(random_bytes(6));
@mkdir($GLOBALS['__almacen_pruebas'], 0700, true);
$_ENV['ALMACEN_DIR'] = $GLOBALS['__almacen_pruebas'];
putenv('ALMACEN_DIR=' . $GLOBALS['__almacen_pruebas']);

// Snapshot de los datos de desarrollo que estas pruebas sobreescriben, para
// restaurarlos al terminar. Sin base de datos, las pruebas que la necesiten
// se omiten.
$GLOBALS['__institucion_snapshot'] = null;
$GLOBALS['__apariencia_snapshot'] = null;
try {
    $GLOBALS['__institucion_snapshot'] = conexion()->query(
        'SELECT id, nombre, ruc, direccion, telefono, correo, ciudad, actualizado_en FROM institucion WHERE id = 1'
    )->fetch();
    $GLOBALS['__apariencia_snapshot'] = conexion()->query(
        "SELECT clave, locale, contenido, borrador, version, actualizado_en FROM configuracion_sitio WHERE clave = 'apariencia' AND locale = 'es'"
    )->fetch();
} catch (Throwable $e) {
    // sin base de datos.
}

// Limpieza inicial: quita solo las filas de PRUEBAS (prefijo `prueba-`) que
// pudieran quedar de una ejecución anterior, para que la deduplicación por
// sha256 no reutilice registros viejos (con binarios ya desaparecidos). Los
// datos reales de `medios` no se tocan.
try {
    limpiarMediosDePrueba();
} catch (Throwable $e) {
    // sin base de datos.
}

/**
 * Borra las filas de medios dejadas por pruebas (marcadas con el prefijo
 * `prueba-`): versiones referenciadas y medios, variantes incluidas (las filas
 * hijas llevan el mismo `nombre_original` que el padre). Los datos reales de
 * `medios` no se tocan.
 */
function limpiarMediosDePrueba(): void
{
    $pdo = conexion();
    $pdo->prepare(
        'DELETE v FROM versiones_medio v INNER JOIN medios m ON v.medio_id = m.id WHERE m.nombre_original LIKE ?'
    )->execute([PREFIJO_SUBIDA_PRUEBA . '%']);
    $pdo->prepare('DELETE FROM medios WHERE nombre_original LIKE ?')->execute([PREFIJO_SUBIDA_PRUEBA . '%']);
}

/**
 * Limpieza final de la suite: borra lo creado por estas pruebas y restaura el
 * snapshot de identidad/apariencia. Se ejecuta al terminar TODO el corredor
 * (incluidas las suites posteriores), no solo este archivo.
 */
function terminarPruebasDeMedios(): void
{
    try {
        $pdo = conexion();
        $inst = $GLOBALS['__institucion_snapshot'] ?? null;
        $pdo->prepare('DELETE FROM institucion WHERE id = 1')->execute();
        if (is_array($inst)) {
            $pdo->prepare(
                'INSERT INTO institucion (id, nombre, ruc, direccion, telefono, correo, ciudad, actualizado_en)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            )->execute([
                $inst['id'], $inst['nombre'], $inst['ruc'], $inst['direccion'],
                $inst['telefono'], $inst['correo'], $inst['ciudad'], $inst['actualizado_en'],
            ]);
        }
        $apa = $GLOBALS['__apariencia_snapshot'] ?? null;
        $pdo->prepare("DELETE FROM configuracion_sitio WHERE clave = 'apariencia' AND locale = 'es'")->execute();
        if (is_array($apa)) {
            $pdo->prepare(
                'INSERT INTO configuracion_sitio (clave, locale, contenido, borrador, version, actualizado_en)
                 VALUES (?, ?, ?, ?, ?, ?)'
            )->execute([$apa['clave'], $apa['locale'], $apa['contenido'], $apa['borrador'], $apa['version'], $apa['actualizado_en']]);
        }
        limpiarMediosDePrueba();
        $pdo->prepare("DELETE FROM usuarios WHERE usuario = 'adminmedios'")->execute();
    } catch (Throwable $e) {
        // Sin base de datos o error transitorio: la limpieza es lo mejor posible.
    }
    // Borra el almacén temporal de esta ejecución (best effort).
    $almacen = (string) ($GLOBALS['__almacen_pruebas'] ?? '');
    if ($almacen !== '' && is_dir($almacen)) {
        $archivos = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($almacen, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($archivos as $item) {
            $item->isDir() ? @rmdir($item->getPathname()) : @unlink($item->getPathname());
        }
        @rmdir($almacen);
    }
}

register_shutdown_function('terminarPruebasDeMedios');

/**
 * Crea (o recrea) un usuario administrador de pruebas y devuelve su id.
 * Se elimina en la limpieza final.
 */
function usuarioAdminMedios(): int
{
    $pdo = conexion();
    $pdo->prepare("DELETE FROM usuarios WHERE usuario = 'adminmedios'")->execute();
    $stmt = $pdo->prepare(
        "INSERT INTO usuarios (usuario, hash_contrasena, rol, activo) VALUES (?, ?, 'admin', 1)"
    );
    $stmt->execute(['adminmedios', password_hash('ClavePrueba123', PASSWORD_DEFAULT)]);
    return (int) $pdo->lastInsertId();
}

/**
 * Deja la identidad en un estado conocido (todos los campos, vacíos por defecto).
 */
function fijarIdentidadPrueba(array $datos): void
{
    $admin = usuarioAdminMedios();
    fijarSesionDePrueba($admin);
    guardarIdentidad(array_merge([
        'nombre' => '', 'ruc' => '', 'direccion' => '', 'telefono' => '', 'correo' => '', 'ciudad' => '',
    ], $datos));
}

/**
 * Archivo PDF real (con la firma %PDF) para las pruebas. El nombre original
 * lleva el prefijo de prueba para que la limpieza final lo encuentre.
 */
function archivoPdfValido(string $marca = ''): array
{
    $tmp = tempnam(sys_get_temp_dir(), 'pdf-');
    file_put_contents($tmp, "%PDF-1.4\n1 0 obj\n<< /Marca (" . $marca . ") >>\nendobj\ntrailer\n<<>>\n%%EOF\n");
    return [
        'tmp_name' => $tmp, 'name' => PREFIJO_SUBIDA_PRUEBA . $marca . '.pdf',
        'type' => 'application/pdf', 'error' => 0, 'size' => filesize($tmp),
    ];
}

/**
 * Archivo .pdf que en realidad es texto plano (firma incorrecta). Lleva el
 * prefijo aunque nunca llegue a guardarse; el nombre no puede causar colisión.
 */
function archivoPdfFalso(): array
{
    $tmp = tempnam(sys_get_temp_dir(), 'falso-');
    file_put_contents($tmp, "esto es texto plano, no un PDF de verdad");
    return [
        'tmp_name' => $tmp, 'name' => PREFIJO_SUBIDA_PRUEBA . 'falso.pdf',
        'type' => 'application/pdf', 'error' => 0, 'size' => filesize($tmp),
    ];
}

/**
 * Imagen PNG real de `$ancho`x`$alto` píxeles para las pruebas, con nombre
 * prefijado y binario firmado.
 */
function imagenPngPrueba(int $ancho, int $alto, string $nombre = ''): array
{
    $tmp = sys_get_temp_dir() . '/plibre-img-' . bin2hex(random_bytes(6)) . '.png';
    $img = imagecreatetruecolor($ancho, $alto);
    $fondo = imagecolorallocate($img, 200, 30, 30);
    $detalle = imagecolorallocate($img, 30, 60, 160);
    imagefilledrectangle($img, 0, 0, $ancho, $alto, $fondo);
    $cx1 = max(0, (int) ($ancho / 2 - 20));
    $cy1 = max(0, (int) ($alto / 2 - 20));
    $cx2 = min($ancho - 1, (int) ($ancho / 2 + 20));
    $cy2 = min($alto - 1, (int) ($alto / 2 + 20));
    imagefilledrectangle($img, $cx1, $cy1, $cx2, $cy2, $detalle);
    imagepng($img, $tmp);
    imagedestroy($img);
    return [
        'tmp_name' => $tmp,
        'name' => $nombre !== '' ? $nombre : PREFIJO_SUBIDA_PRUEBA . 'imagen.png',
        'type' => 'image/png', 'error' => 0, 'size' => filesize($tmp),
    ];
}

probar('un archivo con firma incorrecta se rechaza', function () {
    $admin = usuarioAdminMedios();
    fijarSesionDePrueba($admin);
    intentar(function () use ($admin) {
        guardarMedio(archivoPdfFalso(), $admin);
    });
    afirmar(error_ultimo_codigo() === 415, 'debe responder 415');
});

probar('un PDF valido se acepta', function () {
    $admin = usuarioAdminMedios();
    fijarSesionDePrueba($admin);
    $r = guardarMedio(archivoPdfValido('aceptado'), $admin);
    afirmar(($r['id'] ?? 0) > 0, 'debe devolver un id');
    afirmar(($r['mime'] ?? '') === 'application/pdf', 'el mime debe ser application/pdf');
    afirmar(($r['url'] ?? '') !== '', 'debe devolver una url');
});

probar('el directorio de archivos queda con permisos 700', function () {
    $admin = usuarioAdminMedios();
    fijarSesionDePrueba($admin);
    guardarMedio(archivoPdfValido('directorio'), $admin);
    $modo = (int) fileperms(rutaAlmacen());
    afirmar(substr(sprintf('%o', $modo), -3) === '700', 'el directorio debe ser 700');
});

probar('el archivo guardado tiene permisos 600', function () {
    $admin = usuarioAdminMedios();
    fijarSesionDePrueba($admin);
    $r = guardarMedio(archivoPdfValido('permisos'), $admin);
    $medio = medioPorId((int) $r['id']);
    $ruta = rutaAlmacen() . '/' . (string) $medio['nombre_guardado'];
    afirmar(is_file($ruta), 'el archivo debe existir');
    $modo = (int) fileperms($ruta);
    afirmar(substr(sprintf('%o', $modo), -3) === '600', 'el archivo debe ser 600');
});

probar('el mismo archivo no se guarda dos veces', function () {
    $admin = usuarioAdminMedios();
    fijarSesionDePrueba($admin);
    $a = guardarMedio(archivoPdfValido('dedup'), $admin);
    $b = guardarMedio(archivoPdfValido('dedup'), $admin);
    afirmar(($a['id'] ?? 0) === ($b['id'] ?? 0), 'debe reutilizar el mismo registro');
});

probar('la subida de una imagen conserva el original y registra la variante webp optimizada', function () {
    if (!function_exists('imagewebp')) {
        // Si GD no genera WebP, la variante optimizada se omite sin error y
        // esta prueba se marca como pasada con un aviso claro.
        echo "\nAVISO — imagewebp no está disponible: la variante WebP optimizada no se prueba y la prueba se marca como pasada.\n";
        return;
    }
    $archivo = ['tmp_name' => ''];
    try {
        $admin = usuarioAdminMedios();
        fijarSesionDePrueba($admin);
        $archivo = imagenPngPrueba(1200, 800);
        $subido = guardarMedio($archivo, $admin);
        $principal = medioPorId((int) $subido['id']);
        afirmar($principal !== null, 'el medio principal debe existir');

        // El original se conserva: la versión principal lleva el PNG tal cual.
        $rutaPrincipal = rutaAlmacen() . '/' . (string) $principal['nombre_guardado'];
        afirmar(is_file($rutaPrincipal), 'el original debe conservarse en el almacén');
        afirmar(
            substr((string) file_get_contents($rutaPrincipal, false, null, 0, 4), 0, 4) === "\x89PNG",
            'el binario principal debe seguir siendo el PNG original'
        );
        afirmar((string) $principal['mime'] === 'image/png', 'el mime principal debe ser el del original');

        // Y debe existir una variante optimizada registrada cuyo binario tiene
        // la firma RIFF….WEBP.
        $varianteWebp = null;
        foreach (mediosHijasBd((int) $principal['id']) as $hija) {
            $ruta = rutaAlmacen() . '/' . (string) $hija['nombre_guardado'];
            if (!is_file($ruta)) {
                continue;
            }
            $cabecera = (string) file_get_contents($ruta, false, null, 0, 12);
            if (substr($cabecera, 0, 4) === 'RIFF' && substr($cabecera, 8, 4) === 'WEBP') {
                $varianteWebp = $hija;
                break;
            }
        }
        afirmar($varianteWebp !== null, 'debe existir una variante registrada con binario RIFF….WEBP');
        afirmar((string) ($varianteWebp['mime'] ?? '') === 'image/webp', 'la variante optimizada debe declararse image/webp');
        $registradas = decodificarVariantes($principal['variantes'] ?? null);
        afirmar(count($registradas) >= 1, 'la variante debe quedar en el JSON `variantes` de la principal');
        $urls = array_column($registradas, 'url');
        afirmar(in_array($varianteWebp['url'], $urls, true), 'la url de la variante WebP debe estar registrada');
    } finally {
        @unlink($archivo['tmp_name']);
    }
});

probar('el almacen no puede vivir en el directorio publico', function () {
    $admin = usuarioAdminMedios();
    fijarSesionDePrueba($admin);
    $_ENV['ALMACEN_DIR'] = rutaPublicaRaiz() . '/almacen-publico-test';
    putenv('ALMACEN_DIR=' . $_ENV['ALMACEN_DIR']);
    try {
        intentar(function () use ($admin) {
            guardarMedio(archivoPdfValido('publico'), $admin);
        });
        afirmar(error_ultimo_codigo() === 500, 'debe rechazar con 500');
    } finally {
        $_ENV['ALMACEN_DIR'] = $GLOBALS['__almacen_pruebas'];
        putenv('ALMACEN_DIR=' . $GLOBALS['__almacen_pruebas']);
    }
});

probar('los tokens de identidad se reemplazan', function () {
    fijarIdentidadPrueba(['nombre' => 'Universidad Ejemplo', 'ciudad' => 'Lima']);
    $salida = resolverTokens('Bienvenido a {{institucion.nombre}} en {{institucion.ciudad}}');
    afirmar(str_contains($salida, 'Universidad Ejemplo'), 'debe sustituir el nombre');
    afirmar(str_contains($salida, 'Lima'), 'debe sustituir la ciudad');
    afirmar(!str_contains($salida, '{{'), 'no debe quedar ningún token');
});

probar('un token sin valor se deja intacto', function () {
    fijarIdentidadPrueba(['nombre' => 'Universidad Ejemplo']); // ruc queda vacío
    $salida = resolverTokens('RUC: {{institucion.ruc}}');
    afirmar(str_contains($salida, '{{institucion.ruc}}'), 'el token sin valor queda intacto');
});

probar('resolverTokens no lanza con contenido vacio', function () {
    afirmar(resolverTokens('') === '', 'cadena vacía devuelve cadena vacía');
    afirmar(resolverTokens('', ['nombre' => 'X']) === '', 'no lanza con identidad presente');
});

probar('el contraste insuficiente genera un aviso sin rechazar el guardado', function () {
    $admin = usuarioAdminMedios();
    fijarSesionDePrueba($admin);
    conexion()->prepare("DELETE FROM configuracion_sitio WHERE clave = 'apariencia' AND locale = 'es'")->execute();
    $r = guardarDocumento(CLAVE_APARIENCIA, 'es', [
        'color_primario' => '#ffffff',
        'color_texto' => '#ffffff',
        'color_fondo' => '#ffffff',
        'color_superficie' => '#ffffff',
    ], 1, 'prepararApariencia');
    afirmar(($r['version'] ?? 0) === 2, 'debe guardar subiendo a la versión 2');
    afirmar(isset($r['avisos']) && is_array($r['avisos']) && count($r['avisos']) >= 1, 'debe devolver avisos');
});

probar('un color con formato invalido se rechaza', function () {
    $admin = usuarioAdminMedios();
    fijarSesionDePrueba($admin);
    conexion()->prepare("DELETE FROM configuracion_sitio WHERE clave = 'apariencia' AND locale = 'es'")->execute();
    intentar(function () {
        guardarDocumento(CLAVE_APARIENCIA, 'es', ['color_primario' => '#ZZZZZZ'], 1, 'prepararApariencia');
    });
    afirmar(error_ultimo_codigo() === 400, 'debe responder 400');
});

probar('la identidad se guarda y se lee', function () {
    $admin = usuarioAdminMedios();
    fijarSesionDePrueba($admin);
    guardarIdentidad(['nombre' => 'Instituto de Pruebas', 'ciudad' => 'Arequipa']);
    $i = identidad();
    afirmar($i['nombre'] === 'Instituto de Pruebas', 'el nombre se guarda');
    afirmar($i['ciudad'] === 'Arequipa', 'la ciudad se guarda');
});

if (function_exists('imagecrop')) {
    probar('recortar una imagen devuelve una url nueva y conserva el original', function () {
        $admin = usuarioAdminMedios();
        fijarSesionDePrueba($admin);
        $archivo = imagenPngPrueba(100, 100);
        try {
            $subido = guardarMedio($archivo, $admin);
            $original = medioPorId((int) $subido['id']);
            $originalPath = rutaAlmacen() . '/' . (string) $original['nombre_guardado'];

            $recorte = recortarMedio($subido['url'], ['url' => $subido['url'], 'x' => 10, 'y' => 10, 'w' => 50, 'h' => 50]);
            afirmar(($recorte['url'] ?? '') !== $subido['url'], 'la url nueva debe diferir');
            afirmar(is_file($originalPath), 'el archivo original se conserva');
        } finally {
            @unlink($archivo['tmp_name']);
        }
    });
}

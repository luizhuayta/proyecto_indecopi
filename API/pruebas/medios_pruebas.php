<?php
declare(strict_types=1);

/**
 * Pruebas de medios, identidad y apariencia: firma real, permisos del almacén,
 * deduplicación por sha256, recorte, tokens de identidad y contraste de color.
 * Requieren base de datos; se omiten si la conexión no está disponible.
 */

require_once __DIR__ . '/../src/nucleo/sesion.php';
require_once __DIR__ . '/../src/nucleo/archivos.php';
require_once __DIR__ . '/../src/nucleo/auditoria.php';
require_once __DIR__ . '/../src/nucleo/documento.php';
require_once __DIR__ . '/../src/modulos/medios/servicio.php';
require_once __DIR__ . '/../src/modulos/identidad/servicio.php';

// Almacén temporal FUERA de la raíz pública para las pruebas.
$GLOBALS['__almacen_pruebas'] = rtrim(sys_get_temp_dir(), '/') . '/plibre-almacen-' . bin2hex(random_bytes(6));
@mkdir($GLOBALS['__almacen_pruebas'], 0700, true);
$_ENV['ALMACEN_DIR'] = $GLOBALS['__almacen_pruebas'];
putenv('ALMACEN_DIR=' . $GLOBALS['__almacen_pruebas']);

// Limpieza: cada ejecución parte de una base de medios vacía, para que la
// deduplicación por sha256 no reutilice registros de ejecuciones anteriores
// (cuyos binarios viven en un /tmp ya distinto y ya no existen).
try {
    conexion()->prepare('DELETE FROM versiones_medio')->execute();
    conexion()->prepare('DELETE FROM medios')->execute();
} catch (Throwable $e) {
    // sin base de datos: las pruebas que la necesiten se omiten.
}

/**
 * Crea (o recrea) un usuario administrador de pruebas y devuelve su id.
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
 * Archivo PDF real (con la firma %PDF) para las pruebas.
 */
function archivoPdfValido(string $marca = ''): array
{
    $tmp = tempnam(sys_get_temp_dir(), 'pdf-');
    file_put_contents($tmp, "%PDF-1.4\n1 0 obj\n<< /Marca (" . $marca . ") >>\nendobj\ntrailer\n<<>>\n%%EOF\n");
    return ['tmp_name' => $tmp, 'name' => 'prueba.pdf', 'type' => 'application/pdf', 'error' => 0, 'size' => filesize($tmp)];
}

/**
 * Archivo .pdf que en realidad es texto plano (firma incorrecta).
 */
function archivoPdfFalso(): array
{
    $tmp = tempnam(sys_get_temp_dir(), 'falso-');
    file_put_contents($tmp, "esto es texto plano, no un PDF de verdad");
    return ['tmp_name' => $tmp, 'name' => 'falso.pdf', 'type' => 'application/pdf', 'error' => 0, 'size' => filesize($tmp)];
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
        $tmp = sys_get_temp_dir() . '/plibre-img-' . bin2hex(random_bytes(6)) . '.png';
        $img = imagecreatetruecolor(100, 100);
        $rojo = imagecolorallocate($img, 200, 30, 30);
        imagefilledrectangle($img, 0, 0, 100, 100, $rojo);
        imagepng($img, $tmp);
        imagedestroy($img);

        $subido = guardarMedio(
            ['tmp_name' => $tmp, 'name' => 'prueba.png', 'type' => 'image/png', 'error' => 0, 'size' => filesize($tmp)],
            $admin
        );
        $original = medioPorId((int) $subido['id']);
        $originalPath = rutaAlmacen() . '/' . (string) $original['nombre_guardado'];

        $recorte = recortarMedio($subido['url'], ['url' => $subido['url'], 'x' => 10, 'y' => 10, 'w' => 50, 'h' => 50]);
        afirmar(($recorte['url'] ?? '') !== $subido['url'], 'la url nueva debe diferir');
        afirmar(is_file($originalPath), 'el archivo original se conserva');
        @unlink($tmp);
    });
}

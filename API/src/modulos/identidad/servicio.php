<?php
declare(strict_types=1);

/**
 * Lógica de identidad institucional y apariencia del sitio.
 *
 * - Identidad: lee y escribe la tabla `institucion` (id 1), de donde salen los
 *   tokens `{{institucion.*}}` que se sustituyen al servir el contenido público.
 * - Apariencia: colores, tipografía, logo, pie y redes, con borrador /
 *   publicación / 409 como las páginas, y verificación de contraste que avisa
 *   (sin rechazar) cuando un color no cumple 4.5:1.
 */

require_once __DIR__ . '/../../nucleo/base_datos.php';
require_once __DIR__ . '/../../nucleo/sesion.php';
require_once __DIR__ . '/../../nucleo/auditoria.php';
require_once __DIR__ . '/../../nucleo/validacion.php';
require_once __DIR__ . '/../../nucleo/fechas.php';
require_once __DIR__ . '/../../nucleo/documento.php';
require_once __DIR__ . '/../../http/errores.php';
require_once __DIR__ . '/esquemas.php';
require_once __DIR__ . '/repositorio.php';

/** Relación de contraste mínima exigida (WCAG AA para texto normal). */
const CONTRASTE_MINIMO = 4.5;

/** Campos de color de la apariencia. */
function camposColorApariencia(): array
{
    return [
        'color_primario',
        'color_primario_fuerte',
        'color_secundario',
        'color_acento',
        'color_texto',
        'color_texto_suave',
        'color_fondo',
        'color_superficie',
        'color_borde',
    ];
}

/**
 * Datos de identidad de la institución (id 1).
 */
function identidad(): array
{
    $fila = institucionPorIdBd(1);
    if ($fila === null) {
        return [
            'nombre' => '', 'ruc' => '', 'direccion' => '', 'telefono' => '',
            'correo' => '', 'ciudad' => '', 'actualizado_en' => null,
        ];
    }
    return [
        'nombre' => (string) $fila['nombre'],
        'ruc' => (string) $fila['ruc'],
        'direccion' => (string) $fila['direccion'],
        'telefono' => (string) $fila['telefono'],
        'correo' => (string) $fila['correo'],
        'ciudad' => (string) $fila['ciudad'],
        'actualizado_en' => aIso(isset($fila['actualizado_en']) ? (string) $fila['actualizado_en'] : null),
    ];
}

/**
 * Guarda la identidad de la institución. Exige rol admin. La auditoría registra
 * SOLO qué campos cambiaron, sin los valores de correo ni teléfono.
 */
function guardarIdentidad(array $datos): array
{
    exigirRol('admin');

    $fallo = validar($datos, esquemasIdentidad()['identidad']);
    if ($fallo !== []) {
        solicitudInvalida($fallo['mensaje'], $fallo);
    }

    $actual = institucionPorIdBd(1);
    $campos = ['nombre', 'ruc', 'direccion', 'telefono', 'correo', 'ciudad'];
    $nuevos = [];
    foreach ($campos as $campo) {
        $nuevos[$campo] = array_key_exists($campo, $datos)
            ? trim((string) ($datos[$campo] ?? ''))
            : ($actual !== null ? (string) ($actual[$campo] ?? '') : '');
    }

    if ($nuevos['correo'] !== '' && filter_var($nuevos['correo'], FILTER_VALIDATE_EMAIL) === false) {
        solicitudInvalida('El correo no es válido.', ['campo' => 'correo']);
    }

    $cambiados = [];
    foreach ($campos as $campo) {
        $antes = $actual !== null ? (string) ($actual[$campo] ?? '') : '';
        if ($nuevos[$campo] !== $antes) {
            $cambiados[] = $campo;
        }
    }

    enTransaccion(static function () use ($nuevos): void {
        if (institucionPorIdBd(1) === null) {
            insertarInstitucionBd(1, $nuevos);
        } else {
            actualizarInstitucionBd(1, $nuevos);
        }
    });

    registrarAuditoria('guardar_identidad', 'institucion', '1', ['campos_cambiados' => $cambiados]);

    return identidad();
}

/**
 * Sustituye los tokens `{{institucion.*}}` por los valores guardados. Si un
 * token no tiene valor, se deja el texto del token intacto.
 */
function resolverTokens(string $texto, ?array $identidad = null): string
{
    if ($identidad === null) {
        $identidad = identidad();
    }
    $tokens = ['nombre', 'ruc', 'direccion', 'telefono', 'correo', 'ciudad'];
    foreach ($tokens as $token) {
        $valor = (string) ($identidad[$token] ?? '');
        if ($valor === '') {
            continue;
        }
        $texto = str_replace('{{institucion.' . $token . '}}', $valor, $texto);
    }
    return $texto;
}

/** Normaliza un color #RGB/#RRGGBB a [r, g, b] enteros 0-255, o null. */
function colorARgb(string $color): ?array
{
    $color = strtolower(trim($color));
    if (preg_match('/^#([0-9a-f]{3})$/', $color, $m) === 1) {
        $r = hexdec($m[1][0] . $m[1][0]);
        $g = hexdec($m[1][1] . $m[1][1]);
        $b = hexdec($m[1][2] . $m[1][2]);
        return [$r, $g, $b];
    }
    if (preg_match('/^#([0-9a-f]{6})$/', $color, $m) === 1) {
        return [hexdec(substr($m[1], 0, 2)), hexdec(substr($m[1], 2, 2)), hexdec(substr($m[1], 4, 2))];
    }
    return null;
}

/** Luminancia relativa WCAG de un color. */
function luminanciaRelativa(string $color): float
{
    $rgb = colorARgb($color);
    if ($rgb === null) {
        return 0.0;
    }
    $canales = [];
    foreach ($rgb as $canal) {
        $c = $canal / 255.0;
        $canales[] = $c <= 0.03928 ? $c / 12.92 : pow(($c + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * $canales[0] + 0.7152 * $canales[1] + 0.0722 * $canales[2];
}

/** Relación de contraste WCAG entre dos colores. */
function relacionContraste(string $color1, string $color2): float
{
    $l1 = luminanciaRelativa($color1);
    $l2 = luminanciaRelativa($color2);
    $clara = max($l1, $l2);
    $oscura = min($l1, $l2);
    return ($clara + 0.05) / ($oscura + 0.05);
}

/**
 * Sugiere un color de primer plano que alcance 4.5:1 contra el fondo dado,
 * oscureciendo o aclarando el color actual según corresponda.
 */
function sugerirColorContraste(string $frente, string $fondo): string
{
    $rgb = colorARgb($frente);
    if ($rgb === null) {
        return $frente;
    }
    $fondoLum = luminanciaRelativa($fondo);
    $oscurecer = $fondoLum > 0.5; // fondo claro -> oscurecer el frente
    for ($i = 0; $i < 64; $i++) {
        $hex = sprintf('#%02x%02x%02x', $rgb[0], $rgb[1], $rgb[2]);
        if (relacionContraste($hex, $fondo) >= CONTRASTE_MINIMO) {
            return $hex;
        }
        for ($j = 0; $j < 3; $j++) {
            $rgb[$j] = $oscurecer ? max(0, $rgb[$j] - 12) : min(255, $rgb[$j] + 12);
        }
    }
    return $oscurecer ? '#000000' : '#ffffff';
}

/**
 * Valida los colores de la apariencia (400 si el formato es inválido) y
 * devuelve los avisos de contraste (sin rechazar el guardado).
 */
function validarApariencia(array $contenido): array
{
    $fallo = validar($contenido, esquemasIdentidad()['apariencia']);
    if ($fallo !== []) {
        solicitudInvalida($fallo['mensaje'], $fallo);
    }

    // La lista `redes` debe ser una lista de objetos {nombre, url} si viene.
    if (isset($contenido['redes']) && is_array($contenido['redes'])) {
        foreach ($contenido['redes'] as $indice => $red) {
            if (!is_array($red)) {
                solicitudInvalida('Cada red social debe ser un objeto con nombre y url.', ['campo' => 'redes.' . $indice]);
            }
        }
    }

    // Listas de enlaces del marco: objetos con texto y url. Los límites son
    // los del diseño: la franja no cabe con más de seis accesos y la
    // cabecera pierde jerarquía con más de dos botones.
    $listas = [
        'accesos' => ['claves' => ['nombre', 'url'], 'maximo' => 6],
        'botones_cabecera' => ['claves' => ['texto', 'url'], 'maximo' => 2],
    ];
    foreach ($listas as $campo => $regla) {
        if (!array_key_exists($campo, $contenido)) {
            continue;
        }
        $lista = $contenido[$campo];
        if (!is_array($lista) || !array_is_list($lista) || count($lista) > $regla['maximo']) {
            solicitudInvalida("«{$campo}» admite como máximo {$regla['maximo']} elementos.", ['campo' => $campo]);
        }
        foreach ($lista as $indice => $item) {
            if (!is_array($item)) {
                solicitudInvalida('Cada enlace debe ser un objeto.', ['campo' => "{$campo}.{$indice}"]);
            }
            foreach ($regla['claves'] as $clave) {
                if (!is_string($item[$clave] ?? null)) {
                    solicitudInvalida("Falta «{$clave}» en el enlace.", ['campo' => "{$campo}.{$indice}.{$clave}"]);
                }
            }
            if ($campo === 'botones_cabecera' && !in_array($item['estilo'] ?? 'principal', ['principal', 'contorno'], true)) {
                solicitudInvalida('El estilo del botón debe ser «principal» o «contorno».', ['campo' => "{$campo}.{$indice}.estilo"]);
            }
        }
    }
    $whatsapp = (string) ($contenido['whatsapp'] ?? '');
    if ($whatsapp !== '' && preg_match('/^\d{8,15}$/', $whatsapp) !== 1) {
        solicitudInvalida('El WhatsApp debe tener de 8 a 15 dígitos, sin espacios ni «+».', ['campo' => 'whatsapp']);
    }

    $avisos = [];
    $texto = (string) ($contenido['color_texto'] ?? '');
    $fondo = (string) ($contenido['color_fondo'] ?? '');
    $superficie = (string) ($contenido['color_superficie'] ?? '');
    $primario = (string) ($contenido['color_primario'] ?? '');

    if ($texto !== '' && $fondo !== '') {
        $relacion = relacionContraste($texto, $fondo);
        if ($relacion < CONTRASTE_MINIMO) {
            $avisos[] = [
                'campo' => 'color_texto',
                'mensaje' => sprintf(
                    'El color de texto contrasta poco con el fondo (%.2f:1; mínimo %.1f:1). Sugerencia: %s.',
                    $relacion,
                    CONTRASTE_MINIMO,
                    sugerirColorContraste($texto, $fondo)
                ),
            ];
        }
    }
    if ($texto !== '' && $superficie !== '') {
        $relacion = relacionContraste($texto, $superficie);
        if ($relacion < CONTRASTE_MINIMO) {
            $avisos[] = [
                'campo' => 'color_texto',
                'mensaje' => sprintf(
                    'El color de texto contrasta poco con la superficie (%.2f:1; mínimo %.1f:1). Sugerencia: %s.',
                    $relacion,
                    CONTRASTE_MINIMO,
                    sugerirColorContraste($texto, $superficie)
                ),
            ];
        }
    }
    if ($primario !== '') {
        $relacion = relacionContraste($primario, '#ffffff');
        if ($relacion < CONTRASTE_MINIMO) {
            $avisos[] = [
                'campo' => 'color_primario',
                'mensaje' => sprintf(
                    'El color primario contrasta poco con texto blanco (%.2f:1; mínimo %.1f:1). Sugerencia: %s.',
                    $relacion,
                    CONTRASTE_MINIMO,
                    sugerirColorContraste($primario, '#ffffff')
                ),
            ];
        }
    }
    return $avisos;
}

/**
 * Prepara la apariencia antes de guardarla: valida los colores y devuelve los
 * avisos de contraste, que no impiden el guardado. Lo invoca el núcleo de
 * configuración.
 */
function prepararApariencia(array $contenido): array
{
    return ['contenido' => $contenido, 'avisos' => validarApariencia($contenido)];
}

/**
 * Guarda el borrador de la apariencia. Lo hace quien edita el sitio (admin o
 * editor); leerla y publicarla sigue siendo exclusivo del administrador.
 */
function guardarApariencia(array $contenido, int $version, string $locale): array
{
    exigirRol('admin', 'editor');
    return guardarDocumento(CLAVE_APARIENCIA, $locale, $contenido, $version, 'prepararApariencia');
}

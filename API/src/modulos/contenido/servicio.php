<?php
declare(strict_types=1);

/**
 * Lógica de contenido compartida: catálogo de bloques, validación de bloques,
 * saneado del texto enriquecido y la configuración del sitio (tabla
 * `configuracion_sitio`). El módulo `paginas` reutiliza el catálogo y el
 * validador desde aquí.
 */

require_once __DIR__ . '/../../nucleo/base_datos.php';
require_once __DIR__ . '/../../nucleo/sesion.php';
require_once __DIR__ . '/../../nucleo/auditoria.php';
require_once __DIR__ . '/../../nucleo/fechas.php';
require_once __DIR__ . '/../../nucleo/saneado.php';
require_once __DIR__ . '/../../http/errores.php';
require_once __DIR__ . '/repositorio.php';

/**
 * Versión del esquema de contenido que produce este API.
 */
const CMS_SCHEMA_VERSION = 1;

/**
 * Ruta del catálogo de bloques (API/cms/blocks.json).
 */
function rutaCatalogoBloques(): string
{
    return dirname(__DIR__, 3) . '/cms/blocks.json';
}

/**
 * Contenido del catálogo: ['templates' => [...], 'blocks' => [...]]. Si el
 * archivo no existe o está mal formado, devuelve un catálogo vacío.
 */
function fuenteBloques(): array
{
    static $datos = null;
    if ($datos !== null) {
        return $datos;
    }
    $ruta = rutaCatalogoBloques();
    if (!is_file($ruta)) {
        $datos = ['templates' => [], 'blocks' => []];
        return $datos;
    }
    $decodificado = json_decode((string) file_get_contents($ruta), true);
    $datos = is_array($decodificado) ? $decodificado : ['templates' => [], 'blocks' => []];
    return $datos;
}

/**
 * Mapa `tipo => definición` de los bloques del catálogo.
 */
function catalogoBloques(): array
{
    static $catalogo = null;
    if ($catalogo !== null) {
        return $catalogo;
    }
    $bloques = fuenteBloques()['blocks'] ?? [];
    $catalogo = [];
    foreach (is_array($bloques) ? $bloques : [] as $tipo => $item) {
        if (is_array($item)) {
            $catalogo[(string) ($item['type'] ?? $tipo)] = $item;
        }
    }
    return $catalogo;
}

/**
 * Lista de plantillas del catálogo.
 */
function plantillasCatalogo(): array
{
    $plantillas = fuenteBloques()['templates'] ?? [];
    return is_array($plantillas) ? $plantillas : [];
}

/**
 * Identificador nuevo de bloque (16 caracteres hexadecimales).
 */
function nuevoIdBloque(): string
{
    return bin2hex(random_bytes(8));
}

/**
 * Construye un bloque con los valores por defecto del catálogo y los `props`
 * indicados (igual que `makeBlock` del frontend).
 */
function crearBloque(string $tipo, ?array $props = null, bool $oculto = false, ?string $id = null): array
{
    $definicion = catalogoBloques()[$tipo] ?? null;
    $base = is_array($definicion) ? ($definicion['defaults'] ?? []) : [];
    $mezclados = array_replace_recursive($base, is_array($props) ? $props : []);
    return [
        'id' => $id ?: nuevoIdBloque(),
        'type' => $tipo,
        'hidden' => $oculto,
        'layout' => ['width' => 'full', 'padding' => '', 'background' => ''],
        'props' => $mezclados,
    ];
}

/**
 * Bloques iniciales de una plantilla, o null si la plantilla no existe.
 * La plantilla 'blank' deja un único bloque richText.
 */
function bloquesDePlantilla(string $plantilla): ?array
{
    foreach (plantillasCatalogo() as $entrada) {
        if (!is_array($entrada) || (string) ($entrada['id'] ?? '') !== $plantilla) {
            continue;
        }
        $bloques = [];
        foreach (is_array($entrada['blocks'] ?? null) ? $entrada['blocks'] : [] as $especificacion) {
            if (!is_array($especificacion)) {
                continue;
            }
            $tipo = (string) ($especificacion['type'] ?? '');
            if ($tipo === '' || !isset(catalogoBloques()[$tipo])) {
                continue;
            }
            $props = is_array($especificacion['props'] ?? null) ? $especificacion['props'] : null;
            $bloques[] = crearBloque($tipo, $props);
        }
        return $bloques !== [] ? $bloques : [crearBloque('richText')];
    }
    return null;
}

/**
 * Devuelve la función que valida un array de bloques contra el catálogo.
 *
 * La función devuelve null si todo pasa, o ['field' => ..., 'message' => ...]
 * con el primer fallo. Recibe el array de bloques y, opcionalmente, la lista
 * de rutas de imagen declaradas decorativas.
 */
function validadorDeBloques(): callable
{
    return static function (array $bloques, array $decorativas = []): ?array {
        if ($bloques === []) {
            return ['field' => 'contenido.blocks', 'message' => 'La página debe tener al menos un bloque.'];
        }
        $catalogo = catalogoBloques();
        foreach ($bloques as $indice => $bloque) {
            if (!is_array($bloque)) {
                return ['field' => "contenido.blocks.{$indice}", 'message' => 'El bloque no es válido.'];
            }
            $tipo = $bloque['type'] ?? null;
            if (!is_string($tipo) || $tipo === '' || !isset($catalogo[$tipo])) {
                return [
                    'field' => "contenido.blocks.{$indice}.type",
                    'message' => 'Tipo de bloque desconocido: ' . (is_string($tipo) ? $tipo : '') . '.',
                ];
            }
            if (!isset($bloque['id']) || !is_string($bloque['id']) || $bloque['id'] === '') {
                return ['field' => "contenido.blocks.{$indice}.id", 'message' => 'El bloque debe tener un identificador.'];
            }
            if (!array_key_exists('hidden', $bloque) || !is_bool($bloque['hidden'])) {
                return ['field' => "contenido.blocks.{$indice}.hidden", 'message' => 'El bloque debe indicar si está oculto.'];
            }
            if (!isset($bloque['props']) || !is_array($bloque['props'])) {
                return ['field' => "contenido.blocks.{$indice}.props", 'message' => 'El bloque debe tener sus propiedades.'];
            }
            $error = validarCamposBloque(
                is_array($catalogo[$tipo]['schema'] ?? null) ? $catalogo[$tipo]['schema'] : [],
                $bloque['props'],
                $indice,
                $decorativas
            );
            if ($error !== null) {
                return $error;
            }
        }
        return null;
    };
}

/**
 * Valida los campos de un bloque contra su esquema, también dentro de listas y
 * grupos: los campos con `required` deben estar presentes y no vacíos (salvo
 * imágenes declaradas decorativas), las listas con `min` deben tener al menos
 * ese número de elementos y los enlaces (tipo link o embed) se validan con
 * `validarEnlace()`.
 */
function validarCamposBloque(array $esquema, array $props, int $indice, array $decorativas, string $prefijo = ''): ?array
{
    foreach ($esquema as $campo) {
        if (!is_array($campo)) {
            continue;
        }
        $ruta = (string) ($campo['path'] ?? '');
        if ($ruta === '') {
            continue;
        }
        $tipo = (string) ($campo['type'] ?? '');
        $rutaProps = $prefijo === '' ? $ruta : $prefijo . '.' . $ruta;
        $campoPath = "contenido.blocks.{$indice}.props.{$rutaProps}";
        $valor = array_key_exists($ruta, $props) ? $props[$ruta] : null;

        if (!empty($campo['required'])) {
            $esDecorativa = $tipo === 'image' && in_array("blocks.{$indice}.props.{$rutaProps}", $decorativas, true);
            if (!$esDecorativa && ($valor === null || $valor === '' || $valor === [])) {
                return [
                    'field' => $campoPath,
                    'message' => 'El campo ' . (string) ($campo['label'] ?? $ruta) . ' es obligatorio.',
                ];
            }
        }

        if ($tipo === 'list' && (int) ($campo['min'] ?? 0) >= 1) {
            $minimo = (int) $campo['min'];
            if (!is_array($valor) || count($valor) < $minimo) {
                return [
                    'field' => $campoPath,
                    'message' => 'Debe haber al menos ' . $minimo . ' elemento(s) en ' . (string) ($campo['label'] ?? $ruta) . '.',
                ];
            }
        }

        if (($tipo === 'link' || $tipo === 'embed') && is_string($valor) && trim($valor) !== '') {
            $errorEnlace = validarEnlace($valor);
            if ($errorEnlace !== null) {
                return ['field' => $campoPath, 'message' => $errorEnlace];
            }
        }

        if ($tipo === 'list' && is_array($valor) && is_array($campo['item'] ?? null)) {
            foreach ($valor as $j => $elemento) {
                if (is_array($elemento)) {
                    $error = validarCamposBloque($campo['item'], $elemento, $indice, $decorativas, $rutaProps . '.' . $j);
                    if ($error !== null) {
                        return $error;
                    }
                }
            }
        }

        if ($tipo === 'group' && is_array($valor) && is_array($campo['children'] ?? null)) {
            $error = validarCamposBloque($campo['children'], $valor, $indice, $decorativas, $rutaProps);
            if ($error !== null) {
                return $error;
            }
        }
    }
    return null;
}

/**
 * Sanea los campos de tipo 'rich' de todos los bloques del contenido usando el
 * esquema del catálogo. Los tokens {{...}} sobreviven intactos (no se rompen).
 */
function sanearContenido(array $contenido): array
{
    $bloques = $contenido['blocks'] ?? null;
    if (!is_array($bloques)) {
        return $contenido;
    }
    $catalogo = catalogoBloques();
    foreach ($bloques as $indice => $bloque) {
        if (!is_array($bloque)) {
            continue;
        }
        $tipo = (string) ($bloque['type'] ?? '');
        $definicion = $catalogo[$tipo] ?? null;
        if (!is_array($definicion) || !is_array($bloque['props'] ?? null)) {
            continue;
        }
        $bloque['props'] = sanearPropsSegunEsquema(
            $bloque['props'],
            is_array($definicion['schema'] ?? null) ? $definicion['schema'] : []
        );
        $bloques[$indice] = $bloque;
    }
    $contenido['blocks'] = $bloques;
    return $contenido;
}

/**
 * Recorre un subárbol de props siguiendo el esquema y sanea los campos rich,
 * también dentro de listas y grupos.
 */
function sanearPropsSegunEsquema(array $valor, array $esquema): array
{
    foreach ($esquema as $campo) {
        if (!is_array($campo)) {
            continue;
        }
        $ruta = (string) ($campo['path'] ?? '');
        $tipo = (string) ($campo['type'] ?? '');
        if ($ruta === '' || !array_key_exists($ruta, $valor)) {
            continue;
        }
        $sub = $valor[$ruta];
        if ($tipo === 'rich') {
            $valor[$ruta] = is_string($sub) ? sanearHtml($sub) : $sub;
        } elseif ($tipo === 'list' && is_array($sub)) {
            $itemEsquema = is_array($campo['item'] ?? null) ? $campo['item'] : [];
            foreach ($sub as $j => $elemento) {
                if (is_array($elemento)) {
                    $sub[$j] = sanearPropsSegunEsquema($elemento, $itemEsquema);
                }
            }
            $valor[$ruta] = $sub;
        } elseif ($tipo === 'group' && is_array($sub)) {
            $hijos = is_array($campo['children'] ?? null) ? $campo['children'] : [];
            $valor[$ruta] = sanearPropsSegunEsquema($sub, $hijos);
        }
    }
    return $valor;
}

/**
 * Decodifica una columna que guarda JSON (JSON nativo o LONGTEXT). Devuelve un
 * array, o null si está vacía o no es un objeto/array JSON.
 */
function decodificarJsonColumna(mixed $valor): ?array
{
    if ($valor === null || $valor === '') {
        return null;
    }
    if (is_array($valor)) {
        return $valor;
    }
    if (is_string($valor)) {
        $decodificado = json_decode($valor, true);
        return is_array($decodificado) ? $decodificado : null;
    }
    return null;
}

/**
 * Normaliza el locale. Solo se admite 'es' (o vacío, que se normaliza a 'es');
 * cualquier otro valor responde 400.
 */
function normalizarLocale(mixed $locale): string
{
    if ($locale === null || $locale === '') {
        return 'es';
    }
    if (is_string($locale) && strtolower(trim($locale)) === 'es') {
        return 'es';
    }
    solicitudInvalida('Solo se admite el idioma español (es).');
}

/**
 * Locale de la petición actual (query `locale`), normalizado a 'es'.
 */
function localeDePeticion(): string
{
    return normalizarLocale($_GET['locale'] ?? null);
}

/**
 * Documento de configuración del sitio (publicado o borrador según la sesión).
 */
function contenidoConfiguracion(string $locale): array
{
    $fila = configuracionPorLocale($locale);
    $conSesion = usuarioActual() !== null;

    if ($fila === null) {
        $payload = ['contenido' => [], 'version' => 1, 'schemaVersion' => CMS_SCHEMA_VERSION];
        if ($conSesion) {
            $payload['tiene_borrador'] = false;
        }
        return $payload;
    }

    $borrador = decodificarJsonColumna($fila['borrador'] ?? null);
    $publicado = decodificarJsonColumna($fila['contenido'] ?? null);
    $tieneBorrador = $borrador !== null;
    $contenido = ($conSesion && $tieneBorrador) ? $borrador : ($publicado ?? []);

    $payload = [
        'contenido' => $contenido,
        'version' => (int) ($fila['version'] ?? 1),
        'actualizado_en' => aIso(isset($fila['actualizado_en']) ? (string) $fila['actualizado_en'] : null),
        'schemaVersion' => CMS_SCHEMA_VERSION,
    ];
    if ($conSesion) {
        $payload['tiene_borrador'] = $tieneBorrador;
    }
    return $payload;
}

/**
 * Guarda el borrador de la configuración. Exige la versión leída por el
 * cliente; si no coincide responde 409.
 */
function guardarConfiguracion(string $locale, array $contenido, int $version): array
{
    exigirSesion();

    $contenido = sanearContenido($contenido);
    $json = json_encode($contenido, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        solicitudInvalida('El contenido no se puede guardar.');
    }

    $fila = configuracionPorLocale($locale);
    $actual = $fila === null ? 1 : (int) ($fila['version'] ?? 1);
    if ($version !== $actual) {
        lanzarConflictoConfiguracion($fila, 'Alguien guardó el sitio antes. Recarga para no pisar cambios.');
    }

    $nueva = $actual + 1;
    $afectadas = enTransaccion(static function () use ($locale, $json, $actual, $nueva): int {
        asegurarConfiguracion($locale);
        return actualizarBorradorConfiguracion($locale, $json, $actual, $nueva);
    });
    if ($afectadas === 0) {
        lanzarConflictoConfiguracion($fila, 'Alguien guardó el sitio antes. Recarga para no pisar cambios.');
    }

    $fresca = configuracionPorLocale($locale);
    registrarAuditoria('guardar_configuracion', 'configuracion_sitio', $locale, ['version' => $nueva]);

    return [
        'contenido' => $contenido,
        'version' => $nueva,
        'actualizado_en' => aIso($fresca !== null && isset($fresca['actualizado_en']) ? (string) $fresca['actualizado_en'] : null),
    ];
}

/**
 * Publica la configuración: pasa el borrador a contenido (o publica el
 * contenido actual si no hay borrador) y sube la versión.
 */
function publicarConfiguracion(string $locale, int $version): array
{
    exigirRol('admin');

    $fila = configuracionPorLocale($locale);
    $actual = $fila === null ? 1 : (int) ($fila['version'] ?? 1);
    if ($version !== $actual) {
        lanzarConflictoConfiguracion($fila, 'Alguien publicó o guardó antes. Recarga para no pisar cambios.');
    }

    $borrador = $fila === null ? null : decodificarJsonColumna($fila['borrador'] ?? null);
    $publicado = $fila === null ? null : decodificarJsonColumna($fila['contenido'] ?? null);
    $aPublicar = $borrador !== null ? $borrador : ($publicado ?? []);
    $aPublicar = sanearContenido($aPublicar);
    $json = json_encode($aPublicar, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        solicitudInvalida('El contenido no se puede publicar.');
    }

    $nueva = $actual + 1;
    $afectadas = enTransaccion(static function () use ($locale, $json, $actual, $nueva): int {
        asegurarConfiguracion($locale);
        return publicarConfiguracionBd($locale, $json, $actual, $nueva);
    });
    if ($afectadas === 0) {
        lanzarConflictoConfiguracion($fila, 'Alguien publicó o guardó antes. Recarga para no pisar cambios.');
    }

    $fresca = configuracionPorLocale($locale);
    registrarAuditoria('publicar_configuracion', 'configuracion_sitio', $locale, ['version' => $nueva]);

    return [
        'contenido' => $aPublicar,
        'version' => $nueva,
        'actualizado_en' => aIso($fresca !== null && isset($fresca['actualizado_en']) ? (string) $fresca['actualizado_en'] : null),
    ];
}

/**
 * Lanza el 409 de conflicto de versión para la configuración, con la versión,
 * la fecha y el contenido actuales.
 */
function lanzarConflictoConfiguracion(?array $fila, string $mensaje): never
{
    $actual = $fila === null ? 1 : (int) ($fila['version'] ?? 1);
    $borrador = $fila === null ? null : decodificarJsonColumna($fila['borrador'] ?? null);
    $publicado = $fila === null ? null : decodificarJsonColumna($fila['contenido'] ?? null);
    $contenido = $borrador !== null ? $borrador : ($publicado ?? []);
    error_app($mensaje, 409, [
        'version' => $actual,
        'actualizado_en' => $fila !== null && isset($fila['actualizado_en']) ? aIso((string) $fila['actualizado_en']) : null,
        'contenido' => sanearContenido($contenido),
    ]);
}

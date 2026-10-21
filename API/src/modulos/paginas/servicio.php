<?php
declare(strict_types=1);

/**
 * Lógica de negocio de páginas, borradores, publicación e historial.
 * Capa servicio: valida, autoriza y coordina núcleo + repositorio + contenido.
 */

require_once __DIR__ . '/../../nucleo/sesion.php';
require_once __DIR__ . '/../../nucleo/json.php';
require_once __DIR__ . '/../../nucleo/auditoria.php';
require_once __DIR__ . '/../../nucleo/validacion.php';
require_once __DIR__ . '/../../nucleo/fechas.php';
require_once __DIR__ . '/../../nucleo/slug.php';
require_once __DIR__ . '/../../http/errores.php';
require_once __DIR__ . '/../contenido/servicio.php';
require_once __DIR__ . '/esquemas.php';
require_once __DIR__ . '/repositorio.php';

/**
 * Slugs que el sistema se reserva y no pueden usarse para una página.
 */
function slugsReservados(): array
{
    return ['admin', 'api', 'paginas', 'configuracion', 'mensajes', 'medios', 'auth', 'revisions', 'sitemap', 'uploads'];
}

/**
 * Ruta derivada del slug: '/' para 'inicio' y '/' + slug en general.
 */
function rutaParaSlug(string $slug): string
{
    return $slug === 'inicio' ? '/' : '/' . $slug;
}

/**
 * Ruta efectiva de una página: la columna `ruta` o, si está vacía, la derivada
 * del slug.
 */
function rutaEfectiva(string $slug, string $ruta): string
{
    if ($ruta !== '') {
        return $ruta;
    }
    return rutaParaSlug($slug);
}

/**
 * Resumen de una fila de página para las respuestas del API.
 */
function resumenPaginaDesdeFila(array $fila): array
{
    return [
        'slug' => (string) ($fila['slug'] ?? ''),
        'titulo' => (string) ($fila['titulo'] ?? ''),
        'actualizado_en' => aIso(isset($fila['actualizado_en']) ? (string) $fila['actualizado_en'] : null),
        'version' => (int) ($fila['version'] ?? 1),
        'ruta' => rutaEfectiva((string) ($fila['slug'] ?? ''), (string) ($fila['ruta'] ?? '')),
        'mostrar_en_menu' => (int) ($fila['mostrar_en_menu'] ?? 0) === 1,
        'orden_menu' => (int) ($fila['orden_menu'] ?? 0),
    ];
}

/**
 * Valida el array de bloques de un contenido contra el catálogo; responde 400
 * con el campo y mensaje del primer fallo.
 */
function validarContenidoBloques(array $contenido): void
{
    $bloques = is_array($contenido['blocks'] ?? null) ? $contenido['blocks'] : [];
    $decorativas = is_array($contenido['decorativeImagePaths'] ?? null) ? $contenido['decorativeImagePaths'] : [];
    $validar = validadorDeBloques();
    $error = $validar($bloques, $decorativas);
    if ($error !== null) {
        solicitudInvalida((string) $error['message'], ['field' => (string) $error['field']]);
    }
}

/**
 * Lanza el 409 de conflicto de versión de una página, con la versión, la fecha
 * y el contenido actuales (borrador si lo hay, si no el publicado).
 */
function lanzarConflictoPagina(array $fila, string $mensaje): never
{
    $borrador = decodificarJson($fila['borrador'] ?? null);
    $publicado = decodificarJson($fila['contenido'] ?? null);
    $contenido = $borrador !== null ? $borrador : ($publicado ?? []);
    error_app($mensaje, 409, [
        'version' => (int) ($fila['version'] ?? 1),
        'actualizado_en' => aIso(isset($fila['actualizado_en']) ? (string) $fila['actualizado_en'] : null),
        'contenido' => sanearContenido($contenido),
    ]);
}

/**
 * Documento de una página. Con `conBorrador` devuelve el borrador si lo hay y
 * añade `tiene_borrador`. Devuelve null si no hay nada que mostrar (página
 * inexistente o sin contenido publicado).
 */
function documentoPagina(string $slug, string $locale, bool $conBorrador): ?array
{
    $fila = paginaPorSlug($slug, $locale);
    if ($fila === null) {
        return null;
    }
    $borrador = decodificarJson($fila['borrador'] ?? null);
    $publicado = decodificarJson($fila['contenido'] ?? null);
    $tieneBorrador = $borrador !== null;
    $contenido = ($conBorrador && $tieneBorrador) ? $borrador : $publicado;
    if ($contenido === null) {
        return null;
    }

    $payload = [
        'contenido' => $contenido,
        'version' => (int) ($fila['version'] ?? 1),
        'actualizado_en' => aIso(isset($fila['actualizado_en']) ? (string) $fila['actualizado_en'] : null),
        'schemaVersion' => CMS_SCHEMA_VERSION,
        'slug' => (string) $fila['slug'],
        'titulo' => (string) ($fila['titulo'] ?? ''),
        'ruta' => rutaEfectiva((string) $fila['slug'], (string) ($fila['ruta'] ?? '')),
        'mostrar_en_menu' => (int) ($fila['mostrar_en_menu'] ?? 0) === 1,
        'orden_menu' => (int) ($fila['orden_menu'] ?? 0),
    ];
    if ($conBorrador) {
        $payload['tiene_borrador'] = $tieneBorrador;
    }
    return $payload;
}

/**
 * Contenido publicado de una página para el sitio público (sin sesión).
 * Devuelve null si la página no existe o no tiene contenido publicado.
 */
function paginaPublicada(string $slug, string $locale): ?array
{
    return documentoPagina($slug, $locale, false);
}

/**
 * Listado de páginas y de menú (solo las visibles en el menú).
 */
function listarPaginas(string $locale): array
{
    $filas = paginasTodas($locale);
    $paginas = [];
    $menu = [];
    foreach ($filas as $fila) {
        $resumen = resumenPaginaDesdeFila($fila);
        $paginas[] = $resumen;
        if ((int) ($fila['mostrar_en_menu'] ?? 0) === 1) {
            $menu[] = [
                'slug' => $resumen['slug'],
                'titulo' => $resumen['titulo'],
                'ruta' => $resumen['ruta'],
                'orden_menu' => (int) ($fila['orden_menu'] ?? 0),
            ];
        }
    }
    return ['paginas' => $paginas, 'menu' => $menu];
}

/**
 * Guarda el borrador de una página. Exige la versión leída por el cliente; si
 * no coincide responde 409 sin escribir nada.
 */
function guardarBorrador(string $slug, string $locale, array $contenido, int $version): array
{
    exigirSesion();

    $fila = paginaPorSlug($slug, $locale);
    if ($fila === null) {
        noEncontrado('Página no encontrada.');
    }
    $actual = (int) $fila['version'];
    if ($version !== $actual) {
        lanzarConflictoPagina($fila, 'Alguien guardó esta página antes. Recarga para no pisar cambios.');
    }

    validarContenidoBloques($contenido);
    $contenido = sanearContenido($contenido);
    $json = json_encode($contenido, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        solicitudInvalida('El contenido no se puede guardar.');
    }

    $nueva = $actual + 1;
    $afectadas = enTransaccion(static fn (): int => actualizarBorradorPagina($slug, $locale, $json, $actual, $nueva));
    if ($afectadas === 0) {
        $fresca = paginaPorSlug($slug, $locale);
        lanzarConflictoPagina($fresca ?? $fila, 'Alguien guardó esta página antes. Recarga para no pisar cambios.');
    }

    $fresca = paginaPorSlug($slug, $locale);
    registrarAuditoria('guardar_borrador', 'paginas', $slug, [
        'titulo' => (string) $fila['titulo'],
        'slug' => $slug,
        'version' => $nueva,
    ]);

    return [
        'contenido' => $contenido,
        'version' => $nueva,
        'actualizado_en' => aIso($fresca !== null && isset($fresca['actualizado_en']) ? (string) $fresca['actualizado_en'] : null),
    ];
}

/**
 * Publica una página: escribe una revisión con el autor y pasa el borrador a
 * contenido publicado en una sola transacción. Sin borrador, publica el
 * contenido actual.
 */
function publicarPagina(string $slug, string $locale, int $version): array
{
    $usuario = exigirRol('admin');

    $fila = paginaPorSlug($slug, $locale);
    if ($fila === null) {
        noEncontrado('Página no encontrada.');
    }
    $actual = (int) $fila['version'];
    if ($version !== $actual) {
        lanzarConflictoPagina($fila, 'Alguien publicó o guardó antes. Recarga para no pisar cambios.');
    }

    $borrador = decodificarJson($fila['borrador'] ?? null);
    $publicado = decodificarJson($fila['contenido'] ?? null);
    $aPublicar = $borrador !== null ? $borrador : ($publicado ?? []);

    validarContenidoBloques($aPublicar);
    $aPublicar = sanearContenido($aPublicar);
    $json = json_encode($aPublicar, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        solicitudInvalida('El contenido no se puede publicar.');
    }

    $nueva = $actual + 1;
    $autor = (string) $usuario['usuario'];
    $afectadas = enTransaccion(static function () use ($slug, $locale, $autor, $json, $actual, $nueva): int {
        insertarRevision($slug, $locale, $autor, $json);
        return publicarPaginaBd($slug, $locale, $json, $actual, $nueva);
    });
    if ($afectadas === 0) {
        $fresca = paginaPorSlug($slug, $locale);
        lanzarConflictoPagina($fresca ?? $fila, 'Alguien publicó o guardó antes. Recarga para no pisar cambios.');
    }

    registrarAuditoria('publicar_pagina', 'paginas', $slug, [
        'titulo' => (string) $fila['titulo'],
        'slug' => $slug,
        'version' => $nueva,
    ]);

    return ['contenido' => $aPublicar, 'version' => $nueva];
}

/**
 * Historial de revisiones de una página.
 */
function listarRevisiones(string $slug, string $locale): array
{
    exigirSesion();
    $items = array_map(static function (array $fila): array {
        return [
            'id' => (int) $fila['id'],
            'autor' => (string) ($fila['autor'] ?? ''),
            'creado_en' => aIso(isset($fila['creado_en']) ? (string) $fila['creado_en'] : null),
            'instantanea' => decodificarJson($fila['instantanea'] ?? null) ?? [],
        ];
    }, revisionesDePagina($slug, $locale));
    return ['items' => $items];
}

/**
 * Restaura una revisión guardándola como BORRADOR (no la publica) y subiendo
 * la versión.
 */
function restaurarRevision(string $slug, string $locale, int $id, int $version): array
{
    exigirSesion();

    $revision = revisionPorId($slug, $locale, $id);
    if ($revision === null) {
        noEncontrado('Revisión no encontrada.');
    }
    $instantanea = decodificarJson($revision['instantanea'] ?? null) ?? [];

    $fila = paginaPorSlug($slug, $locale);
    if ($fila === null) {
        noEncontrado('Página no encontrada.');
    }
    $actual = (int) $fila['version'];
    if ($version !== $actual) {
        lanzarConflictoPagina($fila, 'Alguien guardó antes. Recarga para no pisar cambios.');
    }

    $json = json_encode($instantanea, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        solicitudInvalida('La revisión no se puede restaurar.');
    }

    $nueva = $actual + 1;
    $afectadas = enTransaccion(static fn (): int => actualizarBorradorPagina($slug, $locale, $json, $actual, $nueva));
    if ($afectadas === 0) {
        $fresca = paginaPorSlug($slug, $locale);
        lanzarConflictoPagina($fresca ?? $fila, 'Alguien guardó antes. Recarga para no pisar cambios.');
    }

    registrarAuditoria('restaurar_revision', 'paginas', $slug, [
        'titulo' => (string) $fila['titulo'],
        'slug' => $slug,
        'version' => $nueva,
    ]);

    return ['contenido' => $instantanea, 'version' => $nueva];
}

/**
 * Crea una página con el borrador inicial de una plantilla (blank por defecto)
 * y versión 1.
 */
function crearPagina(array $datos, int $usuarioId): array
{
    exigirRol('admin');

    $locale = 'es';

    $titulo = trim((string) ($datos['titulo'] ?? ''));
    if ($titulo === '') {
        solicitudInvalida('El título es obligatorio.', ['field' => 'titulo']);
    }
    if (mb_strlen($titulo, 'UTF-8') > 160) {
        solicitudInvalida('El título no debe superar 160 caracteres.', ['field' => 'titulo']);
    }

    $slug = isset($datos['slug']) && trim((string) $datos['slug']) !== '' ? trim((string) $datos['slug']) : aSlug($titulo);
    if (preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $slug) !== 1 || strlen($slug) < 2 || strlen($slug) > 80) {
        solicitudInvalida('El slug debe tener entre 2 y 80 caracteres en minúsculas (letras, números y guiones).', ['field' => 'slug']);
    }
    if (in_array($slug, slugsReservados(), true)) {
        solicitudInvalida('Ese slug está reservado para el sistema.', ['field' => 'slug']);
    }
    if (paginaExistePorSlug($slug, $locale)) {
        conflicto('Ya existe una página con ese slug.');
    }

    $ruta = array_key_exists('ruta', $datos) && trim((string) $datos['ruta']) !== '' ? trim((string) $datos['ruta']) : '';
    if ($ruta !== '') {
        if (preg_match('#^/[a-z0-9\-/]*$#', $ruta) !== 1) {
            solicitudInvalida('La ruta solo puede contener letras, números, guiones y barras, y debe empezar por /.', ['field' => 'ruta']);
        }
    } else {
        $ruta = rutaParaSlug($slug);
    }
    if (paginaExistePorRuta($ruta, $locale)) {
        conflicto('Ya existe una página con esa ruta.');
    }

    $mostrarEnMenu = !empty($datos['mostrar_en_menu']) ? 1 : 0;
    $plantilla = isset($datos['plantilla']) && trim((string) $datos['plantilla']) !== '' ? trim((string) $datos['plantilla']) : 'blank';
    $bloques = bloquesDePlantilla($plantilla);
    if ($bloques === null) {
        solicitudInvalida('La plantilla no existe.', ['field' => 'plantilla']);
    }

    $contenido = ['schemaVersion' => CMS_SCHEMA_VERSION, 'blocks' => $bloques];
    $json = json_encode($contenido, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        solicitudInvalida('El contenido inicial no se puede crear.');
    }

    insertarPagina($slug, $locale, $titulo, $json, $ruta, $mostrarEnMenu, 0);
    registrarAuditoria('crear_pagina', 'paginas', $slug, ['titulo' => $titulo, 'slug' => $slug, 'version' => 1]);

    return [
        'pagina' => [
            'slug' => $slug,
            'titulo' => $titulo,
            'version' => 1,
            'ruta' => $ruta,
            'mostrar_en_menu' => $mostrarEnMenu === 1,
            'orden_menu' => 0,
        ],
        'contenido' => $contenido,
        'version' => 1,
    ];
}

/**
 * Cambia los metadatos de una página (título, slug, ruta, visibilidad y
 * orden).
 */
function actualizarMetaPagina(string $slug, array $datos): array
{
    exigirRol('admin');

    $locale = 'es';
    $fila = paginaPorSlug($slug, $locale);
    if ($fila === null) {
        noEncontrado('Página no encontrada.');
    }

    $titulo = array_key_exists('titulo', $datos) ? trim((string) $datos['titulo']) : (string) $fila['titulo'];
    if ($titulo === '') {
        solicitudInvalida('El título no puede quedar vacío.', ['field' => 'titulo']);
    }
    if (mb_strlen($titulo, 'UTF-8') > 160) {
        solicitudInvalida('El título no debe superar 160 caracteres.', ['field' => 'titulo']);
    }

    $nuevoSlug = (string) $fila['slug'];
    if (array_key_exists('slug', $datos) && $datos['slug'] !== null && trim((string) $datos['slug']) !== '') {
        $nuevoSlug = trim((string) $datos['slug']);
        if (preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $nuevoSlug) !== 1 || strlen($nuevoSlug) < 2 || strlen($nuevoSlug) > 80) {
            solicitudInvalida('El slug no es válido.', ['field' => 'slug']);
        }
        if (in_array($nuevoSlug, slugsReservados(), true)) {
            solicitudInvalida('Ese slug está reservado para el sistema.', ['field' => 'slug']);
        }
        if ($nuevoSlug !== $slug && paginaExistePorSlug($nuevoSlug, $locale)) {
            conflicto('Ya existe una página con ese slug.');
        }
    }

    if (array_key_exists('ruta', $datos)) {
        $ruta = trim((string) $datos['ruta']);
        if ($ruta === '') {
            $ruta = rutaParaSlug($nuevoSlug);
        }
    } else {
        $ruta = (string) ($fila['ruta'] ?? '');
        if ($ruta === '') {
            $ruta = rutaParaSlug($nuevoSlug);
        }
    }
    if (preg_match('#^/[a-z0-9\-/]*$#', $ruta) !== 1) {
        solicitudInvalida('La ruta no es válida.', ['field' => 'ruta']);
    }
    if (paginaExistePorRuta($ruta, $locale, $slug)) {
        conflicto('Ya existe una página con esa ruta.');
    }

    $mostrarEnMenu = array_key_exists('mostrar_en_menu', $datos)
        ? (!empty($datos['mostrar_en_menu']) ? 1 : 0)
        : (int) ($fila['mostrar_en_menu'] ?? 0);
    $ordenMenu = array_key_exists('orden_menu', $datos) ? (int) $datos['orden_menu'] : (int) ($fila['orden_menu'] ?? 0);

    enTransaccion(static function () use ($slug, $locale, $nuevoSlug, $titulo, $ruta, $mostrarEnMenu, $ordenMenu): void {
        actualizarMetaPaginaBd($slug, $locale, $nuevoSlug, $titulo, $ruta, $mostrarEnMenu, $ordenMenu);
        if ($nuevoSlug !== $slug) {
            actualizarSlugRevisiones($slug, $nuevoSlug, $locale);
        }
    });

    registrarAuditoria('actualizar_meta', 'paginas', $nuevoSlug, [
        'titulo' => $titulo,
        'slug' => $nuevoSlug,
        'version' => (int) $fila['version'],
    ]);

    $fresca = paginaPorSlug($nuevoSlug, $locale);
    return ['pagina' => $fresca !== null ? resumenPaginaDesdeFila($fresca) : []];
}

/**
 * Elimina una página y su historial.
 */
function eliminarPagina(string $slug): void
{
    exigirRol('admin');

    $locale = 'es';
    $fila = paginaPorSlug($slug, $locale);
    if ($fila === null) {
        noEncontrado('Página no encontrada.');
    }

    enTransaccion(static function () use ($slug, $locale): void {
        eliminarPaginaBd($slug, $locale);
        eliminarRevisionesPagina($slug, $locale);
    });

    registrarAuditoria('eliminar_pagina', 'paginas', $slug, [
        'titulo' => (string) $fila['titulo'],
        'slug' => $slug,
        'version' => (int) $fila['version'],
    ]);
}

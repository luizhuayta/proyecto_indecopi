<?php
declare(strict_types=1);

/**
 * Lógica de noticias y comunicados. El editor redacta; publicar, editar lo
 * ya publicado y eliminar es del administrador, como en las páginas.
 */

require_once __DIR__ . '/../../nucleo/base_datos.php';
require_once __DIR__ . '/../../nucleo/sesion.php';
require_once __DIR__ . '/../../nucleo/validacion.php';
require_once __DIR__ . '/../../nucleo/slug.php';
require_once __DIR__ . '/../../nucleo/saneado.php';
require_once __DIR__ . '/../../nucleo/fechas.php';
require_once __DIR__ . '/../../nucleo/auditoria.php';
require_once __DIR__ . '/../busqueda/servicio.php';
require_once __DIR__ . '/../../http/errores.php';
require_once __DIR__ . '/esquemas.php';
require_once __DIR__ . '/repositorio.php';

/**
 * Forma pública de una fila (sin borradores ni datos internos).
 */
function noticiaPublicaDeFila(array $fila, bool $conCuerpo = false): array
{
    $salida = [
        'id' => (int) $fila['id'],
        'tipo' => (string) $fila['tipo'],
        'titulo' => (string) $fila['titulo'],
        'slug' => (string) $fila['slug'],
        'ruta' => '/noticias/' . $fila['slug'],
        'categoria' => (string) $fila['categoria'],
        'resumen' => (string) $fila['resumen'],
        'imagen_url' => (string) $fila['imagen_url'],
        'imagen_alt' => (string) $fila['imagen_alt'],
        'destacada' => (bool) $fila['destacada'],
        'publicado_en' => aIso($fila['publicado_en'] ?? null),
    ];
    if ($conCuerpo) {
        $salida['cuerpo'] = (string) ($fila['cuerpo'] ?? '');
    }
    return $salida;
}

/**
 * Forma del panel: la pública más el estado editorial y el autor.
 */
function noticiaAdminDeFila(array $fila): array
{
    return noticiaPublicaDeFila($fila, true) + [
        'estado' => (string) $fila['estado'],
        'autor' => (string) $fila['autor'],
        'actualizado_en' => aIso($fila['actualizado_en'] ?? null),
    ];
}

/**
 * Solo rutas internas o http(s): la imagen se pinta en el sitio público, así
 * que no puede ser un javascript: ni un dato en crudo.
 */
function imagenNoticiaValida(string $url): bool
{
    return $url === '' || preg_match('#^(?:/(?![/\\\\])|https?://)[^\s<>"\'\\\\]+$#i', $url) === 1;
}

/**
 * Slug único para la noticia: deriva del título (o del slug pedido) y añade
 * un sufijo si ya existe. `aSlug` nunca devuelve vacío (cae en 'pagina'), así
 * que el bucle de unicidad decide el resto.
 */
function slugNoticiaUnico(string $base, ?int $excepto): string
{
    $base = aSlug($base) ?: 'noticia';
    $base = substr($base, 0, 110);
    $slug = $base;
    for ($n = 2; slugNoticiaOcupadoBd($slug, $excepto); $n++) {
        $slug = "{$base}-{$n}";
    }
    return $slug;
}

/**
 * Valida y normaliza el cuerpo de la petición; aplica las reglas de rol:
 * un editor no puede publicar ni tocar una noticia ya publicada.
 */
function camposNoticia(array $datos, ?array $actual, array $usuario): array
{
    // Se valida lo que llega; en una edición parcial el título ya guardado
    // cuenta para el «requerido».
    $fallo = validar($datos + ($actual !== null ? ['titulo' => $actual['titulo']] : []), esquemasNoticia()['noticia']);
    if ($fallo !== []) {
        solicitudInvalida($fallo['mensaje'], $fallo);
    }
    $valor = fn (string $clave, mixed $defecto = '') => array_key_exists($clave, $datos) ? $datos[$clave] : ($actual[$clave] ?? $defecto);

    $estado = (string) $valor('estado', 'borrador');
    $tocaPublicado = $estado === 'publicado' || ($actual !== null && $actual['estado'] === 'publicado');
    if ($tocaPublicado && $usuario['rol'] !== 'admin') {
        prohibido('Solo el administrador publica o edita noticias publicadas.');
    }

    $imagen = trim((string) $valor('imagen_url'));
    if (!imagenNoticiaValida($imagen)) {
        solicitudInvalida('La imagen debe ser una ruta del sitio o una dirección http(s).', ['campo' => 'imagen_url']);
    }

    $publicadoEn = trim((string) $valor('publicado_en', ''));
    if ($publicadoEn !== '') {
        // Admite 'YYYY-MM-DD HH:MM' y el formato del input datetime-local.
        $fecha = DateTimeImmutable::createFromFormat('!Y-m-d H:i', substr(str_replace('T', ' ', $publicadoEn), 0, 16))
            ?: DateTimeImmutable::createFromFormat('!Y-m-d', substr($publicadoEn, 0, 10));
        if ($fecha === false) {
            solicitudInvalida('La fecha de publicación no es válida.', ['campo' => 'publicado_en']);
        }
        $publicadoEn = $fecha->format('Y-m-d H:i:s');
    } elseif ($estado === 'publicado') {
        $publicadoEn = date('Y-m-d H:i:s');
    }

    $titulo = trim((string) $valor('titulo'));
    $slugPedido = trim((string) ($datos['slug'] ?? ''));
    $slug = $actual !== null && $slugPedido === '' ? (string) $actual['slug'] : slugNoticiaUnico($slugPedido ?: $titulo, $actual['id'] ?? null);

    return [
        'tipo' => (string) $valor('tipo', 'noticia') ?: 'noticia',
        'titulo' => $titulo,
        'slug' => $slug,
        'categoria' => trim((string) $valor('categoria')),
        'resumen' => trim((string) $valor('resumen')),
        'cuerpo' => sanearHtml((string) $valor('cuerpo')),
        'imagen_url' => $imagen,
        'imagen_alt' => trim((string) $valor('imagen_alt')),
        'destacada' => (bool) $valor('destacada', false) ? 1 : 0,
        'estado' => $estado,
        'publicado_en' => $publicadoEn !== '' ? $publicadoEn : null,
    ];
}

/**
 * Mantiene el índice de búsqueda: publicada → indexada; si no, fuera. El
 * índice recorre `blocks[].props`, así que el resumen y el cuerpo van con la
 * misma forma que un contenido de página.
 */
function sincronizarIndiceNoticia(array $campos, ?string $rutaAnterior): void
{
    $ruta = '/noticias/' . $campos['slug'];
    if ($rutaAnterior !== null && $rutaAnterior !== $ruta) {
        quitarDelIndice($rutaAnterior, 'es');
    }
    if ($campos['estado'] === 'publicado') {
        indexarPagina($ruta, 'es', $campos['titulo'], ['blocks' => [['props' => [
            'resumen' => $campos['resumen'], 'cuerpo' => $campos['cuerpo'],
        ]]]]);
    } else {
        quitarDelIndice($ruta, 'es');
    }
}

/**
 * Listado completo para el panel (incluidos borradores). Exige sesión.
 */
function listarNoticiasAdmin(): array
{
    exigirSesion();
    return array_map('noticiaAdminDeFila', noticiasAdminBd());
}

/**
 * Crea una noticia como borrador (o publicada si lo hace el administrador).
 */
function crearNoticia(array $datos): array
{
    $usuario = exigirRol('editor', 'admin', 'secretaria');
    $campos = camposNoticia($datos, null, $usuario);
    $campos['autor'] = (string) ($usuario['usuario'] ?? '');
    $id = insertarNoticiaBd($campos);
    sincronizarIndiceNoticia($campos, null);
    registrarAuditoria('crear', 'noticias', (string) $id, ['estado' => $campos['estado']]);
    return noticiaAdminDeFila(noticiaPorIdBd($id));
}

/**
 * Actualiza una noticia. Tocar una publicada exige administrador.
 */
function actualizarNoticia(int $id, array $datos): array
{
    $usuario = exigirRol('editor', 'admin', 'secretaria');
    $actual = noticiaPorIdBd($id);
    if ($actual === null) {
        noEncontrado('Noticia no encontrada.');
    }
    $campos = camposNoticia($datos, $actual, $usuario);
    actualizarNoticiaBd($id, $campos);
    sincronizarIndiceNoticia($campos, '/noticias/' . $actual['slug']);
    registrarAuditoria('actualizar', 'noticias', (string) $id, ['estado' => $campos['estado']]);
    return noticiaAdminDeFila(noticiaPorIdBd($id));
}

/**
 * Elimina una noticia. Solo el administrador.
 */
function eliminarNoticia(int $id): array
{
    exigirRol('admin');
    $actual = noticiaPorIdBd($id);
    if ($actual === null) {
        noEncontrado('Noticia no encontrada.');
    }
    eliminarNoticiaBd($id);
    quitarDelIndice('/noticias/' . $actual['slug'], 'es');
    registrarAuditoria('eliminar', 'noticias', (string) $id);
    return ['id' => $id];
}

/**
 * Listado público: publicadas y vigentes, con filtros de tipo, texto y
 * paginación acotados.
 */
function noticiasPublicas(array $filtros): array
{
    $tipo = in_array($filtros['tipo'] ?? null, ['noticia', 'comunicado'], true) ? $filtros['tipo'] : null;
    $limite = max(1, min(50, (int) ($filtros['limite'] ?? 12)));
    $pagina = max(1, (int) ($filtros['pagina'] ?? 1));
    $texto = mb_substr(trim((string) ($filtros['q'] ?? '')), 0, 120);
    [$filas, $total] = noticiasPublicasBd($tipo, $texto, $limite, ($pagina - 1) * $limite);
    return ['items' => array_map('noticiaPublicaDeFila', $filas), 'total' => $total];
}

/**
 * Una noticia publicada por su slug, con el cuerpo. 404 si no es visible.
 */
function noticiaPublica(string $slug): array
{
    $fila = noticiaPublicaPorSlugBd($slug);
    if ($fila === null) {
        noEncontrado('Noticia no encontrada.');
    }
    return noticiaPublicaDeFila($fila, true);
}

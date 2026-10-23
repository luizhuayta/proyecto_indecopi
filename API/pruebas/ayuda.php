<?php
declare(strict_types=1);

/**
 * Ayudas compartidas por las pruebas del API: usuarios de prueba, contenido
 * de ejemplo y limpieza de datos. Este archivo no contiene pruebas.
 */

require_once __DIR__ . '/../src/nucleo/sesion.php';

/**
 * Crea (o recrea) un usuario administrador de pruebas y devuelve su id.
 */
function usuarioAdminPaginas(): int
{
    $pdo = conexion();
    $pdo->prepare("DELETE FROM usuarios WHERE usuario = 'adminpaginas'")->execute();
    $stmt = $pdo->prepare(
        "INSERT INTO usuarios (usuario, hash_contrasena, rol, activo) VALUES (?, ?, 'admin', 1)"
    );
    $stmt->execute(['adminpaginas', password_hash('ClavePrueba123', PASSWORD_DEFAULT)]);
    return (int) $pdo->lastInsertId();
}

/**
 * Elimina una página de pruebas y sus revisiones (para ejecuciones repetidas).
 */
function limpiarPaginaPrueba(string $slug): void
{
    $pdo = conexion();
    $pdo->prepare('DELETE FROM revisiones WHERE slug = ?')->execute([$slug]);
    $pdo->prepare('DELETE FROM paginas WHERE slug = ?')->execute([$slug]);
}

/**
 * Bloque richText de pruebas.
 */
function bloqueRichTextPrueba(string $texto): array
{
    return [
        'id' => 'bloque-prueba',
        'type' => 'richText',
        'hidden' => false,
        'layout' => ['width' => 'full', 'padding' => '', 'background' => ''],
        'props' => ['title' => '', 'lastUpdated' => '', 'body' => '<p>' . $texto . '</p>'],
    ];
}

/**
 * Contenido válido de una página de pruebas (un bloque richText).
 */
function contenidoPrueba(string $texto): array
{
    return ['schemaVersion' => 1, 'blocks' => [bloqueRichTextPrueba($texto)]];
}

/**
 * Texto plano del cuerpo del primer bloque de un contenido.
 */
function textoDeContenido(array $contenido): string
{
    $cuerpo = $contenido['blocks'][0]['props']['body'] ?? '';
    return trim(strip_tags((string) $cuerpo));
}

/**
 * Slugs fijos que usan las pruebas de páginas (y que quedarían en la base de
 * desarrollo si no se borraran al terminar).
 */
const SLUGS_PRUEBA_PAGINAS = [
    'versionvieja', 'versionok', 'publica1', 'historial1', 'restaurar1',
    'tipomalo', 'cero1', 'blank1', 'duplicado1', 'menuvisible', 'menuoculta',
];

/**
 * Limpieza final: borra las páginas y revisiones creadas por las pruebas (por
 * slug) y el usuario de pruebas `adminpaginas`. Se ejecuta al terminar toda la
 * suite, tras el resumen del corredor.
 */
function limpiarTrasPruebasDePaginas(): void
{
    try {
        foreach (SLUGS_PRUEBA_PAGINAS as $slug) {
            limpiarPaginaPrueba($slug);
        }
        conexion()->prepare("DELETE FROM usuarios WHERE usuario = 'adminpaginas'")->execute();
    } catch (Throwable $e) {
        // Sin base de datos o error transitorio: la limpieza es lo mejor posible.
    }
}

register_shutdown_function('limpiarTrasPruebasDePaginas');

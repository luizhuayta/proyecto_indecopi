<?php
declare(strict_types=1);

/**
 * Controladores HTTP del módulo de sesión y usuarios.
 * Traducen la petición (método, ruta, cuerpo) a llamadas al servicio y envían
 * la respuesta JSON.
 */

require_once __DIR__ . '/../../http/respuesta.php';
require_once __DIR__ . '/../../nucleo/csr.php';
require_once __DIR__ . '/servicio.php';

/**
 * Cuerpo JSON de la petición como array (vacío si no lo hay).
 */
function cuerpoJson(): array
{
    $bruto = file_get_contents('php://input') ?: '';
    $datos = json_decode($bruto, true);
    return is_array($datos) ? $datos : [];
}

/**
 * POST /auth/login
 */
function controladorLogin(): void
{
    $cuerpo = cuerpoJson();
    $usuario = (string) ($cuerpo['usuario'] ?? '');
    $contrasena = (string) ($cuerpo['contrasena'] ?? '');
    json_out(autenticarUsuario($usuario, $contrasena), 200);
}

/**
 * POST /auth/logout
 */
function controladorLogout(): void
{
    cerrarSesion();
    json_out(['ok' => true], 200);
}

/**
 * GET /auth/me
 */
function controladorMe(): void
{
    json_out(estadoSesion(), 200);
}

/**
 * GET /auth/usuarios
 */
function controladorListarUsuarios(): void
{
    json_out(listarUsuarios(), 200);
}

/**
 * POST /auth/usuarios
 */
function controladorCrearUsuario(): void
{
    exigirCsrf();
    json_out(crearUsuario(cuerpoJson()), 201);
}

/**
 * PATCH /auth/usuarios/{id}
 */
function controladorActualizarUsuario(int $id): void
{
    exigirCsrf();
    json_out(actualizarUsuario($id, cuerpoJson()), 200);
}

/**
 * PUT /auth/password
 */
function controladorCambiarContrasena(): void
{
    exigirCsrf();
    json_out(cambiarContrasena(cuerpoJson()), 200);
}

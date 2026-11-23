<?php
declare(strict_types=1);

/**
 * Controladores HTTP del módulo de mensajes.
 */

require_once __DIR__ . '/../../http/respuesta.php';
require_once __DIR__ . '/../../nucleo/csr.php';
require_once __DIR__ . '/servicio.php';

/**
 * POST /mensajes — alta desde el formulario público.
 */
function controladorCrearMensaje(): void
{
    exigirCsrf();
    $cuerpo = cuerpoJson();
    $tipo = (string) ($cuerpo['tipo'] ?? 'contacto');
    $mensaje = crearMensaje($cuerpo, $tipo);
    json_out([
        'ticket' => $mensaje['ticket'],
        'estado' => $mensaje['estado'],
    ], 201);
}

/**
 * GET /mensajes — bandeja del panel.
 */
function controladorListarMensajes(): void
{
    json_out([
        'items' => listarMensajes([
            'tipo' => $_GET['tipo'] ?? null,
            'estado' => $_GET['estado'] ?? null,
        ]),
    ]);
}

/**
 * POST /mensajes/{id}/responder — responde un mensaje.
 */
function controladorResponderMensaje(int $id): void
{
    exigirCsrf();
    $cuerpo = cuerpoJson();
    $respuesta = (string) ($cuerpo['respuesta'] ?? '');
    $notificar = (bool) ($cuerpo['notificar'] ?? false);
    json_out(responderMensaje($id, $respuesta, $notificar));
}

/**
 * POST /mensajes/{id}/archivar — saca un mensaje del flujo de la bandeja.
 */
function controladorArchivarMensaje(int $id): void
{
    exigirCsrf();
    json_out(archivarMensaje($id));
}

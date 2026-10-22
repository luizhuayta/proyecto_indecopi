<?php
declare(strict_types=1);

/**
 * Pruebas del módulo de mensajes: alta desde el formulario público, ticket,
 * estados, bandeja en el panel y respuesta.
 */

require_once __DIR__ . '/../src/modulos/mensajes/servicio.php';
require_once __DIR__ . '/ayuda.php';

probar('el mensaje guarda y devuelve un ticket', function () {
    conexion()->exec("DELETE FROM mensajes WHERE ticket LIKE 'MSG-TEST-%'");
    $r = crearMensaje([
        'nombre' => 'Ana', 'correo' => 'a@b.test',
        'asunto' => 'Prueba', 'mensaje' => 'Hola',
    ], 'contacto');
    afirmar(str_starts_with((string) $r['ticket'], 'MSG-'), 'debe devolver ticket');
    afirmar($r['estado'] === 'pendiente', 'debe quedar pendiente');
});

probar('el correo con direccion invalida se rechaza', function () {
    intentar(function () {
        crearMensaje(['nombre' => 'Ana', 'correo' => 'no-es-correo', 'asunto' => 'x', 'mensaje' => 'y'], 'contacto');
    });
    afirmar(error_ultimo_codigo() === 400, 'debe responder 400');
});

probar('el mensaje exige el mensaje y el correo, no el nombre ni el asunto', function () {
    intentar(function () {
        crearMensaje(['correo' => 'a@b.test'], 'contacto');
    });
    afirmar(error_ultimo_codigo() === 400, 'debe responder 400 sin mensaje');

    $r = crearMensaje(['correo' => 'a@b.test', 'mensaje' => 'Hola'], 'contacto');
    afirmar(str_starts_with((string) $r['ticket'], 'MSG-'), 'debe guardarlo sin nombre ni asunto');
});

probar('la bandeja solo ve los mensajes del tipo pedido', function () {
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        crearMensaje(['nombre' => 'Ana', 'correo' => 'a@b.test', 'asunto' => 'A', 'mensaje' => 'x'], 'contacto');
        crearMensaje(['nombre' => 'Luis', 'correo' => 'c@d.test', 'asunto' => 'B', 'mensaje' => 'y'], 'reclamo');
        $tipos = array_column(listarMensajes(['tipo' => 'reclamo']), 'tipo');
        afirmar(count($tipos) >= 1, 'debe listar al menos un reclamo');
        afirmar(count(array_filter($tipos, fn ($t) => $t === 'contacto')) === 0, 'no debe listar contactos');
    } finally {
        $pdo->rollBack();
    }
});

probar('responder un mensaje cambia su estado y guarda la respuesta', function () {
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        $r = crearMensaje(['nombre' => 'Ana', 'correo' => 'a@b.test', 'asunto' => 'A', 'mensaje' => 'x'], 'contacto');
        $respondido = responderMensaje((int) $r['id'], 'Prueba de respuesta', false);
        afirmar($respondido['estado'] === 'respondido', 'debe quedar respondido');
        afirmar(str_contains((string) $respondido['respuesta'], 'Prueba de respuesta'), 'debe guardar la respuesta');
    } finally {
        $pdo->rollBack();
    }
});

probar('la bandeja del panel exige sesion', function () {
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        fijarSesionDePrueba(null);
        intentar(function () { listarMensajes([]); });
        afirmar(error_ultimo_codigo() === 401, 'debe responder 401');
    } finally {
        $pdo->rollBack();
    }
});

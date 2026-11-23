<?php
declare(strict_types=1);

/**
 * Pruebas del módulo de mensajes: alta desde el formulario público, ticket,
 * estados, bandeja en el panel y respuesta.
 */

require_once __DIR__ . '/../src/modulos/mensajes/servicio.php';
require_once __DIR__ . '/ayuda.php';

probar('el mensaje guarda y devuelve un ticket', function () {
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        $r = crearMensaje([
            'nombre' => 'Ana', 'correo' => 'a@b.test',
            'asunto' => 'Prueba', 'mensaje' => 'Hola',
        ], 'contacto');
        afirmar(str_starts_with((string) $r['ticket'], 'MSG-'), 'debe devolver ticket');
        afirmar($r['estado'] === 'pendiente', 'debe quedar pendiente');
    } finally {
        $pdo->rollBack();
    }
});

probar('el correo con direccion invalida se rechaza', function () {
    intentar(function () {
        crearMensaje(['nombre' => 'Ana', 'correo' => 'no-es-correo', 'asunto' => 'x', 'mensaje' => 'y'], 'contacto');
    });
    afirmar(error_ultimo_codigo() === 400, 'debe responder 400');
});

probar('el mensaje exige el mensaje y el correo, no el nombre ni el asunto', function () {
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        intentar(function () {
            crearMensaje(['correo' => 'a@b.test'], 'contacto');
        });
        afirmar(error_ultimo_codigo() === 400, 'debe responder 400 sin mensaje');

        $r = crearMensaje(['correo' => 'a@b.test', 'mensaje' => 'Hola'], 'contacto');
        afirmar(str_starts_with((string) $r['ticket'], 'MSG-'), 'debe guardarlo sin nombre ni asunto');
    } finally {
        $pdo->rollBack();
    }
});

probar('el reclamo guarda el documento y exige consentimiento', function () {
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        intentar(function () {
            crearMensaje([
                'correo' => 'a@b.test', 'mensaje' => 'Sin autorización',
            ], 'reclamo');
        });
        afirmar(error_ultimo_codigo() === 400, 'debe responder 400 sin consentimiento');

        $r = crearMensaje([
            'nombre' => 'Ana', 'documento' => '12345678', 'correo' => 'a@b.test',
            'mensaje' => 'Hola', 'consentimiento' => true,
        ], 'reclamo');
        $items = listarMensajes(['tipo' => 'reclamo']);
        $guardado = null;
        foreach ($items as $item) {
            if ((int) $item['id'] === (int) $r['id']) {
                $guardado = $item;
                break;
            }
        }
        afirmar($guardado !== null, 'el reclamo debe aparecer en la bandeja');
        afirmar(($guardado['documento'] ?? '') === '12345678', 'debe guardar el documento');
        afirmar(($guardado['consentimiento'] ?? false) === true, 'debe guardar el consentimiento');
    } finally {
        $pdo->rollBack();
    }
});

probar('el tramite guarda tipo, documento y consentimiento propios', function () {
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        $r = crearMensaje([
            'nombre' => 'Ana', 'documento' => '87654321', 'correo' => 'a@b.test',
            'asunto' => 'Constancia', 'mensaje' => 'Solicito constancia de estudios.',
            'consentimiento' => true,
        ], 'tramite');
        afirmar($r['tipo'] === 'tramite', 'debe conservar el tipo tramite');

        $items = listarMensajes(['tipo' => 'tramite']);
        $guardado = null;
        foreach ($items as $item) {
            if ((int) $item['id'] === (int) $r['id']) {
                $guardado = $item;
                break;
            }
        }
        afirmar($guardado !== null, 'el tramite debe aparecer en la bandeja filtrada por tipo');
        afirmar(($guardado['documento'] ?? '') === '87654321', 'debe guardar el documento');
        afirmar(($guardado['consentimiento'] ?? false) === true, 'debe guardar el consentimiento');
    } finally {
        $pdo->rollBack();
    }
});

probar('la bandeja solo ve los mensajes del tipo pedido', function () {
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        crearMensaje(['nombre' => 'Ana', 'correo' => 'a@b.test', 'asunto' => 'A', 'mensaje' => 'x'], 'contacto');
        crearMensaje([
            'nombre' => 'Luis', 'correo' => 'c@d.test', 'asunto' => 'B',
            'mensaje' => 'y', 'consentimiento' => true,
        ], 'reclamo');
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

probar('archivar un mensaje lo pasa a archivado', function () {
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        $r = crearMensaje(['nombre' => 'Ana', 'correo' => 'a@b.test', 'asunto' => 'A', 'mensaje' => 'x'], 'contacto');
        $archivado = archivarMensaje((int) $r['id']);
        afirmar($archivado['estado'] === 'archivado', 'debe quedar archivado');

        $pendientes = array_column(listarMensajes(['estado' => 'pendiente']), 'id');
        afirmar(!in_array((int) $r['id'], $pendientes, true), 'no debe listar como pendiente');
        $archivados = array_column(listarMensajes(['estado' => 'archivado']), 'id');
        afirmar(in_array((int) $r['id'], $archivados, true), 'debe listar como archivado');

        intentar(function () { archivarMensaje(999999); });
        afirmar(error_ultimo_codigo() === 404, 'debe responder 404 si no existe');
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

probar('construirCorreo elimina saltos de linea y cabeceras inyectadas', function () {
    $correo = construirCorreo(
        'portal@institucion.test',
        "a@b.test\r\nBcc: evil@b.test",
        "Asunto\r\nBcc: evil@b.test",
        'Hola'
    );
    afirmar(!str_contains($correo, 'Bcc'), 'no debe contener cabeceras Bcc');
    afirmar(!str_contains($correo, 'evil@b.test'), 'no debe contener el destinatario inyectado');
    afirmar(preg_match('/^To: (.+)$/m', $correo, $linea) === 1 && trim($linea[1]) === 'a@b.test', 'la linea To debe quedar sola y limpia');
});

/** Fija (y devuelve) el par SMTP_* para la prueba que llama. */
function fijarSmtpPrueba(string $host, string $remitente): void
{
    $_ENV['SMTP_HOST'] = $host;
    putenv("SMTP_HOST=$host");
    $_ENV['SMTP_REMITENTE'] = $remitente;
    putenv("SMTP_REMITENTE=$remitente");
}

probar('sin SMTP configurado el mensaje se guarda y queda sin notificar', function () {
    fijarSmtpPrueba('', '');
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        $r = crearMensaje(['nombre' => 'Ana', 'correo' => 'a@b.test', 'asunto' => 'A', 'mensaje' => 'x'], 'contacto');
        $fila = mensajePorIdBd((int) $r['id']);
        afirmar($fila !== null, 'el mensaje debe guardarse igual');
        afirmar((int) ($fila['notificado'] ?? 0) === 0, 'notificado debe quedar en 0');
    } finally {
        fijarSmtpPrueba('', '');
        $pdo->rollBack();
    }
});

probar('un SMTP inalcanzable no impide guardar el mensaje', function () {
    fijarSmtpPrueba('127.0.0.1', 'avisos@institucion.test');
    $_ENV['SMTP_PORT'] = '1';
    putenv('SMTP_PORT=1');
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        $r = crearMensaje(['nombre' => 'Ana', 'correo' => 'a@b.test', 'asunto' => 'A', 'mensaje' => 'x'], 'contacto');
        $fila = mensajePorIdBd((int) $r['id']);
        afirmar($fila !== null, 'el mensaje debe guardarse aunque el correo falle');
        afirmar((int) ($fila['notificado'] ?? 0) === 0, 'notificado debe quedar en 0 si el envio fallo');
    } finally {
        fijarSmtpPrueba('', '');
        $_ENV['SMTP_PORT'] = '465';
        putenv('SMTP_PORT=465');
        $pdo->rollBack();
    }
});

probar('responder pidiendo aviso sin SMTP deja notificado en falso', function () {
    fijarSmtpPrueba('', '');
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        fijarSesionDePrueba(usuarioAdminPaginas());
        $r = crearMensaje(['nombre' => 'Ana', 'correo' => 'a@b.test', 'asunto' => 'A', 'mensaje' => 'x'], 'contacto');
        $respondido = responderMensaje((int) $r['id'], 'Prueba de respuesta', true);
        afirmar($respondido['estado'] === 'respondido', 'debe quedar respondido');
        afirmar($respondido['notificado'] === false, 'notificado debe reflejar que no se envio nada');
    } finally {
        fijarSmtpPrueba('', '');
        $pdo->rollBack();
    }
});

probar('el reporte de accesibilidad se guarda sin correo y llega a su bandeja', function () {
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        fijarSesionDePrueba(usuarioAdminPaginas());
        // Sin consentimiento y sin correo: en un reporte de barreras lo
        // importante es la descripción, no los datos de quien avisa.
        $r = crearMensaje([
            'mensaje' => 'El menú no se puede usar solo con teclado.',
            'ruta' => '/contacto',
        ], 'accesibilidad');
        afirmar($r['tipo'] === 'accesibilidad', 'debe conservar el tipo accesibilidad');
        afirmar(str_starts_with((string) $r['ticket'], 'MSG-'), 'debe devolver ticket');

        $items = listarMensajes(['tipo' => 'accesibilidad']);
        $guardado = null;
        foreach ($items as $item) {
            if ((int) $item['id'] === (int) $r['id']) {
                $guardado = $item;
                break;
            }
        }
        afirmar($guardado !== null, 'el reporte debe aparecer en la bandeja filtrada por tipo');
        afirmar(($guardado['correo'] ?? '') === '', 'el correo puede quedar vacío');
        afirmar(($guardado['ruta'] ?? '') === '/contacto', 'la bandeja debe devolver la ruta de origen');
        $contactos = array_column(listarMensajes(['tipo' => 'contacto']), 'id');
        afirmar(!in_array((int) $r['id'], $contactos, true), 'no debe colarse en la bandeja de contacto');
    } finally {
        $pdo->rollBack();
    }
});

probar('el correo del reporte de accesibilidad se valida solo si se escribe', function () {
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        intentar(function () {
            crearMensaje(['correo' => 'no-es-correo', 'mensaje' => 'x'], 'accesibilidad');
        });
        afirmar(error_ultimo_codigo() === 400, 'un correo mal formado se rechaza');

        $r = crearMensaje([
            'correo' => 'ana@b.test',
            'mensaje' => 'El lector de pantalla no anuncia el carrusel.',
            'ruta' => '/',
        ], 'accesibilidad');
        afirmar($r['tipo'] === 'accesibilidad', 'debe conservar el tipo accesibilidad');
        afirmar(str_starts_with((string) $r['ticket'], 'MSG-'), 'con correo válido se guarda');
    } finally {
        $pdo->rollBack();
    }
});

probar('los demás tipos siguen exigiendo el correo', function () {
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        intentar(function () {
            crearMensaje(['mensaje' => 'Sin correo'], 'contacto');
        });
        afirmar(error_ultimo_codigo() === 400, 'contacto sin correo debe responder 400');
    } finally {
        $pdo->rollBack();
    }
});

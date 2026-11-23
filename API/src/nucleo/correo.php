<?php
declare(strict_types=1);

/**
 * Envío de correo por SMTP, sin dependencias externas.
 *
 * Ninguna función lanza: un fallo se registra con error_log('[correo] ...')
 * y devuelve false, para que el mensaje o la respuesta que motivaron el
 * aviso ya estén guardados y no se pierdan.
 */

require_once __DIR__ . '/configuracion.php';

/** ¿Hay credenciales SMTP suficientes para avisar por correo? */
function smtpConfigurado(): bool
{
    return configurar('SMTP_HOST') !== '' && configurar('SMTP_REMITENTE') !== '';
}

/**
 * Corta una cabecera en su primer CR/LF: todo lo que sigue a un salto de
 * línea dentro del valor es un intento de inyección de cabeceras y se
 * descarta, no se concatena.
 */
function cabeceraLimpia(string $texto): string
{
    return trim((string) strtok($texto, "\r\n"));
}

/**
 * Construye el mensaje MIME (cabeceras + cuerpo) listo para DATA.
 * Asunto y cuerpo van codificados en UTF-8 (base64), así el contenido
 * nunca se interpreta como cabecera.
 */
function construirCorreo(string $remitente, string $para, string $asunto, string $cuerpo): string
{
    $remitente = cabeceraLimpia($remitente);
    $para = cabeceraLimpia($para);
    $asunto = mb_encode_mimeheader(cabeceraLimpia($asunto), 'UTF-8', 'B', "\r\n");
    $nombre = cabeceraLimpia(configurar('SMTP_REMITENTE_NOMBRE'));
    $de = $nombre !== ''
        ? mb_encode_mimeheader($nombre, 'UTF-8', 'B', "\r\n") . " <$remitente>"
        : $remitente;

    return "From: $de\r\n"
        . "To: $para\r\n"
        . "Subject: $asunto\r\n"
        . "MIME-Version: 1.0\r\n"
        . "Content-Type: text/plain; charset=UTF-8\r\n"
        . "Content-Transfer-Encoding: base64\r\n"
        . "\r\n"
        . chunk_split(base64_encode($cuerpo));
}

/** Lee una respuesta SMTP (posiblemente multilinea) y confirma su código. */
function smtpLeer($socket, string $esperado): bool
{
    $respuesta = '';
    while (($linea = fgets($socket)) !== false) {
        $respuesta .= $linea;
        // Línea "250-..." continúa; "250 ..." cierra la respuesta.
        if (strlen($linea) < 4 || $linea[3] === ' ') {
            break;
        }
    }
    if (!str_starts_with($respuesta, $esperado)) {
        error_log('[correo] SMTP esperaba ' . $esperado . ' y recibio: ' . trim($respuesta));
        return false;
    }
    return true;
}

/** Envía una orden SMTP y confirma su código de respuesta. */
function smtpOrden($socket, string $orden, string $esperado): bool
{
    if (@fwrite($socket, $orden . "\r\n") === false) {
        error_log("[correo] no se pudo enviar la orden: $orden");
        return false;
    }
    return smtpLeer($socket, $esperado);
}

/**
 * Envía un correo y devuelve true solo si el servidor aceptó el mensaje.
 * `$config` permite sobreescribir host, puerto, cifrado, remitente,
 * usuario y clave (útil en pruebas).
 */
function enviarCorreo(string $para, string $asunto, string $cuerpo, ?array $config = null): bool
{
    $conf = $config ?? [];
    $host = (string) ($conf['host'] ?? configurar('SMTP_HOST'));
    $remitente = (string) ($conf['remitente'] ?? configurar('SMTP_REMITENTE'));
    $puerto = (int) ($conf['puerto'] ?? configurar('SMTP_PORT', '465'));
    $cifrado = (string) ($conf['cifrado'] ?? configurar('SMTP_CIFRADO', 'ssl'));

    // Rechazar cabeceras malformadas: el llamador debe enviar valores de una
    // sola línea; concatenarlas aquí sería una inyección de cabeceras.
    foreach ([$remitente, $para, $asunto] as $cabecera) {
        if (strpbrk($cabecera, "\r\n") !== false) {
            error_log('[correo] cabecera con saltos de linea, envio rechazado');
            return false;
        }
    }
    if ($host === '' || $remitente === '' || cabeceraLimpia($para) === '') {
        return false;
    }

    $destino = ($cifrado === 'ssl' ? 'ssl://' : 'tcp://') . $host . ':' . $puerto;
    $socket = @stream_socket_client($destino, $errno, $errstr, 10);
    if ($socket === false) {
        error_log("[correo] conexion a $destino fallo: $errstr");
        return false;
    }

    try {
        stream_set_timeout($socket, 10);
        if (!smtpLeer($socket, '220')) {
            return false;
        }
        if (!smtpOrden($socket, 'EHLO localhost', '250')) {
            return false;
        }
        if ($cifrado === 'tls') {
            if (!smtpOrden($socket, 'STARTTLS', '220')) {
                return false;
            }
            if (!@stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                error_log('[correo] el intercambio STARTTLS fallo');
                return false;
            }
            if (!smtpOrden($socket, 'EHLO localhost', '250')) {
                return false;
            }
        }
        $usuario = (string) ($conf['usuario'] ?? configurar('SMTP_USUARIO'));
        if ($usuario !== '') {
            $clave = (string) ($conf['clave'] ?? configurar('SMTP_CLAVE'));
            if (!smtpOrden($socket, 'AUTH LOGIN', '334')
                || !smtpOrden($socket, base64_encode($usuario), '334')
                || !smtpOrden($socket, base64_encode($clave), '235')) {
                return false;
            }
        }
        if (!smtpOrden($socket, "MAIL FROM:<$remitente>", '250')
            || !smtpOrden($socket, 'RCPT TO:<' . cabeceraLimpia($para) . '>', '250')
            || !smtpOrden($socket, 'DATA', '354')) {
            return false;
        }

        // Dot-stuffing: una línea que empieza con punto se duplica para que
        // el SMTP no la confunda con el fin del mensaje.
        $mensaje = preg_replace('/^\./m', '..', construirCorreo($remitente, $para, $asunto, $cuerpo));
        if (@fwrite($socket, $mensaje . "\r\n.\r\n") === false) {
            error_log('[correo] no se pudo escribir el cuerpo del mensaje');
            return false;
        }
        if (!smtpLeer($socket, '250')) {
            return false;
        }
        @fwrite($socket, "QUIT\r\n");
        return true;
    } finally {
        fclose($socket);
    }
}

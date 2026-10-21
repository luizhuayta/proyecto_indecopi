<?php
declare(strict_types=1);

/**
 * Saneado de HTML y validación de enlaces.
 * Portado de API/sanitize.php (Matt): sanitize_html() y validate_link_value().
 *
 * El texto enriquecido (campos de tipo 'rich' de los bloques) pasa por una
 * lista blanca de etiquetas y atributos: sin script, sin manejadores on* y con
 * los enlaces javascript:/data:/vbscript: rechazados. Los enlaces internos
 * deben empezar por '/' o ser http/https.
 */

/**
 * Lista blanca de etiquetas y de los atributos permitidos en cada una.
 */
function etiquetasSaneadoPermitidas(): array
{
    return [
        'p' => [],
        'br' => [],
        'strong' => [],
        'b' => [],
        'em' => [],
        'i' => [],
        'u' => [],
        'h2' => [],
        'ul' => [],
        'ol' => [],
        'li' => [],
        'a' => ['href'],
    ];
}

/**
 * Sanea un fragmento de HTML dejando solo las etiquetas y atributos de la
 * lista blanca. Baja los h1 a p y los h3 a h2, quita script/style/iframe y
 * toda etiqueta fuera de la lista, elimina los manejadores on* y los enlaces
 * con protocolo javascript:, data: o vbscript:.
 *
 * Devuelve el HTML limpio (cadena vacía si la entrada es null o vacía).
 */
function sanearHtml(?string $html): string
{
    if ($html === null) {
        return '';
    }
    $html = trim($html);
    if ($html === '') {
        return '';
    }

    $permitidas = etiquetasSaneadoPermitidas();
    $dom = new DOMDocument();
    $previo = libxml_use_internal_errors(true);
    $envuelto = '<div id="cms-root">' . $html . '</div>';
    $dom->loadHTML('<?xml encoding="UTF-8">' . $envuelto, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
    libxml_clear_errors();
    libxml_use_internal_errors($previo);

    $raiz = $dom->getElementById('cms-root');
    if (!$raiz) {
        return strip_tags($html, '<p><br><strong><b><em><i><u><h2><ul><ol><li><a>');
    }

    sanearNodoDom($raiz, $permitidas);

    $salida = '';
    foreach (iterator_to_array($raiz->childNodes) as $hijo) {
        $salida .= $dom->saveHTML($hijo);
    }
    return $salida;
}

/**
 * Recorre un nodo y sus hijos aplicando la lista blanca. Las etiquetas no
 * permitidas (script, style, iframe, span, ...) se eliminan por completo,
 * incluido su contenido.
 */
function sanearNodoDom(DOMNode $nodo, array $permitidas): void
{
    $eliminar = [];
    foreach (iterator_to_array($nodo->childNodes) as $hijo) {
        if ($hijo instanceof DOMComment) {
            $eliminar[] = $hijo;
            continue;
        }
        if ($hijo instanceof DOMText) {
            continue;
        }
        if (!$hijo instanceof DOMElement) {
            $eliminar[] = $hijo;
            continue;
        }

        $etiqueta = strtolower($hijo->tagName);

        // Los títulos grandes se bajan: h1 -> p, h3 -> h2.
        if ($etiqueta === 'h1' || $etiqueta === 'h3') {
            $doc = $hijo->ownerDocument;
            if (!$doc) {
                $eliminar[] = $hijo;
                continue;
            }
            $reemplazo = $doc->createElement($etiqueta === 'h1' ? 'p' : 'h2');
            while ($hijo->firstChild) {
                $reemplazo->appendChild($hijo->firstChild);
            }
            $hijo->parentNode?->replaceChild($reemplazo, $hijo);
            sanearNodoDom($reemplazo, $permitidas);
            continue;
        }

        if ($etiqueta === 'script' || $etiqueta === 'style' || $etiqueta === 'iframe' || !isset($permitidas[$etiqueta])) {
            $eliminar[] = $hijo;
            continue;
        }

        $mantener = $permitidas[$etiqueta];
        foreach (iterator_to_array($hijo->attributes ?? []) as $atributo) {
            $nombre = strtolower($atributo->name);
            if (str_starts_with($nombre, 'on') || !in_array($nombre, $mantener, true)) {
                $hijo->removeAttribute($atributo->name);
                continue;
            }
            if ($nombre === 'href') {
                $href = trim((string) $atributo->value);
                if ($href === '' || preg_match('#^\s*(javascript|data|vbscript):#i', $href)) {
                    $hijo->removeAttribute('href');
                }
            }
        }

        sanearNodoDom($hijo, $permitidas);
    }

    foreach ($eliminar as $muerto) {
        $nodo->removeChild($muerto);
    }
}

/**
 * Valida el valor de un enlace. Devuelve null si es válido y un mensaje en
 * español si no lo es.
 *
 * Acepta rutas internas que empiezan por '/', enlaces http/https, mailto:,
 * tel: y el marcador '#' (o vacío) como enlace pendiente. Rechaza
 * javascript:, data:, vbscript: y cualquier otro valor.
 */
function validarEnlace(mixed $valor): ?string
{
    if ($valor === null) {
        return null;
    }
    if (!is_string($valor)) {
        return 'El enlace debe ser un texto.';
    }
    $texto = trim($valor);
    if ($texto === '' || $texto === '#') {
        return null;
    }
    if (str_starts_with($texto, '/')) {
        return null;
    }
    if (preg_match('#^https?://#i', $texto) === 1) {
        return null;
    }
    if (preg_match('#^(mailto|tel):#i', $texto) === 1) {
        return null;
    }
    return 'Usa una ruta interna (por ejemplo /contacto) o un enlace https://.';
}

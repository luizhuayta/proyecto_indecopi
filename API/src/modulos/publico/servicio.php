<?php
declare(strict_types=1);

require_once __DIR__ . '/repositorio.php';
require_once __DIR__ . '/../paginas/servicio.php';
require_once __DIR__ . '/../identidad/servicio.php';
require_once __DIR__ . '/../../nucleo/documento.php';
require_once __DIR__ . '/../../nucleo/csr.php';

/** Resuelve valores de texto sin cambiar claves, tipos ni identificadores. */
function resolverValoresPublicos(mixed $valor, array $institucion): mixed
{
    if (is_string($valor)) {
        return resolverTokens($valor, $institucion);
    }
    if (is_array($valor)) {
        foreach ($valor as $clave => $hijo) {
            $valor[$clave] = resolverValoresPublicos($hijo, $institucion);
        }
    }
    return $valor;
}

/** En campos HTML la identidad es texto, nunca marcado proporcionado por el administrador. */
function resolverPropsPublicas(array $props, array $esquema, array $institucion): array
{
    $salida = resolverValoresPublicos($props, $institucion);
    $escapada = array_map(static fn ($valor): string => htmlspecialchars((string) $valor, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'), $institucion);
    foreach ($esquema as $campo) {
        $ruta = $campo['path'] ?? '';
        $tipo = $campo['type'] ?? '';
        if (!array_key_exists($ruta, $props)) {
            continue;
        }
        $valor = $props[$ruta];
        if ($tipo === 'rich' && is_string($valor)) {
            $salida[$ruta] = sanearHtml(resolverTokens($valor, $escapada));
        } elseif ($tipo === 'group' && is_array($valor)) {
            $salida[$ruta] = resolverPropsPublicas($valor, $campo['children'] ?? [], $institucion);
        } elseif ($tipo === 'list' && is_array($valor)) {
            foreach ($valor as $i => $item) {
                if (is_array($item)) {
                    $salida[$ruta][$i] = resolverPropsPublicas($item, $campo['item'] ?? [], $institucion);
                }
            }
        }
    }
    return $salida;
}

function resolverContenidoPublico(array $contenido, array $institucion): array
{
    $salida = resolverValoresPublicos($contenido, $institucion);
    foreach ($contenido['blocks'] ?? [] as $i => $bloque) {
        $esquema = catalogoBloques()[$bloque['type'] ?? '']['schema'] ?? [];
        // Partir del original evita resolver dos veces tokens insertados por otro valor.
        $salida['blocks'][$i]['props'] = resolverPropsPublicas($bloque['props'] ?? [], $esquema, $institucion);
    }
    return $salida;
}

function paginaPublicaPorRuta(string $ruta, string $locale): ?array
{
    $slug = slugPublicadoPorRuta($ruta, $locale);
    $pagina = $slug === null ? null : paginaPublicada($slug, $locale);
    if ($pagina !== null) {
        $institucion = identidad();
        $pagina['contenido'] = resolverContenidoPublico($pagina['contenido'], $institucion);
        $pagina['titulo'] = resolverTokens($pagina['titulo'], $institucion);
    }
    return $pagina;
}

function sitioPublico(string $locale): array
{
    $institucion = identidad();
    $menu = array_map('resumenPaginaDesdeFila', menuPublicadoBd($locale));
    return [
        'identidad' => $institucion,
        'apariencia' => resolverValoresPublicos(leerDocumento(CLAVE_APARIENCIA, $locale, false)['contenido'], $institucion),
        'menu' => resolverValoresPublicos($menu, $institucion),
        'csrf' => tokenCsrf(),
    ];
}

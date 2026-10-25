/**
 * Resaltado de los términos buscados en los resultados.
 *
 * El texto viene del servidor y el término viene de quien busca: las dos
 * cosas se escapan antes de marcarse, para que ningún contenido publicado
 * pueda inyectar etiquetas en el resultado.
 */

/** Escapa el texto que se devuelve dentro de un HTML. */
export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Escapa los caracteres que tienen significado dentro de una expresión regular. */
function escaparRegExp(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Devuelve el texto con las coincidencias de la consulta marcadas.
 *
 * Solo se consideran términos de dos letras o más: marcar cada «a» de una
 * frase llena de ruido no ayuda a leer. Si no hay términos, el texto se
 * escapa tal cual.
 */
export function resaltar(texto: string, consulta: string): string {
  const limpio = texto ?? '';
  const terminos = (consulta ?? '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((termino) => termino.length >= 2)
    .map(escaparRegExp);
  if (terminos.length === 0) {
    return escaparHtml(limpio);
  }
  const patron = new RegExp(`(${terminos.join('|')})`, 'gi');
  // split con un grupo de captura deja las coincidencias en las posiciones
  // impares: esas son las que se marcan.
  return limpio
    .split(patron)
    .map((parte, indice) =>
      indice % 2 === 1 ? `<mark>${escaparHtml(parte)}</mark>` : escaparHtml(parte),
    )
    .join('');
}

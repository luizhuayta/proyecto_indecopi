import { stripHtml, excerpt, htmlVacio, esHtml } from './html';

/**
 * Las bajadas de la lista de noticias se generan desde el HTML de Quill con
 * `excerpt()` y se pintan como texto (`{{ }}`). Si las entidades quedan sin
 * decodificar, el portal muestra "&nbsp;" crudo (visto en producción).
 */
describe('html utils', () => {
  it('stripHtml decodifica &nbsp; de contenido Quill', () => {
    expect(stripHtml('<p>Con&nbsp;la&nbsp;aplicación&nbsp;de&nbsp;la&nbsp;entrevista</p>')).toBe(
      'Con la aplicación de la entrevista',
    );
  });

  it('excerpt no deja entidades crudas en la bajada', () => {
    const bajada = excerpt(
      '<p>El&nbsp;Instituto&nbsp;de&nbsp;Educación&nbsp;Superior dio inicio al proceso.</p>',
      220,
    );
    expect(bajada).not.toContain('&nbsp;');
    expect(bajada).toContain('El Instituto de Educación Superior');
  });

  it('decodifica entidades comunes y numéricas', () => {
    expect(stripHtml('<p>A &amp; B &lt;C&gt; &quot;D&quot;</p>')).toBe('A & B <C> "D"');
    expect(stripHtml('<p>caf&#233; &#xE9;</p>')).toBe('café é');
  });

  it('no decodifica dos veces &amp;nbsp; literal', () => {
    expect(stripHtml('<p>muestra &amp;nbsp; así</p>')).toBe('muestra &nbsp; así');
  });

  it('conserva el comportamiento existente', () => {
    expect(stripHtml('<p>Hola</p><p>mundo</p>')).toBe('Hola mundo');
    expect(stripHtml('  mucho   espacio  ')).toBe('mucho espacio');
    expect(excerpt('abcde', 4)).toBe('abcd…');
    expect(excerpt('abc', 10)).toBe('abc');
    expect(htmlVacio('<p><br></p>')).toBe(true);
    expect(esHtml('<p>x</p>')).toBe(true);
    expect(esHtml('texto plano')).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { getByPath, setByPath, changedPaths, buscarMarcadores } from './cms.models';

describe('cms.models', () => {
  it('escribe en una ruta anidada sin mutar el original', () => {
    const original = { a: { b: 1 } };
    const next = setByPath(original, 'a.b', 2);
    expect(next).toEqual({ a: { b: 2 } });
    expect(original).toEqual({ a: { b: 1 } });
  });

  it('crea el camino que falta', () => {
    const next = setByPath({}, 'lista.0.campo', 'x');
    expect(next).toEqual({ lista: [{ campo: 'x' }] });
  });

  it('getByPath devuelve undefined si no existe', () => {
    expect(getByPath({ a: 1 }, 'a.b.c')).toBeUndefined();
    expect(getByPath(null, 'a.b')).toBeUndefined();
  });

  it('changedPaths detecta la hoja que cambio', () => {
    const paths = changedPaths({ a: { b: 1, c: 2 } }, { a: { b: 1, c: 3 } });
    expect(paths).toEqual(['a.c']);
  });

  it('buscarMarcadores encuentra un nombre de institucion sin sustituir', () => {
    const paths = buscarMarcadores({
      bloques: [{ props: { titulo: 'Nombre de la institución' } }],
    });
    expect(paths).toContain('bloques.0.props.titulo');
  });

  it('buscarMarcadores devuelve una ruta por cada marcador', () => {
    const paths = buscarMarcadores({
      a: '{{nombre}}',
      b: 'Dirección',
    });
    expect(paths).toEqual(['a', 'b']);
  });

  it('buscarMarcadores no lanza con contenido vacio', () => {
    expect(() => buscarMarcadores({})).not.toThrow();
    expect(() => buscarMarcadores(null)).not.toThrow();
    expect(() => buscarMarcadores(undefined)).not.toThrow();
    expect(() => buscarMarcadores([])).not.toThrow();
  });
});

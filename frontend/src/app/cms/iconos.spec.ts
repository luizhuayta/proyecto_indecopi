import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ICONOS, iconoSvg } from './iconos';

describe('iconos', () => {
  it('renderiza un icono de la lista blanca como referencia al sprite', () => {
    expect(iconoSvg('graduacion')).toBe(
      '<svg class="icono" aria-hidden="true" focusable="false"><use href="/iconos.svg#graduacion"></use></svg>',
    );
  });

  it('ignora nombres desconocidos o maliciosos', () => {
    expect(iconoSvg('bi-calendar3')).toBe('');
    expect(iconoSvg('x" onload="alert(1)')).toBe('');
    expect(iconoSvg(undefined)).toBe('');
  });

  it('el sprite contiene un símbolo por cada icono declarado', () => {
    const sprite = readFileSync('public/iconos.svg', 'utf8');
    for (const nombre of Object.keys(ICONOS)) {
      expect(sprite).toContain(`<symbol id="${nombre}"`);
    }
  });

  it('las opciones de icono del catálogo coinciden con la lista blanca', () => {
    const catalogo = JSON.parse(readFileSync('../cms/blocks.json', 'utf8'));
    const opciones = catalogo.blocks.stats.schema
      .find((c: { path: string }) => c.path === 'items')
      .item.find((c: { path: string }) => c.path === 'icon')
      .options.map((o: { value: string }) => o.value);
    expect(opciones).toEqual(['', ...Object.keys(ICONOS)]);
  });
});

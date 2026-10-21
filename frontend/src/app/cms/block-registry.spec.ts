import { describe, it, expect } from 'vitest';
import {
  BLOCK_CATALOG,
  BLOCK_TYPES,
  makeBlock,
  pageBlocks,
  visibleBlocks,
  templateBlocks,
} from './block-registry';

describe('block-registry', () => {
  it('crea un bloque con su id y sus valores por defecto', () => {
    const block = makeBlock('hero');
    expect(block.type).toBe('hero');
    expect(block.id).toBeTruthy();
    expect(block.hidden).toBe(false);
    expect(block.props).toHaveProperty('slides');
    expect(block.props).toHaveProperty('subtitle');
    expect(block.props).toHaveProperty('cta');
    expect(block.props).toHaveProperty('ctaLink');
  });

  it('extrae los bloques de un documento', () => {
    const blocks = pageBlocks({ blocks: [makeBlock('hero'), makeBlock('cta')] });
    expect(blocks).toHaveLength(2);
  });

  it('filtra los bloques ocultos', () => {
    const visible = visibleBlocks({
      blocks: [makeBlock('hero'), makeBlock('cta', undefined, true), makeBlock('about')],
    });
    expect(visible).toHaveLength(2);
    expect(visible.every((block) => !block.hidden)).toBe(true);
  });

  it('el catalogo no contiene tipos de clientes', () => {
    const keys = Object.keys(BLOCK_CATALOG);
    expect(keys).not.toContain('testimonials');
    expect(keys).not.toContain('clientStages');
    expect(keys).not.toContain('innovative');
  });

  it('el catalogo tiene el bloque de entidades', () => {
    expect(BLOCK_CATALOG['entidades']).toBeDefined();
    expect(BLOCK_CATALOG['entidades'].label).toBe('Entidades colaboradoras');
  });

  it('la plantilla de entidades usa el bloque entidades', () => {
    const blocks = templateBlocks('entidades');
    expect(blocks.some((block) => block.type === 'entidades')).toBe(true);
  });

  it('todos los tipos del catalogo tienen etiqueta y descripcion en espanol', () => {
    for (const def of BLOCK_TYPES) {
      expect(def.label).toBeTruthy();
      expect(def.description).toBeTruthy();
    }
  });
});

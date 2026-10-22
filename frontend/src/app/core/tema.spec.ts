import { describe, it, expect } from 'vitest';
import { temaPublico } from './tema';
import { contraste } from './contraste';

describe('temaPublico', () => {
  it('aplica la paleta y las fuentes configuradas sin aceptar CSS arbitrario', () => {
    const tema = temaPublico({ color_primario: '#315836', color_fondo: 'url(https://x)', tipografia_titulos: 'Georgia, serif', tipografia_cuerpo: 'x; background: red' });
    expect(tema['--color-primario']).toBe('#315836');
    expect(tema['--color-fondo']).toBe('#ffffff');
    expect(tema['--font-titulos']).toBe('Georgia, serif');
    expect(tema['--font-cuerpo']).not.toContain(';');
    expect(tema['--color-marca']).toBe('#315836');
  });

  it.each([
    { color_primario: '#ffff00', color_texto: '#ffffff' },
    { color_fondo: '#141414', color_superficie: '#222222', color_texto: '#111111' },
    { color_fondo: '#000000', color_superficie: '#ffffff' },
  ])('mantiene texto, enlaces y botones legibles: %j', (apariencia) => {
    const tema = temaPublico(apariencia);
    for (const fondo of ['--color-fondo', '--color-superficie']) {
      for (const texto of ['--color-texto', '--color-texto-suave', '--color-primario', '--color-primario-fuerte', '--color-acento']) {
        expect(contraste(tema[texto], tema[fondo])).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(contraste(tema['--color-boton-texto'], tema['--color-primario'])).toBeGreaterThanOrEqual(4.5);
    expect(contraste(tema['--color-boton-texto-hover'], tema['--color-primario-fuerte'])).toBeGreaterThanOrEqual(4.5);
  });
});

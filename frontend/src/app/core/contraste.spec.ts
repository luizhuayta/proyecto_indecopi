import { describe, expect, it } from 'vitest';
import { contraste, cumpleContraste, invertirColor, sugerirContraste } from './contraste';

describe('contraste', () => {
  it('el contraste de blanco sobre negro es 21', () => {
    expect(contraste('#ffffff', '#000000')).toBeCloseTo(21, 5);
  });

  it('el contraste de dos colores iguales es 1', () => {
    expect(contraste('#123A6D', '#123A6D')).toBeCloseTo(1, 5);
  });

  it('el contraste de un color y su 版本 invertido es simetrico', () => {
    const color = '#3A7D44';
    const invertido = invertirColor(color);
    expect(contraste(color, invertido)).toBeCloseTo(contraste(invertido, color), 8);
  });

  it('un par de color que no cumple se detecta', () => {
    // #777777 sobre blanco ronda 4.47:1, por debajo del umbral de 4.5.
    expect(cumpleContraste('#777777', '#ffffff')).toBe(false);
    // El negro sobre blanco sí cumple.
    expect(cumpleContraste('#000000', '#ffffff')).toBe(true);
  });

  it('sugiere un color que cumple el contraste pedido', () => {
    const sugerido = sugerirContraste('#d0d0d0', '#ffffff');
    expect(cumpleContraste(sugerido, '#ffffff')).toBe(true);
  });

  it('no cambia un color que ya cumple', () => {
    expect(sugerirContraste('#000000', '#ffffff')).toBe('#000000');
  });
});

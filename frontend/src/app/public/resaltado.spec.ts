// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { escaparHtml, resaltar } from './resaltado';

describe('resaltado', () => {
  it('marca las coincidencias sin distinguir mayúsculas', () => {
    expect(resaltar('Admisión 2026', 'admisión')).toBe('<mark>Admisión</mark> 2026');
  });

  it('marca cada aparición del término', () => {
    expect(resaltar('Admisión y admisión', 'admisión')).toBe(
      '<mark>Admisión</mark> y <mark>admisión</mark>',
    );
  });

  it('marca varios términos de la consulta', () => {
    expect(resaltar('Oferta académica de admisión', 'oferta admisión')).toBe(
      '<mark>Oferta</mark> académica de <mark>admisión</mark>',
    );
  });

  it('ignora los términos de una sola letra', () => {
    expect(resaltar('Admitidos', 'a')).toBe('Admitidos');
  });

  it('escapa el texto que viene del servidor', () => {
    expect(resaltar('<b>Oferta</b> & más', 'oferta')).toBe(
      '&lt;b&gt;<mark>Oferta</mark>&lt;/b&gt; &amp; más',
    );
  });

  it('no marca nada si la consulta está vacía, pero escapa igual', () => {
    expect(resaltar('Oferta & <b>más</b>', '')).toBe('Oferta &amp; &lt;b&gt;más&lt;/b&gt;');
  });

  it('escapa los caracteres especiales de la consulta', () => {
    expect(resaltar('Precio: 100', '100')).toBe('Precio: <mark>100</mark>');
    expect(resaltar('Costo (neto)', '(neto)')).toBe('Costo <mark>(neto)</mark>');
  });
});

describe('escaparHtml', () => {
  it('escapa las cinco entidades peligrosas', () => {
    expect(escaparHtml(`<>&"`)).toBe('&lt;&gt;&amp;&quot;');
  });
});

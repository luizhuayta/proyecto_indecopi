import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { tituloDeSeccion } from './admin-shell';

describe('tituloDeSeccion', () => {
  it('nombra la sección del panel según la ruta', () => {
    expect(tituloDeSeccion('/admin/paginas')).toBe('Páginas');
    expect(tituloDeSeccion('/admin/identidad')).toBe('Identidad');
    expect(tituloDeSeccion('/admin/apariencia')).toBe('Apariencia');
    expect(tituloDeSeccion('/admin/medios')).toBe('Medios');
    expect(tituloDeSeccion('/admin/mensajes')).toBe('Mensajes');
    expect(tituloDeSeccion('/admin/usuarios')).toBe('Usuarios');
  });

  it('en el editor manda el título de la página, y sin ruta conocida dice Panel', () => {
    expect(tituloDeSeccion('/admin/editor/oferta')).toBe('');
    expect(tituloDeSeccion('/admin/otra-cosa')).toBe('Panel');
  });
});

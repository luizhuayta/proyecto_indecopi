// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { PreferenciasPanel } from './preferencias-panel';

// El jsdom de vitest no expone localStorage (el global de Node queda
// undefined): se siembra uno en memoria, igual que en la spec del shell.
const memoria = new Map<string, string>();
const almacen = {
  getItem: (k: string) => (memoria.has(k) ? memoria.get(k)! : null),
  setItem: (k: string, v: string) => void memoria.set(k, String(v)),
  removeItem: (k: string) => void memoria.delete(k),
  clear: () => memoria.clear(),
};
Object.defineProperty(globalThis, 'localStorage', {
  value: almacen,
  configurable: true,
  writable: true,
});

describe('PreferenciasPanel — grupos plegados', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('arranca con todos los grupos abiertos', () => {
    const prefs = new PreferenciasPanel();
    expect(prefs.grupoCerrado('portal')).toBe(false);
    expect(prefs.grupoCerrado('gestion')).toBe(false);
    expect(prefs.grupoCerrado('configuracion')).toBe(false);
  });

  it('alternarGrupo pliega y despliega, y lo recuerda en localStorage', () => {
    const prefs = new PreferenciasPanel();
    prefs.alternarGrupo('gestion');
    expect(prefs.grupoCerrado('gestion')).toBe(true);
    expect(localStorage.getItem('admin-grupos-cerrados')).toBe('gestion');

    prefs.alternarGrupo('gestion');
    expect(prefs.grupoCerrado('gestion')).toBe(false);
    expect(localStorage.getItem('admin-grupos-cerrados')).toBe('');
  });

  it('recuerda varios grupos a la vez, separados por coma', () => {
    const prefs = new PreferenciasPanel();
    prefs.alternarGrupo('portal');
    prefs.alternarGrupo('configuracion');
    expect(localStorage.getItem('admin-grupos-cerrados')).toBe(
      'portal,configuracion',
    );
    expect(prefs.grupoCerrado('gestion')).toBe(false);
  });

  it('lee al arrancar los grupos guardados de la sesión anterior', () => {
    localStorage.setItem('admin-grupos-cerrados', 'portal,gestion');
    const prefs = new PreferenciasPanel();
    expect(prefs.grupoCerrado('portal')).toBe(true);
    expect(prefs.grupoCerrado('gestion')).toBe(true);
    expect(prefs.grupoCerrado('configuracion')).toBe(false);
  });
});

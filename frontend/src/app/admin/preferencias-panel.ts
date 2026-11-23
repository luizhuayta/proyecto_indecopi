import { Injectable, signal } from '@angular/core';

export type PaletaPanel = 'rojo' | 'azul' | 'celeste' | 'naranja' | 'amarillo';

/** Paletas del panel (las de Peruano Canadiense, ajustadas a AA). El color es solo para la muestra del selector. */
export const PALETAS_PANEL: { id: PaletaPanel; nombre: string; color: string }[] = [
  { id: 'rojo', nombre: 'Rojo institucional', color: '#b91c2b' },
  { id: 'azul', nombre: 'Azul institucional', color: '#24476b' },
  { id: 'celeste', nombre: 'Celeste', color: '#1c75ad' },
  { id: 'naranja', nombre: 'Naranja', color: '#c2510f' },
  { id: 'amarillo', nombre: 'Amarillo', color: '#8f6700' },
];

/**
 * Preferencias visuales de quien usa el panel: paleta, modo y riel plegado.
 * Se guardan en este navegador y no cambian nada del sitio público.
 */
@Injectable({ providedIn: 'root' })
export class PreferenciasPanel {
  readonly paleta = signal<PaletaPanel>(paletaGuardada());
  readonly modo = signal<'claro' | 'oscuro'>(leer('admin-modo') === 'oscuro' ? 'oscuro' : 'claro');
  readonly colapsado = signal(leer('admin-nav-colapsado') === '1');
  /** Grupos del menú plegados («portal», «gestion», «configuracion»). */
  readonly gruposCerrados = signal<readonly string[]>(listaGuardada('admin-grupos-cerrados'));

  elegirPaleta(paleta: PaletaPanel): void {
    this.paleta.set(paleta);
    guardar('admin-paleta', paleta);
  }

  alternarModo(): void {
    this.modo.update((m) => (m === 'oscuro' ? 'claro' : 'oscuro'));
    guardar('admin-modo', this.modo());
  }

  alternarColapsado(): void {
    this.colapsado.update((v) => !v);
    guardar('admin-nav-colapsado', this.colapsado() ? '1' : '0');
  }

  /**
   * Los rótulos «Portal público», «Gestión» y «Configuración» pliegan su
   * grupo; la elección se recuerda entre sesiones igual que el riel plegado.
   */
  alternarGrupo(id: string): void {
    this.gruposCerrados.update((lista) =>
      lista.includes(id) ? lista.filter((g) => g !== id) : [...lista, id],
    );
    guardar('admin-grupos-cerrados', this.gruposCerrados().join(','));
  }

  grupoCerrado(id: string): boolean {
    return this.gruposCerrados().includes(id);
  }
}

function paletaGuardada(): PaletaPanel {
  const valor = leer('admin-paleta');
  return PALETAS_PANEL.some((p) => p.id === valor) ? (valor as PaletaPanel) : 'rojo';
}
function listaGuardada(clave: string): string[] {
  return (leer(clave) ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}
function leer(clave: string): string | null {
  try { return localStorage.getItem(clave); } catch { return null; }
}
function guardar(clave: string, valor: string): void {
  try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento: vale para esta sesión */ }
}

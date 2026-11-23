import { Injectable, signal } from '@angular/core';

export type ModoApariencia = 'claro' | 'oscuro';

export type PaletaInstitucional = 'rojo' | 'azul' | 'celeste' | 'naranja' | 'amarillo';

export interface PaletaDetalle {
  id: PaletaInstitucional;
  nombre: string;
  descripcion: string;
  principal: string;
  secundario: string;
  suave: string;
}

export const PALETAS_INSTITUCIONALES: readonly PaletaDetalle[] = [
  { id: 'rojo', nombre: 'Rojo institucional', descripcion: 'Rojo del estandarte y azul oscuro', principal: '#b91c2b', secundario: '#292d3b', suave: '#fce9ec' },
  { id: 'azul', nombre: 'Azul institucional', descripcion: 'Azul oscuro con detalles claros', principal: '#24476b', secundario: '#192e45', suave: '#eaf1f8' },
  { id: 'celeste', nombre: 'Celeste', descripcion: 'Color celeste de admisión', principal: '#238ac7', secundario: '#19447d', suave: '#e9f5fc' },
  { id: 'naranja', nombre: 'Naranja', descripcion: 'Color naranja de admisión', principal: '#f26922', secundario: '#19447d', suave: '#fff0e6' },
  { id: 'amarillo', nombre: 'Amarillo', descripcion: 'Color amarillo de admisión', principal: '#a67900', secundario: '#19447d', suave: '#fff7cc' },
] as const;

const STORAGE_KEY = 'pc-admin-paleta-v1';
const MODO_STORAGE_KEY = 'pc-admin-modo-v1';

@Injectable({ providedIn: 'root' })
export class AdminPaletaService {
  readonly actual = signal<PaletaInstitucional>('rojo');
  readonly modo = signal<ModoApariencia>('claro');

  constructor() {
    try {
      const modoGuardado = localStorage.getItem(MODO_STORAGE_KEY);
      if (modoGuardado === 'oscuro') this.modo.set('oscuro');
      const guardada = localStorage.getItem(STORAGE_KEY);
      if (guardada === 'rojo' || guardada === 'azul' || guardada === 'celeste' || guardada === 'naranja' || guardada === 'amarillo') {
        this.actual.set(guardada);
      }
    } catch {
      // En SSR o navegadores con almacenamiento bloqueado se usa rojo.
    }
  }

  alternarModo(): void {
    const nuevo: ModoApariencia = this.modo() === 'claro' ? 'oscuro' : 'claro';
    this.modo.set(nuevo);
    try { localStorage.setItem(MODO_STORAGE_KEY, nuevo); } catch { /* Preferencia en sesión. */ }
  }

  guardar(paleta: PaletaInstitucional): void {
    this.actual.set(paleta);
    try {
      localStorage.setItem(STORAGE_KEY, paleta);
    } catch {
      // El tema sigue activo durante esta sesión aunque no se pueda persistir.
    }
  }
}

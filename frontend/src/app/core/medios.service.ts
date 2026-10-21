import { Injectable, computed, inject, signal } from '@angular/core';
import { CmsApiService, MedioItem, RecortarMedioBody } from '../cms/cms-api.service';

/**
 * Estado de la biblioteca de medios del panel: lista, subida, recorte y
 * eliminación, más el texto alternativo (que se gestiona en el cliente hasta
 * que el API lo exponga). El estado solo cambia cuando el servidor confirma.
 */
@Injectable({ providedIn: 'root' })
export class MediosService {
  private readonly api = inject(CmsApiService);

  readonly items = signal<MedioItem[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly uploading = signal(false);
  readonly error = signal('');

  /** Medios cuyo texto alternativo está vacío (el servidor lo exige). */
  readonly pendientes = computed(() => this.items().filter((m) => !this.altDe(m)));

  async listar(): Promise<MedioItem[]> {
    this.loading.set(true);
    this.error.set('');
    try {
      const items = await this.api.listarMedios();
      this.items.set(items);
      this.loaded.set(true);
      return items;
    } catch {
      this.error.set('No se pudieron cargar los medios. Revisa tu conexión e inténtalo de nuevo.');
      return [];
    } finally {
      this.loading.set(false);
    }
  }

  async subir(file: File): Promise<MedioItem> {
    this.uploading.set(true);
    this.error.set('');
    try {
      const item = await this.api.subirMedio(file);
      this.items.update((list) => [item, ...list]);
      return item;
    } catch {
      this.error.set('No se pudo subir el archivo. Revisa el formato y el tamaño.');
      throw new Error('subida fallida');
    } finally {
      this.uploading.set(false);
    }
  }

  async eliminar(id: number): Promise<void> {
    this.error.set('');
    try {
      await this.api.eliminarMedio(id);
      this.items.update((list) => list.filter((m) => m.id !== id));
    } catch {
      this.error.set('No se pudo eliminar el archivo.');
      throw new Error('eliminación fallida');
    }
  }

  /**
   * Recorta un medio y añade la versión recortada como elemento nuevo; el
   * original se conserva. La respuesta del API no trae nombre/mime/tamaño, así
   * que se derivan del original.
   */
  async recortar(origen: MedioItem, caja: RecortarMedioBody): Promise<MedioItem> {
    this.error.set('');
    try {
      const res = await this.api.recortarMedio(caja);
      const item: MedioItem = {
        id: res.id,
        url: res.url,
        ancho: res.ancho ?? null,
        alto: res.alto ?? null,
        variantes: [],
        nombre_original: `${origen.nombre_original} (recorte)`,
        mime: origen.mime,
        tamano: 0,
        creado_en: new Date().toISOString(),
        alt: '',
      };
      this.items.update((list) => [item, ...list]);
      return item;
    } catch {
      this.error.set('No se pudo recortar la imagen.');
      throw new Error('recorte fallido');
    }
  }

  /** Texto alternativo de un medio ('' cuando no hay). */
  altDe(item: MedioItem): string {
    return (item.alt ?? '').trim();
  }

  /** Establece el texto alternativo en el estado local de la biblioteca. */
  setAlt(id: number, alt: string): void {
    this.items.update((list) =>
      list.map((m) => (m.id === id ? { ...m, alt: alt.trim() } : m))
    );
  }
}

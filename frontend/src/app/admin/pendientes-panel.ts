import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../cms/auth.service';
import { CmsApiService } from '../cms/cms-api.service';

/**
 * Conteo de solicitudes pendientes (mensajes con estado «pendiente»)
 * agrupado por tipo de bandeja. Lo comparten el menú lateral (píldora de
 * cada bandeja de Gestión), la píldora de la cabecera y la propia bandeja,
 * que lo refresca después de responder o archivar un mensaje.
 *
 * Se carga una vez al entrar al panel y otra vez en cada navegación: así el
 * conteo está fresco al volver al tablero sin necesidad de cablear cada
 * pantalla. El criterio es el mismo que usa el tablero.
 */
@Injectable({ providedIn: 'root' })
export class PendientesPanel {
  private readonly api = inject(CmsApiService);
  private readonly auth = inject(AuthService);

  /** Pendientes por tipo de mensaje (`tramite`, `reclamo`…). */
  readonly porTipo = signal<Record<string, number>>({});
  /** Total de solicitudes sin atender: lo muestra la píldora de la cabecera. */
  readonly total = computed(() =>
    Object.values(this.porTipo()).reduce((suma, n) => suma + n, 0),
  );

  deTipo(tipo: string): number {
    return this.porTipo()[tipo] ?? 0;
  }

  /**
   * Pide los mensajes pendientes y los agrupa por tipo. Solo corre si el rol
   * tiene bandeja (la API negaría la lectura a los demás); un fallo conserva
   * el último conteo conocido, mejor que hacer desaparecer la píldora por un
   * tropiezo de red.
   */
  async cargar(): Promise<void> {
    if (!this.auth.puede('mensajes')) {
      return;
    }
    try {
      const items = await this.api.listarMensajes({ estado: 'pendiente' });
      const conteo: Record<string, number> = {};
      for (const m of items) {
        conteo[m.tipo] = (conteo[m.tipo] ?? 0) + 1;
      }
      this.porTipo.set(conteo);
    } catch {
      /* se conserva el último conteo conocido */
    }
  }
}

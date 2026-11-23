import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CmsApiService, MensajeItem } from '../cms/cms-api.service';
import { EstadoVacio } from './estado-vacio';
import { PendientesPanel } from './pendientes-panel';

/**
 * Bandejas temáticas del panel: cada tipo de mensaje tiene su propio nombre
 * y texto, igual que en el menú lateral (Mesa de partes, Reclamaciones…).
 * El tipo `accesibilidad` llega cuando el sitio lo empiece a enviar.
 */
export const BANDEJAS_MENSAJE: Record<string, { titulo: string; descripcion: string }> = {
  tramite: {
    titulo: 'Mesa de partes',
    descripcion: 'Trámites y solicitudes llegados por la mesa de partes virtual.',
  },
  reclamo: {
    titulo: 'Reclamaciones',
    descripcion: 'Reclamos y quejas registrados desde el libro de reclamaciones.',
  },
  accesibilidad: {
    titulo: 'Reportes de accesibilidad',
    descripcion: 'Problemas de accesibilidad que reportan las personas visitantes.',
  },
  contacto: {
    titulo: 'Otras solicitudes',
    descripcion: 'Consultas y solicitudes generales del formulario de contacto.',
  },
  sugerencia: {
    titulo: 'Sugerencias',
    descripcion: 'Sugerencias recibidas desde el sitio.',
  },
};

/**
 * Bandeja de mensajes del panel: filtros por tipo y estado, lista con los
 * datos de contacto y respuesta a cada mensaje. El formulario de contacto del
 * sitio público escribe aquí.
 *
 * Con `?tipo=` en la URL la bandeja se vuelve temática (Mesa de partes,
 * Reclamaciones, Reportes de accesibilidad…): el filtro queda preseleccionado
 * y el encabezado cambia de nombre. Cambiar el filtro a mano actualiza la URL
 * sin recargar, para que el enlace siga siendo compartible.
 */
@Component({
  selector: 'app-admin-mensajes',
  standalone: true,
  imports: [FormsModule, DatePipe, EstadoVacio],
  template: `
    <header class="admin-encabezado">
      <div>
        <h2 class="admin-encabezado__titulo">{{ tituloBandeja() }}</h2>
        <p class="admin-subtitulo admin-encabezado__texto">
          {{ descripcionBandeja() }}
        </p>
      </div>
    </header>

    <div class="admin-filtros">
      <div class="admin-campo">
        <label for="filtro-tipo">Tipo</label>
        <select
          id="filtro-tipo"
          class="admin-control"
          [(ngModel)]="filtroTipo"
          (ngModelChange)="cambiarTipo()"
          name="tipo"
        >
          <option value="">Todos</option>
          <option value="accesibilidad">Accesibilidad</option>
          <option value="contacto">Contacto</option>
          <option value="reclamo">Reclamo</option>
          <option value="sugerencia">Sugerencia</option>
          <option value="tramite">Trámite</option>
        </select>
      </div>
      <div class="admin-campo">
        <label for="filtro-estado">Estado</label>
        <select
          id="filtro-estado"
          class="admin-control"
          [(ngModel)]="filtroEstado"
          (ngModelChange)="cargar()"
          name="estado"
        >
          <option value="">Todos</option>
          <option value="pendiente">Pendiente</option>
          <option value="respondido">Respondido</option>
          <option value="archivado">Archivado</option>
        </select>
      </div>
    </div>

    @if (error()) {
      <p class="admin-banner admin-banner--error" role="alert">{{ error() }}</p>
    }

    @if (cargando()) {
      <p class="admin-vacio">Cargando mensajes…</p>
    } @else if (mensajes().length === 0) {
      <app-estado-vacio
        icono="mensajes"
        titulo="No hay mensajes con estos filtros"
        mensaje="Prueba con otra combinación, o limpia los filtros para ver todo lo que ha llegado."
        textoAccion="Limpiar filtros"
        (accion)="limpiarFiltros()"
      />
    } @else {
      <div class="admin-tabla-scroll">
      <table class="admin-tabla">
        <thead>
          <tr>
            <th scope="col">Fecha</th>
            <th scope="col">Asunto</th>
            <th scope="col">De</th>
            <th scope="col">Tipo</th>
            <th scope="col">Estado</th>
            <th scope="col"><span class="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          @for (m of mensajes(); track m.id) {
            <tr>
              <td>{{ m.creado_en | date: 'dd/MM/yyyy HH:mm' }}</td>
              <td>{{ m.asunto || '(sin asunto)' }}</td>
              <td>{{ m.nombre || m.correo }}</td>
              <td>
                <span class="admin-etiqueta">{{ etiquetasTipo[m.tipo] || m.tipo }}</span>
              </td>
              <td>
                <span
                  class="admin-etiqueta"
                  [class.admin-etiqueta--ok]="m.estado !== 'pendiente'"
                  [class.admin-etiqueta--borrador]="m.estado === 'pendiente'"
                >
                  {{ etiquetasEstado[m.estado] || m.estado }}
                </span>
              </td>
              <td>
                <button type="button" class="admin-btn admin-btn--chico" (click)="ver(m)">
                  {{ seleccionado()?.id === m.id ? 'Cerrar' : 'Ver' }}
                </button>
                @if (m.estado !== 'archivado') {
                  <button
                    type="button"
                    class="admin-btn admin-btn--chico"
                    (click)="archivar(m)"
                    [disabled]="archivando() === m.id"
                  >
                    Archivar
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
      </div>
    }

    <!-- La zona vive siempre en la página: así el lector de pantalla anuncia
         el detalle cuando aparece, en vez de insertarlo en silencio. -->
    <div class="admin-detalle-zona" aria-live="polite">
      @if (seleccionado(); as m) {
        <section class="admin-detalle admin-tarjeta" aria-label="Detalle del mensaje">
          <h2 class="admin-titulo admin-titulo--chico">{{ m.asunto || '(sin asunto)' }}</h2>
          <dl class="admin-datos">
            <dt>Ticket</dt>
            <dd>{{ m.ticket }}</dd>
            <dt>Tipo</dt>
            <dd>
              <span class="admin-etiqueta">{{ etiquetasTipo[m.tipo] || m.tipo }}</span>
            </dd>
            <dt>De</dt>
            <dd>{{ m.nombre }} &lt;{{ m.correo }}&gt;</dd>
            @if (m.documento) {
              <dt>Documento</dt>
              <dd>{{ m.documento }}</dd>
            }
            @if (m.telefono) {
              <dt>Teléfono</dt>
              <dd>{{ m.telefono }}</dd>
            }
            @if (m.ruta) {
              <dt>Página</dt>
              <dd>{{ m.ruta }}</dd>
            }
            <dt>Recibido</dt>
            <dd>{{ m.creado_en | date: 'dd/MM/yyyy HH:mm' }}</dd>
          </dl>
          <p class="admin-mensaje">{{ m.mensaje }}</p>

          @if (m.respuesta) {
            <div class="admin-respuesta-actual">
              <h3>Respuesta guardada</h3>
              @if (m.notificado) {
                <p class="admin-banner admin-banner--ok" role="status">Aviso enviado</p>
              }
              <p>{{ m.respuesta }}</p>
            </div>
          }

          <form class="admin-form-respuesta" (ngSubmit)="responder()">
            <div class="admin-campo">
              <label for="respuesta-texto">Responder</label>
              <textarea
                id="respuesta-texto"
                class="admin-control"
                rows="5"
                [(ngModel)]="textoRespuesta"
                name="respuesta"
                placeholder="Escribe aquí tu respuesta a la persona."
              ></textarea>
            </div>
            <div class="admin-campo admin-campo--check">
              <label for="avisar-correo">
                <input id="avisar-correo" type="checkbox" [(ngModel)]="avisarCorreo" name="avisar" />
                Avisar por correo
              </label>
            </div>
            <button type="submit" class="admin-btn admin-btn--primario" [disabled]="enviando()">
              {{ enviando() ? 'Enviando…' : 'Enviar respuesta' }}
            </button>
          </form>
        </section>
      }
    </div>
  `,
  styles: [
    `
      .admin-filtros {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: 1rem;
        margin: 1.5rem 0;
      }
      .admin-campo {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .admin-detalle {
        margin-top: 2rem;
      }
      .admin-datos {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: 0.25rem 1rem;
        margin: 1rem 0;
      }
      .admin-datos dt {
        font-weight: 600;
        color: var(--color-texto-suave);
      }
      .admin-mensaje {
        white-space: pre-wrap;
        padding: 1rem;
        border-left: 3px solid var(--color-primario);
        background: var(--color-fondo);
      }
      .admin-respuesta-actual {
        margin-top: 1rem;
        padding: 1rem;
        background: var(--color-fondo);
      }
      .admin-form-respuesta {
        display: grid;
        gap: 0.75rem;
        margin-top: 1rem;
      }
      .admin-btn--chico {
        padding: 0.35rem 0.75rem;
        font-size: 0.875rem;
      }
      .admin-titulo--chico {
        font-size: 1.25rem;
      }
    `,
  ],
})
export class AdminMensajes implements OnInit, OnDestroy {
  private readonly api = inject(CmsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  /** Conteo compartido: responder o archivar lo refresca para las píldoras. */
  private readonly pendientes = inject(PendientesPanel);
  private sub?: Subscription;

  readonly mensajes = signal<MensajeItem[]>([]);
  readonly cargando = signal(false);
  readonly enviando = signal(false);
  readonly error = signal('');
  readonly seleccionado = signal<MensajeItem | null>(null);
  readonly archivando = signal<number | null>(null);

  /** El API habla en enums; la bandeja le habla a la persona. */
  readonly etiquetasTipo: Record<string, string> = {
    accesibilidad: 'Accesibilidad',
    contacto: 'Contacto',
    reclamo: 'Reclamo',
    sugerencia: 'Sugerencia',
    tramite: 'Trámite',
  };
  readonly etiquetasEstado: Record<string, string> = {
    pendiente: 'Pendiente',
    respondido: 'Respondido',
    archivado: 'Archivado',
  };

  /** Tipo elegido en el filtro o llegado por `?tipo=`: es una señal porque el
   *  encabezado contextual depende de él. */
  readonly filtroTipo = signal('');
  filtroEstado = '';
  textoRespuesta = '';
  avisarCorreo = false;

  /** Nombre de la bandeja según el filtro: «Mesa de partes», «Mensajes»… */
  readonly tituloBandeja = computed(
    () => BANDEJAS_MENSAJE[this.filtroTipo()]?.titulo ?? 'Mensajes',
  );
  readonly descripcionBandeja = computed(
    () =>
      BANDEJAS_MENSAJE[this.filtroTipo()]?.descripcion ??
      'Los mensajes que llegan desde los formularios del sitio.',
  );

  readonly total = computed(() => this.mensajes().length);

  /** Un `?tipo=` solo tiene efecto si es una bandeja conocida. */
  private tipoDesdeParam(valor: unknown): string {
    return typeof valor === 'string' && BANDEJAS_MENSAJE[valor] ? valor : '';
  }

  /** El estado vacío ofrece limpiar los filtros: vuelve a listar todo. */
  limpiarFiltros(): void {
    this.filtroTipo.set('');
    this.filtroEstado = '';
    this.reflejarTipoEnUrl();
    void this.cargar();
  }

  ngOnInit(): void {
    // Primero el valor actual del query param: la bandeja puede abrirse ya
    // temática desde el menú lateral (?tipo=tramite → Mesa de partes).
    this.filtroTipo.set(this.tipoDesdeParam(this.route.snapshot.queryParams['tipo']));
    // Si la URL cambia con la bandeja abierta (otro enlace del menú), el
    // filtro la sigue; la carga inicial corre una sola vez.
    this.sub = this.route.queryParams.subscribe((params) => {
      const tipo = this.tipoDesdeParam(params['tipo']);
      if (tipo === this.filtroTipo()) {
        return;
      }
      this.filtroTipo.set(tipo);
      void this.cargar();
    });
    void this.cargar();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  /**
   * Cambiar el filtro a mano actualiza la URL sin recargar (replaceUrl), así
   * el enlace sigue describiendo lo que se ve y la suscripción no recarga dos
   * veces: cuando llega, el tipo ya es el mismo.
   */
  cambiarTipo(): void {
    this.reflejarTipoEnUrl();
    void this.cargar();
  }

  private reflejarTipoEnUrl(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tipo: this.filtroTipo() || null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      const items = await this.api.listarMensajes({
        tipo: this.filtroTipo(),
        estado: this.filtroEstado,
      });
      this.mensajes.set(items);
    } catch {
      this.error.set('No se pudieron cargar los mensajes. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }

  ver(m: MensajeItem): void {
    this.seleccionado.set(m);
    this.textoRespuesta = m.respuesta || '';
    this.avisarCorreo = false;
    this.error.set('');
  }

  async archivar(m: MensajeItem): Promise<void> {
    if (this.archivando() !== null) {
      return;
    }
    this.archivando.set(m.id);
    this.error.set('');
    try {
      await this.api.archivarMensaje(m.id);
      this.mensajes.update((lista) =>
        lista.map((x) => (x.id === m.id ? { ...x, estado: 'archivado' as const } : x))
      );
      if (this.seleccionado()?.id === m.id) {
        this.seleccionado.set({ ...m, estado: 'archivado' });
      }
      void this.pendientes.cargar();
    } catch {
      this.error.set('No se pudo archivar el mensaje. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      this.archivando.set(null);
    }
  }

  async responder(): Promise<void> {
    const m = this.seleccionado();
    if (!m || this.enviando()) {
      return;
    }
    if (!this.textoRespuesta.trim()) {
      this.error.set('Escribe una respuesta antes de enviarla.');
      return;
    }
    this.enviando.set(true);
    this.error.set('');
    try {
      const r = await this.api.responderMensaje(m.id, this.textoRespuesta.trim(), this.avisarCorreo);
      this.mensajes.update((lista) =>
        lista.map((x) => (x.id === m.id ? { ...x, estado: 'respondido' as const, respuesta: r.respuesta, notificado: r.notificado } : x))
      );
      this.seleccionado.set({ ...m, estado: 'respondido', respuesta: r.respuesta, notificado: r.notificado });
      void this.pendientes.cargar();
    } catch {
      this.error.set('No se pudo guardar la respuesta. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      this.enviando.set(false);
    }
  }
}

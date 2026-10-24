import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CmsApiService, MensajeItem } from '../cms/cms-api.service';

/**
 * Bandeja de mensajes del panel: filtros por tipo y estado, lista con los
 * datos de contacto y respuesta a cada mensaje. El formulario de contacto del
 * sitio público escribe aquí.
 */
@Component({
  selector: 'app-admin-mensajes',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    <header>
      <h1 class="admin-titulo">Mensajes</h1>
      <p class="admin-subtitulo">
        Los mensajes que llegan desde el formulario de contacto del sitio.
      </p>
    </header>

    <form class="admin-filtros" (ngSubmit)="cargar()">
      <div class="admin-campo">
        <label for="filtro-tipo">Tipo</label>
        <select id="filtro-tipo" class="admin-control" [(ngModel)]="filtroTipo" name="tipo">
          <option value="">Todos</option>
          <option value="contacto">Contacto</option>
          <option value="reclamo">Reclamo</option>
          <option value="sugerencia">Sugerencia</option>
        </select>
      </div>
      <div class="admin-campo">
        <label for="filtro-estado">Estado</label>
        <select id="filtro-estado" class="admin-control" [(ngModel)]="filtroEstado" name="estado">
          <option value="">Todos</option>
          <option value="pendiente">Pendiente</option>
          <option value="respondido">Respondido</option>
          <option value="archivado">Archivado</option>
        </select>
      </div>
      <button type="submit" class="admin-btn" [disabled]="cargando()">Aplicar filtros</button>
    </form>

    @if (error()) {
      <p class="admin-banner admin-banner--error" role="alert">{{ error() }}</p>
    }

    @if (cargando()) {
      <p class="admin-vacio">Cargando mensajes…</p>
    } @else if (mensajes().length === 0) {
      <p class="admin-vacio">No hay mensajes con estos filtros.</p>
    } @else {
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
              <td>{{ m.tipo }}</td>
              <td>
                <span class="admin-etiqueta" [class.admin-etiqueta--ok]="m.estado !== 'pendiente'">
                  {{ m.estado }}
                </span>
              </td>
              <td>
                <button type="button" class="admin-btn admin-btn--chico" (click)="ver(m)">
                  {{ seleccionado()?.id === m.id ? 'Cerrar' : 'Ver' }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    }

    <!-- La zona vive siempre en la página: así el lector de pantalla anuncia
         el detalle cuando aparece, en vez de insertarlo en silencio. -->
    <div class="admin-detalle-zona" aria-live="polite">
      @if (seleccionado(); as m) {
        <section class="admin-detalle" aria-label="Detalle del mensaje">
          <h2 class="admin-titulo admin-titulo--chico">{{ m.asunto || '(sin asunto)' }}</h2>
          <dl class="admin-datos">
            <dt>Ticket</dt>
            <dd>{{ m.ticket }}</dd>
            <dt>De</dt>
            <dd>{{ m.nombre }} &lt;{{ m.correo }}&gt;</dd>
            @if (m.telefono) {
              <dt>Teléfono</dt>
              <dd>{{ m.telefono }}</dd>
            }
            <dt>Recibido</dt>
            <dd>{{ m.creado_en | date: 'dd/MM/yyyy HH:mm' }}</dd>
          </dl>
          <p class="admin-mensaje">{{ m.mensaje }}</p>

          @if (m.respuesta) {
            <div class="admin-respuesta-actual">
              <h3>Respuesta enviada</h3>
              <p>{{ m.respuesta }}</p>
              <p class="admin-subtitulo">
                {{ m.notificado ? 'Se avisó a la institución.' : 'No se notificó a la institución.' }}
              </p>
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
              <label>
                <input type="checkbox" [(ngModel)]="notificar" name="notificar" />
                Avisar a la institución por correo
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
      .admin-campo--check {
        flex-direction: row;
        align-items: center;
      }
      .admin-detalle {
        margin-top: 2rem;
        padding: 1.5rem;
        border: 1px solid var(--color-borde);
        border-radius: 6px;
        background: var(--color-superficie);
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
      .admin-etiqueta {
        padding: 0.15rem 0.5rem;
        border: 1px solid var(--color-borde);
        border-radius: 3px;
        font-size: 0.875rem;
      }
      .admin-etiqueta--ok {
        border-color: var(--color-primario);
        color: var(--color-primario);
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
export class AdminMensajes implements OnInit {
  private readonly api = inject(CmsApiService);

  readonly mensajes = signal<MensajeItem[]>([]);
  readonly cargando = signal(false);
  readonly enviando = signal(false);
  readonly error = signal('');
  readonly seleccionado = signal<MensajeItem | null>(null);

  filtroTipo = '';
  filtroEstado = '';
  textoRespuesta = '';
  notificar = true;

  readonly total = computed(() => this.mensajes().length);

  ngOnInit(): void {
    this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      const items = await this.api.listarMensajes({
        tipo: this.filtroTipo,
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
    this.notificar = true;
    this.error.set('');
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
      const r = await this.api.responderMensaje(m.id, this.textoRespuesta.trim(), this.notificar);
      this.mensajes.update((lista) =>
        lista.map((x) => (x.id === m.id ? { ...x, estado: 'respondido' as const, respuesta: r.respuesta, notificado: r.notificado } : x))
      );
      this.seleccionado.set({ ...m, estado: 'respondido', respuesta: r.respuesta, notificado: r.notificado });
    } catch {
      this.error.set('No se pudo guardar la respuesta. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      this.enviando.set(false);
    }
  }
}

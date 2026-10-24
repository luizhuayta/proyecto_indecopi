import { Component, Input, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { API_BASE, LOCALE, JsonMap } from '../cms/cms.models';

/**
 * Libro de Reclamaciones Virtual del sitio público.
 *
 * El catálogo ya traía el bloque `claimsBook` con los dos avisos legales, el
 * RUC, el logo y el correo de destino, pero no tenía formulario: el bloque
 * caía al renderizador genérico y solo mostraba texto. Aquí se registra la
 * solicitud contra el mismo buzón de mensajes que usa el formulario de
 * contacto, con tipo «reclamo», de modo que llega a la bandeja del panel.
 *
 * ElVisitor escribe un reclamo (discrepancia) o una queja (insatisfacción);
 * son figuras distintas en la ley y no deben mezclarse en un solo campo.
 */
@Component({
  selector: 'app-formulario-reclamo',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="reclamo">
      <header class="reclamo__cabecera">
        @if (logo()) {
          <img class="reclamo__logo" [src]="logo()" [alt]="institucion()" />
        }
        <div>
          <h2 class="reclamo__titulo">{{ titulo() }}</h2>
          @if (institucion()) {
            <p class="reclamo__institucion">{{ institucion() }}</p>
          }
          @if (ruc()) {
            <p class="reclamo__ruc">RUC {{ ruc() }}</p>
          }
        </div>
      </header>

      @if (subtitulo()) {
        <p class="reclamo__subtitulo">{{ subtitulo() }}</p>
      }

      @if (aviso1() || aviso2()) {
        <div class="reclamo__avisos">
          @if (aviso1()) {
            <p class="reclamo__aviso">{{ aviso1() }}</p>
          }
          @if (aviso2()) {
            <p class="reclamo__aviso">{{ aviso2() }}</p>
          }
        </div>
      }

      @if (estado() === 'enviado') {
        <p class="reclamo__confirmacion" role="status">
          Registramos tu {{ tipoSolicitud === 'reclamo' ? 'reclamo' : 'queja' }}. Tu código es
          <strong>{{ ticket() }}</strong>. Puedes usarlo para pedir el seguimiento.
        </p>
      } @else {
        <form class="reclamo__formulario" (ngSubmit)="enviar()" novalidate>
          <fieldset class="reclamo__grupo">
            <legend>Tipo de solicitud</legend>
            <label class="reclamo__opcion">
              <input type="radio" name="tipoSolicitud" value="reclamo" [(ngModel)]="tipoSolicitud" />
              <span>
                <strong>Reclamo</strong>
                Discrepancia con el servicio prestado.
              </span>
            </label>
            <label class="reclamo__opcion">
              <input type="radio" name="tipoSolicitud" value="queja" [(ngModel)]="tipoSolicitud" />
              <span>
                <strong>Queja</strong>
                Disconformidad con el servicio, sin discrepancia con un bien o servicio contratado.
              </span>
            </label>
          </fieldset>

          <div class="reclamo__campo">
            <label for="reclamo-nombre">Nombre completo</label>
            <input id="reclamo-nombre" name="nombre" type="text" autocomplete="name" required
              [(ngModel)]="nombre" />
          </div>
          <div class="reclamo__campo">
            <label for="reclamo-documento">DNI o documento</label>
            <input id="reclamo-documento" name="documento" type="text" inputmode="numeric"
              [(ngModel)]="documento" />
          </div>
          <div class="reclamo__campo">
            <label for="reclamo-correo">Correo electrónico</label>
            <input id="reclamo-correo" name="correo" type="email" autocomplete="email" required
              [(ngModel)]="correo" />
          </div>
          <div class="reclamo__campo">
            <label for="reclamo-telefono">Teléfono</label>
            <input id="reclamo-telefono" name="telefono" type="tel" autocomplete="tel"
              [(ngModel)]="telefono" />
          </div>
          <div class="reclamo__campo">
            <label for="reclamo-detalle">Detalle de la solicitud</label>
            <textarea id="reclamo-detalle" name="detalle" rows="6" required
              [(ngModel)]="detalle"></textarea>
          </div>

          <label class="reclamo__consentimiento">
            <input type="checkbox" name="consentimiento" [(ngModel)]="consentimiento" />
            <span>
              Autorizo el tratamiento de mis datos personales para atender esta solicitud, conforme
              a la Ley N.º 29733 de Protección de Datos Personales.
            </span>
          </label>

          @if (error()) {
            <p class="reclamo__error" role="alert">{{ error() }}</p>
          }

          <button class="boton" type="submit" [disabled]="enviando()">
            {{ enviando() ? 'Enviando…' : boton() }}
          </button>
        </form>
      }
    </section>
  `,
  styles: [
    `
      :host { display: block; }
      .reclamo {
        display: grid;
        gap: 1.25rem;
        max-width: 46rem;
        margin-inline: auto;
        padding: 2rem;
        border: 1px solid var(--color-borde);
        border-radius: var(--radio-tarjeta, 6px);
        background: var(--color-fondo);
      }
      .reclamo__cabecera { display: flex; gap: 1rem; align-items: flex-start; }
      .reclamo__logo { max-height: 4rem; width: auto; }
      .reclamo__titulo { margin: 0; font-size: var(--texto-xl, 1.5rem); font-weight: 600; }
      .reclamo__institucion { margin: 0.15rem 0 0; font-weight: 600; }
      .reclamo__ruc { margin: 0; color: var(--color-texto-suave); font-size: var(--texto-sm, 0.875rem); }
      .reclamo__subtitulo { margin: 0; color: var(--color-texto-suave); }
      .reclamo__avisos {
        display: grid;
        gap: 0.5rem;
        padding: 1rem;
        border-left: 3px solid var(--color-acento);
        background: var(--color-superficie);
      }
      .reclamo__aviso { margin: 0; font-size: var(--texto-sm, 0.875rem); color: var(--color-texto-suave); }
      .reclamo__formulario { display: grid; gap: 1rem; }
      .reclamo__grupo { border: 1px solid var(--color-borde); border-radius: var(--radio-campo, 4px); padding: 1rem; }
      .reclamo__grupo legend { padding: 0 0.4rem; font-weight: 600; font-size: var(--texto-sm, 0.875rem); }
      .reclamo__opcion { display: flex; gap: 0.6rem; align-items: flex-start; padding: 0.35rem 0; }
      .reclamo__opcion input { margin-top: 0.3rem; }
      .reclamo__opcion span { display: grid; font-size: var(--texto-sm, 0.875rem); color: var(--color-texto-suave); }
      .reclamo__campo { display: grid; gap: 0.35rem; }
      label { font-size: var(--texto-sm, 0.875rem); font-weight: 600; }
      input, textarea {
        font: inherit;
        padding: 0.6rem 0.75rem;
        border: 1px solid var(--color-borde-control, var(--color-secundario));
        border-radius: var(--radio-campo, 4px);
        background: var(--color-fondo);
        color: var(--color-texto);
        min-height: 44px;
      }
      textarea { min-height: 8rem; resize: vertical; }
      .reclamo__consentimiento { display: flex; gap: 0.6rem; align-items: flex-start; font-weight: 400; }
      .reclamo__consentimiento input { margin-top: 0.3rem; min-height: auto; }
      .reclamo__confirmacion {
        margin: 0;
        padding: 1rem;
        border: 1px solid var(--color-borde-control, var(--color-secundario));
        border-radius: var(--radio-campo, 4px);
        background: var(--color-superficie);
      }
      .reclamo__error { margin: 0; color: var(--color-acento); font-weight: 600; }
      button { justify-self: start; }
      button:disabled { opacity: 0.7; cursor: progress; }
    `,
  ],
})
export class FormularioReclamo {
  private readonly http = inject(HttpClient);

  @Input() bloque: JsonMap = {};
  @Input() csrf = '';
  @Input() ruta = '';

  nombre = '';
  documento = '';
  correo = '';
  telefono = '';
  detalle = '';
  consentimiento = false;
  tipoSolicitud = 'reclamo';

  readonly estado = signal<'iniciando' | 'enviando' | 'enviado'>('iniciando');
  readonly ticket = signal('');
  readonly error = signal('');
  readonly enviando = computed(() => this.estado() === 'enviando');

  readonly titulo = computed(() => this.texto('title', 'Libro de Reclamaciones'));
  readonly institucion = computed(() => this.texto('company', ''));
  readonly subtitulo = computed(() => this.texto('subtitle', ''));
  readonly logo = computed(() => this.texto('logo', ''));
  readonly ruc = computed(() => this.texto('ruc', ''));
  readonly aviso1 = computed(() => this.texto('disclaimer1', ''));
  readonly aviso2 = computed(() => this.texto('disclaimer2', ''));
  readonly boton = computed(() => this.texto('submitLabel', 'Enviar reclamo'));

  texto(clave: string, defecto: string): string {
    const valor = this.bloque[clave];
    return typeof valor === 'string' && valor.trim() !== '' ? valor : defecto;
  }

  enviar(): void {
    if (this.enviando()) {
      return;
    }
    if (!this.correo.trim() || !this.detalle.trim()) {
      this.error.set('Escribe tu correo y el detalle de la solicitud para poder registrarla.');
      return;
    }
    if (!this.consentimiento) {
      this.error.set('Marca la autorización de tratamiento de datos para continuar.');
      return;
    }
    this.estado.set('enviando');
    this.error.set('');
    this.http
      .post<{ ticket: string }>(
        `${API_BASE}/mensajes`,
        {
          nombre: this.nombre,
          correo: this.correo,
          telefono: this.telefono,
          asunto: this.tipoSolicitud === 'queja' ? 'Queja' : 'Reclamo',
          mensaje: this.detalle,
          ruta: this.ruta,
          tipo: 'reclamo',
        },
        { headers: { 'X-CSRF-Token': this.csrf }, params: { locale: LOCALE } }
      )
      .subscribe({
        next: (r) => {
          this.ticket.set(r.ticket);
          this.estado.set('enviado');
        },
        error: (e: HttpErrorResponse) => {
          this.estado.set('iniciando');
          const cuerpo = e.error as { message?: string; error?: string } | null;
          this.error.set(
            cuerpo?.message ??
              cuerpo?.error ??
              'No se pudo registrar tu solicitud. Revisa tu conexión e inténtalo de nuevo.'
          );
        },
      });
  }
}

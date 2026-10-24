import { Component, Input, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { API_BASE, LOCALE, JsonMap } from '../cms/cms.models';

/**
 * Formulario de contacto del sitio público.
 *
 * Los campos que se muestran los decide la institución en el bloque
 * `contactForm` del catálogo; los que están ocultos no se envían. Al enviar,
 * el servidor devuelve un ticket y el visitante lo ve: así sabe que su
 * mensaje quedó registrado aunque el correo a la institución no se haya
 * podido enviar.
 */
@Component({
  selector: 'app-formulario-contacto',
  standalone: true,
  imports: [FormsModule],
  template: `
    <form class="formulario" (ngSubmit)="enviar()" novalidate>
      <h2 class="formulario__titulo">{{ titulo() }}</h2>
      @if (texto()) {
        <p class="formulario__texto">{{ texto() }}</p>
      }

      @if (estado() === 'enviado') {
        <p class="formulario__aviso" role="status">
          Guardamos tu mensaje. Tu código es <strong>{{ ticket() }}</strong>. Te responderemos al correo
          que escribiste.
        </p>
      } @else {
        @if (campos().nombre) {
          <div class="formulario__campo">
            <label for="contacto-nombre">Nombre</label>
            <input id="contacto-nombre" name="nombre" type="text" autocomplete="name"
              [placeholder]="placeholder('name')" [(ngModel)]="nombre" />
          </div>
        }
        @if (campos().correo) {
          <div class="formulario__campo">
            <label for="contacto-correo">Correo electrónico</label>
            <input id="contacto-correo" name="correo" type="email" required autocomplete="email"
              [placeholder]="placeholder('email')" [(ngModel)]="correo" />
          </div>
        }
        @if (campos().telefono) {
          <div class="formulario__campo">
            <label for="contacto-telefono">Teléfono</label>
            <input id="contacto-telefono" name="telefono" type="tel" autocomplete="tel"
              [placeholder]="placeholder('phone')" [(ngModel)]="telefono" />
          </div>
        }
        @if (campos().asunto) {
          <div class="formulario__campo">
            <label for="contacto-asunto">Asunto</label>
            <input id="contacto-asunto" name="asunto" type="text"
              [placeholder]="placeholder('subject')" [(ngModel)]="asunto" />
          </div>
        }
        @if (campos().mensaje) {
          <div class="formulario__campo">
            <label for="contacto-mensaje">Mensaje</label>
            <textarea id="contacto-mensaje" name="mensaje" rows="6" required
              [placeholder]="placeholder('message')" [(ngModel)]="mensaje"></textarea>
          </div>
        }

        @if (error()) {
          <p class="formulario__error" role="alert">{{ error() }}</p>
        }

        <button class="boton" type="submit" [disabled]="enviando()">
          {{ enviando() ? 'Enviando…' : boton() }}
        </button>
      }
    </form>
  `,
  styles: [
    `
      :host { display: block; }
      .formulario {
        display: grid;
        gap: 1rem;
        max-width: 40rem;
        margin-inline: auto;
        padding: 2rem;
        border: 1px solid var(--color-borde);
        border-radius: var(--radio-tarjeta, 6px);
        background: var(--color-fondo);
      }
      .formulario__titulo { margin: 0; font-size: var(--texto-xl, 1.5rem); font-weight: 600; }
      .formulario__texto { margin: 0; color: var(--color-texto-suave); }
      .formulario__campo { display: grid; gap: 0.35rem; }
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
      .formulario__aviso {
        margin: 0;
        padding: 1rem;
        border: 1px solid var(--color-borde-control, var(--color-secundario));
        border-radius: var(--radio-campo, 4px);
        background: var(--color-superficie);
      }
      .formulario__error { margin: 0; color: var(--color-acento); font-weight: 600; }
      button { justify-self: start; }
      button:disabled { opacity: 0.7; cursor: progress; }
    `,
  ],
})
export class FormularioContacto {
  private readonly http = inject(HttpClient);

  @Input() bloque: JsonMap = {};
  @Input() csrf = '';
  @Input() ruta = '';

  nombre = '';
  correo = '';
  telefono = '';
  asunto = '';
  mensaje = '';

  readonly estado = signal<'iniciando' | 'enviando' | 'enviado'>('iniciando');
  readonly ticket = signal('');
  readonly error = signal('');
  readonly enviando = computed(() => this.estado() === 'enviando');

  readonly titulo = computed(() => this.textoCampo('title', 'Escríbenos'));
  readonly texto = computed(() => this.textoCampo('text', ''));
  readonly boton = computed(() => this.textoCampo('submitLabel', 'Enviar mensaje'));
  readonly campos = computed(() => {
    const campos = this.bloque['fields'];
    const defecto = { nombre: true, correo: true, telefono: true, asunto: true, mensaje: true };
    if (!campos || typeof campos !== 'object') {
      return defecto;
    }
    const elegido = campos as Record<string, unknown>;
    const valor = (clave: string): boolean =>
      typeof elegido[clave] === 'boolean' ? (elegido[clave] as boolean) : defecto[clave as keyof typeof defecto];
    return {
      nombre: valor('nombre'),
      correo: valor('correo'),
      telefono: valor('telefono'),
      asunto: valor('asunto'),
      mensaje: valor('mensaje'),
    };
  });

  placeholder(clave: string): string {
    const textos = this.bloque['placeholders'];
    if (!textos || typeof textos !== 'object') {
      return '';
    }
    const valor = (textos as Record<string, unknown>)[clave];
    return typeof valor === 'string' ? valor : '';
  }

  textoCampo(clave: string, defecto: string): string {
    const valor = this.bloque[clave];
    return typeof valor === 'string' && valor.trim() !== '' ? valor : defecto;
  }

  enviar(): void {
    if (this.enviando()) {
      return;
    }
    if (!this.correo.trim() || !this.mensaje.trim()) {
      this.error.set('Escribe tu correo y tu mensaje para poder enviarlo.');
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
          asunto: this.asunto,
          mensaje: this.mensaje,
          ruta: this.ruta,
          tipo: 'contacto',
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
              'No se pudo guardar tu mensaje. Revisa tu conexión e inténtalo de nuevo.'
          );
        },
      });
  }
}

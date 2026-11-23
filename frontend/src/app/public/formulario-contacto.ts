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
        @if (campos().documento) {
          <div class="formulario__campo">
            <label for="contacto-documento">Documento (DNI o RUC)</label>
            <input id="contacto-documento" name="documento" type="text" inputmode="numeric"
              [placeholder]="placeholder('documento')" [(ngModel)]="documento" />
          </div>
        }
        @if (campos().correo) {
          <div class="formulario__campo">
            <label for="contacto-correo">Correo electrónico</label>
            <input id="contacto-correo" name="correo" type="email" required autocomplete="email"
              [placeholder]="placeholder('email')" [(ngModel)]="correo"
              [attr.aria-invalid]="errores()['correo'] ? 'true' : null"
              (ngModelChange)="limpiarError('correo')" />
            @if (errores()['correo']; as mensaje) {
              <p class="formulario__error" role="alert">{{ mensaje }}</p>
            }
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
              [placeholder]="placeholder('message')" [(ngModel)]="mensaje"
              [attr.aria-invalid]="errores()['mensaje'] ? 'true' : null"
              (ngModelChange)="limpiarError('mensaje')"></textarea>
            @if (errores()['mensaje']; as mensaje) {
              <p class="formulario__error" role="alert">{{ mensaje }}</p>
            }
          </div>
        }

        @if (campos().consentimiento) {
          <div>
            <label class="formulario__consentimiento">
              <input type="checkbox" name="consentimiento" id="contacto-consentimiento"
                [(ngModel)]="consentimiento"
                [attr.aria-invalid]="errores()['consentimiento'] ? 'true' : null"
                (ngModelChange)="limpiarError('consentimiento')" />
              <span>{{ consentTexto() }}</span>
            </label>
            @if (errores()['consentimiento']; as mensaje) {
              <p class="formulario__error" role="alert">{{ mensaje }}</p>
            }
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
      input[aria-invalid='true'], textarea[aria-invalid='true'] {
        border-color: var(--color-acento);
      }
      textarea { min-height: 8rem; resize: vertical; }
      .formulario__consentimiento { display: flex; gap: 0.6rem; align-items: flex-start; font-weight: 400; }
      .formulario__consentimiento input { margin-top: 0.3rem; min-height: auto; }
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
  documento = '';
  consentimiento = false;

  readonly estado = signal<'iniciando' | 'enviando' | 'enviado'>('iniciando');
  readonly ticket = signal('');
  readonly error = signal('');
  readonly errores = signal<Record<string, string>>({});
  readonly enviando = computed(() => this.estado() === 'enviando');

  /** El error de un campo se retira cuando la persona lo corrige. */
  limpiarError(campo: string): void {
    this.errores.update((actuales) => {
      if (!actuales[campo]) {
        return actuales;
      }
      const copia = { ...actuales };
      delete copia[campo];
      return copia;
    });
  }

  titulo(): string {
    return this.textoCampo('title', 'Escríbenos');
  }

  texto(): string {
    return this.textoCampo('text', '');
  }

  boton(): string {
    return this.textoCampo('submitLabel', 'Enviar mensaje');
  }

  campos(): Record<
    'nombre' | 'correo' | 'telefono' | 'asunto' | 'mensaje' | 'documento' | 'consentimiento',
    boolean
  > {
    const campos = this.bloque['fields'];
    const defecto = {
      nombre: true,
      correo: true,
      telefono: true,
      asunto: true,
      mensaje: true,
      documento: false,
      consentimiento: false,
    };
    if (!campos || typeof campos !== 'object') {
      return defecto;
    }
    // El catálogo guarda los campos con su nombre técnico (name, email, phone,
    // subject, message); la plantilla usa los nombres en español. Documento y
    // consentimiento son opcionales: sin bandera explícita no se muestran.
    const elegido = campos as Record<string, unknown>;
    const valor = (clave: string): boolean =>
      typeof elegido[clave] === 'boolean' ? (elegido[clave] as boolean) : true;
    const opcional = (clave: string): boolean => elegido[clave] === true;
    return {
      nombre: valor('name'),
      correo: valor('email'),
      telefono: valor('phone'),
      asunto: valor('subject'),
      mensaje: valor('message'),
      documento: opcional('documento'),
      consentimiento: opcional('consentimiento'),
    };
  }

  /** Uso del formulario: «contacto» o «tramite» (mesa de partes). */
  tipo(): string {
    return this.bloque['tipo'] === 'tramite' ? 'tramite' : 'contacto';
  }

  /** Texto junto a la casilla de autorización de datos personales. */
  consentTexto(): string {
    return this.textoCampo(
      'consentText',
      'Autorizo el tratamiento de mis datos personales para atender esta solicitud, conforme a la Ley N.° 29733 de Protección de Datos Personales.'
    );
  }

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
    const errores: Record<string, string> = {};
    if (this.campos().correo) {
      const correo = this.correo.trim();
      if (!correo) {
        errores['correo'] = 'Escribe tu correo para que podamos responderte.';
      } else if (!/^\S+@\S+\.\S+$/.test(correo)) {
        errores['correo'] = 'Ese correo no parece completo. Revísalo antes de enviar.';
      }
    }
    if (this.campos().mensaje && !this.mensaje.trim()) {
      errores['mensaje'] = 'Escribe tu mensaje.';
    }
    // La casilla solo es obligatoria cuando está a la vista.
    if (this.campos().consentimiento && !this.consentimiento) {
      errores['consentimiento'] =
        'Marca la autorización de tratamiento de datos para continuar.';
    }
    this.errores.set(errores);
    const primero = ['correo', 'mensaje', 'consentimiento'].find((campo) => errores[campo]);
    if (primero) {
      document.getElementById(`contacto-${primero}`)?.focus();
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
          documento: this.documento,
          consentimiento: this.consentimiento,
          ruta: this.ruta,
          tipo: this.tipo(),
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
          const cuerpo = e.error as { message?: string; error?: string; campo?: string } | null;
          const mensaje =
            cuerpo?.message ??
            cuerpo?.error ??
            'No se pudo guardar tu mensaje. Revisa tu conexión e inténtalo de nuevo.';
          // Si el API señala un campo concreto, el error va junto a él.
          if (cuerpo?.campo && document.getElementById(`contacto-${cuerpo.campo}`)) {
            this.errores.set({ [cuerpo.campo]: mensaje });
            document.getElementById(`contacto-${cuerpo.campo}`)?.focus();
            return;
          }
          this.error.set(mensaje);
        },
      });
  }
}

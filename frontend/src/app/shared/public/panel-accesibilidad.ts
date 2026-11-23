import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { API_BASE, LOCALE } from '../../cms/cms.models';
import { SitioPublicoService } from '../../core/sitio-publico.service';
import { Icono } from './icono';

export type Ajuste =
  | 'texto-grande'
  | 'alto-contraste'
  | 'resaltar-enlaces'
  | 'sin-animaciones'
  | 'fuente-legible'
  | 'espaciado';

const AJUSTES: { id: Ajuste; nombre: string }[] = [
  { id: 'texto-grande', nombre: 'Texto más grande' },
  { id: 'alto-contraste', nombre: 'Alto contraste' },
  { id: 'resaltar-enlaces', nombre: 'Resaltar enlaces' },
  { id: 'sin-animaciones', nombre: 'Detener animaciones' },
  { id: 'fuente-legible', nombre: 'Fuente más legible' },
  { id: 'espaciado', nombre: 'Más espacio entre líneas' },
];
const CLAVE = 'pa-ajustes';

/**
 * Ajustes de lectura del visitante. Cada ajuste es una clase en <html>, así
 * se aplica a todo el sitio sin que cada componente lo conozca, y se recuerda
 * en este navegador.
 *
 * Al final del diálogo hay un «Reportar un problema»: abre un mini
 * formulario que envía un mensaje de tipo `accesibilidad` al mismo endpoint
 * del formulario de contacto (`POST /mensajes`), con la ruta de la página
 * donde se encontró la barrera. La descripción es obligatoria y el correo es
 * opcional: quien reporta no siempre quiere dejar sus datos.
 */
@Component({
  selector: 'app-panel-accesibilidad',
  standalone: true,
  imports: [Icono, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="pa-boton"
      aria-label="Opciones de accesibilidad"
      aria-controls="pa-dialogo"
      [attr.aria-expanded]="abierto()"
      (click)="alternarPanel()"
    >
      <app-icono nombre="accesibilidad" />
    </button>
    @if (abierto()) {
      <div id="pa-dialogo" class="pa-dialogo" role="dialog" aria-label="Opciones de accesibilidad">
        <p class="pa-dialogo__titulo">Accesibilidad</p>
        <ul>
          @for (a of ajustes; track a.id) {
            <li>
              <button
                type="button"
                class="pa-ajuste"
                [attr.aria-pressed]="activos().includes(a.id)"
                (click)="alternar(a.id)"
              >
                {{ a.nombre }}
              </button>
            </li>
          }
        </ul>
        <button type="button" class="pa-restablecer" (click)="restablecer()">Restablecer</button>

        <div class="pa-reporte">
          @if (reporteEstado() === 'enviado') {
            <p class="pa-reporte__aviso" role="status" tabindex="-1" id="pa-reporte-aviso">
              Gracias por avisarnos. Guardamos tu reporte con el código
              <strong>{{ ticket() }}</strong>.
            </p>
          } @else if (reporteAbierto()) {
            <form class="pa-reporte__form" (ngSubmit)="enviarReporte()" novalidate>
              <label class="pa-reporte__etiqueta" for="pa-reporte-desc">
                ¿Qué problema encontraste?
              </label>
              <textarea
                id="pa-reporte-desc"
                name="pa-descripcion"
                rows="3"
                [(ngModel)]="reporteDescripcion"
                [attr.aria-invalid]="reporteErrores()['descripcion'] ? 'true' : null"
                (ngModelChange)="limpiarErrorReporte('descripcion')"
              ></textarea>
              @if (reporteErrores()['descripcion']; as avisoDesc) {
                <p class="pa-reporte__error" role="alert">{{ avisoDesc }}</p>
              }
              <label class="pa-reporte__etiqueta" for="pa-reporte-correo">
                Correo electrónico (opcional)
              </label>
              <input
                id="pa-reporte-correo"
                name="pa-correo"
                type="email"
                autocomplete="email"
                [(ngModel)]="reporteCorreo"
                [attr.aria-invalid]="reporteErrores()['correo'] ? 'true' : null"
                (ngModelChange)="limpiarErrorReporte('correo')"
              />
              @if (reporteErrores()['correo']; as avisoCorreo) {
                <p class="pa-reporte__error" role="alert">{{ avisoCorreo }}</p>
              }
              @if (reporteError(); as error) {
                <p class="pa-reporte__error" role="alert">{{ error }}</p>
              }
              <div class="pa-reporte__acciones">
                <button type="submit" class="pa-reporte__enviar" [disabled]="reporteEnviando()">
                  {{ reporteEnviando() ? 'Enviando…' : 'Enviar reporte' }}
                </button>
                <button type="button" class="pa-reporte__cancelar" (click)="cerrarReporte()">
                  Cancelar
                </button>
              </div>
            </form>
          } @else {
            <button type="button" class="pa-reportar" id="pa-reportar" (click)="abrirReporte()">
              <app-icono nombre="mensaje" />
              Reportar un problema
            </button>
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      /* Solo lo nuevo del reporte: los estilos base del panel (.pa-boton,
         .pa-dialogo, .pa-ajuste…) viven en styles/_marco.scss. */
      .pa-reporte {
        margin-top: 0.75rem;
        padding-top: 0.75rem;
        border-top: 1px solid var(--color-borde);
      }
      .pa-reportar,
      .pa-reporte__cancelar {
        min-height: 2.75rem;
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--color-borde);
        border-radius: var(--radio-campo);
        background: var(--color-fondo);
        color: var(--color-texto);
        font: inherit;
      }
      .pa-reportar {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        width: 100%;
        color: var(--color-primario);
        font-weight: 600;
      }
      .pa-reportar .icono {
        width: 1.1rem;
        height: 1.1rem;
      }
      .pa-reporte__form {
        display: grid;
        gap: 0.4rem;
      }
      .pa-reporte__etiqueta {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--color-texto);
      }
      .pa-reporte__form textarea,
      .pa-reporte__form input {
        font: inherit;
        padding: 0.5rem 0.6rem;
        border: 1px solid var(--color-borde-control, var(--color-borde));
        border-radius: var(--radio-campo);
        background: var(--color-fondo);
        color: var(--color-texto);
      }
      .pa-reporte__form textarea {
        min-height: 4.5rem;
        resize: vertical;
      }
      .pa-reporte__form [aria-invalid='true'] {
        border-color: var(--color-acento);
      }
      .pa-reporte__error {
        margin: 0;
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--color-acento);
      }
      .pa-reporte__aviso {
        margin: 0;
        padding: 0.75rem;
        border: 1px solid var(--color-borde-control, var(--color-borde));
        border-radius: var(--radio-campo);
        background: var(--color-superficie);
        font-size: 0.9rem;
      }
      .pa-reporte__acciones {
        display: flex;
        gap: 0.5rem;
        margin-top: 0.25rem;
      }
      .pa-reporte__enviar {
        flex: 1;
        min-height: 2.75rem;
        padding: 0.5rem 0.75rem;
        border: 0;
        border-radius: var(--radio-campo);
        background: var(--color-primario);
        color: var(--color-boton-texto, #fff);
        font: inherit;
        font-weight: 600;
      }
      .pa-reporte__enviar:disabled {
        opacity: 0.7;
        cursor: progress;
      }
      @media (prefers-reduced-motion: reduce) {
        .pa-reporte * {
          transition: none;
        }
      }
    `,
  ],
})
export class PanelAccesibilidad {
  private readonly http = inject(HttpClient);
  private readonly sitio = inject(SitioPublicoService);

  readonly ajustes = AJUSTES;
  readonly abierto = signal(false);
  readonly activos = signal<Ajuste[]>(leerGuardados());

  /* Mini formulario «Reportar un problema»: edición, envío y resultado. */
  readonly reporteAbierto = signal(false);
  readonly reporteEstado = signal<'editando' | 'enviando' | 'enviado'>('editando');
  readonly reporteEnviando = computed(() => this.reporteEstado() === 'enviando');
  readonly reporteErrores = signal<Record<string, string>>({});
  readonly reporteError = signal('');
  readonly ticket = signal('');

  reporteDescripcion = '';
  reporteCorreo = '';

  constructor() {
    effect(() => {
      const raiz = document.documentElement;
      for (const a of AJUSTES) {
        raiz.classList.toggle(`pa-${a.id}`, this.activos().includes(a.id));
      }
      try {
        localStorage.setItem(CLAVE, JSON.stringify(this.activos()));
      } catch {
        // Sin almacenamiento (modo privado): el ajuste vale para esta visita.
      }
    });
  }

  alternarPanel(): void {
    const siguiente = !this.abierto();
    this.abierto.set(siguiente);
    if (!siguiente) {
      // Al cerrar el diálogo el reporte vuelve a su estado inicial: un aviso
      // de éxito viejo o un borrador a medias no deben esperar al visitante.
      this.reiniciarReporte();
    }
  }

  alternar(id: Ajuste): void {
    this.activos.update((lista) =>
      lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id],
    );
  }

  restablecer(): void {
    this.activos.set([]);
  }

  abrirReporte(): void {
    this.reporteAbierto.set(true);
    this.reporteError.set('');
    this.reporteErrores.set({});
    // El foco entra al primer campo cuando el formulario ya está pintado.
    setTimeout(() => document.getElementById('pa-reporte-desc')?.focus(), 0);
  }

  cerrarReporte(): void {
    this.reporteAbierto.set(false);
    this.reporteErrores.set({});
    this.reporteError.set('');
    // El foco vuelve al botón que abrió el formulario.
    setTimeout(() => document.getElementById('pa-reportar')?.focus(), 0);
  }

  /** El error de un campo se retira cuando la persona lo corrige. */
  limpiarErrorReporte(campo: string): void {
    this.reporteErrores.update((actuales) => {
      if (!actuales[campo]) {
        return actuales;
      }
      const copia = { ...actuales };
      delete copia[campo];
      return copia;
    });
  }

  async enviarReporte(): Promise<void> {
    if (this.reporteEnviando()) {
      return;
    }
    const errores: Record<string, string> = {};
    if (!this.reporteDescripcion.trim()) {
      errores['descripcion'] = 'Describe el problema que encontraste.';
    }
    const correo = this.reporteCorreo.trim();
    if (correo && !/^\S+@\S+\.\S+$/.test(correo)) {
      errores['correo'] = 'Ese correo no parece completo. Revísalo antes de enviar.';
    }
    this.reporteErrores.set(errores);
    const primero = (['descripcion', 'correo'] as const).find((campo) => errores[campo]);
    if (primero) {
      document
        .getElementById(primero === 'descripcion' ? 'pa-reporte-desc' : 'pa-reporte-correo')
        ?.focus();
      return;
    }

    this.reporteEstado.set('enviando');
    this.reporteError.set('');
    // El marco pide el token de sesión al cargar cada página; si todavía no
    // llegó (primera carga lenta), se espera a la carga en vez de fallar.
    if (!this.sitio.csrf()) {
      await this.sitio.cargar();
    }
    this.http
      .post<{ ticket: string }>(
        `${API_BASE}/mensajes`,
        {
          nombre: '',
          correo,
          asunto: 'Reporte de accesibilidad',
          mensaje: this.reporteDescripcion.trim(),
          ruta: location.pathname,
          tipo: 'accesibilidad',
        },
        { headers: { 'X-CSRF-Token': this.sitio.csrf() }, params: { locale: LOCALE } }
      )
      .subscribe({
        next: (r) => {
          this.ticket.set(r.ticket);
          this.reporteEstado.set('enviado');
          setTimeout(() => document.getElementById('pa-reporte-aviso')?.focus(), 0);
        },
        error: (e: HttpErrorResponse) => {
          this.reporteEstado.set('editando');
          const cuerpo = e.error as { message?: string; error?: string } | null;
          this.reporteError.set(
            cuerpo?.message ??
              cuerpo?.error ??
              'No se pudo guardar tu reporte. Revisa tu conexión e inténtalo de nuevo.'
          );
        },
      });
  }

  @HostListener('document:keydown.escape')
  cerrar(): void {
    if (this.abierto()) {
      this.alternarPanel();
    }
  }

  /** Deja el reporte como si nunca se hubiera tocado. */
  private reiniciarReporte(): void {
    this.reporteAbierto.set(false);
    this.reporteEstado.set('editando');
    this.reporteErrores.set({});
    this.reporteError.set('');
    this.ticket.set('');
    this.reporteDescripcion = '';
    this.reporteCorreo = '';
  }
}

function leerGuardados(): Ajuste[] {
  try {
    const guardado: unknown = JSON.parse(localStorage.getItem(CLAVE) ?? '[]');
    return Array.isArray(guardado)
      ? guardado.filter((x): x is Ajuste => AJUSTES.some((a) => a.id === x))
      : [];
  } catch {
    return [];
  }
}

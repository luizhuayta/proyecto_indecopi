import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';

/**
 * Diálogo de confirmación del panel.
 *
 * Sustituye al `window.confirm` del navegador: el confirmador nativo no se
 * puede vestir con el material del panel, corta el contexto de la pantalla y
 * en algunos navegadores ni siquiera se puede probar desde una prueba
 * automatizada. Este diálogo usa los mismos tokens que el resto del panel y
 * cumple lo mínimo que se le pide a un diálogo: foco atrapado, Escape para
 * cancelar y el foco devuelto a donde estaba.
 */
@Component({
  selector: 'app-dialogo-confirmacion',
  standalone: true,
  template: `
    <div class="dialogo" (click)="cancelar()">
      <div
        #carta
        class="dialogo__carta"
        [class.dialogo__carta--peligro]="peligro"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="idTitulo"
        [attr.aria-describedby]="idMensaje"
        tabindex="-1"
        (click)="$event.stopPropagation()"
        (keydown)="alTeclear($event)"
      >
        <span class="dialogo__icono" aria-hidden="true">
          @if (peligro) {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M12 4 2.8 20h18.4L12 4Z" stroke-linejoin="round" />
              <path d="M12 10v4.2M12 17.2v.1" stroke-linecap="round" />
            </svg>
          } @else {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7.5V12l3 2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          }
        </span>
        <h2 class="dialogo__titulo" [id]="idTitulo">{{ titulo }}</h2>
        @if (mensaje) {
          <p class="dialogo__mensaje" [id]="idMensaje">{{ mensaje }}</p>
        }
        <div class="dialogo__acciones">
          <button type="button" class="admin-btn" (click)="cancelar()">{{ textoCancelar }}</button>
          <button
            #botonConfirmar
            type="button"
            class="admin-btn"
            [class.admin-btn--primario]="!peligro"
            [class.admin-btn--peligro-solido]="peligro"
            (click)="confirmar()"
          >
            {{ textoConfirmar }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class DialogoConfirmacion implements AfterViewInit, OnDestroy {
  @Input() titulo = '';
  @Input() mensaje = '';
  @Input() textoConfirmar = 'Confirmar';
  @Input() textoCancelar = 'Cancelar';
  /** Marca la acción como destructiva: el botón principal cambia de color. */
  @Input() peligro = false;

  @Output() confirmado = new EventEmitter<void>();
  @Output() cancelado = new EventEmitter<void>();

  readonly idTitulo = `dialogo-titulo-${++contador}`;
  readonly idMensaje = `dialogo-mensaje-${contador}`;

  @ViewChild('botonConfirmar') private confirmarBoton?: ElementRef<HTMLButtonElement>;
  @ViewChild('carta') private carta?: ElementRef<HTMLElement>;

  private elementoPrevio: HTMLElement | null = null;

  ngAfterViewInit(): void {
    this.elementoPrevio = (document.activeElement as HTMLElement) ?? null;
    // El foco va a la acción menos destructiva: en una confirmación de
    // borrado, al botón de cancelar; si no, al de confirmar.
    const foco = this.peligro
      ? this.carta?.nativeElement.querySelector<HTMLElement>('.admin-btn')
      : this.confirmarBoton?.nativeElement;
    foco?.focus();
    document.body.style.overflow = 'hidden';
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
    this.elementoPrevio?.focus?.();
  }

  constructor() {}

  confirmar(): void {
    this.confirmado.emit();
  }

  cancelar(): void {
    this.cancelado.emit();
  }

  /** Escape cancela; Tab circula dentro del diálogo y nunca se sale de él. */
  alTeclear(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      this.cancelar();
      return;
    }
    if (evento.key !== 'Tab') {
      return;
    }
    const focos = this.enfocables();
    if (focos.length === 0) {
      return;
    }
    const primero = focos[0];
    const ultimo = focos[focos.length - 1];
    const activo = document.activeElement;
    if (evento.shiftKey && activo === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && activo === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }

  private enfocables(): HTMLElement[] {
    if (!this.carta) {
      return [];
    }
    return Array.from(
      this.carta.nativeElement.querySelectorAll<HTMLElement>('button, [href], input, select, textarea'),
    ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
  }
}

let contador = 0;

import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * Estado vacío del panel.
 *
 * Un estado vacío no es un texto gris: es una pantalla pequena que explica
 * qué falta y ofrece la acción que lo resuelve. Este componente es el lugar
 * único donde se resuelve, para que los siete estados vacíos del panel se
 * vean iguales entre sí y no parezcan siete textos sueltos.
 */
@Component({
  selector: 'app-estado-vacio',
  standalone: true,
  template: `
    <div class="estado-vacio">
      <span class="estado-vacio__icono" aria-hidden="true">
        @switch (icono) {
          @case ('paginas') {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M9 3h7l5 5v13H9a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke-linejoin="round" />
              <path d="M16 3v5h5M4 7v13a1 1 0 0 0 1 1h11" stroke-linejoin="round" />
            </svg>
          }
          @case ('imagenes') {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="8.5" cy="10" r="1.5" />
              <path d="m4 17 5-5 4 4 3-3 4 4" stroke-linejoin="round" />
            </svg>
          }
          @case ('mensajes') {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3.5 7 8.5 6 8.5-6" stroke-linejoin="round" />
            </svg>
          }
          @case ('usuarios') {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="9.5" cy="8" r="3.5" />
              <path d="M3 20a6.5 6.5 0 0 1 13 0" stroke-linecap="round" />
              <path d="M16.5 5.2a3.5 3.5 0 0 1 0 6.6M18 14.4A6.5 6.5 0 0 1 21 20" stroke-linecap="round" />
            </svg>
          }
          @case ('versiones') {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5.2l3.4 2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          }
          @case ('bloque') {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" stroke-linejoin="round" />
              <path d="m4 7.5 8 4.5 8-4.5M12 12v9" stroke-linejoin="round" />
            </svg>
          }
          @case ('busqueda') {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.9-3.9" stroke-linecap="round" />
            </svg>
          }
          @default {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5M12 16v.1" stroke-linecap="round" />
            </svg>
          }
        }
      </span>
      <p class="estado-vacio__titulo">{{ titulo }}</p>
      @if (mensaje) {
        <p class="estado-vacio__mensaje">{{ mensaje }}</p>
      }
      @if (textoAccion) {
        <button type="button" class="admin-btn admin-btn--primario" (click)="accion.emit()">
          {{ textoAccion }}
        </button>
      }
    </div>
  `,
})
export class EstadoVacio {
  /** Nombre del icono: paginas, imagenes, mensajes, usuarios, versiones, bloque, busqueda. */
  @Input() icono = 'vacio';
  @Input() titulo = '';
  @Input() mensaje = '';
  /** Si se indica, aparece un botón que emite `accion`. */
  @Input() textoAccion = '';

  @Output() accion = new EventEmitter<void>();
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from './toast';

/** Avisos institucionales con acento según el resultado de la operación. */
@Component({
  selector: 'app-toast-host',
  standalone: true,
  template: `
    <div class="toast-host" aria-label="Notificaciones del sistema">
      @for (t of toast.toasts(); track t.id) {
        <div
          class="toast"
          [class.toast-ok]="t.type === 'success'"
          [class.toast-err]="t.type === 'error'"
          [attr.role]="t.type === 'error' ? 'alert' : 'status'"
          [attr.aria-live]="t.type === 'error' ? 'assertive' : 'polite'"
        >
          <div class="toast-symbol" aria-hidden="true">
            <i class="fa-solid" [class.fa-circle-check]="t.type === 'success'" [class.fa-circle-exclamation]="t.type === 'error'"></i>
          </div>
          <div class="toast-content">
            <strong class="toast-title">{{ t.type === 'success' ? 'Operación exitosa' : 'No se pudo completar' }}</strong>
            <p class="toast-message">{{ t.message }}</p>
          </div>
          <button type="button" class="toast-close" [attr.aria-label]="'Cerrar notificación: ' + t.message" (click)="toast.dismiss(t.id)">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastHost {
  readonly toast = inject(ToastService);
}

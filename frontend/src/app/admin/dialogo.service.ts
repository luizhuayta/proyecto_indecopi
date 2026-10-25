import { ApplicationRef, EnvironmentInjector, Injectable, createComponent, inject } from '@angular/core';
import { DialogoConfirmacion } from './dialogo-confirmacion';

/** Opciones de una confirmación del panel. */
export interface OpcionesDialogo {
  titulo: string;
  mensaje?: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  /** La acción destruye algo: el botón principal va en color de aviso. */
  peligro?: boolean;
}

/**
 * Abre el diálogo de confirmación del panel y espera la respuesta.
 *
 * Vive como servicio y no como una etiqueta en cada pantalla porque las
 * confirmaciones aparecen en el constructor de páginas, en medios y en la
 * publicación: el `window.confirm` nativo se sustituye en los tres sitios
 * por la misma llamada, y el marcado del diálogo existe en un único lugar.
 */
@Injectable({ providedIn: 'root' })
export class DialogoService {
  private readonly appRef = inject(ApplicationRef);
  private readonly environment = inject(EnvironmentInjector);

  /** Resuelve true si el usuario confirma, false si cancela o cierra. */
  async confirmar(opciones: OpcionesDialogo): Promise<boolean> {
    const host = document.createElement('div');
    document.body.appendChild(host);

    const ref = createComponent(DialogoConfirmacion, {
      environmentInjector: this.environment,
      hostElement: host,
    });
    this.appRef.attachView(ref.hostView);
    ref.setInput('titulo', opciones.titulo);
    ref.setInput('mensaje', opciones.mensaje ?? '');
    ref.setInput('textoConfirmar', opciones.textoConfirmar ?? 'Confirmar');
    ref.setInput('textoCancelar', opciones.textoCancelar ?? 'Cancelar');
    ref.setInput('peligro', opciones.peligro ?? false);
    // El componente se acaba de crear: sin un cambio de detección, los
    // valores recibidos todavía no están en el DOM.
    ref.changeDetectorRef.detectChanges();

    const respuesta = await new Promise<boolean>((resolver) => {
      ref.instance.confirmado.subscribe(() => resolver(true));
      ref.instance.cancelado.subscribe(() => resolver(false));
    });

    this.appRef.detachView(ref.hostView);
    ref.destroy();
    host.remove();
    return respuesta;
  }
}

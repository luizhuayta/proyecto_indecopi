import { Component } from '@angular/core';

@Component({
  selector: 'app-inicio',
  standalone: true,
  template: `
    <main class="container">
      <h1>Plantilla lista</h1>
      <p>
        El andamiaje de la plantilla educativa está funcionando correctamente.
        El contenido de este sitio se gestiona desde el panel de administración.
      </p>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        padding: 3rem 0;
      }
      h1 {
        color: var(--color-primario);
      }
    `,
  ],
})
export class Inicio {}

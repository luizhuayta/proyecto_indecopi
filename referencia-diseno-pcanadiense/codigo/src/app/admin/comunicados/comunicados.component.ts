import { GestionPreview } from '../shared/gestion-preview/gestion-preview';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin-comunicados',
  standalone: true,
  imports: [GestionPreview, RouterLink],
  template: `
<div class="gestion-live-grid">
  <section class="gestion-live-editor">

    <div class="admin-page">
      <header class="page-header">
        <div>
          <h1 class="page-title">Comunicados</h1>
          <p class="page-sub">
            Los comunicados oficiales se publican desde Noticias, con el tipo Comunicado. Así
            aparecen en el mismo listado público.
          </p>
        </div>
        <a class="btn-add" routerLink="/admin/noticias">
          <i class="fa fa-newspaper"></i> Ir a noticias
        </a>
      </header>
      <div class="comunicados-aviso" role="note">
        <span class="comunicados-aviso-icono" aria-hidden="true">
          <i class="fa-solid fa-circle-info"></i>
        </span>
        <div class="comunicados-aviso-texto">
          <strong>¿Cómo publicar un comunicado?</strong>
          <p>Ingresa a <strong>Noticias</strong>, selecciona el tipo <strong>Comunicado</strong>, añade la imagen y redacta el contenido. Al guardar, se mostrará en la sección pública de noticias.</p>
        </div>
      </div>
    </div>
  
  </section>
      <app-gestion-preview
        modulo="comunicados"
        titulo="Comunicados"
      />
</div>`,
  styles: `
    .comunicados-aviso { display: flex; align-items: flex-start; gap: 13px; padding: 16px 19px; border: 1px solid var(--adm-brand-border); border-radius: 14px; background: color-mix(in srgb, var(--adm-brand-soft) 35%, var(--adm-surface)); color: var(--adm-ink); }
    .comunicados-aviso-icono { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 34px; width: 34px; height: 34px; border-radius: 10px; background: var(--adm-brand-soft); color: var(--adm-brand); font-size: 1rem; }
    .comunicados-aviso-texto { min-width: 0; }
    .comunicados-aviso-texto > strong { display: block; margin: 0 0 4px; font-size: .9rem; font-weight: 750; }
    .comunicados-aviso-texto p { margin: 0; font-size: .85rem; line-height: 1.6; color: var(--adm-muted); }
    .comunicados-aviso-texto p strong { color: var(--adm-ink); font-weight: 700; }
    @media (max-width: 600px) { .comunicados-aviso { padding: 14px; gap: 10px; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminComunicadosComponent {}

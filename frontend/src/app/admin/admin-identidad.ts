import { Component, OnInit, inject, signal } from '@angular/core';
import { CmsApiService, Identidad } from '../cms/cms-api.service';

type Campo = keyof Omit<Identidad, 'actualizado_en'>;

interface CampoDef {
  key: Campo;
  label: string;
  type: 'text' | 'email' | 'tel';
  autocomplete: string;
  ayuda?: string;
}

const CAMPOS: CampoDef[] = [
  { key: 'nombre', label: 'Nombre de la institución', type: 'text', autocomplete: 'organization' },
  {
    key: 'ruc',
    label: 'RUC',
    type: 'text',
    autocomplete: 'off',
    ayuda: 'El RUC (Registro Único de Contribuyentes) es el número de 11 dígitos que identifica a tu institución ante la SUNAT.',
  },
  { key: 'direccion', label: 'Dirección', type: 'text', autocomplete: 'street-address' },
  { key: 'telefono', label: 'Teléfono', type: 'tel', autocomplete: 'tel' },
  { key: 'correo', label: 'Correo', type: 'email', autocomplete: 'email' },
  { key: 'ciudad', label: 'Ciudad', type: 'text', autocomplete: 'address-level2' },
];

const VACIO: Identidad = {
  nombre: '',
  ruc: '',
  direccion: '',
  telefono: '',
  correo: '',
  ciudad: '',
};

/**
 * Identidad de la institución: nombre, RUC, dirección, teléfono, correo y
 * ciudad. Guardar y Publicar son acciones distintas; ambas guardan en el
 * servidor (el contrato de identidad no expone un borrador aparte) pero el
 * aviso de éxito dice exactamente cuál se ejecutó.
 */
@Component({
  selector: 'app-admin-identidad',
  standalone: true,
  template: `
    <header>
      <h1 class="admin-titulo">Identidad</h1>
      <p class="admin-subtitulo">
        Los datos oficiales de la institución. Aparecen en el pie, los documentos y el libro de
        reclamaciones.
      </p>
    </header>

    @if (cargando()) {
      <p class="admin-vacio">Cargando los datos…</p>
    } @else {
      <form class="identidad" (ngSubmit)="guardar(false)">
        @for (campo of CAMPOS; track campo.key) {
          <div class="admin-campo">
            <label [for]="'identidad-' + campo.key">{{ campo.label }}</label>
            <input
              [id]="'identidad-' + campo.key"
              class="admin-control"
              [class.admin-control--error]="errores()[campo.key]"
              [type]="campo.type"
              [autocomplete]="campo.autocomplete"
              [value]="campos()[campo.key]"
              (input)="setCampo(campo.key, $any($event.target).value)"
              [attr.aria-invalid]="errores()[campo.key] ? 'true' : null"
            />
            @if (campo.ayuda) {
              <p class="admin-ayuda">{{ campo.ayuda }}</p>
            }
            @if (errores()[campo.key]; as mensaje) {
              <p class="admin-error" role="alert">{{ mensaje }}</p>
            }
          </div>
        }

        @if (error()) {
          <p class="admin-banner admin-banner--error" role="alert">{{ error() }}</p>
        }
        @if (status()) {
          <p class="admin-banner admin-banner--ok" role="status">{{ status() }}</p>
        }

        <div class="identidad__acciones">
          <button type="submit" class="admin-btn" [disabled]="guardando()">
            {{ guardando() && !publicando() ? 'Guardando…' : 'Guardar' }}
          </button>
          <button
            type="button"
            class="admin-btn admin-btn--primario"
            [disabled]="guardando()"
            (click)="guardar(true)"
          >
            {{ publicando() ? 'Publicando…' : 'Publicar' }}
          </button>
        </div>
      </form>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-16, 1rem);
      }
      .admin-titulo {
        margin: 0;
        font-family: var(--font-titulos, serif);
        font-weight: 600;
      }
      .admin-subtitulo {
        margin: 0;
        color: var(--color-texto-suave);
      }
      .admin-vacio {
        color: var(--color-texto-suave);
        margin: 0;
      }
      .identidad {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--space-16, 1rem);
        max-width: 52rem;
      }
      @media (max-width: 640px) {
        .identidad {
          grid-template-columns: 1fr;
        }
      }
      .identidad__acciones {
        grid-column: 1 / -1;
        display: flex;
        gap: var(--space-8, 0.5rem);
      }
      .admin-ayuda {
        margin: 0;
        font-size: var(--texto-xs, 0.75rem);
        color: var(--color-texto-suave);
      }
      .admin-error {
        margin: 0;
        font-size: var(--texto-sm, 0.875rem);
        color: var(--color-acento);
      }
      .admin-control--error {
        border-color: var(--color-acento);
      }
      .admin-banner {
        grid-column: 1 / -1;
        margin: 0;
      }
    `,
  ],
})
export class AdminIdentidad implements OnInit {
  protected readonly CAMPOS = CAMPOS;

  private api = inject(CmsApiService);

  readonly campos = signal<Identidad>({ ...VACIO });
  readonly errores = signal<Record<string, string>>({});
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly publicando = signal(false);
  readonly error = signal('');
  readonly status = signal('');

  private original: Identidad = { ...VACIO };

  async ngOnInit(): Promise<void> {
    this.cargando.set(true);
    try {
      const identidad = await this.api.getIdentidad();
      this.aplicar(identidad);
      this.original = { ...this.toCampos(identidad) };
    } catch {
      this.error.set('No se pudieron cargar los datos de identidad. Revisa tu conexión.');
    } finally {
      this.cargando.set(false);
    }
  }

  setCampo(key: Campo, valor: string): void {
    this.campos.update((c) => ({ ...c, [key]: valor }));
    this.errores.update((e) => {
      const next = { ...e };
      delete next[key];
      return next;
    });
  }

  async guardar(publicar: boolean): Promise<void> {
    this.error.set('');
    this.status.set('');

    const errores = this.validar();
    this.errores.set(errores);
    if (Object.keys(errores).length > 0) {
      return;
    }

    const editados = this.camposEditados();
    if (Object.keys(editados).length === 0) {
      this.status.set('No hay cambios para guardar.');
      return;
    }

    if (publicar) {
      this.publicando.set(true);
    } else {
      this.guardando.set(true);
    }
    try {
      const res = await this.api.guardarIdentidad(editados);
      this.aplicar(res);
      this.original = { ...this.toCampos(res) };
      this.status.set(publicar ? 'Identidad publicada.' : 'Identidad guardada.');
    } catch {
      this.error.set('No se pudo guardar la identidad. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      this.guardando.set(false);
      this.publicando.set(false);
    }
  }

  private validar(): Record<string, string> {
    const errores: Record<string, string> = {};
    const c = this.campos();
    if (!c.nombre.trim()) {
      errores['nombre'] = 'Escribe el nombre de la institución.';
    }
    const correo = c.correo.trim();
    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      errores['correo'] = 'Escribe un correo válido.';
    }
    return errores;
  }

  private camposEditados(): Partial<Identidad> {
    const out: Partial<Identidad> = {};
    for (const key of Object.keys(this.campos()) as Campo[]) {
      const actual = (this.campos()[key] ?? '').trim();
      const previo = (this.original[key] ?? '').trim();
      if (actual !== previo) {
        out[key] = actual;
      }
    }
    return out;
  }

  private toCampos(identidad: Identidad): Identidad {
    return {
      nombre: identidad.nombre ?? '',
      ruc: identidad.ruc ?? '',
      direccion: identidad.direccion ?? '',
      telefono: identidad.telefono ?? '',
      correo: identidad.correo ?? '',
      ciudad: identidad.ciudad ?? '',
    };
  }

  private aplicar(identidad: Identidad): void {
    this.campos.set(this.toCampos(identidad));
  }
}

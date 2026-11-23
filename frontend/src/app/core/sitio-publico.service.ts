import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE, CmsMenuItem, JsonMap, LOCALE } from '../cms/cms.models';
import { Identidad } from '../cms/cms-api.service';
import { ICONOS, type NombreIcono } from '../cms/iconos';
import { temaPublico } from './tema';

export interface EnlaceAcceso {
  nombre: string;
  url: string;
  icono: NombreIcono | '';
}

export interface BotonCabecera {
  texto: string;
  url: string;
  estilo: 'principal' | 'contorno';
}

/**
 * Datos publicados del sitio: identidad, apariencia y menú.
 *
 * Es la fuente única del marco público (cabecera y pie) y del tema. El panel
 * se pinta con los mismos tokens que ve el visitante: si el panel usara el
 * color por defecto de la plantilla, quien edita no reconocería su propia
 * institución en la pantalla de edición. Se toma de la ruta pública
 * (`/publico/sitio`), que es exactamente lo que ve el visitante.
 *
 * La carga es perezosa: solo se pide cuando alguien lo necesita, y las
 * peticiones simultáneas comparten la misma.
 */
@Injectable({ providedIn: 'root' })
export class SitioPublicoService {
  private readonly http = inject(HttpClient);

  private readonly apariencia = signal<JsonMap>({});
  private readonly datos = signal<Identidad | null>(null);
  private readonly enlaces = signal<CmsMenuItem[]>([]);
  private readonly token = signal('');

  /** Tokens CSS del tema publicado. */
  readonly tema = computed(() => temaPublico(this.apariencia()));

  /** Identidad publicada de la institución. */
  readonly identidad = computed(() => this.datos());

  /** Menú publicado: los enlaces de la cabecera y del pie. */
  readonly menu = computed(() => this.enlaces());

  /** Token CSRF de la sesión del visitante. */
  readonly csrf = computed(() => this.token());

  /** Nombre de la institución, con un respaldo si aún no se ha cargado. */
  readonly nombre = computed(() => this.datos()?.nombre || 'Portal institucional');

  /** Redes sociales declaradas en la apariencia. */
  readonly redes = computed(() => {
    const redes = this.apariencia()['redes'];
    return Array.isArray(redes)
      ? redes.filter((r) => r && typeof r.nombre === 'string' && this.urlSegura(r.url))
      : [];
  });

  /** Accesos rápidos de la franja superior (plataformas, aula virtual…). */
  readonly accesos = computed<EnlaceAcceso[]>(() =>
    this.lista('accesos')
      .map((a): EnlaceAcceso => ({
        nombre: typeof a['nombre'] === 'string' ? a['nombre'].trim() : '',
        url: this.urlSegura(a['url']),
        icono:
          typeof a['icono'] === 'string' && Object.hasOwn(ICONOS, a['icono'])
            ? (a['icono'] as NombreIcono)
            : '',
      }))
      .filter((a) => a.nombre && a.url)
      .slice(0, 6),
  );

  /** Botones de acción de la cabecera: como máximo dos, para no competir entre sí. */
  readonly botonesCabecera = computed<BotonCabecera[]>(() =>
    this.lista('botones_cabecera')
      .map((b): BotonCabecera => ({
        texto: typeof b['texto'] === 'string' ? b['texto'].trim() : '',
        url: this.urlSegura(b['url']),
        estilo: b['estilo'] === 'contorno' ? ('contorno' as const) : ('principal' as const),
      }))
      .filter((b) => b.texto && b.url)
      .slice(0, 2),
  );

  /** Enlace directo a WhatsApp, o vacío si no hay un número válido. */
  readonly whatsapp = computed(() => {
    const numero = this.texto('whatsapp');
    return /^\d{8,15}$/.test(numero) ? `https://wa.me/${numero}` : '';
  });

  /** True cuando ya se intentó leer la apariencia publicada. */
  readonly cargado = signal(false);

  private pendiente: Promise<void> | null = null;

  /** Vuelve a leer los datos publicados. Tras publicar, el panel se repinta. */
  async cargar(): Promise<void> {
    if (this.pendiente) {
      return this.pendiente;
    }
    this.pendiente = (async () => {
      try {
        const res = await firstValueFrom(
          this.http.get<{
            apariencia?: JsonMap;
            identidad?: Identidad;
            menu?: CmsMenuItem[];
            csrf?: string;
          }>(`${API_BASE}/publico/sitio`, { params: { locale: LOCALE } }),
        );
        this.apariencia.set(res.apariencia ?? {});
        this.datos.set(res.identidad ?? null);
        this.enlaces.set(res.menu ?? []);
        this.token.set(res.csrf ?? '');
      } catch {
        // Sin apariencia publicada se siguen usando los tokens por defecto:
        // el panel no debe caerse por un fallo de red al pintar.
      } finally {
        this.cargado.set(true);
      }
    })();
    try {
      await this.pendiente;
    } finally {
      this.pendiente = null;
    }
  }

  /** Texto suelto de la apariencia (pie legal, logo, teléfono…). */
  texto(clave: string): string {
    const valor = this.apariencia()[clave];
    return typeof valor === 'string' ? valor : '';
  }

  /** Lista de objetos de la apariencia (accesos, botones de cabecera…). */
  private lista(clave: string): JsonMap[] {
    const valor = this.apariencia()[clave];
    return Array.isArray(valor)
      ? valor.filter((x): x is JsonMap => !!x && typeof x === 'object')
      : [];
  }

  /**
   * Filtra los valores que vienen de la institución y se usan como enlace:
   * solo se admiten rutas internas y direcciones http(s). Evita que un valor
   * publicado convierta un enlace en `javascript:`.
   */
  urlSegura(valor: unknown): string {
    if (typeof valor !== 'string') return '';
    return /^(?:\/(?![\/\\])|https?:\/\/)[^\s<>"'\\]+$/i.test(valor) ? valor : '';
  }
}

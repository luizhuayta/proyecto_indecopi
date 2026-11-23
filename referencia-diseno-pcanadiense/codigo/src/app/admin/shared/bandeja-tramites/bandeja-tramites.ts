import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { environment } from '../../../../environments/environment';
import { PortalApi } from '../../../core/api/portal.api';
import { DialogComponent } from '../../../shared/ui';
import { ToastService } from '../toast/toast';
import type { TramiteAdmin, TramiteCambioEstado } from '../../../core/api/api.types';

export interface ColumnaBandeja {
  label: string;
  campo: string;
}

/**
 * Bandeja de un trámite ciudadano. Mesa de partes, libro de reclamaciones,
 * acceso a la información, citas y apoyo social comparten la misma mecánica
 * (listar, filtrar por estado, abrir el detalle, responder y cambiar el estado):
 * cambian las columnas y los estados, no el comportamiento.
 */
@Component({
  selector: 'app-bandeja-tramites',
  standalone: true,
  imports: [DialogComponent],
  templateUrl: './bandeja-tramites.html',
  styles: `
    :host { display: block; min-width: 0; }
    .admin-page { display: flex; flex-direction: column; gap: 20px; }
    .page-header {
      padding: 24px 28px;
      border: 1px solid var(--adm-brand-border);
      border-radius: 16px;
      background: linear-gradient(115deg, color-mix(in srgb, var(--adm-brand-soft) 45%, white), #fff 70%);
    }
    .page-header .page-sub { max-width: 70ch; line-height: 1.6; }
    .admin-tabs { margin-bottom: 0; }
    .admin-card { min-width: 0; }
    .tramites-scroll { overflow-x: auto; scrollbar-width: thin; }
    .tramites-scroll .admin-table { min-width: 720px; }
    .tramites-scroll .admin-table th:last-child { width: 90px; }
    .tramites-scroll .admin-table td:last-child { width: 90px; }
    .tramites-scroll .admin-table td:not(:last-child) { overflow-wrap: anywhere; }
    .admin-table { font-variant-numeric: tabular-nums; }
    .admin-table td { line-height: 1.55; }
    .admin-table td:last-child { white-space: nowrap; }
    .admin-table tbody tr:hover { background: color-mix(in srgb, var(--adm-brand-soft) 35%, white); }

    .admin-table .btn-icon { border: 1px solid var(--adm-line); background: var(--adm-surface); color: var(--adm-ink); }
    .admin-table .btn-icon:hover { border-color: var(--adm-brand); background:var(--adm-muted-bg); color: var(--adm-brand); }
    .empty-state { padding: 36px 24px; }
    /* Detalle de trámite: bloques legibles, iconos y acciones sin solaparse. */
    .tramite-resumen {
      display:flex; align-items:center; gap:14px; min-width:0;
      padding:17px; margin:0 0 20px;
      border:1px solid color-mix(in srgb,var(--adm-brand) 30%,var(--adm-line));
      border-left:4px solid var(--adm-brand);
      border-radius:14px;
      background:color-mix(in srgb,var(--adm-brand) 7%,var(--adm-surface));
    }
    .tramite-resumen-icono {
      display:grid; place-items:center; flex:0 0 48px;
      width:48px; height:48px; border-radius:12px;
      color:var(--adm-brand);
      border:1px solid color-mix(in srgb,var(--adm-brand) 34%,var(--adm-line));
      background:var(--adm-surface); font-size:1.15rem;
    }
    .tramite-resumen-texto { display:flex; flex-direction:column; gap:4px; min-width:0; }
    .tramite-resumen-etiqueta { font-size:.75rem; font-weight:750; color:var(--adm-brand); }
    .tramite-codigo { font-size:clamp(1.1rem,2.5vw,1.55rem); line-height:1.3; overflow-wrap:anywhere; color:var(--adm-ink); }
    .tramite-fecha { font-size:.8rem; color:var(--adm-muted); }
    .tramite-fecha i { margin-right:4px; color:var(--adm-brand); }
    .tramite-seccion-titulo {
      display:flex; align-items:center; gap:9px; margin:18px 0 12px;
      font-weight:800; font-size:.92rem; color:var(--adm-ink);
    }
    .tramite-seccion-titulo i { color:var(--adm-brand); }
    .tramite-detalle-grid, .tramite-gestion-grid {
      display:grid; grid-template-columns:repeat(2,minmax(0,1fr));
      gap:12px; margin:0;
    }
    .tramite-detalle-grid > .tramite-dato {
      display:flex; flex-direction:column; gap:8px; min-width:0;
      padding:14px; margin:0;
      border:1px solid var(--adm-line);
      border-radius:12px; background:var(--adm-surface);
    }
    .tramite-detalle-grid > .tramite-dato label {
      display:flex; align-items:center; gap:8px;
      margin:0; font-weight:750; font-size:.8rem; color:var(--adm-ink);
    }
    .tramite-detalle-grid > .tramite-dato label i { color:var(--adm-brand); }
    .tramite-detalle-grid > .tramite-dato p {
      margin:0; color:var(--adm-muted); line-height:1.5;
      overflow-wrap:anywhere; word-break:break-word; white-space:pre-wrap;
    }
    .tramite-detalle-grid > .tramite-dato :is(a,button) { max-width:100%; width:max-content; }
    .tramite-gestion-grid > .form-row { min-width:0; }
    .tramite-gestion-grid > .form-row.span-2, .tramite-detalle-grid > .span-2 { grid-column:1 / -1; }
    .tramite-gestion-grid .check-inline { display:flex; gap:9px; align-items:flex-start; }
    .tramite-gestion-grid .check-inline input { flex:0 0 auto; }
    .save-bar {
      position:static !important;
      display:flex; flex-wrap:wrap; justify-content:flex-end; gap:10px;
      margin-top:20px; padding:16px 0 0;
      border-top:1px solid var(--adm-line);
      background:transparent;
    }
    @media(max-width:600px) {
      .tramite-detalle-grid, .tramite-gestion-grid { grid-template-columns:minmax(0,1fr); }
      .tramite-detalle-grid > .span-2, .tramite-gestion-grid > .span-2 { grid-column:auto; }
      .tramite-resumen { padding:13px; gap:10px; }
      .tramite-resumen-icono { flex-basis:42px; width:42px; height:42px; }
      .save-bar > button { flex:1 1 auto; }
    }
    /* Detalles más compactos y barra de acciones accesible al desplazarse. */
    .tramite-resumen { padding:14px 17px; margin-bottom:16px; }
    .tramite-seccion-titulo {
      margin:16px 0 10px; padding-bottom:9px;
      border-bottom:1px solid var(--adm-line);
    }
    .tramite-detalle-grid { gap:10px; }
    .tramite-detalle-grid > .tramite-dato {
      padding:12px 14px; gap:6px;
      background:color-mix(in srgb,var(--adm-brand) 2%,var(--adm-surface));
    }
    .tramite-detalle-grid > .tramite-dato label { font-size:.81rem; gap:8px; }
    .tramite-dato-icono {
      display:inline-grid; place-items:center;
      flex:0 0 27px; width:27px; height:27px;
      border-radius:8px;
      background:color-mix(in srgb,var(--adm-brand) 10%,var(--adm-surface));
      color:var(--adm-brand);
    }
    .tramite-detalle-grid > .tramite-dato p { padding-left:35px; font-size:.9rem; color:var(--adm-ink); }
    .tramite-detalle-grid > .tramite-dato :is(a,button) { margin-left:35px; }
    .tramite-gestion-grid > .form-row { margin:0; }
    .save-bar {
      position:sticky !important;
      bottom:-8px;
      z-index:3;
      margin:18px -3px -8px;
      padding:12px 3px 8px;
      background:var(--adm-surface);
      box-shadow:0 -8px 18px -15px rgba(0,0,0,.24);
    }
    @media(max-width:600px) {
      .tramite-detalle-grid > .tramite-dato p { padding-left:0; }
      .tramite-detalle-grid > .tramite-dato :is(a,button) { margin-left:0; }
    }
    /* Observaciones: campo legible y ayuda diferenciada, sin agrandar el modal. */
    .tramite-gestion-grid > .tramite-observacion {
      display:flex;
      flex-direction:column;
      gap:10px;
      min-width:0;
      padding:15px;
      border:1px solid var(--adm-line);
      border-radius:13px;
      background:color-mix(in srgb,var(--adm-brand) 3%,var(--adm-surface));
    }
    .tramite-observacion > label {
      display:flex;
      align-items:center;
      gap:10px;
      font-weight:750;
      color:var(--adm-ink);
      margin:0;
    }
    .tramite-observacion-icono {
      display:inline-grid;
      place-items:center;
      width:34px;
      height:34px;
      flex:0 0 34px;
      border-radius:10px;
      color:var(--adm-brand);
      background:color-mix(in srgb,var(--adm-brand) 10%,var(--adm-surface));
      border:1px solid color-mix(in srgb,var(--adm-brand) 26%,var(--adm-line));
    }
    .tramite-gestion-grid .tramite-observacion-texto {
      display:block;
      width:100%;
      min-width:0;
      min-height:172px;
      max-height:320px;
      box-sizing:border-box;
      padding:14px 16px;
      border:1px solid var(--adm-line);
      border-radius:11px;
      background:var(--adm-surface);
      color:var(--adm-ink);
      line-height:1.65;
      font:inherit;
      font-size:.92rem;
      resize:vertical;
      overflow-y:auto;
      scrollbar-width:thin;
    }
    .tramite-gestion-grid .tramite-observacion-texto:focus {
      outline:2px solid color-mix(in srgb,var(--adm-brand) 20%,transparent);
      outline-offset:1px;
      border-color:var(--adm-brand);
    }
    .tramite-observacion-ayuda {
      display:flex;
      align-items:flex-start;
      gap:9px;
      margin:0;
      padding:10px 12px;
      border-radius:9px;
      background:color-mix(in srgb,var(--adm-brand) 7%,var(--adm-surface));
      color:var(--adm-muted);
      font-size:.79rem;
      line-height:1.55;
    }
    .tramite-observacion-ayuda i { color:var(--adm-brand); margin-top:2px; flex:0 0 auto; }
    @media(max-width:600px) {
      .tramite-gestion-grid > .tramite-observacion { padding:12px; }
      .tramite-gestion-grid .tramite-observacion-texto { min-height:150px; padding:12px; }
    }
    @media (max-width: 720px) {
      .page-header { padding: 18px; }
      .admin-tabs { max-width: 100%; }
    }
  `,

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BandejaTramites {
  private readonly toast = inject(ToastService);
  private readonly api = inject(PortalApi);

  readonly titulo = input.required<string>();
  readonly descripcion = input('');
  readonly columnas = input.required<ColumnaBandeja[]>();
  readonly detalle = input.required<ColumnaBandeja[]>();
  readonly estados = input.required<string[]>();
  readonly etiquetaRespuesta = input('Respuesta / observación');
  /** Clave del payload con el correo del solicitante. '' = bandeja sin aviso. */
  readonly campoCorreo = input('email');
  readonly soloLectura = input(false);
  readonly cargar = input.required<() => Promise<TramiteAdmin[]>>();
  readonly guardar = input<
    ((id: string, cambio: TramiteCambioEstado) => Promise<TramiteAdmin>) | null
  >(null);

  readonly items = signal<TramiteAdmin[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly filtro = signal('todos');
  readonly abierto = signal<TramiteAdmin | null>(null);
  readonly estadoEditado = signal('');
  readonly respuestaEditada = signal('');
  readonly notificar = signal(false);
  readonly guardando = signal(false);
  private solicitudCarga = 0;

  readonly visibles = computed(() => {
    const estado = this.filtro();
    return estado === 'todos' ? this.items() : this.items().filter((t) => t.estado === estado);
  });

  readonly pendientes = computed(
    () => this.items().filter((t) => t.estado === 'pendiente' || t.estado === 'recibido').length,
  );

  constructor() {
    // Se recarga sola cuando cambia el origen de datos: la pantalla de
    // solicitudes reutiliza esta misma bandeja para sus tres pestañas.
    effect(() => {
      const cargar = this.cargar();
      this.abierto.set(null);
      this.filtro.set('todos');
      void this.traer(cargar);
    });
  }

  recargar(): Promise<void> {
    return this.traer(this.cargar());
  }

  private async traer(cargar: () => Promise<TramiteAdmin[]>): Promise<void> {
    const solicitud = ++this.solicitudCarga;
    this.cargando.set(true);
    this.error.set(null);
    try {
      const datos = await cargar();
      if (solicitud === this.solicitudCarga) this.items.set(datos);
    } catch {
      if (solicitud === this.solicitudCarga) this.error.set('No se pudo cargar la bandeja. ¿Está el servidor levantado?');
    } finally {
      if (solicitud === this.solicitudCarga) this.cargando.set(false);
    }
  }

  /** Evita cerrar el expediente mientras se está guardando. */
  cerrarDetalle(open: boolean): void {
    if (!open && !this.guardando()) this.abierto.set(null);
  }

  /** No envía solicitudes al servidor cuando no hay cambios. */
  hayCambios(): boolean {
    const tramite = this.abierto();
    if (!tramite) return false;
    return this.estadoEditado() !== tramite.estado
      || this.respuestaEditada().trim() !== (tramite.respuesta ?? '').trim()
      || (this.notificar() && !!this.correoDe(tramite));
  }

  abrir(tramite: TramiteAdmin): void {
    this.abierto.set(tramite);
    this.estadoEditado.set(tramite.estado);
    this.respuestaEditada.set(tramite.respuesta ?? '');
    // Nunca marcada por defecto: avisar al ciudadano se elige, no se hereda de
    // la solicitud anterior que se estuvo mirando.
    this.notificar.set(false);
  }

  /** Correo del solicitante, o '' si no dejó uno. */
  correoDe(tramite: TramiteAdmin): string {
    const campo = this.campoCorreo();
    const valor = campo ? tramite.payload[campo] : undefined;
    return valor ? String(valor) : '';
  }

  valor(tramite: TramiteAdmin, campo: string): string {
    if (campo === 'codigo') return tramite.codigo;
    if (campo === 'estado') return this.etiquetaEstado(tramite.estado);
    if (campo === 'fecha') return this.fecha(tramite.submittedAt);
    const dato = tramite.payload[campo];
    return dato === undefined || dato === null ? '—' : String(dato);
  }

  /** Un adjunto o un enlace del solicitante se abre, no se lee como texto. */
  esEnlace(valor: string): boolean {
    return valor.startsWith('http://') || valor.startsWith('https://') || valor.startsWith('/api/');
  }

  urlAbsoluta(valor: string): string {
    return valor.startsWith('/api/') ? `${environment.baseUrl}${valor}` : valor;
  }

  /** Un enlace que escribió el solicitante sale del portal: se abre tal cual. */
  esArchivoDelApi(valor: string): boolean {
    return valor.startsWith('/api/');
  }

  /**
   * Abre un adjunto reservado. El API lo niega sin sesión y un `<a href>` no
   * lleva el token, así que se baja por HttpClient (el interceptor lo firma) y
   * se abre el blob resultante.
   */
  async abrirAdjunto(url: string): Promise<void> {
    try {
      const blob = await this.api.descargarArchivo(url);
      const objeto = URL.createObjectURL(blob);
      const ventana = window.open(objeto, '_blank', 'noopener');
      if (!ventana) {
        // Bloqueador de ventanas: al menos que se lo pueda guardar.
        const enlace = document.createElement('a');
        enlace.href = objeto;
        enlace.download = url.split('/').pop() || 'adjunto';
        enlace.click();
      }
      // El blob vive en memoria hasta que se revoque; la pestaña ya lo tiene.
      setTimeout(() => URL.revokeObjectURL(objeto), 60_000);
    } catch {
      this.toast.error('No se pudo abrir el adjunto.');
    }
  }

  iconoDetalle(campo: string, label: string): string {
    const texto=(campo+' '+label).toLocaleLowerCase('es');
    if (/dni|documento de identidad/.test(texto)) return 'fa-id-card';
    if (/correo|email/.test(texto)) return 'fa-envelope';
    if (/teléfono|celular/.test(texto)) return 'fa-phone';
    if (/archivo|adjunto|descargar/.test(texto)) return 'fa-paperclip';
    if (/enlace|url/.test(texto)) return 'fa-link';
    if (/fecha|recibido/.test(texto)) return 'fa-calendar-days';
    if (/folio/.test(texto)) return 'fa-file-lines';
    if (/mensaje|detalle|motivo|solicitud/.test(texto)) return 'fa-align-left';
    if (/nombre|remitente|solicitante/.test(texto)) return 'fa-user';
    if (/condición|tipo|estado/.test(texto)) return 'fa-tag';
    return 'fa-circle-info';
  }

  etiquetaEstado(estado: string): string {
    return estado.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  }

  claseEstado(estado: string): string {
    const atendido = ['finalizado', 'resuelto', 'atendida', 'confirmada', 'cerrada'];
    return atendido.includes(estado) ? 'badge badge-publicado' : 'badge badge-borrador';
  }

  fecha(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' });
  }

  async aplicar(): Promise<void> {
    const tramite = this.abierto();
    const guardar = this.guardar();
    if (!tramite || !guardar || this.guardando() || !this.hayCambios()) return;
    if (!this.estados().includes(this.estadoEditado())) {
      this.toast.error('Selecciona un estado válido para la solicitud.');
      return;
    }
    this.guardando.set(true);
    try {
      const avisar = this.notificar() && !!this.correoDe(tramite);
      const actualizado = await guardar(tramite.id, {
        estado: this.estadoEditado(),
        respuesta: this.respuestaEditada().trim() || undefined,
        notificar: avisar,
      });
      // Una respuesta tardía no debe cerrar el detalle de otra solicitud.
      if (this.abierto()?.id === tramite.id) {
        this.items.update((lista) => lista.map((t) => (t.id === actualizado.id ? actualizado : t)));
        this.abierto.set(null);
      }
      // Si se pidió avisar y el correo no salió (SMTP caído), decirlo: el
      // expediente quedó guardado igual, pero nadie avisó al ciudadano.
      if (avisar && !actualizado.notificado) {
        this.toast.error('Se guardó el trámite, pero no se pudo enviar el correo al solicitante.');
      } else {
        this.toast.success(avisar ? 'Trámite actualizado y solicitante notificado.' : 'Trámite actualizado.');
      }
    } catch {
      this.toast.error('No se pudo actualizar el trámite.');
    } finally {
      this.guardando.set(false);
    }
  }
}

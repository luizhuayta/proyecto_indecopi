import { GestionPreview } from '../shared/gestion-preview/gestion-preview';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FacultyMember } from '../../core/constants/faculty.constant';
import { FacultyStore } from '../../core/store/faculty.store';
import { AppSrc } from '../../core/directives/app-src';
import { DialogComponent } from '../../shared/ui';
import { SelectorArchivo } from '../shared/selector-archivo/selector-archivo';
import { ToastService } from '../shared/toast/toast';

interface PersonaForm {
  names: string;
  lastNames: string;
  type: FacultyMember['type'];
  position: string;
  area: string;
  grade: string;
  email: string;
  image: string;
  cvUrl: string;
  order: number;
}

const VACIO: PersonaForm = {
  names: '',
  lastNames: '',
  type: 'Docente',
  position: '',
  area: '',
  grade: '',
  email: '',
  image: '',
  cvUrl: '',
  order: 1,
};

@Component({
  selector: 'app-admin-personal',
  standalone: true,
  imports: [GestionPreview, DialogComponent, SelectorArchivo, AppSrc],
  templateUrl: './personal.component.html',
  styleUrl: './personal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPersonalComponent {
  private readonly store = inject(FacultyStore);
  private readonly toast = inject(ToastService);

  readonly lista = this.store.lista;
  readonly busqueda = signal('');
  readonly pagina = signal(1);
  readonly porPagina = 10;
  readonly filtrados = computed(() => {
    const q = this.busqueda().trim().toLocaleLowerCase('es');
    const datos = this.visibles();
    return q ? datos.filter(item => [item.names, item.lastNames, item.position, item.area, item.email].some(v => String(v ?? '').toLocaleLowerCase('es').includes(q))) : datos;
  });
  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.filtrados().length / this.porPagina)));
  readonly paginaActual = computed(() => Math.min(this.pagina(), this.totalPaginas()));
  readonly paginados = computed(() => this.filtrados().slice((this.paginaActual() - 1) * this.porPagina, this.paginaActual() * this.porPagina));
  buscar(valor: string): void { this.busqueda.set(valor); this.pagina.set(1); }
  cambiarPagina(delta: number): void { this.pagina.set(Math.max(1, Math.min(this.totalPaginas(), this.paginaActual() + delta))); }

  readonly tipos: FacultyMember['type'][] = ['Autoridad', 'Administrativo', 'Docente'];
  readonly filtro = signal<'Todos' | FacultyMember['type']>('Todos');
  readonly formAbierto = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly form = signal<PersonaForm>({ ...VACIO });
  private formularioInicial = '';
  readonly hayCambios = computed(() => this.formAbierto() && JSON.stringify(this.form()) !== this.formularioInicial);
  cerrarFormulario(): void {
    if (this.guardando()) return;
    if (this.hayCambios() && !window.confirm('Hay cambios sin guardar. ¿Desea descartarlos?')) return;
    this.formAbierto.set(false);
  }
  alCambiarDialogo(abierto: boolean): void {
    if (!abierto) this.cerrarFormulario();
  }
  readonly confirm = signal<FacultyMember | null>(null);
  readonly guardando = signal(false);
  readonly eliminando = signal(false);

  readonly visibles = computed(() => {
    const tipo = this.filtro();
    const list = [...this.lista()].sort((a, b) => a.order - b.order);
    return tipo === 'Todos' ? list : list.filter((item) => item.type === tipo);
  });

  abrirNuevo(): void {
    const max = this.lista().reduce((n, item) => Math.max(n, item.order), 0);
    this.editingId.set(null);
    this.form.set({ ...VACIO, order: max + 1 });
    this.formularioInicial = JSON.stringify(this.form());
    this.formAbierto.set(true);
  }

  abrirEditar(member: FacultyMember): void {
    this.editingId.set(member.id);
    this.form.set({
      names: member.names,
      lastNames: member.lastNames,
      type: member.type,
      position: member.position,
      area: member.area ?? '',
      grade: member.grade,
      email: member.email,
      image: member.image ?? '',
      cvUrl: member.cvUrl ?? '',
      order: member.order,
    });
    this.formularioInicial = JSON.stringify(this.form());
    this.formAbierto.set(true);
  }

  patch<K extends keyof PersonaForm>(key: K, value: PersonaForm[K]): void {
    this.form.update((current) => ({ ...current, [key]: value }));
  }

  toOrden(event: Event): number {
    const value = Number((event.target as HTMLInputElement).value);
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  async guardar(): Promise<void> {
    const data = this.form();
    if (
      !data.names.trim() ||
      !data.lastNames.trim() ||
      !data.position.trim() ||
      !data.email.trim()
    ) {
      this.toast.error('Nombres, apellidos, cargo y correo son obligatorios.');
      return;
    }
    const payload = {
      names: data.names.trim(),
      lastNames: data.lastNames.trim(),
      type: data.type,
      position: data.position.trim(),
      area: data.area.trim() || undefined,
      grade: data.grade.trim(),
      email: data.email.trim(),
      image: data.image.trim() || undefined,
      cvUrl: data.cvUrl.trim() || undefined,
      order: data.order,
    };
    if (this.guardando()) return;
    this.guardando.set(true);
    try {
      const id = this.editingId();
      if (id !== null) {
        await this.store.actualizar({ id, ...payload });
        this.toast.success('Ficha actualizada. Ya se ve en /nosotros.');
      } else {
        await this.store.crear(payload);
        this.toast.success('Persona publicada en el directorio.');
      }
      this.formAbierto.set(false);
    } catch {
      this.toast.error('No se pudo guardar la ficha.');
    } finally {
      this.guardando.set(false);
    }
  }

  async eliminar(): Promise<void> {
    const member = this.confirm();
    if (!member || this.eliminando()) return;
    this.eliminando.set(true);
    try {
      await this.store.eliminar(member.id);
      this.confirm.set(null);
      this.toast.success('Se quitó del directorio público.');
    } catch {
      this.toast.error('No se pudo quitar la persona del directorio.');
    } finally {
      this.eliminando.set(false);
    }
  }
}

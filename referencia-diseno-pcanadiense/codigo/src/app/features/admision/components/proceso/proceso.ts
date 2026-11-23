
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';

import { RouterLink } from '@angular/router';

import { InstitutionService } from '../../../../core/services/institution.service';

import {
  ADMISSION_DOCS,
  type AdmissionContent,
  type AdmissionDoc,
} from '../../../../core/constants/admission.constant';

import { ContenidoStore } from '../../../../core/store/contenido.store';
import { DocumentosStore } from '../../../../core/store/documentos.store';
import { ListaDocs } from '../../../../core/store/lista-docs';
import { AppSrc } from '../../../../core/directives/app-src';
import { htmlVacio, stripHtml } from '../../../../core/utils/html';
import { ButtonDirective } from '../../../../shared/ui';

@Component({
  selector: 'app-admision-proceso',
  standalone: true,
  imports: [RouterLink, ButtonDirective, ListaDocs, AppSrc],
  templateUrl: './proceso.html',
  styleUrl: './proceso.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Proceso {
  private readonly institution = inject(InstitutionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly contenido = inject(ContenidoStore);
  private readonly documentos = inject(DocumentosStore);

  // Solo el administrador suministra estos datos.
  // En el portal público ambos inputs son null.
  readonly previewCopy = input<AdmissionContent | null>(null);
  readonly previewTab = input<string | null>(null);

  readonly docs = ADMISSION_DOCS;

  readonly copy = computed<AdmissionContent>(() =>
    this.previewCopy() ?? this.contenido.admision.value()
  );

  readonly info = this.institution.info;
  readonly whatsappUrl = this.institution.whatsappUrl;
  readonly fidPrograms = this.institution.fidPrograms;

  readonly activeId = signal(ADMISSION_DOCS[0].id);
  readonly copiedKey = signal<string | null>(null);

  readonly docsActivos = computed(() =>
    this.documentos.deSeccion('admision', this.activeId())
  );

  readonly activeDoc = computed(() =>
    this.docs.find(doc => doc.id === this.activeId()) ?? this.docs[0]
  );

  readonly vacancyTotal = computed(() =>
    this.fidPrograms().reduce(
      (sum, program) => sum + program.vacancies,
      0
    )
  );

  readonly campus = computed(() =>
    this.info().locations.find(location => location.id === 'campus') ??
    this.info().locations[0]
  );

  readonly feeItems = computed(() => {
    const fees = this.info().fees;

    return [
      { id: 'exam', label: 'Examen de admisión', amount: fees.admissionExam },
      { id: 'enrollment', label: 'Matrícula', amount: fees.enrollment },
      { id: 'tuition', label: 'Pensión mensual', amount: fees.monthlyTuition },
      { id: 'reinstatement', label: 'Reincorporación', amount: fees.reinstatement },
    ];
  });

  readonly mailtoHref = computed(() => {
    const subject = encodeURIComponent(
      `Inscripción al examen de admisión — ${this.info().shortName}`
    );

    const body = encodeURIComponent(
      stripHtml(this.copy().emailTemplate)
    );

    return `mailto:${this.info().contact.emailIntake}?subject=${subject}&body=${body}`;
  });

  private copyTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // Sincronización de pestañas dentro de la misma aplicación.
    effect(() => {
      const tab = this.previewTab();

      if (tab && this.docs.some(doc => doc.id === tab)) {
        if (this.activeId() !== tab) {
          this.activeId.set(tab);
        }
      }
    });

    this.destroyRef.onDestroy(() => clearTimeout(this.copyTimer));
  }

  selectDoc(id: string): void {
    this.activeId.set(id);
  }

  hayTexto(valor: string | undefined): boolean {
    return !htmlVacio(valor ?? '');
  }

  formatFee(amount: number): string {
    return `S/ ${amount.toFixed(2)}`;
  }

  formatScore(score: number): string {
    return score.toFixed(2);
  }

  async copyText(value: string, key: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(stripHtml(value));
      this.copiedKey.set(key);
      clearTimeout(this.copyTimer);

      this.copyTimer = setTimeout(() => {
        if (this.copiedKey() === key) {
          this.copiedKey.set(null);
        }
      }, 2000);
    } catch {
      this.copiedKey.set(null);
    }
  }

  openAfiche(doc: AdmissionDoc): void {
    const publicado =
      this.docsActivos().find(d => d.tipo === 'imagen') ??
      this.docsActivos()[0];

    const href = publicado?.url ?? doc.src;

    if (href) {
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  }
}

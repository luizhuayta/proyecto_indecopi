import { AppSrc } from '../../../../core/directives/app-src';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  input,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { InstitutionService } from '../../../../core/services/institution.service';
import { COSTOS_DOCS } from '../../../../core/constants/costos.constant';
import { ContenidoStore } from '../../../../core/store/contenido.store';
import type { CostosContent } from '../../../../core/constants/costos.constant';
import type {
  InstitutionFees,
  InstitutionBankAccount,
} from '../../../../core/constants/institution.constant';
import { DocumentosStore } from '../../../../core/store/documentos.store';
import { ListaDocs } from '../../../../core/store/lista-docs';
import {
  BadgeComponent,
  ButtonDirective,
  CardComponent,
  CardContentComponent,
  CardHeaderComponent,
  CardTitleComponent,
} from '../../../../shared/ui';

@Component({
  selector: 'app-costos-visor',
  standalone: true,
  imports: [AppSrc,
    RouterLink,
    BadgeComponent,
    ButtonDirective,
    CardComponent,
    CardHeaderComponent,
    CardTitleComponent,
    CardContentComponent,
    ListaDocs,
  ],
  templateUrl: './visor.html',
  styleUrls: ['../../../../shared/styles/viewer-shell.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Visor {
  private readonly institution = inject(InstitutionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly contenido = inject(ContenidoStore);
  private readonly documentos = inject(DocumentosStore);

  readonly docs = COSTOS_DOCS;
  readonly previewCopy = input<CostosContent | null>(null);
  readonly previewTab = input<string | null>(null);

  readonly copy = computed<CostosContent>(() =>
    this.previewCopy() ?? this.contenido.costos.value()
  );
  readonly info = this.institution.info;

  readonly previewFees = input<InstitutionFees | null>(null);
  readonly previewAccounts = input<InstitutionBankAccount[] | null>(null);
  readonly whatsappUrl = this.institution.whatsappUrl;
  readonly docsTarifario = computed(() => this.documentos.deSeccion('costos', 'tarifario'));
  readonly docsMatricula = computed(() => this.documentos.deSeccion('costos', 'matricula'));

  readonly activeId = signal(COSTOS_DOCS[0].id);
  private readonly sincronizarTab = effect(() => {
    const destino = this.previewTab();
    const encontrado = this.docs.find(
      doc => doc.id === destino
    );

    if (encontrado && this.activeId() !== encontrado.id) {
      this.activeId.set(encontrado.id);
    }
  });
  readonly copiedKey = signal<string | null>(null);
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  readonly activeDoc = computed(
    () => this.docs.find((doc) => doc.id === this.activeId()) ?? this.docs[0],
  );

  readonly feeItems = computed(() => {
    const fees = this.previewFees() ?? this.info().fees;
    return [
      { id: 'exam', label: 'Examen de admisión', amount: fees.admissionExam },
      { id: 'enrollment', label: 'Matrícula', amount: fees.enrollment },
      { id: 'tuition', label: 'Pensión mensual', amount: fees.monthlyTuition },
      { id: 'reinstatement', label: 'Reincorporación', amount: fees.reinstatement },
    ];
  });

  readonly mailtoHref = computed(() => {
    const subject = encodeURIComponent(`Consulta de costos — ${this.info().shortName}`);
    return `mailto:${this.info().contact.emailGeneral}?subject=${subject}`;
  });

  private copyTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.copyTimer));
  }

  selectDoc(id: (typeof COSTOS_DOCS)[number]['id'], event?: Event): void {
    this.activeId.set(id);
    const target = event?.currentTarget;
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    }
    queueMicrotask(() => this.panel()?.nativeElement.scrollTo({ top: 0 }));
  }

  formatFee(amount: number): string {
    return `S/ ${amount.toFixed(2)}`;
  }

  async copyText(value: string, key: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.copiedKey.set(key);
      clearTimeout(this.copyTimer);
      this.copyTimer = setTimeout(() => {
        if (this.copiedKey() === key) this.copiedKey.set(null);
      }, 2000);
    } catch {
      this.copiedKey.set(null);
    }
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { BRAND_MAX, ReportsStore, SharePeriod } from '../../core/data/reports.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.engine';
import { NewTabService } from '../../core/services/new-tab.service';
import { NotificationService } from '../../core/services/notification.service';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { SelectFieldComponent } from '../../shared/components/select-field/select-field.component';
import { reportAddress } from './report-links';

type Format = 'pdf' | 'link';

// "Client report" (Agency): the brand name, the period, PDF or link and whether to hide the AutoPost branding.
// The API freezes the report as of now behind a link; "PDF" then opens that page ready to print (Save as PDF),
// "link" only shows the link. The page opens in a new tab that has no link back to this one (NewTabService).
// A refused request keeps the dialog open (the interceptor says why).
@Component({
  selector: 'app-client-report-modal',
  imports: [ModalComponent, InputFieldComponent, SelectFieldComponent, CheckboxComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" [title]="t().rep.client" (closed)="closed.emit()">
      <form class="form" (submit)="$event.preventDefault(); create()">
        <app-input-field
          [label]="t().rep.brand"
          [placeholder]="t().rep.brandPh"
          [(value)]="brand"
          [error]="error()"
          [maxlength]="brandMax"
        />
        <div class="two">
          <app-select-field
            [label]="t().rep.period"
            [options]="periods()"
            [value]="period()"
            (valueChange)="period.set($any($event))"
          />
          <app-select-field
            [label]="t().rep.format"
            [options]="formats()"
            [value]="format()"
            (valueChange)="format.set($any($event))"
          />
        </div>
        <app-checkbox [label]="t().rep.logo" [(checked)]="logo" />
        <button type="submit" hidden></button>
      </form>
      <div modal-footer>
        <button type="button" class="su-btn su-btn-sm su-btn-secondary" (click)="closed.emit()">
          {{ t().common.cancel }}
        </button>
        <button
          type="button"
          class="su-btn su-btn-sm su-btn-primary"
          [disabled]="busy()"
          (click)="create()"
        >
          {{ t().rep.clientBtn }}
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .two {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
    }
  `,
})
export class ClientReportModalComponent {
  readonly open = input(false);
  readonly closed = output<void>();

  private readonly store = inject(ReportsStore);
  private readonly workspaces = inject(WorkspaceStore);
  private readonly notify = inject(NotificationService);
  private readonly newTab = inject(NewTabService);
  protected readonly t = inject(I18nService).t;
  protected readonly brandMax = BRAND_MAX;

  protected readonly brand = signal('');
  protected readonly period = signal<SharePeriod>('week');
  protected readonly format = signal<Format>('pdf');
  /** Hide the AutoPost name and mark on the shared page (the design has it on). */
  protected readonly logo = signal(true);
  protected readonly error = signal('');
  protected readonly busy = signal(false);

  protected readonly periods = computed(() => [
    { value: 'week', label: this.t().rep.pWeek },
    { value: 'month', label: this.t().rep.pMonth },
  ]);
  protected readonly formats = computed(() => [
    { value: 'pdf', label: this.t().rep.fPdf },
    { value: 'link', label: this.t().rep.fLink },
  ]);

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.brand.set('');
        this.period.set('week');
        this.format.set('pdf');
        this.logo.set(true);
        this.error.set('');
      });
    });
  }

  protected async create(): Promise<void> {
    if (this.busy()) return;
    if (!this.brand().trim()) {
      this.error.set(this.t().rep.errBrand);
      return;
    }
    this.busy.set(true);
    try {
      const share = await this.store.share(this.brand(), this.period(), this.logo());
      const t = this.t();
      const address = reportAddress(share.path);
      if (this.format() === 'pdf') this.newTab.open(reportAddress(share.path, true));
      this.notify.success(
        fmt(t.rep.created, {
          p: this.period() === 'month' ? t.rep.pMonth : t.rep.pWeek,
          w: this.workspaces.current()?.name ?? '',
          l: address,
        }),
      );
      if (this.format() === 'pdf') this.notify.info(t.api.engine.reportPdfHint);
      this.closed.emit();
    } catch {
      // The error interceptor has shown why (a plan below Agency, 20 links already, ...); the dialog stays.
    } finally {
      this.busy.set(false);
    }
  }
}

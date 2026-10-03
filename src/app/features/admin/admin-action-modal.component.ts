import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { AdminAction, AdminStore } from '../../core/data/admin.store';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';

export interface AdminActionRequest {
  id: string;
  action: AdminAction;
  /** Transaction to refund; defaults to the latest plan price. */
  tx?: string;
}

// Confirm dialog for suspend / ban / refund / assist / restore, with an optional internal note.
@Component({
  selector: 'app-admin-action-modal',
  imports: [ModalComponent, InputFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="!!request()" [title]="title()" (closed)="closed.emit()">
      <p class="body">{{ body() }}</p>
      <app-input-field [label]="t().adm.note" [(value)]="note" />
      <div modal-footer>
        <button type="button" class="su-btn su-btn-sm su-btn-secondary" (click)="closed.emit()">
          {{ t().common.cancel }}
        </button>
        <button
          type="button"
          class="su-btn su-btn-sm"
          [class.su-btn-danger]="danger()"
          [class.su-btn-primary]="!danger()"
          (click)="confirm()"
        >
          {{ t().common.confirm }}
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    .body {
      margin: 0 0 12px;
      font-size: 14px;
    }
  `,
})
export class AdminActionModalComponent {
  readonly request = input<AdminActionRequest | null>(null);
  readonly closed = output<void>();

  private readonly admin = inject(AdminStore);
  private readonly notify = inject(NotificationService);
  protected readonly t = inject(I18nService).t;
  protected readonly note = signal('');

  protected readonly title = computed(() => {
    const r = this.request();
    const c = r ? this.admin.customer(r.id) : undefined;
    return r && c ? `${this.t().adm[r.action]} · ${c.name}` : '';
  });
  protected readonly body = computed(() => {
    const r = this.request();
    if (!r) return '';
    const keys = {
      suspend: 'aSuspend',
      ban: 'aBan',
      refund: 'aRefund',
      assist: 'aAssist',
      restore: 'aRestore',
    } as const;
    return this.t().adm[keys[r.action]];
  });
  protected readonly danger = computed(() =>
    ['ban', 'suspend'].includes(this.request()?.action ?? ''),
  );

  protected confirm(): void {
    const r = this.request();
    const c = r ? this.admin.customer(r.id) : undefined;
    if (!r || !c) return;
    this.admin.apply(r.id, r.action, r.tx);
    this.note.set('');
    this.closed.emit();
    this.notify.success(fmt(this.t().adm.done, { c: c.name, a: this.t().adm[r.action] }));
  }
}
